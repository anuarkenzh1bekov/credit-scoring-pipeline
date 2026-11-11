import { useCallback, useEffect, useMemo, useState } from "react";
import { getApplications, getModelInfo, score } from "./api.js";

const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;

const FIELDS = [
  { key: "age", label: "Age", hint: "18–120", step: 1, int: true, min: 18 },
  { key: "monthly_income", label: "Monthly income", hint: "USD, optional", step: 1, optional: true },
  { key: "revolving_utilization", label: "Revolving utilization", hint: "0.35 = 35%", step: "any" },
  { key: "debt_ratio", label: "Debt ratio", hint: "Debt / income", step: "any" },
  { key: "open_credit_lines", label: "Open credit lines", hint: "Loans and cards", step: 1, int: true },
  { key: "real_estate_loans", label: "Real estate loans", hint: "Mortgages, HELOC", step: 1, int: true },
  { key: "late_30_59", label: "Late 30–59 days", hint: "Times", step: 1 },
  { key: "late_60_89", label: "Late 60–89 days", hint: "Times", step: 1, int: true },
  { key: "late_90", label: "Late 90+ days", hint: "Times", step: 1, int: true },
  { key: "dependents", label: "Dependents", hint: "Optional", step: 1, int: true, optional: true },
];

const EXAMPLE = {
  age: "42", monthly_income: "5400", revolving_utilization: "0.35", debt_ratio: "0.3",
  open_credit_lines: "8", real_estate_loans: "1", late_30_59: "0", late_60_89: "0", late_90: "0", dependents: "2",
};

const Arrow = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12 12 4M5.5 4H12v6.5" />
  </svg>
);

/** "4.20%" -> 4 bold, ".20%" muted — the decimal treatment from the fintech reference. */
function Num({ text }) {
  const i = text.indexOf(".");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="dim">{text.slice(i)}</span></>;
}

