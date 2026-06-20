import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Nav from "../components/Nav";
import { useAuth } from "../contexts/AuthContext";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("polling");
  const [item, setItem] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) { setStatus("error"); return; }

    let cancelled = false;
    let n = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/billing/status/${sessionId}`);
        if (cancelled) return;
        if (data.item_name) setItem(data.item_name);
        if (data.payment_status === "paid") {
          setStatus("paid");
          await refresh();
          return;
        }
        if (data.status === "expired") { setStatus("expired"); return; }
      } catch (e) {
        // ignore, retry
      }
      n += 1;
      setAttempts(n);
      if (n >= 8) { setStatus("timeout"); return; }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-24 fade-in text-center" data-testid="payment-return">
        <p className="label-eyebrow mb-4">§ Receipt</p>
        {status === "polling" && (
          <>
            <h1 className="font-serif text-5xl mb-4">Verifying payment…</h1>
            <p className="text-sm text-stone-700">Attempt {attempts + 1} of 8.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <h1 className="font-serif text-5xl mb-4">Payment received.</h1>
            <p className="text-base text-stone-700 mb-3">{item} has been applied to your account.</p>
            <p className="label-eyebrow mb-8">Filed under your account.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/dashboard" className="fm-btn fm-btn-primary" data-testid="payment-back-dashboard">Open Dashboard</Link>
              <Link to="/convert" className="fm-btn fm-btn-secondary">Convert a File</Link>
            </div>
          </>
        )}
        {status === "expired" && (
          <>
            <h1 className="font-serif text-5xl mb-4 text-[#FF3B30]">Session expired.</h1>
            <button className="fm-btn fm-btn-primary" onClick={() => nav("/pricing")}>Back to Pricing</button>
          </>
        )}
        {status === "timeout" && (
          <>
            <h1 className="font-serif text-5xl mb-4">Still processing.</h1>
            <p className="text-sm text-stone-700 mb-6">Check your dashboard in a moment — webhook will complete the order.</p>
            <Link to="/dashboard" className="fm-btn fm-btn-primary">Go to Dashboard</Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-serif text-5xl mb-4">Missing session.</h1>
            <Link to="/pricing" className="fm-btn fm-btn-primary">Back to Pricing</Link>
          </>
        )}
      </div>
    </div>
  );
}
