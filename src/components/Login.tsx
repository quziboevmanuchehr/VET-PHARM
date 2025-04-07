import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Login.css";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("⚠ Bitte füllen Sie alle Felder aus.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError("❌ Login fehlgeschlagen: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">🐾 VetPharma Login</h2>
        <p className="login-subtitle">
          Melde dich an, um deinen Dienstplan zu verwalten
        </p>

        {error && <p className="alert alert-danger">{error}</p>}

        <div className="mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="📧 Email"
            className="form-control"
            disabled={loading}
          />
        </div>
        <div className="mb-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="🔑 Passwort"
            className="form-control"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleLogin}
          className="btn btn-primary w-100"
          disabled={loading}
        >
          {loading ? "🔄 Einloggen..." : "🚀 Login"}
        </button>

        <div className="paw-prints mt-4">🐾 🐾 🐾</div>
      </div>
    </div>
  );
};

export default Login;