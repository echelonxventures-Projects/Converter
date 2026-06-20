import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { API } from "../lib/api";
import Nav from "../components/Nav";

const DEFAULT = {
  rotate: 0, flip_h: false, flip_v: false,
  grayscale: false, invert: false,
  brightness: 1, contrast: 1, saturation: 1,
  blur: 0, sharpen: false, out_format: "png",
};

export default function Editor() {
  const [params] = useSearchParams();
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [ops, setOps] = useState(DEFAULT);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("image"); // image | pdf-merge | pdf-split
  const [pdfFiles, setPdfFiles] = useState([]); // multi-uploads for merge
  const [splitRanges, setSplitRanges] = useState("1-2");

  useEffect(() => {
    const fid = params.get("file");
    if (fid) {
      // assume image
      setUploaded({ file_id: fid, ext: "png", filename: "from-convert", is_image: true });
    }
  }, [params]);

  const uploadImage = async () => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/files/upload", fd);
      if (!data.is_image) throw new Error("Please upload an image for the image editor.");
      setUploaded(data);
      setResult(null);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!uploaded) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const { data } = await api.post("/edit/image", { file_id: uploaded.file_id, ...ops });
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Edit failed");
    } finally { setBusy(false); }
  };

  // --- PDF merge / split ---
  const addPdfs = async (files) => {
    setBusy(true); setErr("");
    try {
      const list = [...pdfFiles];
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        const { data } = await api.post("/files/upload", fd);
        if (data.ext !== "pdf") throw new Error(`${f.name} is not a PDF`);
        list.push(data);
      }
      setPdfFiles(list);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  const doMerge = async () => {
    setBusy(true); setErr(""); setResult(null);
    try {
      const { data } = await api.post("/edit/pdf/merge", { file_ids: pdfFiles.map(p => p.file_id) });
      setResult({ ...data, multi: false });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Merge failed");
    } finally { setBusy(false); }
  };

  const doSplit = async () => {
    if (!uploaded || uploaded.ext !== "pdf") { setErr("Upload a PDF first."); return; }
    const ranges = splitRanges.split(",").map(r => r.split("-").map(x => parseInt(x.trim())));
    setBusy(true); setErr(""); setResult(null);
    try {
      const { data } = await api.post("/edit/pdf/split", { file_id: uploaded.file_id, ranges });
      setResult({ files: data.files, multi: true });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Split failed");
    } finally { setBusy(false); }
  };

  const uploadPdfForSplit = async () => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/files/upload", fd);
      if (data.ext !== "pdf") throw new Error("Please upload a PDF.");
      setUploaded(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-7xl mx-auto px-6 py-12 fade-in">
        <p className="label-eyebrow mb-4" data-testid="editor-eyebrow">§ Workshop — Editing Bench</p>
        <h1 className="font-serif text-5xl leading-tight mb-10">Edit. Crop. Filter. Merge. Split.</h1>

        {/* mode tabs */}
        <div className="flex gap-px bg-stone-200 mb-10 w-fit" data-testid="editor-modes">
          {[
            ["image", "Image Editor"],
            ["pdf-merge", "PDF · Merge"],
            ["pdf-split", "PDF · Split"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setMode(id); setResult(null); setErr(""); setUploaded(null); setFile(null); setPdfFiles([]); }}
              className={`px-6 py-3 text-xs uppercase tracking-[0.2em] ${mode === id ? "bg-stone-950 text-white" : "bg-white"}`}
              data-testid={`mode-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* IMAGE EDITOR */}
        {mode === "image" && (
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              {!uploaded && (
                <div className="fm-dropzone" onClick={() => document.getElementById("img-input").click()} data-testid="image-dropzone">
                  <p className="font-serif text-3xl mb-2">{file ? file.name : "Drop an image"}</p>
                  <p className="label-eyebrow">PNG · JPG · WEBP · BMP · GIF</p>
                  <input id="img-input" type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0])} data-testid="image-input"/>
                  <div className="mt-6">
                    <button className="fm-btn fm-btn-primary" onClick={(e) => { e.stopPropagation(); uploadImage(); }} disabled={!file || busy} data-testid="image-upload-btn">Upload →</button>
                  </div>
                </div>
              )}
              {uploaded && (
                <div className="fm-card p-2" data-testid="image-preview">
                  <img src={`${API}/files/preview/${uploaded.file_id}`} alt="preview" className="w-full h-auto"/>
                </div>
              )}
              {result && (
                <div className="fm-card p-6 mt-6" data-testid="image-result">
                  <div className="label-eyebrow mb-2">Output</div>
                  <div className="font-serif text-2xl mb-4">{result.filename}</div>
                  <a className="fm-btn fm-btn-primary" href={`${API}/files/download/${result.file_id}`} data-testid="download-edited">Download ↓</a>
                </div>
              )}
            </div>

            {uploaded && (
              <div className="lg:col-span-5 fm-card p-8 space-y-6" data-testid="image-controls">
                <h3 className="font-serif text-2xl">Adjustments</h3>

                <div className="grid grid-cols-4 gap-2">
                  {[0, 90, 180, 270].map(r => (
                    <button key={r} onClick={() => setOps({ ...ops, rotate: r })} className={`fm-btn ${ops.rotate === r ? "fm-btn-primary" : "fm-btn-secondary"}`} data-testid={`rotate-${r}`}>
                      {r}°
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button className={`fm-btn ${ops.flip_h ? "fm-btn-primary" : "fm-btn-secondary"}`} onClick={() => setOps({ ...ops, flip_h: !ops.flip_h })} data-testid="flip-h">Flip ⇄</button>
                  <button className={`fm-btn ${ops.flip_v ? "fm-btn-primary" : "fm-btn-secondary"}`} onClick={() => setOps({ ...ops, flip_v: !ops.flip_v })} data-testid="flip-v">Flip ⇅</button>
                </div>

                {[
                  ["Brightness", "brightness", 0.2, 2, 0.05],
                  ["Contrast", "contrast", 0.2, 2, 0.05],
                  ["Saturation", "saturation", 0, 2, 0.05],
                  ["Blur", "blur", 0, 10, 0.5],
                ].map(([label, key, min, max, step]) => (
                  <div key={key}>
                    <div className="flex justify-between label-eyebrow">
                      <span>{label}</span><span>{ops[key]}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={ops[key]} onChange={e => setOps({ ...ops, [key]: parseFloat(e.target.value) })} data-testid={`slider-${key}`}/>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-2">
                  <button className={`fm-btn ${ops.grayscale ? "fm-btn-primary" : "fm-btn-secondary"}`} onClick={() => setOps({ ...ops, grayscale: !ops.grayscale })} data-testid="toggle-grayscale">B&W</button>
                  <button className={`fm-btn ${ops.invert ? "fm-btn-primary" : "fm-btn-secondary"}`} onClick={() => setOps({ ...ops, invert: !ops.invert })} data-testid="toggle-invert">Invert</button>
                  <button className={`fm-btn ${ops.sharpen ? "fm-btn-primary" : "fm-btn-secondary"}`} onClick={() => setOps({ ...ops, sharpen: !ops.sharpen })} data-testid="toggle-sharpen">Sharpen</button>
                </div>

                <div>
                  <div className="label-eyebrow mb-2">Output Format</div>
                  <select className="fm-input" value={ops.out_format} onChange={e => setOps({ ...ops, out_format: e.target.value })} data-testid="out-format">
                    {["png", "jpg", "webp", "bmp"].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>

                {err && <div className="text-sm text-[#FF3B30]" data-testid="edit-error">{String(err)}</div>}

                <div className="flex gap-3">
                  <button className="fm-btn fm-btn-primary flex-1" onClick={apply} disabled={busy} data-testid="apply-edits">{busy ? "Working…" : "Apply →"}</button>
                  <button className="fm-btn fm-btn-secondary" onClick={() => setOps(DEFAULT)} data-testid="reset-edits">Reset</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF MERGE */}
        {mode === "pdf-merge" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="fm-card p-8" data-testid="merge-panel">
              <h3 className="font-serif text-2xl mb-4">Add PDFs to merge</h3>
              <input type="file" accept="application/pdf" multiple onChange={e => addPdfs(Array.from(e.target.files || []))} className="fm-input" data-testid="merge-input"/>
              <div className="mt-6 space-y-2" data-testid="merge-list">
                {pdfFiles.map((p, i) => (
                  <div key={p.file_id} className="flex justify-between items-center border border-stone-200 p-3">
                    <span className="font-mono text-sm">{i+1}. {p.filename}</span>
                    <button className="text-[#FF3B30] text-xs uppercase tracking-widest" onClick={() => setPdfFiles(pdfFiles.filter(x => x.file_id !== p.file_id))} data-testid={`remove-pdf-${i}`}>Remove</button>
                  </div>
                ))}
                {pdfFiles.length === 0 && <p className="label-eyebrow">No PDFs queued.</p>}
              </div>
              {err && <div className="text-sm text-[#FF3B30] mt-4">{String(err)}</div>}
              <button className="fm-btn fm-btn-primary mt-6" onClick={doMerge} disabled={pdfFiles.length < 2 || busy} data-testid="merge-submit">
                {busy ? "Merging…" : `Merge ${pdfFiles.length} PDFs →`}
              </button>
            </div>
            <div>
              {result && !result.multi && (
                <div className="fm-card p-8" data-testid="merge-result">
                  <div className="label-eyebrow mb-2">Output</div>
                  <div className="font-serif text-2xl mb-4">{result.filename}</div>
                  <a className="fm-btn fm-btn-primary" href={`${API}/files/download/${result.file_id}`} data-testid="download-merged">Download ↓</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF SPLIT */}
        {mode === "pdf-split" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="fm-card p-8" data-testid="split-panel">
              <h3 className="font-serif text-2xl mb-4">Upload PDF to split</h3>
              <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0])} className="fm-input" data-testid="split-input"/>
              <button className="fm-btn fm-btn-secondary mt-3" onClick={uploadPdfForSplit} disabled={!file || busy} data-testid="split-upload">Upload PDF</button>
              {uploaded && <div className="mt-4 label-eyebrow">Loaded: {uploaded.filename}</div>}
              <div className="mt-6">
                <div className="label-eyebrow mb-2">Page Ranges (e.g. <span className="font-mono">1-3,4-6</span>)</div>
                <input className="fm-input" value={splitRanges} onChange={e => setSplitRanges(e.target.value)} data-testid="split-ranges"/>
              </div>
              {err && <div className="text-sm text-[#FF3B30] mt-4">{String(err)}</div>}
              <button className="fm-btn fm-btn-primary mt-6" onClick={doSplit} disabled={!uploaded || busy} data-testid="split-submit">
                {busy ? "Splitting…" : "Split →"}
              </button>
            </div>
            <div>
              {result && result.multi && (
                <div className="fm-card p-8" data-testid="split-result">
                  <div className="label-eyebrow mb-4">Outputs</div>
                  <div className="space-y-3">
                    {result.files.map((r, i) => (
                      <div key={r.file_id} className="flex justify-between items-center border border-stone-200 p-3">
                        <div>
                          <div className="font-mono text-sm">{r.filename}</div>
                          <div className="label-eyebrow">{(r.size/1024).toFixed(1)} KB</div>
                        </div>
                        <a className="fm-btn fm-btn-secondary" href={`${API}/files/download/${r.file_id}`} data-testid={`download-split-${i}`}>Download ↓</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
