import React, { useState, useEffect } from "react";
import { Calendar, momentLocalizer, SlotInfo } from "react-big-calendar";
import moment from "moment";
import "moment/locale/de";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  doc,
  Timestamp,
  deleteField,
} from "firebase/firestore";

moment.locale("de");
const localizer = momentLocalizer(moment);

interface Break {
  startZeit: string;
  endZeit: string;
}

interface Shift {
  startZeit: string;
  endZeit: string;
  notizen: string;
  pausen: Break[];
}

interface Event {
  id: string;
  mitarbeiterName: string;
  start: Date;
  end: Date;
  isBreak: boolean;
  notizen: string;
}

const ScheduleCalendar: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<"month" | "week">("week");

  // Hilfsfunktion zum Parsen von Datum und Zeit
  const parseDate = (dateKey: string, time: any): Date => {
    if (time instanceof Timestamp) {
      return time.toDate();
    } else if (typeof time === "string") {
      const date = moment(dateKey, "YYYY-MM-DD");
      const [hours, minutes] = time.split(":");
      return date
        .clone()
        .set({ hour: parseInt(hours), minute: parseInt(minutes) })
        .toDate();
    } else {
      console.error("Ungültiges Zeitformat:", time);
      return new Date();
    }
  };

  // Schicht in Arbeits- und Pausenzeiten aufteilen
  const splitShiftIntoPeriods = (shift: Shift, dateKey: string) => {
    const periods: { start: Date; end: Date; type: "work" | "break" }[] = [];
    const start = parseDate(dateKey, shift.startZeit);
    const end = parseDate(dateKey, shift.endZeit);
    const breaks = shift.pausen || [];

    breaks.sort((a, b) => a.startZeit.localeCompare(b.startZeit));
    let currentStart = start;

    breaks.forEach((pause) => {
      const breakStart = parseDate(dateKey, pause.startZeit);
      const breakEnd = parseDate(dateKey, pause.endZeit);
      if (breakStart > currentStart) {
        periods.push({ start: currentStart, end: breakStart, type: "work" });
      }
      periods.push({ start: breakStart, end: breakEnd, type: "break" });
      currentStart = breakEnd;
    });

    if (currentStart < end) {
      periods.push({ start: currentStart, end, type: "work" });
    }
    return periods;
  };

  // Firestore-Daten abrufen
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "dienstplaene"),
      (snapshot) => {
        const eventData: Event[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const mitarbeiterName = data.mitarbeiterName || "Unbekannt";

          if (data.schichten && typeof data.schichten === "object") {
            Object.entries(data.schichten).forEach(([dateKey, shift]: [string, any]) => {
              const periods = splitShiftIntoPeriods(shift, dateKey);
              periods.forEach((period, index) => {
                eventData.push({
                  id: `${doc.id}|${dateKey}|${index}`,
                  mitarbeiterName,
                  start: period.start,
                  end: period.end,
                  isBreak: period.type === "break",
                  notizen: period.type === "break" ? "Pause" : shift.notizen || "",
                });
              });
            });
          }
        });
        setEvents(eventData);
      },
      (error) => {
        console.error("Fehler beim Abrufen der Schichten:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Farben für Mitarbeiter
  const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF", "#33FFA1"];
  const employeeColors = new Map<string, string>();
  const uniqueEmployees = Array.from(new Set(events.map((e) => e.mitarbeiterName)));
  uniqueEmployees.forEach((name, index) => {
    employeeColors.set(name, colors[index % colors.length]);
  });

  // Navigation
  const goToNext = () =>
    setCurrentDate(
      moment(currentDate)
        .add(1, view === "month" ? "months" : "weeks")
        .toDate()
    );
  const goToPrevious = () =>
    setCurrentDate(
      moment(currentDate)
        .subtract(1, view === "month" ? "months" : "weeks")
        .toDate()
    );
  const goToToday = () => setCurrentDate(new Date());

  const formatDateRange = () => {
    if (view === "month") {
      return moment(currentDate).format("MMMM YYYY");
    }
    const startOfWeek = moment(currentDate).startOf("isoWeek");
    const endOfWeek = moment(currentDate).endOf("isoWeek");
    return `${startOfWeek.format("D. MMM")} - ${endOfWeek.format("D. MMM")}`;
  };

  // Event-Styling
  const eventPropGetter = (event: Event) => {
    const baseStyle = {
      borderRadius: "5px",
      opacity: 0.9,
      color: "white",
      padding: "4px",
      fontSize: "11px",
      whiteSpace: "normal",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    };
    if (event.isBreak) {
      return {
        style: { ...baseStyle, backgroundColor: "#ffcc00" }, // Gelb für Pausen
      };
    }
    const isOverlapping = events.some(
      (e) =>
        e.id !== event.id &&
        e.mitarbeiterName === event.mitarbeiterName &&
        moment(event.start).isSame(e.start, "day") &&
        !e.isBreak
    );
    return {
      style: {
        ...baseStyle,
        backgroundColor: isOverlapping
          ? "#f87171"
          : employeeColors.get(event.mitarbeiterName) || "#60a5fa",
      },
    };
  };

  // Event-Rendering
  const customEventRender = ({ event }: { event: Event }) => (
    <div className="truncate">
      {event.isBreak ? (
        <strong>Pause</strong>
      ) : (
        <>
          <strong>{event.mitarbeiterName}</strong>
          <br />
          {moment(event.start).format("HH:mm")} - {moment(event.end).format("HH:mm")}
          {event.notizen && (
            <>
              <br />
              <em className="text-xs">{event.notizen}</em>
            </>
          )}
        </>
      )}
    </div>
  );

  // Neue Schicht erstellen
  const handleSelectSlot = async (slotInfo: SlotInfo) => {
    if (!auth.currentUser) {
      alert("⚠ Bitte logge dich ein, um eine Schicht zu erstellen.");
      return;
    }
    const mitarbeiterName = prompt("Mitarbeitername:");
    if (!mitarbeiterName) return;

    const notizen = prompt("Notizen (optional):") || "";
    const startZeit = new Date(slotInfo.start);
    const endZeit = new Date(startZeit.getTime() + 2 * 60 * 60 * 1000);
    const dateKey = moment(startZeit).format("YYYY-MM-DD");

    const docRef = doc(db, "dienstplaene", mitarbeiterName);
    try {
      await updateDoc(docRef, {
        [`schichten.${dateKey}`]: {
          startZeit: moment(startZeit).format("HH:mm"),
          endZeit: moment(endZeit).format("HH:mm"),
          notizen,
          pausen: [],
        },
      });
    } catch (error: any) {
      if (error.code === "not-found") {
        await setDoc(docRef, {
          mitarbeiterName,
          schichten: {
            [dateKey]: {
              startZeit: moment(startZeit).format("HH:mm"),
              endZeit: moment(endZeit).format("HH:mm"),
              notizen,
              pausen: [],
            },
          },
        });
      } else {
        console.error("Fehler beim Erstellen der Schicht:", error);
        alert("Fehler beim Speichern der Schicht.");
      }
    }
  };

  // Schicht löschen
  const handleDeleteEvent = async (eventId: string) => {
    if (!auth.currentUser) {
      alert("⚠ Bitte logge dich ein, um eine Schicht zu löschen.");
      return;
    }
    const [docId, dateKey] = eventId.split("|");
    const docRef = doc(db, "dienstplaene", docId);
    try {
      await updateDoc(docRef, { [`schichten.${dateKey}`]: deleteField() });
      alert("✅ Schicht erfolgreich gelöscht!");
    } catch (error) {
      console.error("Fehler beim Löschen der Schicht:", error);
      alert("Fehler beim Löschen der Schicht.");
    }
  };

  const handleSelectEvent = (event: Event) => {
    if (event.isBreak) return; // Pausen nicht direkt löschbar
    if (!auth.currentUser) {
      alert("⚠ Bitte logge dich ein, um eine Schicht zu löschen.");
      return;
    }
    if (window.confirm("Möchten Sie diese Schicht wirklich löschen?")) {
      handleDeleteEvent(event.id);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-5xl mx-auto">
      <div className="flex flex-col items-center mb-6 bg-gray-100 p-4 rounded-lg shadow-sm">
        <div className="flex space-x-4 mb-3">
          <button
            onClick={goToPrevious}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition"
          >
            ⬅ Zurück
          </button>
          <button
            onClick={goToToday}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition"
          >
            📍 Heute
          </button>
          <button
            onClick={goToNext}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition"
          >
            Weiter ➡
          </button>
        </div>
        <h3 className="text-xl font-semibold text-gray-700">{formatDateRange()}</h3>
        <div className="flex space-x-4 mt-3">
          <button
            onClick={() => setView("week")}
            className={`px-4 py-2 rounded-lg transition ${
              view === "week"
                ? "bg-blue-600 text-white"
                : "bg-gray-300 text-gray-800 hover:bg-gray-400"
            }`}
          >
            Wochenansicht
          </button>
          <button
            onClick={() => setView("month")}
            className={`px-4 py-2 rounded-lg transition ${
              view === "month"
                ? "bg-blue-600 text-white"
                : "bg-gray-300 text-gray-800 hover:bg-gray-400"
            }`}
          >
            Monatsansicht
          </button>
        </div>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500 }}
        selectable
        views={["month", "week"]}
        view={view}
        date={currentDate}
        onNavigate={(newDate) => setCurrentDate(newDate)}
        toolbar={false}
        eventPropGetter={eventPropGetter}
        components={{ event: customEventRender }}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        messages={{
          week: "Woche",
          month: "Monat",
          today: "Heute",
          previous: "Zurück",
          next: "Weiter",
        }}
      />
    </div>
  );
};

export default ScheduleCalendar;