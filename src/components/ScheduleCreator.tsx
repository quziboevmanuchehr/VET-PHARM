import React, { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

const ScheduleCreator: React.FC = () => {
  const [employee, setEmployee] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isDoubleShift, setIsDoubleShift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employee.trim()) {
      setError("⚠ Mitarbeitername ist erforderlich.");
      return;
    }
    if (!startTime || !endTime) {
      setError("⚠ Startzeit und Endzeit sind erforderlich.");
      return;
    }

    try {
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(endTime);

      const schicht = {
        mitarbeiterName: employee.trim(),
        startZeit: Timestamp.fromDate(startDateTime),
        endZeit: Timestamp.fromDate(endDateTime),
        notizen: notes.trim() || "",
        isDoubleShift: isDoubleShift,
      };

      await addDoc(collection(db, "schichten"), schicht);

      alert("✅ Dienstplan erfolgreich gespeichert!");
      setEmployee("");
      setStartTime("");
      setEndTime("");
      setNotes("");
      setIsDoubleShift(false);
      setError(null);
    } catch (err) {
      setError("⚠ Fehler beim Speichern: " + (err as Error).message);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">📅 Neuen Dienstplan erstellen</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mitarbeiter</label>
          <input
            type="text"
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="z. B. Sibille"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Startzeit (mit Datum)</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Endzeit</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="z. B. Mit Lorna arbeiten"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isDoubleShift}
            onChange={(e) => setIsDoubleShift(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm text-gray-700">Doppelstunde</label>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
        >
          💾 Dienstplan speichern
        </button>
      </form>
    </div>
  );
};

export default ScheduleCreator;
