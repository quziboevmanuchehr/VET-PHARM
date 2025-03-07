import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import PharmacySearch from "./PharmacySearch";
import ScheduleCalendar from "./ScheduleCalendar";
import ScheduleTable from "./ScheduleTable";
import Settings from "./Settings";
import MissingMedications from "./MissingMedications";

interface DoppelstundenEinstellung {
  id: number;
  wochentag: number;
  startZeit: string;
  endZeit: string;
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("schedule");
  const [doppelstundenEinstellungen, setDoppelstundenEinstellungen] = useState<
    DoppelstundenEinstellung[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("❌ Logout fehlgeschlagen:", (error as Error).message);
      setError(`❌ Fehler beim Abmelden: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setError("❌ Kein Benutzer angemeldet. Bitte melde dich an.");
      } else {
        setError(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto relative">
        <button
          onClick={handleLogout}
          className={`absolute top-4 right-4 bg-red-600 text-white px-5 py-2 rounded-lg shadow-md hover:bg-red-700 transition ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={loading}
        >
          🚪 Logout
        </button>

        {error ? (
          <p className="text-red-500 text-center mb-4">{error}</p>
        ) : (
          <>
            <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">
              Willkommen in 🐾 VetPharma
            </h1>

            <div className="flex justify-center mb-6 space-x-4">
              <button
                onClick={() => setActiveTab("schedule")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "schedule"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                Dienstplan
              </button>
              <button
                onClick={() => setActiveTab("pharmacySearch")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "pharmacySearch"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                Apotheken Suche
              </button>
              <button
                onClick={() => setActiveTab("missingMedications")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "missingMedications"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                Fehlende Medikamente
              </button>
            </div>

            {activeTab === "schedule" && (
              <div className="grid grid-cols-1 gap-6">
                <ScheduleCalendar />
                <ScheduleTable
                  doppelstundenEinstellungen={doppelstundenEinstellungen}
                />
                <Settings
                  doppelstundenEinstellungen={doppelstundenEinstellungen}
                  setDoppelstundenEinstellungen={setDoppelstundenEinstellungen}
                />
              </div>
            )}
            {activeTab === "pharmacySearch" && <PharmacySearch />}
            {activeTab === "missingMedications" && <MissingMedications />}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;