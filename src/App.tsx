// src/App.tsx
import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  return user ? <Dashboard /> : <Login />;
};

export default App;