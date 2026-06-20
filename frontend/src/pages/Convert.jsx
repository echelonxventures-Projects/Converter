import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { API } from "../lib/api";
import Nav from "../components/Nav";

export default function Convert() {
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (uploaded?.available_targets?.length) setTarget(uploaded.available_targets[0]);
  }, [uploaded]);

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) setFile(f);
  };

  const doUpload = async () => {
    if (!file) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setUploaded(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload failed. Are you logged in?");
    } finally { setBusy(false); }
  };

  const doConvert = async () => {
    if (!uploaded || !target) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const { data } = await api.post("/convert", { file_id: uploaded.file_id, target_format: target });
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Conversion failed");
    } finally { setBusy(false); }
  };

  const reset = () => { setFile(null); setUploaded(null); setResult(null); setErr(""); };

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav />
      <div className="max-w-5xl mx-auto px-6 py-14 fade-in">
        <p className="label-eyebrow mb-4" data-testid="convert-eyebrow">§ Bureau — Conversion Desk</p>
        <h1 className="font-serif text-5xl leading-tight mb-12">Submit a file for conversion.</h1>

        {!uploaded && (
          <div
            className={`fm-dropzone ${drag ? "active" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("file-input").click()}
            data-testid="upload-dropzone"
          >
            <p className="font-serif text-4xl mb-3">{file ? "Ready to upload." : "Drop a file here."}</p>
            <p className="label-eyebrow mb-6">or click to browse</p>
            <input id="file-input" type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} data-testid="file-input"/>
            {file && (
              <div className="mt-6 inline-flex items-center gap-4 fm-card px-6 py-3">
                <span className="font-mono text-sm">{file.name}</span>
                <span className="label-eyebrow">{(file.size/1024).toFixed(1)} KB</span>
              </div>
            )}
            <div className="mt-8">
              <button className="fm-btn fm-btn-primary" onClick={(e) => { e.stopPropagation(); doUpload(); }} disabled={!file || busy} data-testid="upload-submit">
                {busy ? "Uploading…" : "Upload File →"}
              </button>
            </div>
          </div>
        )}

        {uploaded && (
          <div className="fm-card p-8" data-testid="convert-panel">
            <div className="grid sm:grid-cols-2 gap-px bg-stone-200 mb-8">
              <div className="bg-white p-5">
                <div className="label-eyebrow">Source</div>
                <div className="font-mono text-sm mt-2 break-all">{uploaded.filename}</div>
                <div className="label-eyebrow mt-3">{uploaded.ext.toUpperCase()} · {(uploaded.size/1024).toFixed(1)} KB</div>
              </div>
              <div className="bg-white p-5">
                <div className="label-eyebrow">Target Format</div>
                <select className="fm-input mt-2" value={target} onChange={e => setTarget(e.target.value)} data-testid="target-select">
                  {uploaded.available_targets.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  {uploaded.ext !== "xlsx" && !uploaded.available_targets.includes("xlsx") && <option value="xlsx">XLSX (any → Excel)</option>}
                </select>
              </div>
            </div>

            {err && <div className="text-sm text-[#FF3B30] mb-4" data-testid="convert-error">{String(err)}</div>}

            {!result ? (
              <div className="flex items-center gap-3">
                <button className="fm-btn fm-btn-primary" onClick={doConvert} disabled={busy} data-testid="convert-submit">
                  {busy ? "Working…" : `Convert to .${target.toUpperCase()} →`}
                </button>
                <button className="fm-btn fm-btn-secondary" onClick={reset} data-testid="reset-btn">Start Over</button>
                {uploaded.is_image && (
                  <Link to={`/editor?file=${uploaded.file_id}`} className="fm-btn fm-btn-secondary ml-auto" data-testid="open-editor-link">Open in Editor ↗</Link>
                )}
              </div>
            ) : (
              <div className="border border-stone-200 p-6 bg-stone-50" data-testid="convert-result">
                <div className="label-eyebrow mb-2">Result Filed</div>
                <div className="font-serif text-3xl mb-2">{result.filename}</div>
                <div className="label-eyebrow mb-6">{(result.size/1024).toFixed(1)} KB</div>
                <div className="flex gap-3">
                  <a className="fm-btn fm-btn-primary" href={`${API}/files/download/${result.file_id}`} data-testid="download-result">Download ↓</a>
                  <button className="fm-btn fm-btn-secondary" onClick={reset} data-testid="convert-another">Convert Another</button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-12 label-eyebrow">Supported: images · PDF · DOCX · TXT · CSV · XLSX · TSV · JSON · any → XLSX</p>
      </div>
    </div>
  );
}
