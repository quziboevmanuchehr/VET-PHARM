// src/App.tsx
import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null); // Typisierung für den Benutzer
  const [loading, setLoading] = useState<boolean>(true); // Typisierung für den Ladezustand

  useEffect(() => {
    // Überwacht den Authentifizierungsstatus
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Bereinigt den Listener bei der Demontage der Komponente
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <p>Loading...</p>; // Zeigt einen Ladezustand an
  }

  return user ? <Dashboard /> : <Login />; // Zeigt Dashboard oder Login an
};

export default App;