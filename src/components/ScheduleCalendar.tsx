import React, { useState, useEffect } from "react";
import { Calendar, momentLocalizer, SlotInfo } from "react-big-calendar";
import moment from "moment";
import "moment/locale/de";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  query,
  where,
  addDoc,
  deleteField,
} from "firebase/firestore";
import { FaPlus, FaTrash } from "react-icons/fa";

// Deutsche Lokalisierung für Moment
moment.locale("de");
const localizer = momentLocalizer(moment);

// Typendefinitionen
interface Break {
  startZeit: string;
  endZeit: string;
}

interface Shift {
  startZeit?: string;
  endZeit?: string;
  notizen: string;
  pausen: Break[];
}

interface Event {
  id: string;
  mitarbeiterName: string;
  start: Date;
  end: Date;
  isBreak: boolean;
  shift: Shift;
  allDay: boolean;
}

interface NewShiftData {
  mitarbeiterName: string;
  notizen: string;
  startZeit: string;
  endZeit: string;
  dateKey: string;
  pausen: Break[];
}

// Hilfsfunktion für Fehlermeldungen
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unbekannter Fehler";
}

// Berechnung der Gesamtstunden
const calculateTotalHours = (shift: Shift, dateKey: string): number => {
  if (!shift.startZeit || !shift.endZeit) return 0;
  const start = moment(`${dateKey} ${shift.startZeit}`, "YYYY-MM-DD HH:mm");
  const end = moment(`${dateKey} ${shift.endZeit}`, "YYYY-MM-DD HH:mm");
  let duration = end.diff(start, "hours", true);

  const breaks = shift.pausen || [];
  breaks.forEach((pause) => {
    const breakStart = moment(`${dateKey} ${pause.startZeit}`, "YYYY-MM-DD HH:mm");
    const breakEnd = moment(`${dateKey} ${pause.endZeit}`, "YYYY-MM-DD HH:mm");
    if (breakStart.isValid() && breakEnd.isValid()) {
      const overlapStart = moment.max(start, breakStart);
      const overlapEnd = moment.min(end, breakEnd);
      if (overlapStart.isBefore(overlapEnd)) {
        duration -= overlapEnd.diff(overlapStart, "hours", true);
      }
    }
  });

  return Math.max(duration, 0);
};

