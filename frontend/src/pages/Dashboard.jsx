import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { API } from "../lib/api";
import Nav from "../components/Nav";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get("/files/history").then(r => setHistory(r.data.items || [])).catch(() => {});
    refresh();
    // eslint-disable-next-line
  }, []);

  const usage = user?.usage || { used_today: 0, credit_balance: 0 };

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-7xl mx-auto px-6 py-16 fade-in">
        <p className="label-eyebrow mb-4" data-testid="dashboard-eyebrow">§ III — Operations Desk</p>
        <h1 className="font-serif text-5xl leading-tight mb-12">Good day, <span className="italic">{user?.name || user?.email}</span>.</h1>

        {/* Control Room Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 fm-grid mb-14" data-testid="dashboard-stats">
          <div>
            <div className="label-eyebrow">Current Plan</div>
            <div className="font-serif text-3xl mt-2 uppercase">{user?.plan_id || "Free"}</div>
            <Link to="/pricing" className="text-xs uppercase tracking-[0.2em] mt-3 inline-block hover:text-[#FF3B30]" data-testid="upgrade-link">Manage →</Link>
          </div>
          <div>
            <div className="label-eyebrow">Used Today</div>
            <div className="font-serif text-3xl mt-2">{usage.used_today}</div>
            <div className="text-xs text-stone-500 mt-3">Resets at midnight UTC</div>
          </div>
          <div>
            <div className="label-eyebrow">Credit Balance</div>
            <div className="font-serif text-3xl mt-2">{usage.credit_balance || 0}</div>
            <Link to="/pricing#packs" className="text-xs uppercase tracking-[0.2em] mt-3 inline-block hover:text-[#FF3B30]" data-testid="buy-credits-link">Buy Credits →</Link>
          </div>
          <div>
            <div className="label-eyebrow">Account Email</div>
            <div className="font-mono text-sm mt-3 break-all">{user?.email}</div>
            <div className="text-xs text-stone-500 mt-3">Role: {user?.role || "user"}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 gap-6 mb-14">
          <Link to="/convert" className="fm-card p-8 hover:border-stone-950 transition-colors block" data-testid="quick-convert">
            <div className="label-eyebrow">Action 01</div>
            <div className="font-serif text-4xl mt-3 mb-2">Convert →</div>
            <p className="text-sm text-stone-600">Upload a file and pick a target format.</p>
          </Link>
          <Link to="/editor" className="fm-card p-8 hover:border-stone-950 transition-colors block" data-testid="quick-editor">
            <div className="label-eyebrow">Action 02</div>
            <div className="font-serif text-4xl mt-3 mb-2">Editor →</div>
            <p className="text-sm text-stone-600">Crop, filter images. Merge & split PDFs.</p>
          </Link>
        </div>

        {/* History */}
        <div className="fm-card">
          <div className="p-6 border-b border-stone-200 flex items-center justify-between">
            <div>
              <div className="label-eyebrow">§ Archive</div>
              <h2 className="font-serif text-2xl mt-1">Recent Conversions</h2>
            </div>
            <span className="text-xs text-stone-500">{history.length} entries</span>
          </div>
          {history.length === 0 ? (
            <div className="p-16 text-center" data-testid="history-empty">
              <div className="label-eyebrow mb-3">Empty Drawer</div>
              <p className="font-serif text-3xl mb-3">Nothing filed yet.</p>
              <p className="text-sm text-stone-600 mb-6">Convert your first file to begin an archive.</p>
              <Link to="/convert" className="fm-btn fm-btn-primary">Begin →</Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-200" data-testid="history-list">
              {history.map((h, i) => (
                <div key={h.file_id} className="p-5 flex items-center justify-between hover:bg-stone-50">
                  <div className="flex items-center gap-6">
                    <span className="serial-num">№ {String(i+1).padStart(3,"0")}</span>
                    <div>
                      <div className="font-mono text-sm">{h.filename}</div>
                      <div className="label-eyebrow mt-1">
                        {h.kind} · {(h.size/1024).toFixed(1)} KB · {new Date(h.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <a className="fm-btn fm-btn-secondary" href={`${API}/files/download/${h.file_id}`} data-testid={`download-${h.file_id}`}>Download ↓</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
