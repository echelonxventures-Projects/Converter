import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  const links = [
    { to: "/convert", label: "Convert" },
    { to: "/editor", label: "Editor" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/pricing", label: "Pricing" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200" data-testid="main-nav">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="brand-link">
          <span className="serial-num">№ 001</span>
          <span className="font-serif text-2xl tracking-tight">FileMorph</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-xs uppercase tracking-[0.2em] transition-colors ${
                loc.pathname === l.to ? "text-stone-950 border-b border-stone-950 pb-1" : "text-stone-500 hover:text-stone-950"
              }`}
              data-testid={`nav-${l.label.toLowerCase()}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:inline label-eyebrow" data-testid="user-email">{user.email}</span>
              <button className="fm-btn fm-btn-secondary" onClick={async () => { await logout(); nav("/"); }} data-testid="logout-btn">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="fm-btn fm-btn-secondary" data-testid="nav-login">Login</Link>
              <Link to="/register" className="fm-btn fm-btn-primary" data-testid="nav-register">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
