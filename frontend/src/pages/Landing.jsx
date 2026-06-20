import { Link } from "react-router-dom";
import Nav from "../components/Nav";

export default function Landing() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-12 gap-12 fade-in" data-testid="landing-hero">
        <div className="lg:col-span-7">
          <p className="label-eyebrow mb-8" data-testid="hero-eyebrow">№ Volume I — File Bureau</p>
          <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl tracking-tight leading-[0.95] text-stone-950">
            Convert anything.<br/>
            <span className="italic">Edit precisely.</span><br/>
            <span className="text-[#FF3B30]">Done.</span>
          </h1>
          <p className="mt-10 max-w-xl text-base text-stone-700 leading-relaxed">
            FileMorph is a precision file bureau for the modern desk. Drop in a PDF, an image, a spreadsheet — pick a format, edit if you must, and receive a clean file at the other end.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link to="/register" className="fm-btn fm-btn-primary" data-testid="hero-cta-register">Open Account</Link>
            <Link to="/convert" className="fm-btn fm-btn-secondary" data-testid="hero-cta-try">Try Without Signing Up →</Link>
          </div>
          <div className="mt-12 grid grid-cols-3 max-w-md border-t border-l border-stone-200">
            {[
              { k: "Formats", v: "30+" },
              { k: "Editing", v: "Advanced" },
              { k: "Storage", v: "24 hrs" },
            ].map(s => (
              <div key={s.k} className="p-4 border-r border-b border-stone-200">
                <div className="label-eyebrow">{s.k}</div>
                <div className="font-serif text-2xl mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <div className="fm-card p-0 overflow-hidden">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <span className="label-eyebrow">Specimen.001 — In-Tray</span>
              <span className="text-xs text-[#FF3B30]">● LIVE</span>
            </div>
            <div className="p-8 grid grid-cols-2 gap-px bg-stone-200">
              {[
                ["PDF","→ DOCX"],["JPG","→ PNG"],["XLSX","→ CSV"],
                ["PNG","→ PDF"],["DOCX","→ TXT"],["CSV","→ JSON"],
              ].map(([a,b]) => (
                <div key={a} className="bg-white p-6">
                  <div className="font-serif text-3xl">{a}</div>
                  <div className="label-eyebrow mt-2">{b}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-stone-200 flex items-center justify-between">
              <span className="serial-num">Queued: 6 · Cleared: 4,812</span>
              <Link to="/convert" className="text-xs uppercase tracking-[0.2em] hover:text-[#FF3B30]">Enter Bureau →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="fm-marquee" data-testid="marquee">
        <div className="fm-marquee-track">
          {Array.from({length: 2}).map((_,i) => (
            <span key={i}>
              <span>Bureau of Files</span><span>Filed under: Precision</span><span>Archival Quality</span>
              <span>Encrypted Transit</span><span>Editor included</span><span>Stripe Billing</span>
            </span>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <section className="max-w-7xl mx-auto px-6 py-24" data-testid="capabilities-section">
        <div className="grid lg:grid-cols-12 gap-12 mb-12">
          <div className="lg:col-span-4">
            <p className="label-eyebrow mb-4">Capabilities — § II</p>
            <h2 className="font-serif text-5xl leading-[1.05]">A complete workshop for every file.</h2>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 fm-grid">
            {[
              { t: "Images", d: "PNG · JPG · WEBP · BMP · GIF · TIFF · ICO. Crop, rotate, filters, sharpen." },
              { t: "Documents", d: "PDF · DOCX · TXT. Extract text. Convert seamlessly between formats." },
              { t: "Spreadsheets", d: "CSV · XLSX · TSV · JSON. Any structured file to Excel in one click." },
              { t: "PDF Tools", d: "Merge, split, extract pages. Combine multiple PDFs into one." },
            ].map(c => (
              <div key={c.t}>
                <div className="label-eyebrow mb-3">Folio</div>
                <h3 className="font-serif text-2xl mb-2">{c.t}</h3>
                <p className="text-sm text-stone-700 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-10">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="font-serif text-xl">FileMorph</span>
            <span className="ml-3 label-eyebrow">est. mmxxvi</span>
          </div>
          <p className="label-eyebrow">A bureau by precision · all rights filed</p>
        </div>
      </footer>
    </div>
  );
}
