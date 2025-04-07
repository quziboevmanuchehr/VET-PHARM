import React from "react";

interface WorkProtectionHint {
  text: string;
  type: "warning" | "error" | "info";
}

interface WorkProtectionHintsProps {
  hints: string[];
  aiError: string | null;
}

const WorkProtectionHints: React.FC<WorkProtectionHintsProps> = ({ hints, aiError }) => {
  // Kategorisierung der Hinweise basierend auf ihrem Inhalt
  const categorizedHints: WorkProtectionHint[] = hints.map((hint) => {
    if (hint.includes("mehr als 48 Stunden") || hint.includes("länger als 10 Stunden")) {
      return { text: hint, type: "error" }; // Schwerwiegende Verstöße
    } else if (hint.includes("weniger als 11 Stunden") || hint.includes("mehreren Wochenenden") || hint.includes("ohne Pause")) {
      return { text: hint, type: "warning" }; // Warnungen
    } else {
      return { text: hint, type: "info" }; // Allgemeine Informationen
    }
  });

  const getStyle = (type: string) => {
    switch (type) {
      case "error":
        return "bg-red-100 border-red-400 text-red-800 font-bold"; // Rot für Fehler
      case "warning":
        return "bg-yellow-100 border-yellow-400 text-yellow-800 italic"; // Gelb für Warnungen
      case "info":
        return "bg-blue-100 border-blue-400 text-blue-800"; // Blau für Infos
      default:
        return "bg-gray-100 border-gray-400 text-gray-800";
    }
  };

  return (
    <div className="p-4 rounded-lg shadow-md mb-6 bg-white">
      <h3 className="text-lg font-semibold text-gray-900">Arbeitsschutz-Hinweise</h3>
      {aiError && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-2 mt-2 rounded">
          <p>{aiError}</p>
          <p>Bitte überprüfen Sie die API-Konfiguration in der Google Cloud Console.</p>
        </div>
      )}
      {categorizedHints.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {categorizedHints.map((hint, index) => (
            <li
              key={index}
              className={`p-2 border rounded ${getStyle(hint.type)}`}
            >
              {hint.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-700 mt-2">
          {aiError ? "Keine lokalen Hinweise verfügbar." : "Kein Dienstplan vorhanden oder keine Hinweise verfügbar."}
        </p>
      )}
    </div>
  );
};

export default WorkProtectionHints;