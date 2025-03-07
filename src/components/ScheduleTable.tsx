import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import moment from "moment";
import "moment/locale/de";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { FaPlus, FaFilePdf, FaTrash } from "react-icons/fa";

// Deutsche Lokalisierung für Moment
moment.locale("de");

// Typendefinitionen
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

interface EmployeeShift {
  id: string;
  mitarbeiterName: string;
  datum: Timestamp;
  startZeit: Timestamp;
  endZeit: Timestamp;
  schichten: { [date: string]: Shift };
}

interface DoppelstundenEinstellung {
  id: number;
  wochentag: number; // 0 = Sonntag, 1 = Montag, ..., 6 = Samstag
  startZeit: string; // Format: "HH:mm"
  endZeit: string;   // Format: "HH:mm"
}

interface ScheduleTableProps {
  doppelstundenEinstellungen: DoppelstundenEinstellung[];
}

// Hilfsfunktion für Fehlermeldungen
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Funktion zum Berechnen des Montags der aktuellen Woche
const getMonday = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return monday;
};

const ScheduleTable: React.FC<ScheduleTableProps> = ({ doppelstundenEinstellungen }) => {
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [startDate, setStartDate] = useState<Date>(getMonday(new Date()));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) =>
      moment(startDate).add(i, "days").format("YYYY-MM-DD")
    );
  }, [startDate]);

  // Debounce-Funktion
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Funktion zum Aktualisieren des Mitarbeiternamens
  const handleNameUpdate = async (id: string, newName: string) => {
    if (!auth.currentUser) {
      setError("⚠ Bitte logge dich ein, um Änderungen zu speichern.");
      return;
    }
    setIsSaving(true);
    try {
      const shiftRef = doc(db, "dienstplaene", id);
      await updateDoc(shiftRef, { mitarbeiterName: newName });
    } catch (error) {
      setError(`❌ Fehler beim Aktualisieren des Namens: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Funktion zum Aktualisieren der Schichten
  const handleUpdate = useCallback(
    debounce(async (id: string, day: string, updatedShift: Shift) => {
      if (!auth.currentUser) {
        setError("⚠ Bitte logge dich ein, um Änderungen zu speichern.");
        return;
      }
      setIsSaving(true);
      try {
        const shiftRef = doc(db, "dienstplaene", id);
        await updateDoc(shiftRef, {
          [`schichten.${day}`]: updatedShift,
        });
      } catch (error) {
        setError(`❌ Fehler beim Aktualisieren: ${getErrorMessage(error)}`);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  // Funktion zum Hinzufügen einer Pause
  const addBreak = (employeeId: string, day: string) => {
    setShifts((prevShifts) =>
      prevShifts.map((s) =>
        s.id === employeeId
          ? {
              ...s,
              schichten: {
                ...s.schichten,
                [day]: {
                  ...s.schichten[day] || { startZeit: "", endZeit: "", notizen: "", pausen: [] },
                  pausen: [...(s.schichten[day]?.pausen || []), { startZeit: "", endZeit: "" }],
                },
              },
            }
          : s
      )
    );
  };

  // Funktion zum Entfernen einer Pause
  const removeBreak = (employeeId: string, day: string, pauseIndex: number) => {
    setShifts((prevShifts) =>
      prevShifts.map((s) =>
        s.id === employeeId
          ? {
              ...s,
              schichten: {
                ...s.schichten,
                [day]: {
                  ...s.schichten[day],
                  pausen: s.schichten[day].pausen.filter((_, i) => i !== pauseIndex),
                },
              },
            }
          : s
      )
    );
    const updatedShift = shifts.find((s) => s.id === employeeId)?.schichten[day];
    if (updatedShift) {
      handleUpdate(employeeId, day, updatedShift);
    }
  };

  // Funktion zum Löschen eines Mitarbeiters
  const handleDelete = async (id: string) => {
    if (!auth.currentUser) {
      setError("⚠ Bitte logge dich ein, um zu löschen.");
      return;
    }
    if (!window.confirm("Bist du sicher, dass du diesen Mitarbeiter löschen möchtest?")) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "dienstplaene", id));
    } catch (error) {
      setError(`❌ Fehler beim Löschen: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Funktion zum Erstellen eines neuen Mitarbeiters
  const handleCreate = async () => {
    if (!auth.currentUser) {
      setError("⚠ Bitte logge dich ein, um einen neuen Mitarbeiter hinzuzufügen.");
      return;
    }
    setIsSaving(true);
    try {
      const newEmployee = {
        mitarbeiterName: "Neuer Mitarbeiter",
        datum: Timestamp.fromDate(new Date()),
        startZeit: Timestamp.fromDate(new Date()),
        endZeit: Timestamp.fromDate(new Date()),
        schichten: {},
        notizen: "",
        plattform: "web",
        doppelstunde: false,
      };
      const docRef = await addDoc(collection(db, "dienstplaene"), newEmployee);
      // Synchronisiere den State sofort mit dem neuen Mitarbeiter
      setShifts((prevShifts) => [
        ...prevShifts,
        {
          ...newEmployee,
          id: docRef.id,
          schichten: {},
        },
      ]);
      console.log("Neuer Mitarbeiter hinzugefügt mit ID:", docRef.id);
    } catch (error) {
      setError(`❌ Fehler beim Erstellen des Mitarbeiters: ${getErrorMessage(error)}`);
      console.error("Fehlerdetails:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Berechnung der Gesamtstunden mit Pausen
  const calculateTotalHours = (employee: EmployeeShift, weekDays: string[]) => {
    let totalHours = 0;
    weekDays.forEach((day) => {
      const shift = employee.schichten[day];
      if (shift && shift.startZeit && shift.endZeit) {
        const start = moment(shift.startZeit, "HH:mm");
        const end = moment(shift.endZeit, "HH:mm");
        let shiftDuration = end.diff(start, "hours", true);

        const breaks = shift.pausen || [];
        breaks.forEach((pause) => {
          const breakStart = moment(pause.startZeit, "HH:mm");
          const breakEnd = moment(pause.endZeit, "HH:mm");
          if (breakStart.isValid() && breakEnd.isValid() && breakStart.isBefore(end) && breakEnd.isAfter(start)) {
            const overlapStart = moment.max(start, breakStart);
            const overlapEnd = moment.min(end, breakEnd);
            shiftDuration -= overlapEnd.diff(overlapStart, "hours", true);
          }
        });

        const wochentag = moment(day).day();
        const doppelstunde = doppelstundenEinstellungen.find((e) => e.wochentag === wochentag);
        if (doppelstunde) {
          const doppelStart = moment(doppelstunde.startZeit, "HH:mm");
          const doppelEnd = moment(doppelstunde.endZeit, "HH:mm");
          const overlapStart = moment.max(start, doppelStart);
          const overlapEnd = moment.min(end, doppelEnd);
          if (overlapStart.isBefore(overlapEnd)) {
            let overlapHours = overlapEnd.diff(overlapStart, "hours", true);
            breaks.forEach((pause) => {
              const breakStart = moment(pause.startZeit, "HH:mm");
              const breakEnd = moment(pause.endZeit, "HH:mm");
              const breakOverlapStart = moment.max(overlapStart, breakStart);
              const breakOverlapEnd = moment.min(overlapEnd, breakEnd);
              if (breakOverlapStart.isBefore(breakOverlapEnd)) {
                overlapHours -= breakOverlapEnd.diff(breakOverlapStart, "hours", true);
              }
            });
            shiftDuration += overlapHours;
          }
        }
        totalHours += shiftDuration > 0 ? shiftDuration : 0;
      }
    });
    return totalHours.toFixed(2);
  };

  // Daten aus Firestore abrufen
  useEffect(() => {
    if (!auth.currentUser) {
      setError("⚠ Bitte logge dich ein, um den Dienstplan zu sehen.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "dienstplaene"),
      (snapshot) => {
        const shiftData: EmployeeShift[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            mitarbeiterName: data.mitarbeiterName || "Unbekannt",
            datum: data.datum || Timestamp.fromDate(new Date()),
            startZeit: data.startZeit || Timestamp.fromDate(new Date()),
            endZeit: data.endZeit || Timestamp.fromDate(new Date()),
            schichten: data.schichten || {},
          };
        });
        setShifts(shiftData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        setError(`❌ Fehler beim Laden der Daten: ${getErrorMessage(error)}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Export als PDF ohne Aktionen
  const exportToPDF = async () => {
    const table = document.querySelector("table") as HTMLElement;
    if (!table) return;
    try {
      const actionsColumns = table.querySelectorAll(".actions-column");
      actionsColumns.forEach((col) => ((col as HTMLElement).style.display = "none"));

      const canvas = await html2canvas(table, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      actionsColumns.forEach((col) => ((col as HTMLElement).style.display = ""));

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save("dienstplan_wochenplan.pdf");
    } catch (error) {
      setError(`❌ Fehler beim Exportieren als PDF: ${getErrorMessage(error)}`);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500">Lade Daten...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-6 space-y-4 flex-col md:flex-row">
          <div className="flex space-x-4">
            <button
              onClick={() => setStartDate(new Date(startDate.setDate(startDate.getDate() - 7)))}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
              disabled={isSaving}
            >
              ⬅ Vorherige Woche
            </button>
            <button
              onClick={() => setStartDate(new Date(startDate.setDate(startDate.getDate() + 7)))}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
              disabled={isSaving}
            >
              Nächste Woche ➡
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 text-center">
            {moment(startDate).format("DD.MM.YYYY")} -{" "}
            {moment(startDate).add(6, "days").format("DD.MM.YYYY")}
          </h2>
          <div className="flex space-x-4">
            <button
              onClick={handleCreate}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full flex items-center space-x-2 shadow-md transition"
              disabled={isSaving}
            >
              <FaPlus /> <span>Neuer Mitarbeiter</span>
            </button>
            <button
              onClick={exportToPDF}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-full flex items-center space-x-2 shadow-md transition"
              disabled={isSaving}
            >
              <FaFilePdf /> <span>Als PDF exportieren</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white shadow-md rounded-lg">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="p-2 border w-[120px]">Mitarbeiter</th>
                {weekDays.map((day, index) => (
                  <th key={index} className="p-2 border w-[50px] text-xs">
                    {moment(day).format("ddd, DD.MM.")}
                  </th>
                ))}
                <th className="p-2 border w-[50px] text-xs">Gesamtstunden</th>
                <th className="p-2 border w-[50px] actions-column text-xs">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-2 border w-[120px]">
                    <input
                      type="text"
                      value={shift.mitarbeiterName}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setShifts((prevShifts) =>
                          prevShifts.map((s) =>
                            s.id === shift.id ? { ...s, mitarbeiterName: newName } : s
                          )
                        );
                      }}
                      onBlur={() => handleNameUpdate(shift.id, shift.mitarbeiterName)}
                      className="w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={isSaving}
                    />
                  </td>
                  {weekDays.map((day, index) => (
                    <td key={index} className="p-2 border text-center w-[50px]">
                      <input
                        type="time"
                        value={shift.schichten[day]?.startZeit || ""}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setShifts((prevShifts) =>
                            prevShifts.map((s) =>
                              s.id === shift.id
                                ? {
                                    ...s,
                                    schichten: {
                                      ...s.schichten,
                                      [day]: {
                                        ...s.schichten[day] || {
                                          startZeit: "",
                                          endZeit: "",
                                          notizen: "",
                                          pausen: [],
                                        },
                                        startZeit: newValue,
                                      },
                                    },
                                  }
                                : s
                            )
                          );
                        }}
                        onBlur={() =>
                          handleUpdate(shift.id, day, shift.schichten[day] || {
                            startZeit: "",
                            endZeit: "",
                            notizen: "",
                            pausen: [],
                          })
                        }
                        className="w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        disabled={isSaving}
                      />
                      <input
                        type="time"
                        value={shift.schichten[day]?.endZeit || ""}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setShifts((prevShifts) =>
                            prevShifts.map((s) =>
                              s.id === shift.id
                                ? {
                                    ...s,
                                    schichten: {
                                      ...s.schichten,
                                      [day]: {
                                        ...s.schichten[day] || {
                                          startZeit: "",
                                          endZeit: "",
                                          notizen: "",
                                          pausen: [],
                                        },
                                        endZeit: newValue,
                                      },
                                    },
                                  }
                                : s
                            )
                          );
                        }}
                        onBlur={() =>
                          handleUpdate(shift.id, day, shift.schichten[day] || {
                            startZeit: "",
                            endZeit: "",
                            notizen: "",
                            pausen: [],
                          })
                        }
                        className="w-full p-1 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        disabled={isSaving}
                      />
                      <textarea
                        value={shift.schichten[day]?.notizen || ""}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setShifts((prevShifts) =>
                            prevShifts.map((s) =>
                              s.id === shift.id
                                ? {
                                    ...s,
                                    schichten: {
                                      ...s.schichten,
                                      [day]: {
                                        ...s.schichten[day] || {
                                          startZeit: "",
                                          endZeit: "",
                                          notizen: "",
                                          pausen: [],
                                        },
                                        notizen: newValue,
                                      },
                                    },
                                  }
                                : s
                            )
                          );
                        }}
                        onBlur={() =>
                          handleUpdate(shift.id, day, shift.schichten[day] || {
                            startZeit: "",
                            endZeit: "",
                            notizen: "",
                            pausen: [],
                          })
                        }
                        className="w-full p-1 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        placeholder="Notizen"
                        rows={2}
                        disabled={isSaving}
                      />
                      <div className="mt-1">
                        <h4 className="text-xs font-semibold">Pausen</h4>
                        {shift.schichten[day]?.pausen?.map((pause, pauseIndex) => (
                          <div key={pauseIndex} className="flex space-x-1 mt-1 items-center">
                            <input
                              type="time"
                              value={pause.startZeit || ""}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setShifts((prevShifts) =>
                                  prevShifts.map((s) =>
                                    s.id === shift.id
                                      ? {
                                          ...s,
                                          schichten: {
                                            ...s.schichten,
                                            [day]: {
                                              ...s.schichten[day],
                                              pausen: s.schichten[day].pausen.map((p, i) =>
                                                i === pauseIndex ? { ...p, startZeit: newValue } : p
                                              ),
                                            },
                                          },
                                        }
                                      : s
                                  )
                                );
                              }}
                              onBlur={() => handleUpdate(shift.id, day, shift.schichten[day])}
                              className="w-1/2 p-1 border rounded text-xs"
                            />
                            <input
                              type="time"
                              value={pause.endZeit || ""}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setShifts((prevShifts) =>
                                  prevShifts.map((s) =>
                                    s.id === shift.id
                                      ? {
                                          ...s,
                                          schichten: {
                                            ...s.schichten,
                                            [day]: {
                                              ...s.schichten[day],
                                              pausen: s.schichten[day].pausen.map((p, i) =>
                                                i === pauseIndex ? { ...p, endZeit: newValue } : p
                                              ),
                                            },
                                          },
                                        }
                                      : s
                                  )
                                );
                              }}
                              onBlur={() => handleUpdate(shift.id, day, shift.schichten[day])}
                              className="w-1/2 p-1 border rounded text-xs"
                            />
                            <button
                              onClick={() => removeBreak(shift.id, day, pauseIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addBreak(shift.id, day)}
                          className="mt-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-full flex items-center space-x-1 shadow-md transition text-xs"
                        >
                          <FaPlus /> <span>Pause hinzufügen</span>
                        </button>
                      </div>
                    </td>
                  ))}
                  <td className="p-2 border text-center w-[50px] text-xs">
                    {calculateTotalHours(shift, weekDays)}
                  </td>
                  <td className="p-2 border w-[50px] actions-column">
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded-full flex items-center space-x-1 shadow-md transition text-xs"
                      disabled={isSaving}
                    >
                      <FaTrash /> <span>Löschen</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isSaving && (
          <div className="p-4 text-center text-yellow-500">Speichere Änderungen...</div>
        )}
      </div>
    </div>
  );
};

export default ScheduleTable;