// Komponente
const ScheduleCalendar: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<"month" | "week">("week");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newShiftData, setNewShiftData] = useState<NewShiftData>({
    mitarbeiterName: "",
    notizen: "",
    startZeit: "",
    endZeit: "",
    dateKey: "",
    pausen: [],
  });
  const [showNewShiftForm, setShowNewShiftForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Datum und Zeit parsen
  const parseDate = (dateKey: string, time: string): Date => {
    const date = moment(dateKey, "YYYY-MM-DD");
    const [hours, minutes] = time.split(":").map(Number);
    return date.clone().set({ hour: hours, minute: minutes }).toDate();
  };

  // Schicht in Arbeits- und Pausenperioden aufteilen
  const splitShiftIntoPeriods = (shift: Shift, dateKey: string) => {
    const periods: { start: Date; end: Date; type: "work" | "break" }[] = [];
    if (!shift.startZeit || !shift.endZeit) return periods;
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

  // Daten aus Firestore abrufen
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein, um den Dienstplan zu sehen.");
      return;
    }

    const q = query(collection(db, "dienstplaene"), where("userID", "==", currentUser.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const eventData: Event[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const mitarbeiterName = data.mitarbeiterName || "Unbekannt";

          if (data.schichten && typeof data.schichten === "object") {
            Object.entries(data.schichten).forEach(([dateKey, shift]: [string, any]) => {
              if (shift.startZeit && shift.endZeit) {
                const periods = splitShiftIntoPeriods(shift, dateKey);
                periods.forEach((period, index) => {
                  eventData.push({
                    id: `${doc.id}|${dateKey}|${index}`,
                    mitarbeiterName,
                    start: period.start,
                    end: period.end,
                    isBreak: period.type === "break",
                    shift: {
                      startZeit: shift.startZeit,
                      endZeit: shift.endZeit,
                      notizen: shift.notizen || "",
                      pausen: shift.pausen || [],
                    },
                    allDay: false,
                  });
                });
              } else if (shift.notizen) {
                const start = moment(dateKey, "YYYY-MM-DD").startOf("day").toDate();
                const end = moment(dateKey, "YYYY-MM-DD").endOf("day").toDate();
                eventData.push({
                  id: `${doc.id}|${dateKey}|allDay`,
                  mitarbeiterName,
                  start,
                  end,
                  isBreak: false,
                  shift: { notizen: shift.notizen, pausen: shift.pausen || [] },
                  allDay: true,
                });
              }
            });
          }
        });
        setEvents(eventData);
        setError(null);
      },
      (error) => setError(`❌ Fehler beim Laden: ${getErrorMessage(error)}`)
    );
    return () => unsubscribe();
  }, []);

  // Farben für Mitarbeiter zuweisen
  const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF", "#33FFA1"];
  const employeeColors = new Map<string, string>();
  const uniqueEmployees = Array.from(new Set(events.map((e) => e.mitarbeiterName)));
  uniqueEmployees.forEach((name, index) => {
    employeeColors.set(name, colors[index % colors.length]);
  });

  // Navigationsfunktionen
  const goToNext = () =>
    setCurrentDate(moment(currentDate).add(1, view === "month" ? "months" : "weeks").toDate());
  const goToPrevious = () =>
    setCurrentDate(moment(currentDate).subtract(1, view === "month" ? "months" : "weeks").toDate());
  const goToToday = () => setCurrentDate(new Date());

  const formatDateRange = () => {
    if (view === "month") return moment(currentDate).format("MMMM YYYY");
    const startOfWeek = moment(currentDate).startOf("isoWeek");
    const endOfWeek = moment(currentDate).endOf("isoWeek");
    return `${startOfWeek.format("DD. MMM")} - ${endOfWeek.format("DD. MMM YYYY")}`;
  };

  // Event-Styling
  const eventPropGetter = (event: Event) => {
    const baseStyle = {
      borderRadius: "5px",
      opacity: 0.9,
      color: "white",
      padding: "4px",
      fontSize: "11px",
      whiteSpace: "normal" as const,
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    };
    if (event.isBreak) {
      return { style: { ...baseStyle, backgroundColor: "#ffcc00" } };
    }
    const isOverlapping = events.some(
      (e) =>
        e.id !== event.id &&
        e.mitarbeiterName === event.mitarbeiterName &&
        moment(event.start).isSame(e.start, "day") &&
        !e.isBreak &&
        !e.allDay
    );
    return {
      style: {
        ...baseStyle,
        backgroundColor: event.allDay
          ? "#d1d5db"
          : isOverlapping
          ? "#f87171"
          : employeeColors.get(event.mitarbeiterName) || "#60a5fa",
      },
    };
  };

  // Event-Rendering mit Tooltips
  const customEventRender = ({ event }: { event: Event }) => (
    <div className="truncate" title={event.shift.notizen}>
      {event.isBreak ? (
        <strong>Pause</strong>
      ) : (
        <>
          <strong>{event.mitarbeiterName}</strong>
          {event.allDay ? (
            <>
              <br />
              <em className="text-xs">{event.shift.notizen}</em>
            </>
          ) : (
            <>
              <br />
              {moment(event.start).format("HH:mm")} - {moment(event.end).format("HH:mm")}
              {event.shift.notizen && (
                <>
                  <br />
                  <em className="text-xs">{event.shift.notizen}</em>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  // Neue Schicht erstellen
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const dateKey = moment(slotInfo.start).format("YYYY-MM-DD");
    setNewShiftData({
      mitarbeiterName: "",
      notizen: "",
      startZeit: moment(slotInfo.start).format("HH:mm"),
      endZeit: moment(slotInfo.end).format("HH:mm"),
      dateKey,
      pausen: [],
    });
    setShowNewShiftForm(true);
  };

  const handleCreateShift = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }
    if (!newShiftData.mitarbeiterName) {
      setError("⚠ Mitarbeitername ist erforderlich.");
      return;
    }
    if ((newShiftData.startZeit && !newShiftData.endZeit) || (!newShiftData.startZeit && newShiftData.endZeit)) {
      setError("⚠ Start- und Endzeit müssen beide angegeben oder beide leer sein.");
      return;
    }

    setIsSaving(true);
    try {
      const { dateKey, startZeit, endZeit, notizen, mitarbeiterName, pausen } = newShiftData;
      const shiftData: Shift = { notizen, pausen };
      if (startZeit && endZeit) {
        shiftData.startZeit = startZeit;
        shiftData.endZeit = endZeit;
      }

      const q = query(
        collection(db, "dienstplaene"),
        where("userID", "==", currentUser.uid),
        where("mitarbeiterName", "==", mitarbeiterName)
      );
      const snapshot = await new Promise((resolve) => {
        const unsubscribe = onSnapshot(q, (snap) => {
          resolve(snap);
          unsubscribe();
        });
      });
      if ((snapshot as any).empty) {
        await addDoc(collection(db, "dienstplaene"), {
          mitarbeiterName,
          datum: Timestamp.fromDate(new Date(dateKey)),
          schichten: { [dateKey]: shiftData },
          userID: currentUser.uid,
        });
      } else {
        const docRef = doc(db, "dienstplaene", (snapshot as any).docs[0].id);
        await updateDoc(docRef, {
          [`schichten.${dateKey}`]: shiftData,
        });
      }
      setShowNewShiftForm(false);
      setError("✅ Schicht erfolgreich erstellt!");
    } catch (error) {
      setError(`❌ Fehler beim Erstellen: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Event auswählen
  const handleSelectEvent = (event: Event) => {
    if (event.isBreak) return;
    setSelectedEvent(event);
  };

  // Schicht speichern
  const handleSaveShift = async (eventId: string, updatedShift: Shift) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }
    const [docId, dateKey] = eventId.split("|");
    const docRef = doc(db, "dienstplaene", docId);
    setIsSaving(true);
    try {
      await updateDoc(docRef, {
        [`schichten.${dateKey}`]: updatedShift,
      });
      setError("✅ Schicht erfolgreich aktualisiert!");
      setSelectedEvent(null);
    } catch (error) {
      setError(`❌ Fehler beim Speichern: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Notizen löschen
  const handleDeleteNotizen = async (eventId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }
    const [docId, dateKey] = eventId.split("|");
    const docRef = doc(db, "dienstplaene", docId);
    setIsSaving(true);
    try {
      await updateDoc(docRef, {
        [`schichten.${dateKey}.notizen`]: "",
      });
      setError("✅ Notizen erfolgreich gelöscht!");
      setSelectedEvent(null);
    } catch (error) {
      setError(`❌ Fehler beim Löschen: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Schicht löschen
  const handleDeleteShift = async (eventId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }
    const [docId, dateKey] = eventId.split("|");
    const docRef = doc(db, "dienstplaene", docId);
    setIsSaving(true);
    try {
      await updateDoc(docRef, {
        [`schichten.${dateKey}`]: deleteField(), // Löscht das Schichtfeld
      });
      setError("✅ Schicht erfolgreich gelöscht!");
      setSelectedEvent(null);
    } catch (error) {
      setError(`❌ Fehler beim Löschen: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4">
      <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-lg">
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="flex items-center justify-between mb-6 space-y-4 flex-col md:flex-row">
          <div className="flex space-x-4">
            <button
              onClick={goToPrevious}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
              disabled={isSaving}
            >
              ⬅ Zurück
            </button>
            <button
              onClick={goToToday}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition text-sm"
            >
              📍 Heute
            </button>
            <button
              onClick={goToNext}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
              disabled={isSaving}
            >
              Weiter ➡
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 text-center">{formatDateRange()}</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => setView("week")}
              className={`px-4 py-2 rounded-lg transition ${
                view === "week" ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-800 hover:bg-gray-400"
              }`}
            >
              Wochenansicht
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-4 py-2 rounded-lg transition ${
                view === "month" ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-800 hover:bg-gray-400"
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
          messages={{ week: "Woche", month: "Monat", today: "Heute", previous: "Zurück", next: "Weiter" }}
        />

        {/* Modal für neue Schicht */}
        {showNewShiftForm && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-lg w-1/3">
              <h3 className="text-xl font-semibold mb-4">Neue Schicht erstellen</h3>
              <input
                type="text"
                placeholder="Mitarbeitername"
                value={newShiftData.mitarbeiterName}
                onChange={(e) => setNewShiftData({ ...newShiftData, mitarbeiterName: e.target.value })}
                className="w-full p-2 border rounded mb-2"
              />
              <input
                type="time"
                value={newShiftData.startZeit}
                onChange={(e) => setNewShiftData({ ...newShiftData, startZeit: e.target.value })}
                className="w-full p-2 border rounded mb-2"
              />
              <input
                type="time"
                value={newShiftData.endZeit}
                onChange={(e) => setNewShiftData({ ...newShiftData, endZeit: e.target.value })}
                className="w-full p-2 border rounded mb-2"
              />
              <textarea
                placeholder="Notizen"
                value={newShiftData.notizen}
                onChange={(e) => setNewShiftData({ ...newShiftData, notizen: e.target.value })}
                className="w-full p-2 border rounded mb-4"
                rows={2}
              />
              <div className="mb-4">
                <h4 className="text-lg font-semibold">Pausen</h4>
                {newShiftData.pausen.map((pause, index) => (
                  <div key={index} className="flex space-x-2 mb-2 items-center">
                    <input
                      type="time"
                      value={pause.startZeit}
                      onChange={(e) => {
                        const updatedPausen = newShiftData.pausen.map((p, i) =>
                          i === index ? { ...p, startZeit: e.target.value } : p
                        );
                        setNewShiftData({ ...newShiftData, pausen: updatedPausen });
                      }}
                      className="p-2 border rounded w-1/2"
                    />
                    <input
                      type="time"
                      value={pause.endZeit}
                      onChange={(e) => {
                        const updatedPausen = newShiftData.pausen.map((p, i) =>
                          i === index ? { ...p, endZeit: e.target.value } : p
                        );
                        setNewShiftData({ ...newShiftData, pausen: updatedPausen });
                      }}
                      className="p-2 border rounded w-1/2"
                    />
                    <button
                      onClick={() => {
                        const updatedPausen = newShiftData.pausen.filter((_, i) => i !== index);
                        setNewShiftData({ ...newShiftData, pausen: updatedPausen });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setNewShiftData({
                      ...newShiftData,
                      pausen: [...newShiftData.pausen, { startZeit: "", endZeit: "" }],
                    })
                  }
                  className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-lg flex items-center space-x-1 shadow-md transition text-sm"
                >
                  <FaPlus /> <span>Pause hinzufügen</span>
                </button>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={handleCreateShift}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
                  disabled={isSaving}
                >
                  Speichern
                </button>
                <button
                  onClick={() => setShowNewShiftForm(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                  disabled={isSaving}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal für Schicht bearbeiten */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-lg w-1/3">
              <h3 className="text-xl font-semibold mb-4">Schicht bearbeiten</h3>
              <textarea
                value={selectedEvent.shift.notizen}
                onChange={(e) =>
                  setSelectedEvent({ ...selectedEvent, shift: { ...selectedEvent.shift, notizen: e.target.value } })
                }
                className="w-full p-2 border rounded mb-4"
                rows={4}
                placeholder="Notizen hier eingeben..."
              />
              <div className="mb-4">
                <h4 className="text-lg font-semibold">Pausen</h4>
                {selectedEvent.shift.pausen.map((pause, index) => (
                  <div key={index} className="flex space-x-2 mb-2 items-center">
                    <input
                      type="time"
                      value={pause.startZeit}
                      onChange={(e) => {
                        const updatedPausen = selectedEvent.shift.pausen.map((p, i) =>
                          i === index ? { ...p, startZeit: e.target.value } : p
                        );
                        setSelectedEvent({ ...selectedEvent, shift: { ...selectedEvent.shift, pausen: updatedPausen } });
                      }}
                      className="p-2 border rounded w-1/2"
                    />
                    <input
                      type="time"
                      value={pause.endZeit}
                      onChange={(e) => {
                        const updatedPausen = selectedEvent.shift.pausen.map((p, i) =>
                          i === index ? { ...p, endZeit: e.target.value } : p
                        );
                        setSelectedEvent({ ...selectedEvent, shift: { ...selectedEvent.shift, pausen: updatedPausen } });
                      }}
                      className="p-2 border rounded w-1/2"
                    />
                    <button
                      onClick={() => {
                        const updatedPausen = selectedEvent.shift.pausen.filter((_, i) => i !== index);
                        setSelectedEvent({ ...selectedEvent, shift: { ...selectedEvent.shift, pausen: updatedPausen } });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSelectedEvent({
                      ...selectedEvent,
                      shift: { ...selectedEvent.shift, pausen: [...selectedEvent.shift.pausen, { startZeit: "", endZeit: "" }] },
                    })
                  }
                  className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-lg flex items-center space-x-1 shadow-md transition text-sm"
                >
                  <FaPlus /> <span>Pause hinzufügen</span>
                </button>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => handleSaveShift(selectedEvent.id, selectedEvent.shift)}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
                  disabled={isSaving}
                >
                  Speichern
                </button>
                <button
                  onClick={() => handleDeleteNotizen(selectedEvent.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
                  disabled={isSaving}
                >
                  Notizen löschen
                </button>
                <button
                  onClick={() => handleDeleteShift(selectedEvent.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                  disabled={isSaving}
                >
                  Schicht löschen
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                  disabled={isSaving}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}
        {isSaving && <div className="p-4 text-center text-yellow-500">Speichere Änderungen...</div>}
      </div>
    </div>
  );
};

export default ScheduleCalendar;