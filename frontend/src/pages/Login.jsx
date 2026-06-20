import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "../contexts/AuthContext";
import Nav from "../components/Nav";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@filemorph.app");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-md mx-auto px-6 py-20 fade-in">
        <p className="label-eyebrow mb-8" data-testid="login-eyebrow">Form 02 — Login</p>
        <h1 className="font-serif text-5xl mb-10 leading-tight">Welcome back.</h1>
        <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
          <div>
            <div className="label-eyebrow mb-2">Email</div>
            <input className="fm-input" value={email} onChange={e => setEmail(e.target.value)} data-testid="login-email" required type="email" autoComplete="email"/>
          </div>
          <div>
            <div className="label-eyebrow mb-2">Password</div>
            <input className="fm-input" type="password" value={password} onChange={e => setPassword(e.target.value)} data-testid="login-password" required autoComplete="current-password"/>
          </div>
          {err && <div className="text-sm text-[#FF3B30]" data-testid="login-error">{err}</div>}
          <button className="fm-btn fm-btn-primary w-full" disabled={busy} data-testid="login-submit">
            {busy ? "Authenticating…" : "Sign In →"}
          </button>
        </form>
        <p className="mt-8 text-sm text-stone-600">
          No account? <Link to="/register" className="underline hover:text-[#FF3B30]" data-testid="register-link">Register here</Link>
        </p>
      </div>
    </div>
  );
}
