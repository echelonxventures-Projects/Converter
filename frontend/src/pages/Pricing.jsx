import { useEffect, useState } from "react";
import api from "../lib/api";
import Nav from "../components/Nav";
import { useAuth } from "../contexts/AuthContext";

export default function Pricing() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState({ plans: [], credit_packs: [] });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/billing/config").then(r => setCfg(r.data));
  }, []);

  const checkout = async (item_id, item_type) => {
    if (!user) { setErr("Please log in or register first."); return; }
    setBusy(`${item_type}:${item_id}`); setErr("");
    try {
      const { data } = await api.post("/billing/checkout", { item_id, item_type, origin_url: window.location.origin });
      window.location.href = data.url;
    } catch (e) {
      setErr(e?.response?.data?.detail || "Checkout failed");
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-7xl mx-auto px-6 py-16 fade-in">
        <p className="label-eyebrow mb-4" data-testid="pricing-eyebrow">§ IV — Subscription Ledger</p>
        <h1 className="font-serif text-5xl leading-tight mb-3">Choose your tier.</h1>
        <p className="text-sm text-stone-700 max-w-2xl mb-12">Flat monthly subscriptions for steady workloads, or top up with credit packs when you need a one-off.</p>

        {err && <div className="text-sm text-[#FF3B30] mb-6" data-testid="pricing-error">{String(err)}</div>}

        {/* Plans */}
        <div className="grid md:grid-cols-3 fm-grid mb-20" data-testid="plans-grid">
          {cfg.plans.map(p => (
            <div key={p.id} className={`relative ${p.highlight ? "bg-stone-950 text-white" : "bg-white"}`} data-testid={`plan-${p.id}`}>
              {p.highlight && <div className="absolute top-0 right-0 bg-[#FF3B30] text-white px-3 py-1 text-xs uppercase tracking-[0.2em]">Featured</div>}
              <div className={`label-eyebrow ${p.highlight ? "text-stone-400" : ""}`}>Tier — {p.id}</div>
              <h3 className="font-serif text-4xl mt-3">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-serif text-5xl">${p.price}</span>
                <span className={`text-xs uppercase tracking-[0.2em] ${p.highlight ? "text-stone-400" : "text-stone-500"}`}>/{p.interval}</span>
              </div>
              <ul className={`mt-8 space-y-3 text-sm ${p.highlight ? "text-stone-200" : "text-stone-700"}`}>
                {p.features.map(f => (
                  <li key={f} className="flex gap-3"><span className="text-[#FF3B30]">→</span>{f}</li>
                ))}
              </ul>
              <div className="mt-10">
                {p.price === 0 ? (
                  <button className={`fm-btn ${user?.plan_id === p.id ? "fm-btn-secondary" : "fm-btn-secondary"} w-full`} disabled data-testid={`plan-cta-${p.id}`}>
                    {user?.plan_id === p.id ? "Current Plan" : "Default"}
                  </button>
                ) : user?.plan_id === p.id ? (
                  <button className="fm-btn fm-btn-secondary w-full" disabled data-testid={`plan-cta-${p.id}`}>Current Plan</button>
                ) : (
                  <button className={`fm-btn ${p.highlight ? "fm-btn-danger" : "fm-btn-primary"} w-full`} onClick={() => checkout(p.id, "plan")} disabled={busy.startsWith("plan:")} data-testid={`plan-cta-${p.id}`}>
                    {busy === `plan:${p.id}` ? "Redirecting…" : p.cta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Credit Packs */}
        <div id="packs">
          <p className="label-eyebrow mb-4">§ V — Top-Up Vouchers</p>
          <h2 className="font-serif text-4xl mb-10">Credit Packs</h2>
          <div className="grid md:grid-cols-3 fm-grid" data-testid="packs-grid">
            {cfg.credit_packs.map(pk => (
              <div key={pk.id} className="bg-white" data-testid={`pack-${pk.id}`}>
                <div className="label-eyebrow">Voucher</div>
                <h3 className="font-serif text-3xl mt-3">{pk.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-serif text-4xl">${pk.price}</span>
                  <span className="label-eyebrow">one-time</span>
                </div>
                <p className="mt-4 text-sm text-stone-700">+ {pk.credits} extra conversions, never expire.</p>
                <div className="mt-8">
                  <button className="fm-btn fm-btn-primary w-full" onClick={() => checkout(pk.id, "pack")} disabled={busy.startsWith("pack:")} data-testid={`pack-cta-${pk.id}`}>
                    {busy === `pack:${pk.id}` ? "Redirecting…" : "Buy →"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-16 label-eyebrow">Stripe test mode · use card 4242 4242 4242 4242 for testing</p>
      </div>
    </div>
  );
}
