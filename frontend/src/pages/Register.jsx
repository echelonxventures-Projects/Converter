import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "../contexts/AuthContext";
import Nav from "../components/Nav";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await register(email, password, name);
      nav("/dashboard");
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-md mx-auto px-6 py-20 fade-in">
        <p className="label-eyebrow mb-8" data-testid="register-eyebrow">Form 01 — New Account</p>
        <h1 className="font-serif text-5xl mb-10 leading-tight">Open a desk at the bureau.</h1>
        <form onSubmit={onSubmit} className="space-y-5" data-testid="register-form">
          <div>
            <div className="label-eyebrow mb-2">Full Name</div>
            <input className="fm-input" value={name} onChange={e => setName(e.target.value)} data-testid="register-name" autoComplete="name"/>
          </div>
          <div>
            <div className="label-eyebrow mb-2">Email</div>
            <input className="fm-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="register-email" autoComplete="email"/>
          </div>
          <div>
            <div className="label-eyebrow mb-2">Password</div>
            <input className="fm-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} data-testid="register-password" autoComplete="new-password"/>
          </div>
          {err && <div className="text-sm text-[#FF3B30]" data-testid="register-error">{err}</div>}
          <button className="fm-btn fm-btn-primary w-full" disabled={busy} data-testid="register-submit">
            {busy ? "Creating…" : "Create Account →"}
          </button>
        </form>
        <p className="mt-8 text-sm text-stone-600">
          Already have one? <Link to="/login" className="underline hover:text-[#FF3B30]" data-testid="login-link">Login</Link>
        </p>
      </div>
    </div>
  );
}
