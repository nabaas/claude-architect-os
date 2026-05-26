/* ui_kits/architect-os/orchestrator.jsx — 7-layer prompt composer */
const DO = window.HUD_DATA;

function OrchestratorView() {
  const [layers, setLayers] = useState(DO.PROMPT_LAYERS);
  const [selected, setSelected] = useState(layers[0].key);

  const active = layers.filter(l => l.on);
  const composed = active.map(l => `## [${l.label}]\n${l.sample}`).join("\n\n");
  const approxTokens = Math.round(composed.length / 4);

  const toggle = key => setLayers(ls => ls.map(l => l.key === key ? { ...l, on: !l.on } : l));
  const sel = layers.find(l => l.key === selected);

  return (
    <>
      <div className="row-2" style={{ gridTemplateColumns: "1fr auto" }}>
        <div>
          <Eyebrow color="var(--cyan)" dot>PROMPT ORCHESTRATOR · 7-LAYER INHERITANCE</Eyebrow>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg-1)", margin: "4px 0 0" }}>
            SYSTEM → MISSION → ROLE → TASK → CONTEXT → MEMORY → LIVE-DATA
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill color="#7ee787">{active.length} / {layers.length} active</Pill>
          <Pill color="#7dd3fc">~{approxTokens} tokens</Pill>
          <button className="btn btn-primary">⌘⏎ compose</button>
        </div>
      </div>

      <div className="row-2" style={{ gridTemplateColumns: "1.05fr 1.4fr" }}>
        {/* Left: layer list */}
        <Panel eyebrow="PROMPT STACK" color="var(--cyan)" tight
               meta={<><span>{active.length} active</span></>}>
          {layers.map((l, i) => (
            <button
              key={l.key}
              onClick={() => setSelected(l.key)}
              style={{
                display: "grid",
                gridTemplateColumns: "26px 1fr auto auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                width: "100%",
                background: selected === l.key ? "rgba(217,119,87,0.05)" : "transparent",
                borderLeft: selected === l.key ? "2px solid var(--claude)" : "2px solid transparent",
                borderBottom: "1px solid var(--border-hairline)",
                border: "0",
                borderBottom: "1px solid var(--border-hairline)",
                cursor: "pointer", color: "var(--fg-2)", textAlign: "left",
                position: "relative",
              }}
            >
              {selected === l.key && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--claude)" }} />}
              <span style={{
                width: 22, height: 22, borderRadius: 4,
                background: l.color + "1c",
                color: l.color, border: "1px solid " + l.color + "55",
                display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
              }}>{l.icon}</span>
              <div>
                <div style={{ fontSize: 12, color: l.on ? "var(--fg-1)" : "var(--fog)", letterSpacing: "0.04em", fontWeight: 500 }}>{l.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--fg-4)", marginTop: 2 }}>{l.desc}</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.1em" }}>ORDER {i + 1}</span>
              <button
                onClick={e => { e.stopPropagation(); toggle(l.key); }}
                style={{
                  background: "transparent", border: "1px solid var(--border-2)",
                  padding: "2px 8px", borderRadius: 999, cursor: "pointer",
                  fontSize: 10, color: l.on ? "var(--phosphor)" : "var(--fog)", fontWeight: 600, letterSpacing: "0.1em",
                }}
              >
                {l.on ? "● ON" : "○ OFF"}
              </button>
            </button>
          ))}
        </Panel>

        {/* Right: detail + composed output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel eyebrow={`LAYER · ${sel.label}`} color={sel.color} dot
                 meta={<><Pill color={sel.color}>{sel.on ? "ACTIVE" : "INACTIVE"}</Pill></>}>
            <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginBottom: 10 }}>{sel.desc}</div>
            <pre style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 6,
              padding: 12,
              fontSize: 12,
              color: "var(--fg-1)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              margin: 0,
              fontFamily: "var(--font-mono)",
            }}>{sel.sample}</pre>
          </Panel>

          <Panel eyebrow="COMPOSED STACK · COPY READY" color="var(--phosphor)" dot
                 meta={<><span>{composed.split('\n').length} lines</span><span>·</span><span>{composed.length} chars</span><span>·</span><span>~{approxTokens} tok</span></>}>
            <pre style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 6,
              padding: 12,
              fontSize: 11.5,
              color: "var(--phosphor-bright)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              margin: 0,
              maxHeight: 280,
              overflow: "auto",
            }}>{composed}</pre>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary">⌘C copy stack</button>
              <button className="btn btn-secondary">save as preset</button>
              <button className="btn btn-ghost">reset to defaults</button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

window.OrchestratorView = OrchestratorView;
