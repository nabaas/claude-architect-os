/* ui_kits/architect-os/agents.jsx — 37-agent registry grid */
const DA = window.HUD_DATA;

function AgentsView() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  const phases = DA.PHASES;
  const grouped = phases.map(p => ({
    ...p,
    items: DA.AGENTS.filter(a => a.ph === p.id),
  }));

  const total = DA.AGENTS.length;
  const live = DA.AGENTS.filter(a => a.st === "live").length;
  const proc = DA.AGENTS.filter(a => a.st === "proc").length;
  const fail = DA.AGENTS.filter(a => a.st === "fail").length;

  return (
    <>
      <div className="row-2" style={{ gridTemplateColumns: "1fr auto" }}>
        <div>
          <Eyebrow color="var(--violet)" dot>AGENT REGISTRY · LOKI MODE</Eyebrow>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg-1)", margin: "4px 0 0", lineHeight: 1.1 }}>
            37 specialists. 7 phases. One coordinator.
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill color="#7ee787" dot pulse>{live} LIVE</Pill>
          <Pill color="#f5a524" dot pulse>{proc} PROC</Pill>
          <Pill color="#ff5d5d">{fail} FAIL</Pill>
          <Pill color="#8b8798">{total - live - proc - fail} IDLE</Pill>
        </div>
      </div>

      {grouped.map(p => (
        <Panel
          key={p.id}
          eyebrow={<><span style={{ marginRight: 8 }}><Glyph id={p.id} size={16} /></span>{p.name} · {p.items.length} agents</>}
          color={p.color}
          meta={<><span>{p.items.filter(a => a.st === "live").length} live</span><span>·</span><span>{Math.round(p.items.reduce((s, a) => s + a.succ, 0) / p.items.length)}% avg</span></>}
          tight
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 0 }}>
            {p.items.map(a => (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  background: "transparent",
                  border: 0,
                  borderRight: "1px solid var(--border-hairline)",
                  borderBottom: "1px solid var(--border-hairline)",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--fg-2)",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(201,196,184,0.025)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Glyph id={a.ph} size={20} />
                <div>
                  <div style={{ fontSize: 12, color: "var(--fg-1)" }}>{a.id} <span style={{ color: "var(--fog)", fontSize: 10.5 }}>v{a.v}</span></div>
                  <div style={{ fontSize: 10.5, color: "var(--fg-4)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {a.run} · {a.succ}%
                  </div>
                </div>
                <StatusDot st={a.st} />
              </button>
            ))}
          </div>
        </Panel>
      ))}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(7, 6, 10, 0.6)",
            backdropFilter: "blur(6px)", zIndex: 10,
            display: "grid", placeItems: "center", padding: 40,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="panel"
            style={{ width: 520, maxWidth: "100%", boxShadow: "var(--shadow-3)" }}
          >
            <div className="panel-h">
              <Glyph id={selected.ph} size={20} />
              <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>{selected.id}</span>
              <span style={{ color: "var(--fog)", fontSize: 11 }}>v{selected.v}</span>
              <div className="meta"><StatusDot st={selected.st} /></div>
            </div>
            <div className="panel-b">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <Stat label="PHASE" value={PHASE_BY_ID[selected.ph].name} color={PHASE_BY_ID[selected.ph].color} />
                <Stat label="SUCCESS" value={`${selected.succ}%`} color="var(--phosphor)" />
                <Stat label="LAST RUN" value={selected.run} color="var(--fg-1)" />
              </div>
              <Eyebrow>SYSTEM PROMPT · agents/{PHASE_BY_ID[selected.ph].name.toLowerCase()}/{selected.id}.md</Eyebrow>
              <pre style={{
                marginTop: 8,
                background: "var(--bg-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 6,
                padding: 12,
                fontSize: 11.5,
                color: "var(--phosphor-bright)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
{`<system>
  <identity>${selected.id} — phase ${PHASE_BY_ID[selected.ph].name}</identity>
  <model>claude-sonnet-4-6</model>
  <protocol>
    - read agents/registry.json
    - load patterns matching domain
    - emit implementation-ready output
  </protocol>
</system>`}
              </pre>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn btn-primary">▶ INVOKE</button>
                <button className="btn btn-secondary">edit prompt</button>
                <button className="btn btn-ghost">view registry entry</button>
                <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setSelected(null)}>esc</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-1)", borderRadius: 4, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.18em", color: "var(--fg-4)" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

window.AgentsView = AgentsView;
