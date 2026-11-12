import { useCallback, useEffect, useMemo, useState } from "react";
import { getApplications, getModelInfo, getStats, score } from "./api.js";

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

const Num = ({ text }) => <>{text}</>;

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
function Face({ pd, threshold, tone }) {
  // k: 1 = far below threshold (smile), 0 = at threshold (flat), -1 = well above (frown)
  const k = pd == null || !threshold ? 0 : Math.max(-1, Math.min(1, 1 - pd / threshold));
  const mouth = `M64 128Q100 ${(128 + k * 36).toFixed(1)} 136 128`;
  const open = `M62 124Q100 ${(124 + k * 58).toFixed(1)} 138 124Z`;
  const brow = k < -0.15 ? Math.min(1, -k) * 9 : 0;
  const idle = pd == null;
  return (
    <svg className={`face ${idle ? "idle" : tone}`} viewBox="0 0 200 212" role="img"
      aria-label={idle ? "No score yet" : tone === "ok" ? "Low risk" : "High risk"}>
      <defs>
        <radialGradient id="f-grad" cx="36%" cy="28%" r="80%">
          <stop offset="0" className="s1" />
          <stop offset="0.55" className="s2" />
          <stop offset="1" className="s3" />
        </radialGradient>
        <radialGradient id="f-shine" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="198" rx="54" ry="7" className="f-shadow" />
      <circle cx="100" cy="100" r="88" fill="url(#f-grad)" />
      <circle cx="100" cy="100" r="87" className="f-rim" />
      <ellipse cx="68" cy="52" rx="40" ry="24" transform="rotate(-24 68 52)" fill="url(#f-shine)" />
      {k > 0.2 && <><circle cx="46" cy="118" r="13" className="f-cheek" /><circle cx="154" cy="118" r="13" className="f-cheek" /></>}
      <g className="f-eyes">
        <ellipse cx="72" cy="88" rx="9" ry="12" className="f-ink" />
        <ellipse cx="128" cy="88" rx="9" ry="12" className="f-ink" />
        <circle cx="75" cy="83" r="3.2" fill="#fff" />
        <circle cx="131" cy="83" r="3.2" fill="#fff" />
      </g>
      {brow > 0 && (
        <>
          <path d={`M52 ${62 - brow / 2}L90 ${62 + brow}`} className="f-brow" />
          <path d={`M148 ${62 - brow / 2}L110 ${62 + brow}`} className="f-brow" />
        </>
      )}
      {k > 0.35 && <path d={open} className="f-open" />}
      <path className="f-mouth" style={{ d: `path("${mouth}")` }} d={mouth} />
      {k < -0.5 && <path d="M160 52c9 13 14 21 14 28a14 14 0 0 1-28 0c0-7 5-15 14-28Z" className="f-sweat" />}
    </svg>
  );
}

function ResultCard({ result, info, busy }) {
  const pd = result?.probability_of_default;
  const shown = useCountUp(pd);
  const threshold = result?.threshold ?? info?.threshold;
  const scale = Math.max(0.25, (threshold ?? 0.1) * 3);
  const tone = !result ? "idle" : result.decision === "approve" ? "ok" : "bad";
  return (
    <aside className="result" aria-label="Latest score">
      <div className={`stage ${tone}`}>
        <div className="stage-top">
          <span>Probability of default</span>
          <span className="result-ver">{info ? info.version : "offline"}</span>
        </div>
        <Face pd={pd} threshold={threshold} tone={tone} />
      </div>
      <div className="result-body">
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
            <span className="result-hint">Submit an application to see a decision</span>
          )}
          {threshold != null && <span className="result-meta">Reject at ≥ {pct(threshold, 0)}</span>}
        </div>
      </div>
    </aside>
  );
}

