import React, { useState, Dispatch, SetStateAction } from "react";

// Typ für Doppelstundeneinstellungen definieren
interface DoppelstundenEinstellung {
  id: number;
  wochentag: number;
  startZeit: string;
  endZeit: string;
}

// Props für Settings definieren
interface SettingsProps {
  doppelstundenEinstellungen: DoppelstundenEinstellung[];
  setDoppelstundenEinstellungen: Dispatch<SetStateAction<DoppelstundenEinstellung[]>>;
}

const Settings: React.FC<SettingsProps> = ({ doppelstundenEinstellungen, setDoppelstundenEinstellungen }) => {
  const [neueStartZeit, setNeueStartZeit] = useState("18:00");
  const [neueEndZeit, setNeueEndZeit] = useState("22:00");
  const [ausgewählterTag, setAusgewählterTag] = useState(0);

  const wochentage = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  const handleAdd = () => {
    const neueEinstellung: DoppelstundenEinstellung = {
      id: Date.now(),
      wochentag: ausgewählterTag,
      startZeit: neueStartZeit,
      endZeit: neueEndZeit,
    };
    setDoppelstundenEinstellungen((prev) => [...prev, neueEinstellung]);
    // Zurücksetzen der Eingabefelder (optional)
    setNeueStartZeit("18:00");
    setNeueEndZeit("22:00");
    setAusgewählterTag(0);
  };

  const handleDelete = (id: number) => {
    setDoppelstundenEinstellungen((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">🕒 Doppelstunden-Einstellungen</h2>

      {/* Bestehende Einstellungen anzeigen */}
      <div className="space-y-4">
        {doppelstundenEinstellungen.length === 0 ? (
          <p className="text-gray-500 text-center">Keine Doppelstunden gespeichert.</p>
        ) : (
          doppelstundenEinstellungen.map((einstellung) => (
            <div key={einstellung.id} className="flex justify-between items-center p-4 bg-gray-100 rounded-lg">
              <div>
                <p>
                  <strong>{wochentage[einstellung.wochentag]}</strong>
                </p>
                <p>Start: {einstellung.startZeit}</p>
                <p>Ende: {einstellung.endZeit}</p>
              </div>
              <button
                onClick={() => handleDelete(einstellung.id)}
                className="text-red-600 hover:text-red-800"
              >
                ❌ Löschen
              </button>
            </div>
          ))
        )}
      </div>

      {/* Neue Einstellung hinzufügen */}
      <div className="mt-6 space-y-4">
        <label className="block font-medium text-gray-700">Wochentag</label>
        <select
          value={ausgewählterTag}
          onChange={(e) => setAusgewählterTag(Number(e.target.value))}
          className="w-full p-2 border rounded-md"
        >
          {wochentage.map((tag, index) => (
            <option key={index} value={index}>
              {tag}
            </option>
          ))}
        </select>

        <label className="block font-medium text-gray-700">Startzeit</label>
        <input
          type="time"
          value={neueStartZeit}
          onChange={(e) => setNeueStartZeit(e.target.value)}
          className="w-full p-2 border rounded-md"
        />

        <label className="block font-medium text-gray-700">Endzeit</label>
        <input
          type="time"
          value={neueEndZeit}
          onChange={(e) => setNeueEndZeit(e.target.value)}
          className="w-full p-2 border rounded-md"
        />

        <button
          onClick={handleAdd}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          ➕ Doppelstunde speichern
        </button>
      </div>
    </div>
  );
};

export default Settings;