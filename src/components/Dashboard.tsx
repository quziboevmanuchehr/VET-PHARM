import React, { useState, useEffect, useCallback } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import PharmacySearch from "./PharmacySearch";
import ScheduleCalendar from "./ScheduleCalendar";
import ScheduleTable from "./ScheduleTable";
import Settings from "./Settings";
import MissingMedications from "./MissingMedications";
import InventoryList from "./InventoryList";
import WorkProtectionHints from "./WorkProtectionHints";
import { GoogleGenerativeAI } from "@google/generative-ai";
import moment from "moment";

// Typisierungen
interface DoppelstundenEinstellung {
  id: number;
  wochentag: number;
  startZeit: string;
  endZeit: string;
}

interface Shift {
  startZeit: string;
  endZeit: string;
  notizen: string;
  pausen: Break[];
}

interface Break {
  startZeit: string;
  endZeit: string;
}

interface EmployeeShift {
  id: string;
  mitarbeiterName: string;
  datum: any;
  startZeit: any;
  endZeit: any;
  schichten: { [date: string]: Shift };
  userID: string;
}

// API-Schlüssel (ersetzen Sie diesen mit Ihrem gültigen Schlüssel)
const GEMINI_API_KEY = "AIzaSyAydf-ONYogjNxlu_Kfh6mYKnWyVHTFp3E";

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("schedule");
  const [doppelstundenEinstellungen, setDoppelstundenEinstellungen] = useState<DoppelstundenEinstellung[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState<boolean>(false); // Standardmäßig ausgeblendet

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
        window.location.href = "/login";
      } else {
        setError(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleScheduleUpdate = (newShifts: EmployeeShift[], newWeekDays: string[]) => {
    setShifts(newShifts);
    setWeekDays(newWeekDays);
  };

  const fetchHints = useCallback(
    debounce(async () => {
      if (shifts.length === 0 || weekDays.length === 0) {
        setHints([]);
        setAiError(null);
        return;
      }

      const localHints = generateWorkProtectionHints(shifts, weekDays);
      setHints(localHints);

      try {
        const aiHints = await analyzeScheduleWithAI(shifts, weekDays);
        const uniqueHints = Array.from(new Set([...localHints, ...aiHints]));
        setHints(uniqueHints);
        setAiError(null);
      } catch (error) {
        console.error("Fehler bei der AI-Analyse:", error);
        setAiError(`Fehler: Dienstplan konnte nicht mit AI analysiert werden. Details: ${(error as Error).message}`);
      }
    }, 1000),
    [shifts, weekDays]
  );

  useEffect(() => {
    fetchHints();
  }, [shifts, weekDays, fetchHints]);

  const tabs = [
    { name: "schedule", label: "Dienstplan" },
    { name: "pharmacySearch", label: "Apotheken Suche" },
    { name: "missingMedications", label: "Fehlende Medikamente" },
    { name: "inventory", label: "Inventurliste" },
  ];

  if (loading) {
    return <p className="text-center text-gray-600">Lade...</p>;
  }

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
              {tabs.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`px-4 py-2 rounded-lg ${
                    activeTab === tab.name
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "schedule" && (
              <div className="grid grid-cols-1 gap-6">
                <ScheduleCalendar />
                <div>
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {showHints ? "Hinweise ausblenden" : "Hinweise einblenden"}
                  </button>
                  {showHints && <WorkProtectionHints hints={hints} aiError={aiError} />}
                </div>
                <ScheduleTable
                  doppelstundenEinstellungen={doppelstundenEinstellungen}
                  onScheduleUpdate={handleScheduleUpdate}
                />
                <Settings
                  doppelstundenEinstellungen={doppelstundenEinstellungen}
                  setDoppelstundenEinstellungen={setDoppelstundenEinstellungen}
                />
              </div>
            )}
            {activeTab === "pharmacySearch" && <PharmacySearch />}
            {activeTab === "missingMedications" && <MissingMedications />}
            {activeTab === "inventory" && <InventoryList />}
          </>
        )}
      </div>
    </div>
  );
};

// Lokale Hinweisgenerierung (nur für aktuelle Woche)
const generateWorkProtectionHints = (shifts: EmployeeShift[], weekDays: string[]): string[] => {
  const hints: string[] = [];
  shifts.forEach((shift) => {
    let totalHours = 0;
    let consecutiveWeekends: string[] = [];
    let lastWeekendWorked = false;

    weekDays.forEach((day) => {
      const schicht = shift.schichten[day];
      const dayMoment = moment(day);
      const isWeekend = dayMoment.day() === 0 || dayMoment.day() === 6;

      if (schicht && schicht.startZeit && schicht.endZeit) {
        const start = moment(schicht.startZeit, "HH:mm");
        const end = moment(schicht.endZeit, "HH:mm");
        let duration = end.diff(start, "hours", true);

        const breaks = schicht.pausen || [];
        breaks.forEach((pause) => {
          const breakStart = moment(pause.startZeit, "HH:mm");
          const breakEnd = moment(pause.endZeit, "HH:mm");
          if (breakStart.isValid() && breakEnd.isValid()) {
            duration -= breakEnd.diff(breakStart, "hours", true);
          }
        });
        totalHours += duration > 0 ? duration : 0;

        if (duration > 8 && breaks.length === 0) {
          hints.push(
            `${shift.mitarbeiterName}: Verstoß gegen Arbeitsschutz am ${dayMoment.format("DD.MM.YYYY")} (${schicht.startZeit} - ${schicht.endZeit})`
          );
        }

        if (isWeekend) {
          if (lastWeekendWorked) {
            consecutiveWeekends.push(dayMoment.format("DD.MM.YYYY"));
          } else {
            if (consecutiveWeekends.length > 0) {
              hints.push(
                `${shift.mitarbeiterName}: Verstoß gegen Arbeitsschutz (Arbeit an mehreren Wochenenden: ${consecutiveWeekends.join(", ")})`
              );
              consecutiveWeekends = [];
            }
            consecutiveWeekends.push(dayMoment.format("DD.MM.YYYY"));
            lastWeekendWorked = true;
          }
        } else {
          lastWeekendWorked = false;
        }
      } else if (isWeekend) {
        lastWeekendWorked = false;
      }
    });

    if (consecutiveWeekends.length > 1) {
      hints.push(
        `${shift.mitarbeiterName}: Verstoß gegen Arbeitsschutz (Arbeit an mehreren Wochenenden: ${consecutiveWeekends.join(", ")})`
      );
    }

    if (totalHours > 40) {
      hints.push(`${shift.mitarbeiterName}: Verstoß gegen Arbeitsschutz (Gesamtstunden: ${totalHours.toFixed(2)} Std.)`);
    }
  });
  return hints;
};

// Dienstplan als Text für AI-Analyse (nur aktuelle Woche)
const generateScheduleText = (shifts: EmployeeShift[], weekDays: string[]): string => {
  let text = "Dienstplan für die Woche:\n";
  shifts.forEach((shift) => {
    text += `Mitarbeiter: ${shift.mitarbeiterName}\n`;
    weekDays.forEach((day) => {
      const schicht = shift.schichten[day];
      if (schicht && schicht.startZeit && schicht.endZeit) {
        text += `- ${moment(day).format("dddd, DD.MM.YYYY")}: ${schicht.startZeit} - ${schicht.endZeit}`;
        if (schicht.pausen && schicht.pausen.length > 0) {
          text += ", Pausen: ";
          schicht.pausen.forEach((pause, index) => {
            text += `${pause.startZeit} - ${pause.endZeit}${index < schicht.pausen.length - 1 ? ", " : ""}`;
          });
        }
        text += "\n";
      } else {
        text += `- ${moment(day).format("dddd, DD.MM.YYYY")}: frei\n`;
      }
    });
    text += "\n";
  });
  return text;
};

// AI-Analyse des Dienstplans (nur aktuelle Woche)
const analyzeScheduleWithAI = async (shifts: EmployeeShift[], weekDays: string[]): Promise<string[]> => {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const scheduleText = generateScheduleText(shifts, weekDays);
  const prompt = `Analysiere den folgenden Dienstplan und identifiziere Verstöße gegen Arbeitsschutzregeln. Prüfe:
  - Mehr als 40 Stunden pro Woche.
  - Arbeit an mehreren aufeinanderfolgenden Wochenenden.
  - Schichten länger als 8 Stunden ohne Pause.
  - Ruhezeiten unter 11 Stunden zwischen Schichten.
  Gib kurze Hinweise im Format "[Mitarbeitername]: Verstoß gegen Arbeitsschutz am [Datum] ([Details])" für Verstöße an einem bestimmten Tag, sonst "[Mitarbeitername]: Verstoß gegen Arbeitsschutz ([Details])".

  Dienstplan:
  ${scheduleText}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text.split("\n").filter((line) => line.trim() !== "");
  } catch (error) {
    console.error("API-Fehler:", error);
    throw new Error(`API-Analyse fehlgeschlagen: ${(error as Error).message}`);
  }
};

// Debounce-Funktion zur Verzögerung
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default Dashboard;