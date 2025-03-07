import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import moment from "moment";
import "moment/locale/de";

moment.locale("de");

interface Shift {
  startZeit: Timestamp;
  endZeit: Timestamp;
  notizen: string;
}

interface Employee {
  id?: string;
  mitarbeiterName: string;
  schichten: {
    [date: string]: Shift;
  };
}

const DienstplanErsteller: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(moment().startOf("week"));

  // Firestore-Daten abrufen
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "dienstplaene"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        mitarbeiterName: doc.data().mitarbeiterName || "Unbekannt",
        schichten: doc.data().schichten || {},
      }));
      setEmployees(data);
    });
    return () => unsubscribe();
  }, []);

  // Schicht-Daten aktualisieren
  const handleUpdate = async (id: string, date: string, field: keyof Shift, value: string) => {
    const employeeRef = doc(db, "dienstplaene", id);
    const updatedEmployee = employees.find((emp) => emp.id === id);

    if (updatedEmployee) {
      const shift = updatedEmployee.schichten[date] || {
        startZeit: Timestamp.fromDate(moment(date).set({ hour: 8, minute: 0 }).toDate()),
        endZeit: Timestamp.fromDate(moment(date).set({ hour: 16, minute: 0 }).toDate()),
        notizen: "",
      };

      if (field === "startZeit" || field === "endZeit") {
        const [hours, minutes] = value.split(":").map(Number);
        const dateTime = moment(date).set({ hour: hours, minute: minutes }).toDate();
        shift[field] = Timestamp.fromDate(dateTime);
      } else {
        shift[field] = value as Shift[typeof field];
      }

      updatedEmployee.schichten[date] = shift;

      await updateDoc(employeeRef, {
        schichten: updatedEmployee.schichten,
      });
    }
  };

  // Neuen Mitarbeiter hinzufügen
  const handleAddEmployee = async () => {
    if (!auth.currentUser) {
      setError("⚠ Bitte logge dich ein, um den Dienstplan zu speichern.");
      return;
    }

    const newEmployee: Employee = {
      mitarbeiterName: "Neuer Mitarbeiter",
      schichten: {},
    };

    const docRef = await addDoc(collection(db, "dienstplaene"), newEmployee);
    setEmployees([...employees, { ...newEmployee, id: docRef.id }]);
  };

  // Dienstplan speichern
  const handleSave = async () => {
    if (!auth.currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }

    try {
      for (const emp of employees) {
        if (!emp.mitarbeiterName.trim()) {
          throw new Error("Mitarbeitername ist erforderlich.");
        }
        const empRef = doc(db, "dienstplaene", emp.id!);
        await updateDoc(empRef, {
          mitarbeiterName: emp.mitarbeiterName.trim(),
          schichten: emp.schichten,
        });
      }
      alert("✅ Dienstplan erfolgreich gespeichert!");
    } catch (err) {
      setError("⚠ Fehler beim Speichern: " + (err as Error).message);
    }
  };

  // Wochenauswahl ändern
  const handleWeekChange = (direction: "prev" | "next") => {
    setSelectedWeek((prev) =>
      direction === "next" ? prev.clone().add(1, "week") : prev.clone().subtract(1, "week")
    );
  };

  // Tage der ausgewählten Woche generieren
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    selectedWeek.clone().startOf("week").add(i, "days").format("YYYY-MM-DD")
  );

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white shadow-lg rounded-lg">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">📅 Dienstplan Erstellen</h2>
      <div className="flex justify-between mb-4">
        <button onClick={() => handleWeekChange("prev")} className="bg-gray-200 px-4 py-2 rounded">
          ← Vorherige Woche
        </button>
        <span>
          {selectedWeek.format("DD.MM.YYYY")} -{" "}
          {selectedWeek.clone().endOf("week").format("DD.MM.YYYY")}
        </span>
        <button onClick={() => handleWeekChange("next")} className="bg-gray-200 px-4 py-2 rounded">
          Nächste Woche →
        </button>
      </div>
      <button
        onClick={handleAddEmployee}
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        ➕ Mitarbeiter hinzufügen
      </button>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="p-3 text-left">Mitarbeiter</th>
              {weekDays.map((day) => (
                <th key={day} className="p-3 text-left">
                  {moment(day).format("dd, DD.MM.")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, empIndex) => (
              <tr key={empIndex} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <input
                    type="text"
                    value={emp.mitarbeiterName}
                    onChange={(e) => {
                      const newEmployees = [...employees];
                      newEmployees[empIndex].mitarbeiterName = e.target.value;
                      setEmployees(newEmployees);
                    }}
                    className="w-full p-2 border rounded"
                  />
                </td>
                {weekDays.map((day) => (
                  <td key={day} className="p-3">
                    <div className="flex flex-col space-y-2">
                      <input
                        type="time"
                        value={
                          emp.schichten[day]?.startZeit
                            ? moment(emp.schichten[day].startZeit.toDate()).format("HH:mm")
                            : ""
                        }
                        onChange={(e) => handleUpdate(emp.id!, day, "startZeit", e.target.value)}
                        className="p-2 border rounded"
                      />
                      <input
                        type="time"
                        value={
                          emp.schichten[day]?.endZeit
                            ? moment(emp.schichten[day].endZeit.toDate()).format("HH:mm")
                            : ""
                        }
                        onChange={(e) => handleUpdate(emp.id!, day, "endZeit", e.target.value)}
                        className="p-2 border rounded"
                      />
                      <textarea
                        value={emp.schichten[day]?.notizen || ""}
                        onChange={(e) => handleUpdate(emp.id!, day, "notizen", e.target.value)}
                        className="p-2 border rounded"
                        placeholder="Notizen"
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={handleSave} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg">
        💾 Speichern
      </button>
    </div>
  );
};

export default DienstplanErsteller;