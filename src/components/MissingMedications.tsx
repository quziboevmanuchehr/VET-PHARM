import React, { useState, useEffect } from "react";
import { db } from "../firebase"; // Annahme: Firebase ist in einer separaten Datei konfiguriert
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

interface Medikament {
  id: string;
  name: string;
  beschreibung: string;
  tierart: string;
  gruppe: string;
  fehlendeMenge: number;
  link: string;
  userID: string;
}

const MissingMedications: React.FC = () => {
  const [missingMedications, setMissingMedications] = useState<Medikament[]>([]);

  // Funktion zum Abrufen der fehlenden Medikamente
  const fetchMissingMedications = async () => {
    try {
      // Abfrage: Alle Medikamente mit fehlendeMenge > 0
      const q = query(
        collection(db, "medikamente"),
        where("fehlendeMenge", ">", 0)
      );

      const querySnapshot = await getDocs(q);
      console.log("Anzahl der abgerufenen Dokumente:", querySnapshot.size);

      const meds = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Medikament[];

      console.log("Abgerufene Medikamente:", meds);
      setMissingMedications(meds);
    } catch (error) {
      console.error("❌ Fehler beim Abrufen der fehlenden Medikamente:", error);
      setMissingMedications([]);
    }
  };

  // Funktion zum Löschen eines Medikaments
  const deleteMedikament = async (medikamentID: string) => {
    try {
      await deleteDoc(doc(db, "medikamente", medikamentID));
      console.log("✅ Medikament erfolgreich gelöscht!");
      fetchMissingMedications(); // Liste nach dem Löschen aktualisieren
    } catch (error) {
      console.error("❌ Fehler beim Löschen des Medikaments:", error);
    }
  };

  // Daten beim Laden der Komponente abrufen
  useEffect(() => {
    fetchMissingMedications();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Fehlende Medikamente
      </h2>
      {missingMedications.length === 0 ? (
        <p className="text-gray-600">✅ Keine fehlenden Medikamente vorhanden.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Name</th>
              <th className="p-3">Gruppe</th>
              <th className="p-3">Tierart</th>
              <th className="p-3">Fehlende Menge</th>
              <th className="p-3">Beschreibung</th>
              <th className="p-3">Link</th>
              <th className="p-3">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {missingMedications.map((med) => (
              <tr key={med.id} className="border-b">
                <td className="p-3">{med.name}</td>
                <td className="p-3">{med.gruppe}</td>
                <td className="p-3">{med.tierart}</td>
                <td className="p-3">{med.fehlendeMenge}</td>
                <td className="p-3">{med.beschreibung}</td>
                <td className="p-3">
                  <a
                    href={med.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {med.link === "Kein Link verfügbar" ? "—" : "Link"}
                  </a>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => deleteMedikament(med.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MissingMedications;