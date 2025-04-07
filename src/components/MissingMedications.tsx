import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";

interface Medikament {
  id: string;
  name: string;
  beschreibung: string;
  tierart: string;
  gruppe: string;
  fehlendeMenge: number;
  link: string;
  userID?: string; // Optional, da es in einigen Dokumenten fehlen könnte
}

const MissingMedications: React.FC = () => {
  const [missingMedications, setMissingMedications] = useState<Medikament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Echtzeit-Updates für fehlende Medikamente
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Kein Benutzer angemeldet.");
      setLoading(false);
      return;
    }

    // Abfrage ohne userID-Filter, da es möglicherweise fehlt
    const q = query(
      collection(db, "medikamente"),
      where("fehlendeMenge", ">", 0)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const meds = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            name: doc.data().name || "Unbekanntes Medikament",
            beschreibung: doc.data().beschreibung || "Keine Beschreibung",
            tierart: doc.data().tierart || "Unbekannte Tierart",
            gruppe: doc.data().gruppe || "Unbekannte Gruppe",
            fehlendeMenge: doc.data().fehlendeMenge || 0,
            link: doc.data().link || "Kein Link verfügbar",
            userID: doc.data().userID, // Kann undefined sein
          }))
          .filter(
            (med) =>
              med.userID === undefined || med.userID === currentUser.uid
          ) as Medikament[];
        setMissingMedications(meds);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Fehler bei Echtzeit-Updates:", error);
        setError("Fehler beim Abrufen der Medikamente: " + error.message);
        setLoading(false);
      }
    );

    // Cleanup-Funktion, um Listener zu entfernen
    return () => unsubscribe();
  }, []);

  // Funktion zum Löschen eines Medikaments
  const deleteMedikament = async (medikamentID: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Kein Benutzer angemeldet.");
      return;
    }
    try {
      await deleteDoc(doc(db, "medikamente", medikamentID));
      // Echtzeit-Updates machen eine manuelle Aktualisierung überflüssig
    } catch (error) {
      console.error("❌ Fehler beim Löschen des Medikaments:", error);
      setError("Fehler beim Löschen des Medikaments.");
    }
  };

  // Ladezustand anzeigen
  if (loading) {
    return <div className="text-center">Lade fehlende Medikamente...</div>;
  }

  // Fehler anzeigen
  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  // Benutzeroberfläche rendern
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Fehlende Medikamente</h2>
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