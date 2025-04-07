import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import "moment/locale/de";

moment.locale("de");

interface Shift {
  startZeit: Timestamp | null;
  endZeit: Timestamp | null;
  notizen: string;
}

interface EmployeeShift {
  id: string;
  mitarbeiterName: string;
  datum: Timestamp;
  startZeit: Timestamp | null;
  endZeit: Timestamp | null;
  notizen: string;
  userID: string;
  plattform: string;
  doppelstunde: boolean;
}

const DienstplanErsteller: React.FC = () => {
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(moment().startOf("week"));

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein, um den Dienstplan zu verwalten.");
      return;
    }

    const startOfWeek = Timestamp.fromDate(selectedWeek.startOf("week").toDate());
    const endOfWeek = Timestamp.fromDate(selectedWeek.endOf("week").add(1, "day").toDate());

    const q = query(
      collection(db, "dienstplaene"),
      where("userID", "==", currentUser.uid),
      where("datum", ">=", startOfWeek),
      where("datum", "<", endOfWeek)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          mitarbeiterName: doc.data().mitarbeiterName,
          datum: doc.data().datum,
          startZeit: doc.data().startZeit || null,
          endZeit: doc.data().endZeit || null,
          notizen: doc.data().notizen || "",
          userID: doc.data().userID,
          plattform: doc.data().plattform || "web",
          doppelstunde: doc.data().doppelstunde || false,
        }));
        setShifts(data);
      },
      (err) => setError("⚠ Fehler beim Laden: " + err.message)
    );
    return () => unsubscribe();
  }, [selectedWeek]);

  const handleUpdate = async (
    mitarbeiterName: string,
    date: string,
    field: keyof Shift,
    value: string
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }

    const datum = Timestamp.fromDate(moment(date, "YYYY-MM-DD").startOf("day").toDate());
    const q = query(
      collection(db, "dienstplaene"),
      where("userID", "==", currentUser.uid),
      where("mitarbeiterName", "==", mitarbeiterName),
      where("datum", "==", datum)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        const newShift = {
          mitarbeiterName,
          datum,
          startZeit: field === "startZeit" ? Timestamp.fromDate(moment(`${date} ${value}`).toDate()) : null,
          endZeit: field === "endZeit" ? Timestamp.fromDate(moment(`${date} ${value}`).toDate()) : null,
          notizen: field === "notizen" ? value : "",
          userID: currentUser.uid,
          plattform: "web",
          doppelstunde: false,
        };
        await addDoc(collection(db, "dienstplaene"), newShift);
      } else {
        const docRef = doc(db, "dienstplaene", snapshot.docs[0].id);
        const updateData: Partial<Shift> = {};
        if (field === "startZeit") {
          updateData.startZeit = Timestamp.fromDate(moment(`${date} ${value}`).toDate());
        } else if (field === "endZeit") {
          updateData.endZeit = Timestamp.fromDate(moment(`${date} ${value}`).toDate());
        } else if (field === "notizen") {
          updateData.notizen = value;
        }
        await updateDoc(docRef, updateData);
      }
    });
    return () => unsubscribe();
  };

  const handleDeleteShift = async (shiftId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }
    if (!window.confirm("Bist du sicher, dass du diese Schicht löschen möchtest?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "dienstplaene", shiftId));
    } catch (err) {
      setError("⚠ Fehler beim Löschen: " + (err as Error).message);
    }
  };

  const handleAddEmployee = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein.");
      return;
    }

    const firstDay = selectedWeek.startOf("week").format("YYYY-MM-DD");
    const newShift = {
      mitarbeiterName: "Neuer Mitarbeiter",
      datum: Timestamp.fromDate(moment(firstDay).toDate()),
      startZeit: null,
      endZeit: null,
      notizen: "",
      userID: currentUser.uid,
      plattform: "web",
      doppelstunde: false,
    };

    try {
      await addDoc(collection(db, "dienstplaene"), newShift);
    } catch (err) {
      setError("⚠ Fehler beim Hinzufügen: " + (err as Error).message);
    }
  };

  const handleWeekChange = (direction: "prev" | "next") => {
    setSelectedWeek((prev) =>
      direction === "next" ? prev.clone().add(1, "week") : prev.clone().subtract(1, "week")
    );
  };

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    selectedWeek.clone().startOf("week").add(i, "days").format("YYYY-MM-DD")
  );

  const employees = Array.from(new Set(shifts.map((s) => s.mitarbeiterName)));

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white shadow-lg rounded-lg">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">📅 Dienstplan Erstellen</h2>
      <div className="flex justify-between mb-4">
        <button
          onClick={() => handleWeekChange("prev")}
          className="bg-gray-200 px-4 py-2 rounded"
        >
          ← Vorherige Woche
        </button>
        <span>
          {selectedWeek.format("DD.MM.YYYY")} -{" "}
          {selectedWeek.clone().endOf("week").format("DD.MM.YYYY")}
        </span>
        <button
          onClick={() => handleWeekChange("next")}
          className="bg-gray-200 px-4 py-2 rounded"
        >
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
              <th className="p-3 text-left">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((empName, empIndex) => (
              <tr key={empIndex} className="border-b hover:bg-gray-50">
                <td className="p-3">{empName}</td>
                {weekDays.map((day) => {
                  const shift = shifts.find(
                    (s) =>
                      s.mitarbeiterName === empName &&
                      moment(s.datum.toDate()).format("YYYY-MM-DD") === day
                  );
                  return (
                    <td key={day} className="p-3">
                      <div className="flex flex-col space-y-2">
                        <input
                          type="time"
                          value={
                            shift?.startZeit
                              ? moment(shift.startZeit.toDate()).format("HH:mm")
                              : ""
                          }
                          onChange={(e) => handleUpdate(empName, day, "startZeit", e.target.value)}
                          className="p-2 border rounded"
                        />
                        <input
                          type="time"
                          value={
                            shift?.endZeit ? moment(shift.endZeit.toDate()).format("HH:mm") : ""
                          }
                          onChange={(e) => handleUpdate(empName, day, "endZeit", e.target.value)}
                          className="p-2 border rounded"
                        />
                        <textarea
                          value={shift?.notizen || ""}
                          onChange={(e) => handleUpdate(empName, day, "notizen", e.target.value)}
                          className="p-2 border rounded"
                          placeholder="Notizen"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="p-3">
                  {shifts.find((s) => s.mitarbeiterName === empName) && (
                    <button
                      onClick={() =>
                        handleDeleteShift(shifts.find((s) => s.mitarbeiterName === empName)!.id)
                      }
                      className="bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Löschen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DienstplanErsteller;