function Hero({ result, info, busy }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>Default risk for a loan application</h1>
        <p>Enter a borrower’s profile. The model returns a default probability and a decision.</p>
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
          <p className="sub">Income and dependents are optional</p>
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
    ["Average PD", s ? pct(s.avg, 2) : "–", "most recent 50"],
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

/* ---------------- Dashboard ---------------- */
const fmtTime = (iso) => new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Dashboard({ apps, stats, threshold }) {
  const [tab, setTab] = useState("all");
  const [hover, setHover] = useState(null);
  const rows = useMemo(() => (apps ?? []).filter((a) => tab === "all" || a.decision === tab), [apps, tab]);
  const bars = useMemo(() => [...rows].reverse(), [rows]);
  const max = Math.max(0.01, ...bars.map((a) => a.probability_of_default), threshold ?? 0) * 1.1;
  const daily = stats?.daily ?? [];

  return (
    <section className="history" id="dashboard" aria-labelledby="dash-h">
      <div className="history-head">
        <h2 id="dash-h">Recent decisions</h2>
        <div className="tabs" role="group" aria-label="Filter by decision">
          {[["all", "All"], ["approve", "Approved"], ["reject", "Rejected"]].map(([k, l]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card history-card">
        {apps == null && <p className="state">Loading applications…</p>}
        {apps?.length === 0 && <p className="state">No applications yet</p>}
        {apps?.length > 0 && (
          <>
            <div className="chart-head">
              <strong className="chart-total"><Num text={String(rows.length)} /></strong>
              <span className="sub">default probability per application, oldest → newest</span>
            </div>
            <div className="bars" onMouseLeave={() => setHover(null)}>
              {threshold != null && (
                <div className="thr" style={{ bottom: `${(threshold / max) * 100}%` }}><b>reject ≥ {pct(threshold, 0)}</b></div>
              )}
              {bars.map((a) => (
                <button
                  key={a.id}
                  className={`bar ${a.decision === "reject" ? "rej" : ""} ${hover === a.id ? "on" : ""}`}
                  style={{ height: `${Math.max(1, (a.probability_of_default / max) * 100)}%` }}
                  aria-label={`#${a.id}: ${pct(a.probability_of_default, 2)}, ${a.decision}`}
                  onMouseEnter={() => setHover(a.id)} onFocus={() => setHover(a.id)} onBlur={() => setHover(null)}
                >
                  {hover === a.id && <span className="tip">#{a.id} · {pct(a.probability_of_default, 2)}</span>}
                </button>
              ))}
            </div>

            {daily.length > 0 && (
              <div className="table-wrap">
                <table>
                  <caption className="sr">Daily totals</caption>
                  <thead><tr><th>Day</th><th className="num">Scored</th><th className="num">Approved</th><th className="num">Approval rate</th></tr></thead>
                  <tbody>
                    {daily.slice(-7).reverse().map((d) => (
                      <tr key={d.day}><td>{d.day}</td><td className="num">{d.total}</td><td className="num">{d.approved}</td><td className="num strong">{pct(d.approval_rate, 1)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Time</th><th className="num">Age</th><th className="num">Income</th><th className="num">Late 90+</th><th className="num">PD</th><th>Decision</th></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="mute">#{a.id}</td>
                      <td>{fmtTime(a.created_at)}</td>
                      <td className="num">{a.age}</td>
                      <td className="num">{a.monthly_income == null ? <span className="mute">–</span> : a.monthly_income.toLocaleString()}</td>
                      <td className="num">{a.late_90}</td>
                      <td className="num strong">{pct(a.probability_of_default, 2)}</td>
                      <td><span className={`pill ${a.decision === "approve" ? "ok" : "bad"}`}>{a.decision === "approve" ? "Approved" : "Rejected"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [info, setInfo] = useState(null);
  const [infoErr, setInfoErr] = useState(null);
  const [apps, setApps] = useState(null);
  const [stats, setStats] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(() => (location.hash === "#/decisions" ? "decisions" : "score"));

  useEffect(() => {
    const on = () => { setPage(location.hash === "#/decisions" ? "decisions" : "score"); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => { getModelInfo().then(setInfo).catch((e) => setInfoErr(e.message)); }, []);

  const load = useCallback(() => {
    getApplications().then(setApps).catch(() => setApps(null));
    getStats().then(setStats).catch(() => setStats(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const onResult = (r) => { setResult(r); load(); };

  return (
    <div className="page">
      <header className="nav">
        <span className="brand">Credit Scoring Desk</span>
        <nav className="nav-links" aria-label="Sections">
          <a href="#/" aria-current={page === "score" ? "page" : undefined}>New application</a>
          <a href="#/decisions" aria-current={page === "decisions" ? "page" : undefined}>Recent decisions</a>
        </nav>
        <span className={`status ${infoErr ? "down" : info ? "up" : ""}`}><i />{infoErr ? "API offline" : info ? "API online" : "Connecting"}</span>
      </header>

      <main id="top">
        {page === "score" ? (
          <>
            <Hero result={result} info={info} busy={busy} />
            <div className="overlap">
              <ScoreForm onResult={onResult} onBusy={setBusy} />
              <div className="side">
                <Tiles apps={apps} />
                <ModelCard info={info} error={infoErr} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="page-top"><Tiles apps={apps} /></div>
            <Dashboard apps={apps} stats={stats} threshold={info?.threshold} />
          </>
        )}
      </main>

    </div>
  );
}

