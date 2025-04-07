import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import { FaExclamationTriangle } from "react-icons/fa";

interface InventoryItem {
  id: string;
  artikelnummer: string;
  bezeichnung: string;
  kategorie: string;
  bestand: number;
  mindestbestand?: number | null;
  einheit: string;
  lieferant?: string | null;
  letzteBestellung?: Date | null;
  bemerkungen?: string | null;
  gueltigkeit?: Date | null;
  alarmDeaktiviert: boolean;
  userID: string; // Hinzugefügt für Sicherheitsregeln
}

const InventoryList: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // Inventurdaten abrufen
  useEffect(() => {
    const fetchInventory = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("⚠ Bitte logge dich ein, um die Inventurliste zu sehen.");
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "inventory"),
          where("userID", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const inventoryData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            artikelnummer: data.artikelnummer || "",
            bezeichnung: data.bezeichnung || "",
            kategorie: data.kategorie || "",
            bestand: data.bestand || 0,
            mindestbestand: data.mindestbestand ?? null,
            einheit: data.einheit || "",
            lieferant: data.lieferant ?? null,
            letzteBestellung: data.letzteBestellung?.toDate() ?? null,
            bemerkungen: data.bemerkungen ?? null,
            gueltigkeit: data.gueltigkeit?.toDate() ?? null,
            alarmDeaktiviert: data.alarmDeaktiviert || false,
            userID: data.userID,
          } as InventoryItem;
        });
        setInventory(inventoryData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
        console.error("Fehler beim Abrufen der Inventur:", err);
        setError("Fehler beim Abrufen der Inventur: " + errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  // Kategorien abrufen
  useEffect(() => {
    const fetchCategories = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("⚠ Bitte logge dich ein, um Kategorien zu sehen.");
        return;
      }
      try {
        const q = query(
          collection(db, "categories"),
          where("userID", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const categoryList = querySnapshot.docs.map((doc) => doc.id);
        setCategories(categoryList);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
        console.error("Fehler beim Abrufen der Kategorien:", err);
        setError("Fehler beim Abrufen der Kategorien: " + errorMessage);
      }
    };
    fetchCategories();
  }, []);

  // Prüfen, ob ein Artikel bald abläuft (innerhalb der nächsten 2 Monate)
  const isExpiringSoon = (expiryDate?: Date | null) => {
    if (!expiryDate) return false;
    const twoMonthsFromNow = new Date();
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    return expiryDate <= twoMonthsFromNow;
  };

  // Neuen Inventarposten hinzufügen
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein, um Inventur hinzuzufügen.");
      return;
    }
    try {
      if (
        !newItem.artikelnummer ||
        !newItem.bezeichnung ||
        !newItem.bestand ||
        !newItem.einheit ||
        !selectedCategory
      ) {
        setError("Bitte füllen Sie alle erforderlichen Felder aus.");
        return;
      }

      let category = selectedCategory;
      if (selectedCategory === "add_new") {
        if (!newCategoryName) {
          setError("Bitte geben Sie einen Namen für die neue Kategorie ein.");
          return;
        }
        const categoryDoc = await getDoc(doc(db, "categories", newCategoryName));
        if (!categoryDoc.exists()) {
          await setDoc(doc(db, "categories", newCategoryName), { name: newCategoryName, userID: currentUser.uid });
          setCategories([...categories, newCategoryName]);
        }
        category = newCategoryName;
      }

      const itemToAdd = {
        artikelnummer: newItem.artikelnummer,
        bezeichnung: newItem.bezeichnung,
        kategorie: category,
        bestand: newItem.bestand,
        mindestbestand: newItem.mindestbestand ?? null,
        einheit: newItem.einheit,
        lieferant: newItem.lieferant ?? null,
        letzteBestellung: newItem.letzteBestellung ? Timestamp.fromDate(newItem.letzteBestellung) : null,
        bemerkungen: newItem.bemerkungen ?? null,
        gueltigkeit: newItem.gueltigkeit ? Timestamp.fromDate(newItem.gueltigkeit) : null,
        alarmDeaktiviert: false,
        userID: currentUser.uid, // Erforderlich für Sicherheitsregeln
      };

      const docRef = await addDoc(collection(db, "inventory"), itemToAdd);

      setInventory([...inventory, { ...itemToAdd, id: docRef.id, letzteBestellung: newItem.letzteBestellung || null, gueltigkeit: newItem.gueltigkeit || null }]);
      setIsModalOpen(false);
      setNewItem({});
      setSelectedCategory("");
      setNewCategoryName("");
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
      console.error("Fehler beim Hinzufügen des Inventarpostens:", err);
      setError("Fehler beim Hinzufügen: " + errorMessage);
    }
  };

  // Inventarposten löschen
  const deleteItem = async (id: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("⚠ Bitte logge dich ein, um zu löschen.");
      return;
    }
    if (window.confirm("Möchten Sie diesen Inventurposten wirklich löschen?")) {
      try {
        await deleteDoc(doc(db, "inventory", id));
        setInventory(inventory.filter((item) => item.id !== id));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
        console.error("Fehler beim Löschen des Inventarpostens:", err);
        setError("Fehler beim Löschen: " + errorMessage);
      }
    }
  };

  // Optimierte Druckfunktion
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Inventurliste</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
              body { font-family: 'Roboto', sans-serif; margin: 20px; background-color: #f9f9f9; }
              h2 { text-align: center; color: #333; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background-color: #fff; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; word-wrap: break-word; }
              th { background: linear-gradient(to bottom, #4a90e2, #357abd); color: white; font-weight: bold; }
              td { color: #555; }
              tr:nth-child(even) { background-color: #f2f2f2; }
              @media print { body { margin: 0; } table { box-shadow: none; } }
            </style>
          </head>
          <body>
            <h2>Inventurliste</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">Artikelnummer</th>
                  <th style="width: 15%;">Bezeichnung</th>
                  <th style="width: 10%;">Kategorie</th>
                  <th style="width: 8%;">Bestand</th>
                  <th style="width: 10%;">Mindestbestand</th>
                  <th style="width: 8%;">Einheit</th>
                  <th style="width: 10%;">Lieferant</th>
                  <th style="width: 10%;">Letzte Bestellung</th>
                  <th style="width: 10%;">Bemerkungen</th>
                  <th style="width: 10%;">Ablaufdatum</th>
                </tr>
              </thead>
              <tbody>
      `);
      inventory.forEach((item) => {
        printWindow.document.write(`
          <tr>
            <td>${item.artikelnummer}</td>
            <td>${item.bezeichnung}</td>
            <td>${item.kategorie}</td>
            <td>${item.bestand}</td>
            <td>${item.mindestbestand || ""}</td>
            <td>${item.einheit}</td>
            <td>${item.lieferant || ""}</td>
            <td>${item.letzteBestellung ? item.letzteBestellung.toLocaleDateString("de-DE") : ""}</td>
            <td>${item.bemerkungen || ""}</td>
            <td>${item.gueltigkeit ? item.gueltigkeit.toLocaleDateString("de-DE") : ""}</td>
          </tr>
        `);
      });
      printWindow.document.write(`
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) return <p>Lade Inventurliste...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  // Sortiere die Inventur nach Ablaufdatum
  const sortedInventory = [...inventory].sort((a, b) => {
    if (!a.gueltigkeit && !b.gueltigkeit) return 0;
    if (!a.gueltigkeit) return 1;
    if (!b.gueltigkeit) return -1;
    return a.gueltigkeit.getTime() - b.gueltigkeit.getTime();
  });

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Inventurliste</h2>
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Inventur hinzufügen
        </button>
        <button
          onClick={handlePrint}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Inventurliste drucken
        </button>
      </div>
      <div className="overflow-x-auto max-h-[80vh] overflow-y-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead className="bg-gray-200 text-black sticky top-0">
            <tr>
              <th className="py-2 px-4 border-b">Artikelnummer</th>
              <th className="py-2 px-4 border-b">Bezeichnung</th>
              <th className="py-2 px-4 border-b">Kategorie</th>
              <th className="py-2 px-4 border-b">Bestand</th>
              <th className="py-2 px-4 border-b">Mindestbestand</th>
              <th className="py-2 px-4 border-b">Einheit</th>
              <th className="py-2 px-4 border-b">Lieferant</th>
              <th className="py-2 px-4 border-b">Letzte Bestellung</th>
              <th className="py-2 px-4 border-b">Bemerkungen</th>
              <th className="py-2 px-4 border-b">Ablaufdatum</th>
              <th className="py-2 px-4 border-b">Alarm</th>
              <th className="py-2 px-4 border-b">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedInventory.map((item, index) => {
              const rowBg = index % 2 === 0 ? "bg-white" : "bg-gray-50";
              return (
                <tr
                  key={item.id}
                  className={
                    isExpiringSoon(item.gueltigkeit) && !item.alarmDeaktiviert
                      ? "bg-red-100"
                      : rowBg
                  }
                >
                  <td className="py-2 px-4 border-b">{item.artikelnummer}</td>
                  <td className="py-2 px-4 border-b">{item.bezeichnung}</td>
                  <td className="py-2 px-4 border-b">{item.kategorie}</td>
                  <td className="py-2 px-4 border-b">{item.bestand}</td>
                  <td className="py-2 px-4 border-b">{item.mindestbestand || ""}</td>
                  <td className="py-2 px-4 border-b">{item.einheit}</td>
                  <td className="py-2 px-4 border-b">{item.lieferant || ""}</td>
                  <td className="py-2 px-4 border-b">
                    {item.letzteBestellung ? item.letzteBestellung.toLocaleDateString("de-DE") : ""}
                  </td>
                  <td className="py-2 px-4 border-b">{item.bemerkungen || ""}</td>
                  <td className="py-2 px-4 border-b">
                    {item.gueltigkeit ? item.gueltigkeit.toLocaleDateString("de-DE") : ""}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {isExpiringSoon(item.gueltigkeit) && !item.alarmDeaktiviert && (
                      <FaExclamationTriangle
                        className="text-red-500 inline-block"
                        title="Achtung: Produkt läuft in weniger als 2 Monaten ab!"
                      />
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full md:w-1/2 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Inventur hinzufügen</h2>
            <form onSubmit={handleAddItem}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Artikelnummer *</label>
                <input
                  type="text"
                  placeholder="z.B. 12345"
                  value={newItem.artikelnummer || ""}
                  onChange={(e) => setNewItem({ ...newItem, artikelnummer: e.target.value })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Bezeichnung *</label>
                <input
                  type="text"
                  placeholder="z.B. Aspirin 500mg"
                  value={newItem.bezeichnung || ""}
                  onChange={(e) => setNewItem({ ...newItem, bezeichnung: e.target.value })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Kategorie *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Kategorie auswählen</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="add_new">Neue Kategorie hinzufügen</option>
                </select>
              </div>
              {selectedCategory === "add_new" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Neue Kategorie *</label>
                  <input
                    type="text"
                    placeholder="z.B. Schmerzmittel"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Bestand *</label>
                <input
                  type="number"
                  placeholder="z.B. 50"
                  value={newItem.bestand || ""}
                  onChange={(e) => setNewItem({ ...newItem, bestand: Number(e.target.value) })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Mindestbestand</label>
                <input
                  type="number"
                  placeholder="z.B. 10"
                  value={newItem.mindestbestand || ""}
                  onChange={(e) => setNewItem({ ...newItem, mindestbestand: Number(e.target.value) })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Einheit *</label>
                <input
                  type="text"
                  placeholder="z.B. Stück, ml"
                  value={newItem.einheit || ""}
                  onChange={(e) => setNewItem({ ...newItem, einheit: e.target.value })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Lieferant</label>
                <input
                  type="text"
                  placeholder="z.B. VetSupplies Inc."
                  value={newItem.lieferant || ""}
                  onChange={(e) => setNewItem({ ...newItem, lieferant: e.target.value })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Letzte Bestellung</label>
                <input
                  type="date"
                  value={newItem.letzteBestellung ? new Date(newItem.letzteBestellung).toISOString().split("T")[0] : ""}
                  onChange={(e) => setNewItem({ ...newItem, letzteBestellung: e.target.value ? new Date(e.target.value) : null })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Bemerkungen</label>
                <input
                  type="text"
                  placeholder="z.B. Kühl lagern"
                  value={newItem.bemerkungen || ""}
                  onChange={(e) => setNewItem({ ...newItem, bemerkungen: e.target.value })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Ablaufdatum</label>
                <input
                  type="date"
                  value={newItem.gueltigkeit ? new Date(newItem.gueltigkeit).toISOString().split("T")[0] : ""}
                  onChange={(e) => setNewItem({ ...newItem, gueltigkeit: e.target.value ? new Date(e.target.value) : null })}
                  className="mt-1 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end mt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryList;