import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase"; // Firebase-Konfiguration wird vorausgesetzt
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

interface Arzneimittel {
  id: string;
  name: string;
  lagerplatz: string;
}

const PharmacySearch: React.FC = () => {
  const [suchbegriff, setSuchbegriff] = useState<string>("");
  const [neuerName, setNeuerName] = useState<string>("");
  const [neuerLagerplatz, setNeuerLagerplatz] = useState<string>("");
  const [arzneimittelListe, setArzneimittelListe] = useState<Arzneimittel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Daten aus Firebase laden
  const ladeArzneimittel = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("❌ Kein Benutzer angemeldet. Bitte melde dich an.");
      setLoading(false);
      return () => {};
    }

    const q = collection(db, "arzneimittel");
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const arzneimittelData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name as string,
          lagerplatz: doc.data().lagerplatz as string,
        }));
        setArzneimittelListe(arzneimittelData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error("❌ Fehler beim Laden der Daten:", error.message);
        setError(`❌ Fehler: ${error.message}`);
        setLoading(false);
      }
    );
    return unsubscribe;
  };

  // Neues Arzneimittel hinzufügen
  const arzneimittelHinzufuegen = async () => {
    const trimmedName = neuerName.trim();
    const trimmedLagerplatz = neuerLagerplatz.trim();
    if (!trimmedName || !trimmedLagerplatz) {
      setError("❌ Produkt und Lagerplatz dürfen nicht leer sein.");
      return;
    }
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("❌ Kein Benutzer angemeldet.");
        return;
      }
      const neuesArzneimittel = {
        name: trimmedName,
        lagerplatz: trimmedLagerplatz,
      };
      await addDoc(collection(db, "arzneimittel"), neuesArzneimittel);
      setNeuerName("");
      setNeuerLagerplatz("");
      setError(null);
    } catch (error) {
      console.error("❌ Fehler beim Hinzufügen:", (error as Error).message);
      setError(`❌ Fehler: ${(error as Error).message}`);
    }
  };

  // Arzneimittel löschen
  const arzneimittelLoeschen = async (id: string) => {
    try {
      await deleteDoc(doc(db, "arzneimittel", id));
      setError(null);
    } catch (error) {
      console.error("❌ Fehler beim Löschen:", (error as Error).message);
      setError(`❌ Fehler: ${(error as Error).message}`);
    }
  };

  // Filterung basierend auf Suchbegriff
  const gefilterteArzneimittel = arzneimittelListe.filter((arzneimittel) =>
    arzneimittel.name.toLowerCase().includes(suchbegriff.toLowerCase())
  );

  // Daten beim Mount laden
  useEffect(() => {
    const unsubscribe = ladeArzneimittel();
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-gray-100 p-6 rounded-xl shadow-lg max-w-2xl mx-auto transition-all duration-300">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 font-sans">
        Apotheken Suche
      </h2>

      {loading && (
        <p className="text-gray-600 text-center font-sans">Lade Daten...</p>
      )}
      {error && (
        <p className="text-red-500 text-center mb-4 font-sans">{error}</p>
      )}

      <div className="relative mb-6">
        <input
          type="text"
          value={suchbegriff}
          onChange={(e) => setSuchbegriff(e.target.value)}
          placeholder="Arzneimittel suchen..."
          className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-sans transition-all duration-200"
        />
        <button
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-500 transition duration-200"
          aria-label="Suchen"
        >
          🔍
        </button>
      </div>

      {!loading && !error && gefilterteArzneimittel.length === 0 && (
        <p className="text-gray-600 text-center font-sans">
          Keine Arzneimittel gefunden.
        </p>
      )}
      {!loading && !error && gefilterteArzneimittel.length > 0 && (
        <ul className="space-y-3 max-h-64 overflow-y-auto">
          {gefilterteArzneimittel.map((arzneimittel) => (
            <li
              key={arzneimittel.id}
              className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold text-gray-800 font-sans">
                    Produkt: {arzneimittel.name}
                  </span>
                  <div className="text-gray-600 text-sm font-sans">
                    Lagerplatz: {arzneimittel.lagerplatz}
                  </div>
                </div>
                <button
                  onClick={() => arzneimittelLoeschen(arzneimittel.id)}
                  className="bg-red-400 text-white p-2 rounded-full hover:bg-red-500 transition duration-200 ease-in-out transform hover:scale-105"
                  aria-label={`Löschen ${arzneimittel.name}`}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="neuerName"
            className="block text-gray-700 mb-1 font-sans"
          >
            Produkt (Arzneimittel)
          </label>
          <input
            id="neuerName"
            type="text"
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 font-sans transition-all duration-200"
            placeholder="z. B. Amoxita"
          />
        </div>
        <div>
          <label
            htmlFor="neuerLagerplatz"
            className="block text-gray-700 mb-1 font-sans"
          >
            Lagerplatz
          </label>
          <input
            id="neuerLagerplatz"
            type="text"
            value={neuerLagerplatz}
            onChange={(e) => setNeuerLagerplatz(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 font-sans transition-all duration-200"
            placeholder="z. B. Vitrine"
          />
        </div>
        <button
          onClick={arzneimittelHinzufuegen}
          className="w-full bg-green-400 text-white py-3 rounded-lg hover:bg-green-500 transition duration-200 ease-in-out transform hover:scale-105 font-sans"
          disabled={loading}
        >
          Arzneimittel hinzufügen
        </button>
      </div>
    </div>
  );
};

export default PharmacySearch;