function useCountUp(target, ms = 800) {
  const [v, setV] = useState(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* ---------------- Hero ---------------- */
function ResultCard({ result, info, busy }) {
  const pd = result?.probability_of_default;
  const shown = useCountUp(pd);
  const threshold = result?.threshold ?? info?.threshold;
  const scale = Math.max(0.25, (threshold ?? 0.1) * 3);
  const tone = !result ? "idle" : result.decision === "approve" ? "ok" : "bad";
  return (
    <aside className="result" aria-label="Latest score">
      <div className="result-top">
        <span>PD · latest score</span>
        <span className="result-ver">{info ? info.version : "offline"}</span>
      </div>
      <p className="result-num" aria-live="polite">
        {busy ? <span className="dim">Scoring…</span> : pd == null ? <span className="dim">–.–%</span> : <Num text={pct(shown, 2)} />}
      </p>
      <div className="meter" role="img" aria-label={threshold != null ? `Reject threshold ${pct(threshold, 0)}` : "Threshold unknown"}>
        <i className={`meter-fill ${tone}`} style={{ width: `${Math.min(100, ((pd ?? 0) / scale) * 100)}%` }} />
        {threshold != null && <b className="meter-tick" style={{ left: `${(threshold / scale) * 100}%` }} />}
      </div>
      <div className="result-foot">
        {result ? (
          <span className={`verdict ${tone}`}>{result.decision === "approve" ? "Approved" : "Rejected"}</span>
        ) : (
          <span className="result-hint">Submit an application to see a decision.</span>
        )}
        {threshold != null && <span className="result-meta">Reject at ≥ {pct(threshold, 0)}</span>}
      </div>
    </aside>
  );
}

function Hero({ result, info, busy }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>
          <span>Know the risk</span>
          <span><em>before</em> you lend.</span>
        </h1>
        <p>Enter a borrower’s profile. The trained model returns a default probability and a clear decision.</p>
      </div>
      <ResultCard result={result} info={info} busy={busy} />
    </section>
  );
}

/* ---------------- Form ---------------- */
function ScoreForm({ onResult, onBusy }) {
  const [vals, setVals] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {};
    for (const f of FIELDS) {
      const raw = (vals[f.key] ?? "").trim();
      if (raw === "") {
        if (!f.optional) { setError(`${f.label} is required.`); return; }
        payload[f.key] = null;
      } else {
        const n = Number(raw);
        if (Number.isNaN(n)) { setError(`${f.label} must be a number.`); return; }
        payload[f.key] = n;
      }
    }
    setBusy(true);
    onBusy(true);
    try { onResult(await score(payload)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); onBusy(false); }
  };

  return (
    <section className="card form-card" id="score" aria-labelledby="form-h">
      <header className="card-head">
        <div>
          <h2 id="form-h">New application</h2>
          <p className="sub">Ten inputs. Income and dependents can stay empty.</p>
        </div>
        <button type="button" className="chip-btn" onClick={() => setVals(EXAMPLE)}>Fill example</button>
      </header>
      <form onSubmit={submit} noValidate>
        <div className="fields">
          {FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <input
                type="number" inputMode={f.int ? "numeric" : "decimal"} step={f.step} min={f.min ?? 0}
                value={vals[f.key] ?? ""} placeholder={f.hint}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit" type="submit" disabled={busy}>
          {busy ? "Scoring…" : "Get decision"} <span className="submit-ic">{Arrow}</span>
        </button>
      </form>
    </section>
  );
}

/* ---------------- Stat tiles + black model card ---------------- */
function Tiles({ apps }) {
  const s = useMemo(() => {
    if (!apps?.length) return null;
    const approved = apps.filter((a) => a.decision === "approve").length;
    return { n: apps.length, approved, rejected: apps.length - approved, avg: apps.reduce((t, a) => t + a.probability_of_default, 0) / apps.length };
  }, [apps]);
  const tiles = [
    ["Scored", s ? String(s.n) : "–", "applications"],
    ["Approved", s ? String(s.approved) : "–", s ? pct(s.approved / s.n, 0) + " of scored" : ""],
    ["Rejected", s ? String(s.rejected) : "–", s ? pct(s.rejected / s.n, 0) + " of scored" : ""],
    ["Average PD", s ? pct(s.avg, 2) : "–", "across recent"],
  ];
  return (
    <div className="tiles">
      {tiles.map(([label, value, note]) => (
        <div className="tile" key={label}>
          <span className="tile-label">{label}</span>
          <strong className="tile-num"><Num text={value} /></strong>
          <span className="tile-note">{note || (apps ? "Score one to start" : "Loading…")}</span>
        </div>
      ))}
    </div>
  );
}

function ModelCard({ info, error }) {
  const entries = info ? Object.entries(info.metrics ?? {}) : [];
  return (
    <section className="card dark model" aria-labelledby="model-h">
      <header className="card-head">
        <h2 id="model-h">Model quality</h2>
        <span className="chip-dark">{info ? info.version : "—"}</span>
      </header>
      {error && <p className="state-dark">Can’t load model info. {error}</p>}
      {!info && !error && <div className="skeleton-stack">{[0, 1].map((i) => <div key={i} className="skeleton dark-sk" />)}</div>}
      {info && (
        <>
          <p className="dark-big"><Num text={pct(info.threshold, 1)} /><span> reject threshold</span></p>
          <ul className="metrics">
            {entries.map(([k, v]) => (
              <li key={k}>
                <span>{k.replace(/_/g, " ")}</span>
                <strong>{typeof v === "number" ? v.toFixed(3) : String(v)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [info, setInfo] = useState(null);
  const [infoErr, setInfoErr] = useState(null);
  const [apps, setApps] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getModelInfo().then(setInfo).catch((e) => setInfoErr(e.message)); }, []);

  const load = useCallback(() => {
    getApplications().then(setApps).catch(() => setApps(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const onResult = (r) => { setResult(r); load(); };

  return (
    <div className="page">
      <header className="nav">
        <span className={`status ${infoErr ? "down" : info ? "up" : ""}`}><i />{infoErr ? "API offline" : info ? "API online" : "Connecting"}</span>
      </header>

      <main id="top">
        <Hero result={result} info={info} busy={busy} />
        <div className="overlap">
          <ScoreForm onResult={onResult} onBusy={setBusy} />
          <div className="side">
            <Tiles apps={apps} />
            <ModelCard info={info} error={infoErr} />
          </div>
        </div>
      </main>

    </div>
  );
}

