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
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import "moment/locale/de";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaPlus, FaFilePdf, FaTrash } from "react-icons/fa";

moment.locale("de");

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
  userID: string;
}

interface DoppelstundenEinstellung {
  id: number;
  wochentag: number;
  startZeit: string;
  endZeit: string;
}

interface ScheduleTableProps {
  doppelstundenEinstellungen: DoppelstundenEinstellung[];
  onScheduleUpdate: (shifts: EmployeeShift[], weekDays: string[]) => void;
}

const FaPlusIcon = FaPlus as unknown as React.FC;
const FaFilePdfIcon = FaFilePdf as unknown as React.FC;
const FaTrashIcon = FaTrash as unknown as React.FC;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const getMonday = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return monday;
};

const ScheduleTable: React.FC<ScheduleTableProps> = ({ doppelstundenEinstellungen, onScheduleUpdate }) => {
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

  // Schichten und Wochentage an Dashboard weitergeben
  useEffect(() => {
    onScheduleUpdate(shifts, weekDays);
  }, [shifts, weekDays, onScheduleUpdate]);

  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const handleNameUpdate = async (id: string, newName: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
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

  const handleUpdate = useCallback(
    debounce(async (id: string, day: string, updatedShift: Shift) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
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

  const handleDelete = async (id: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
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

  const handleCreate = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
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
        userID: currentUser.uid,
      };
      const docRef = await addDoc(collection(db, "dienstplaene"), newEmployee);
      setShifts((prevShifts) => [
        ...prevShifts,
        {
          ...newEmployee,
          id: docRef.id,
          schichten: {},
        },
      ]);
    } catch (error) {
      setError(`❌ Fehler beim Erstellen des Mitarbeiters: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

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

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein, um den Dienstplan zu sehen.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "dienstplaene"),
      where("userID", "==", currentUser.uid)
    );
    const unsubscribe = onSnapshot(
      q,
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
            userID: data.userID,
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

  const exportToPDF = () => {
    if (shifts.length === 0) {
      setError("❌ Keine Daten zum Exportieren vorhanden.");
      return;
    }

    const headers = ["Mitarbeiter", ...weekDays.map((day) => moment(day).format("ddd, DD.MM.")), "Gesamtstunden"];

    const body = shifts.map((shift) => {
      const employeeName = shift.mitarbeiterName;
      const totalHours = calculateTotalHours(shift, weekDays);
      const dayCells = weekDays.map((day) => {
        const schicht = shift.schichten[day];
        if (!schicht) return "";
        const start = schicht.startZeit || "";
        const end = schicht.endZeit || "";
        const notizen = schicht.notizen || "";
        const pausen = schicht.pausen?.map((p) => `- ${p.startZeit} - ${p.endZeit}`).join("\n") || "";
        return `Start: ${start}\nEnde: ${end}\nNotizen: ${notizen}\nPausen:\n${pausen}`;
      });
      return [employeeName, ...dayCells, totalHours];
    });

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    autoTable(pdf, {
      head: [headers],
      body: body,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 30 },
        8: { cellWidth: 20 },
      },
      margin: { top: 10 },
      rowPageBreak: "avoid",
    });

    pdf.save(`dienstplan_${moment(startDate).format("DD.MM.YYYY")}.pdf`);
  };

  if (loading) return <div className="p-4 text-center text-gray-500">Lade Daten...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="bg-gray-100 min-h-screen p-4">
      <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-6 space-y-4 flex-col md:flex-row">
          <div className="flex space-x-4">
            <button
              onClick={() => setStartDate(new Date(startDate.setDate(startDate.getDate() - 7)))}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
              disabled={isSaving}
            >
              ⬅ Vorherige Woche
            </button>
            <button
              onClick={() => setStartDate(new Date(startDate.setDate(startDate.getDate() + 7)))}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
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
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 shadow-md transition text-sm"
              disabled={isSaving}
            >
              <FaPlusIcon /> <span>Neuer Mitarbeiter</span>
            </button>
            <button
              onClick={exportToPDF}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 shadow-md transition text-sm"
              disabled={isSaving}
            >
              <FaFilePdfIcon /> <span>Als PDF exportieren</span>
            </button>
          </div>
        </div>

        <div className="relative overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full min-w-[1200px] border-collapse bg-white shadow-md rounded-lg text-sm">
            <thead className="sticky top-0 bg-gray-200 text-gray-700">
              <tr>
                <th className="p-3 border w-[120px] text-left">Mitarbeiter</th>
                {weekDays.map((day, index) => (
                  <th key={index} className="p-3 border w-[150px] text-center">
                    {moment(day).format("ddd, DD.MM.")}
                  </th>
                ))}
                <th className="p-3 border w-[100px] text-center">Gesamtstunden</th>
                <th className="p-3 border w-[100px] text-center">Aktionen</th>
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
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={isSaving}
                    />
                  </td>
                  {weekDays.map((day, index) => (
                    <td key={index} className="p-2 border text-center w-[150px]">
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
                        className="w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                        className="w-full p-1 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                        className="w-full p-1 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Notizen"
                        rows={2}
                        disabled={isSaving}
                      />
                      <div className="mt-2">
                        <h4 className="text-sm font-semibold">Pausen</h4>
                        {shift.schichten[day]?.pausen?.map((pause, pauseIndex) => (
                          <div key={pauseIndex} className="flex space-x-2 mt-1 items-center">
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
                              className="w-1/2 p-1 border rounded text-sm"
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
                              className="w-1/2 p-1 border rounded text-sm"
                            />
                            <button
                              onClick={() => removeBreak(shift.id, day, pauseIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <FaTrashIcon />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addBreak(shift.id, day)}
                          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-lg flex items-center space-x-1 shadow-md transition text-sm"
                        >
                          <FaPlusIcon /> <span>Pause hinzufügen</span>
                        </button>
                      </div>
                    </td>
                  ))}
                  <td className="p-2 border text-center w-[100px]">
                    {calculateTotalHours(shift, weekDays)}
                  </td>
                  <td className="p-2 border text-center w-[100px]">
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-lg flex items-center space-x-1 shadow-md transition text-sm w-full"
                      disabled={isSaving}
                    >
                      <FaTrashIcon /> <span>Löschen</span>
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