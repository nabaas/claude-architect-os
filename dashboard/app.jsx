/* ui_kits/architect-os/app.jsx — top-level shell */
const DApp = window.HUD_DATA;

function App() {
  const [tab, setTab] = useState("mission");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app" data-screen-label="Command Center HUD">
      {/* TOP BAR */}
      <div className="topbar">
        <div className="mark">C</div>
        <div className="word">CLAUDE<small>/ARCHITECT-OS</small></div>
        <div className="divider" />
        <div className="tabs">
          {DApp.SECTIONS.map(s => (
            <div key={s.id} className={"tab" + (tab === s.id ? " active" : "")} onClick={() => setTab(s.id)}>
              {s.label}
            </div>
          ))}
        </div>
        <div className="spacer" />
        <div className="status">
          <span className="pill" style={{ color: "var(--phosphor)" }}>
            <span className="dot pulse" style={{ background: "var(--phosphor)" }} />OPERATIONAL
          </span>
          <span className="pill" style={{ color: "var(--cyan)" }}>
            <span className="dot" style={{ background: "var(--cyan)" }} />CLAUDE-SONNET-4-6
          </span>
          <span className="pill" style={{ color: "var(--fg-3)" }}>
            <span className="dot" style={{ background: "var(--fg-3)" }} />37 AGENTS
          </span>
          <span className="ts">{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} MT</span>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="side">
        <div className="sect">
          <div className="eb">PHASES</div>
          {DApp.PHASES.map(p => (
            <div key={p.id} className="item">
              <span className="gl" style={{ background: p.color + "1c", color: p.color, border: "1px solid " + p.color + "55" }}>{p.id}</span>
              <span className="nm">{p.name}</span>
              <span className="ct">{p.active}/{p.agents}</span>
            </div>
          ))}
        </div>

        <div className="sect">
          <div className="eb">CHAINS</div>
          {DApp.CHAINS.slice(0, 7).map(c => (
            <div key={c.id} className="item">
              <span className="gl" style={{ background: c.color + "1c", color: c.color, border: "1px solid " + c.color + "55", fontSize: 11 }}>{c.id}</span>
              <span className="nm" style={{ fontSize: 11 }}>{c.name}</span>
              <span className="ct">{c.count > 0 ? `${c.count}×` : "—"}</span>
            </div>
          ))}
        </div>

        <div className="sect" style={{ marginTop: "auto" }}>
          <div className="eb">SYSTEM</div>
          <div className="stats">
            <div className="stat"><span className="lab">ROI · today</span><span className="val up">78 / 100</span></div>
            <div className="stat"><span className="lab">patterns</span><span className="val">187 (+24)</span></div>
            <div className="stat"><span className="lab">quality</span><span className="val up">7.6 / 10</span></div>
            <div className="stat"><span className="lab">trades · 24h</span><span className="val">1 · +$37.20</span></div>
            <div className="stat"><span className="lab">last upgrade</span><span className="val">02:55 MT</span></div>
            <div className="stat"><span className="lab">.HALT file</span><span className="val up">absent</span></div>
            <div className="stat"><span className="lab">api · 1d budget</span><span className="val warn">$3.40 / $10</span></div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        {tab === "mission" && <MissionView now={now} onTab={setTab} />}
        {tab === "agents" && <AgentsView />}
        {tab === "orchestrator" && <OrchestratorView />}
        {tab === "telemetry" && <TelemetryView />}
      </div>

      {/* FOOT */}
      <div className="foot">
        <span className="ok">●</span>
        <span>SESSION 20260522_070000_M3K9</span>
        <span>·</span>
        <span>LiteLLM @ localhost:4000</span>
        <span>·</span>
        <span>ChromaDB cmndcenter_patterns · 187 docs</span>
        <span>·</span>
        <span>n8n @ localhost:5678</span>
        <span style={{ marginLeft: "auto" }}>routeToAgent() ready · press ⌘ to open command palette</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
