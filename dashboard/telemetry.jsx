/* ui_kits/architect-os/telemetry.jsx — chains + activity log + ROI heatmap */
const DT = window.HUD_DATA;

function TelemetryView() {
  return (
    <>
      {/* Top KPIs */}
      <div className="row-4">
        <Kpi label="SESSION ROI" value="78" of="/100" color="var(--phosphor)" delta="+12 vs 7d avg" spark={[40, 55, 60, 70, 65, 72, 78]} />
        <Kpi label="PATTERNS · 7D" value="187" delta="+24 saved" color="var(--violet)" spark={[2, 4, 1, 5, 3, 4, 5]} />
        <Kpi label="QUALITY · NIGHTLY" value="7.6" delta="▲ from 7.2" color="var(--amber)" spark={[6.9, 7.0, 7.1, 7.2, 7.3, 7.4, 7.6]} />
        <Kpi label="UPTIME · 24H" value="99.7" of="%" color="var(--cyan)" delta="9 services · all green" spark={[100, 100, 100, 100, 95, 100, 100]} />
      </div>

      {/* Chains + Activity */}
      <div className="row-2">
        <Panel eyebrow="EXECUTION CHAINS · LAST 24H" color="var(--claude)" dot tight
               meta={<><span>7 chains · 19 activations</span></>}>
          {DT.CHAINS.map(c => (
            <div key={c.id} className="list-row">
              <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 60px", gap: 12, alignItems: "center", width: "100%" }}>
                <span style={{
                  display: "inline-grid", placeItems: "center",
                  width: 22, height: 22, borderRadius: 4,
                  background: c.color + "1c", color: c.color, border: "1px solid " + c.color + "55",
                  fontWeight: 700, fontSize: 12,
                }}>{c.id}</span>
                <div>
                  <div className="name">chain-{c.id}-{c.name}</div>
                  <div className="meta" style={{ marginTop: 2 }}>{c.count > 0 ? `${c.count} activations · last ran ${c.id * 7}m ago` : "no runs in window"}</div>
                </div>
                <ScoreBar value={Math.min(c.count * 14, 100)} color={c.color} />
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.color, fontWeight: 600, fontSize: 13 }}>{c.count}</div>
              </div>
            </div>
          ))}
        </Panel>

        <Panel eyebrow="ACTIVITY LOG · LIVE TAIL" color="var(--phosphor)" dot tight
               meta={<><span>8 events · auto-scroll</span></>}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, padding: 0 }}>
            {DT.ACTIVITY.map((a, i) => {
              const c = a.lvl === "ok" ? "var(--phosphor)" : a.lvl === "warn" ? "var(--amber)" : a.lvl === "err" ? "var(--crimson)" : "var(--fg-3)";
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "70px 14px 1fr", gap: 10,
                  padding: "7px 14px", borderBottom: "1px solid var(--border-hairline)", alignItems: "baseline",
                }}>
                  <span style={{ color: "var(--fg-4)", fontVariantNumeric: "tabular-nums", fontSize: 10.5 }}>{a.t}</span>
                  <span style={{ color: c, fontWeight: 700, lineHeight: 1 }}>{a.lvl === "ok" ? "●" : a.lvl === "warn" ? "⚠" : a.lvl === "err" ? "✕" : "→"}</span>
                  <span style={{ color: "var(--fg-2)", lineHeight: 1.5 }}>{a.ev}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Phase health heatmap */}
      <Panel eyebrow="PHASE HEALTH · 7-DAY HEATMAP" color="var(--bone)"
             meta={<><span>cell = avg ROI / phase / day</span></>}>
        <div style={{ display: "grid", gridTemplateColumns: "100px repeat(7, 1fr)", gap: 4, fontSize: 10.5 }}>
          <div></div>
          {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d => (
            <div key={d} style={{ textAlign: "center", color: "var(--fg-4)", letterSpacing: "0.16em" }}>{d}</div>
          ))}
          {DT.PHASES.map(p => (
            <React.Fragment key={p.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: p.color, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em" }}>
                <Glyph id={p.id} size={16} />{p.name}
              </div>
              {Array.from({ length: 7 }, (_, i) => {
                const v = Math.round(40 + Math.random() * 55);
                const op = (v - 40) / 60;
                return (
                  <div key={i} title={`${v}/100`} style={{
                    height: 28,
                    background: p.color, opacity: 0.18 + op * 0.65,
                    borderRadius: 3,
                    display: "grid", placeItems: "center",
                    color: "var(--ink)", fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  }}>
                    {v}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </Panel>

      {/* Services row */}
      <Panel eyebrow="INFRASTRUCTURE · SERVICE HEALTH" color="var(--phosphor)" dot tight
             meta={<><span>all 9 services responding</span></>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            ["Ollama",      "localhost:11434", "ok",  "12ms"],
            ["ChromaDB",    "localhost:8000",  "ok",  "14ms"],
            ["Supabase",    "localhost:54321", "ok",  "8ms"],
            ["n8n",         "localhost:5678",  "ok",  "22ms"],
            ["LiteLLM",     "localhost:4000",  "ok",  "9ms"],
            ["AnythingLLM", "localhost:3001",  "ok",  "18ms"],
            ["Neo4j",       "localhost:7474",  "warn", "180ms"],
            ["Flowise",     "localhost:3000",  "ok",  "16ms"],
            ["Redis",       "127.0.0.1:6379",  "ok",  "2ms"],
          ].map(([n, addr, st, lat]) => (
            <div key={n} style={{
              display: "grid", gridTemplateColumns: "12px 1fr auto",
              alignItems: "center", gap: 10,
              padding: "9px 14px",
              borderRight: "1px solid var(--border-hairline)",
              borderBottom: "1px solid var(--border-hairline)",
            }}>
              <span className={st === "ok" ? "pulse" : ""} style={{
                width: 7, height: 7, borderRadius: "50%",
                background: st === "ok" ? "var(--phosphor)" : st === "warn" ? "var(--amber)" : "var(--crimson)",
              }} />
              <div>
                <div style={{ fontSize: 12, color: "var(--fg-1)" }}>{n}</div>
                <div style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{addr}</div>
              </div>
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 10.5, color: st === "ok" ? "var(--phosphor)" : "var(--amber)" }}>{lat}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Kpi({ label, value, of, delta, color, spark }) {
  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--border-1)",
      borderRadius: 6, padding: "12px 14px",
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.18em", color: "var(--fg-4)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "4px 0 4px" }}>
        <span style={{ fontSize: 32, fontWeight: 500, color, letterSpacing: "-0.025em", lineHeight: 1, fontVariantNumeric: "tabular-nums slashed-zero" }}>{value}</span>
        {of && <span style={{ fontSize: 13, color: "var(--fog)" }}>{of}</span>}
      </div>
      <div style={{ fontSize: 10.5, color }}>{delta}</div>
      <div style={{ marginTop: 6 }}>
        <Spark color={color} points={spark} h={22} />
      </div>
    </div>
  );
}

window.TelemetryView = TelemetryView;
