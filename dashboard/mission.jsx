/* ui_kits/architect-os/mission.jsx — the daily greeting / hero tab */
const D2 = window.HUD_DATA;

function MissionView({ now, onTab }) {
  const top = D2.OPPORTUNITIES[0];
  const dayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const t = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <>
      {/* Mission hero ─ daily briefing */}
      <div className="mission">
        <Eyebrow color="var(--phosphor)" dot>CMNDCENTER · OPERATIONAL · v4.0 · {t} MT</Eyebrow>
        <h1>Good morning. Today is {dayStr}.</h1>
        <div className="sub">
          Overnight cycle produced <b>3 improvements</b> (quality 7.2 → 7.6).{" "}
          Today's scan surfaced <b>6 actionable opportunities</b> — the leverage point sits at{" "}
          <b style={{ color: "var(--phosphor)" }}>{top.name}</b>{" "}
          (score <b>{top.score}/100</b>, chain <code>{top.chain}</code>). WAND has <b>2 videos</b> queued. IntelliTradeX executed 1 trade. Ready for your commands.
        </div>
        <div className="actions">
          <button className="btn btn-primary">▶ EXECUTE TOP-1 · score {top.score}</button>
          <button className="btn btn-secondary" onClick={() => onTab("agents")}>route via loki-coordinator</button>
          <button className="btn btn-ghost" onClick={() => onTab("orchestrator")}>compose prompt stack</button>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 10.5, color: "var(--fg-4)" }}>
            <span><kbd>⌘</kbd><kbd>⇧</kbd><kbd>N</kbd> new</span>
            <span><kbd>⌘</kbd><kbd>⇧</kbd><kbd>A</kbd> dashboard</span>
            <span><kbd>⌘</kbd><kbd>⇧</kbd><kbd>P</kbd> orchestrator</span>
          </span>
        </div>
      </div>

      {/* Row 1: Opportunity Feed + Top-1 Avatar */}
      <div className="row-2">
        <Panel eyebrow="OPPORTUNITY FEED · LINEAR QUEUE" color="var(--amber)" dot tight
               meta={<><span>6 actionable</span><span>·</span><span>avg score 78.5</span></>}>
          {D2.OPPORTUNITIES.map((o, i) => (
            <div key={o.rank} className={"list-row" + (i === 0 ? " top" : "")}>
              <div style={{ display: "grid", gridTemplateColumns: "26px 1fr auto 50px 16px", gap: 12, alignItems: "center", width: "100%" }}>
                <span className="rank">{String(o.rank).padStart(2, "0")}</span>
                <div>
                  <div className="name">{o.name}</div>
                  <div className="meta" style={{ marginTop: 2 }}>{o.sub} · <span style={{ color: "var(--fg-4)" }}>{o.chain}</span></div>
                </div>
                <div className="meta">{o.meta}</div>
                <div className="score"><ScoreText value={o.score} /></div>
                <span className="arrow">→</span>
              </div>
            </div>
          ))}
        </Panel>

        {/* Right column — desktop avatar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AvatarPanel />
          <PatternEnginePanel />
        </div>
      </div>

      {/* Row 2: Unusual Flow + YouTube Outliers + Flips */}
      <div className="row-3">
        <Panel eyebrow="CRYPTO · UNUSUAL FLOW" color="var(--cyan)" dot tight
               meta={<><span>gate ≥ 0.75</span></>}>
          {D2.UNUSUAL_FLOW.map(u => (
            <div key={u.pair} className="list-row">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 60px 48px", gap: 6, alignItems: "center", width: "100%" }}>
                <div>
                  <div className="name">{u.pair} <small>{u.exch}</small></div>
                  <div className="meta" style={{ marginTop: 2 }}>RSI {u.rsi} · vol {u.volX}× · dev {(u.dev * 100).toFixed(1)}%</div>
                </div>
                <Pill color={u.side === "BUY" ? "#7ee787" : u.side === "SELL" ? "#ff5d5d" : "#7dd3fc"}>{u.side}</Pill>
                <div className="score" style={{ color: u.score >= 0.75 ? "var(--phosphor)" : u.score >= 0.5 ? "var(--amber)" : "var(--fog)" }}>{u.score.toFixed(2)}</div>
                <span style={{ fontSize: 10.5, color: u.chg >= 0 ? "var(--phosphor)" : "var(--crimson)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {u.chg >= 0 ? "▲" : "▼"} {Math.abs(u.chg).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </Panel>

        <Panel eyebrow="WAND · YOUTUBE OUTLIERS" color="var(--violet)" dot tight
               meta={<><span>6h window</span></>}>
          {D2.YOUTUBE_OUTLIERS.map(y => (
            <div key={y.rank} className="list-row">
              <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 48px 36px", gap: 10, alignItems: "center", width: "100%" }}>
                <span className="rank">{y.rank}</span>
                <div>
                  <div className="name" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{y.title}</div>
                  <div className="meta" style={{ marginTop: 2 }}>{y.ch} · {y.views} · {y.age}</div>
                </div>
                <div className="meta" style={{ textAlign: "right" }}>VCP+ <b style={{ color: y.vcp >= 0.25 ? "var(--phosphor)" : "var(--amber)" }}>{y.vcp.toFixed(2)}</b></div>
                <div className="meta" style={{ textAlign: "right", color: "var(--fg-4)" }}>{(y.ctr * 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </Panel>

        <Panel eyebrow="MARKETPLACE · FB → EBAY FLIPS" color="var(--phosphor)" dot tight
               meta={<><span>Denver/Aurora CO</span></>}>
          {D2.FLIPS.map(f => (
            <div key={f.rank} className="list-row">
              <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 60px 56px", gap: 10, alignItems: "center", width: "100%" }}>
                <span className="rank">{f.rank}</span>
                <div>
                  <div className="name" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.item}</div>
                  <div className="meta" style={{ marginTop: 2 }}>${f.buy} → ${f.sell} · {f.where}</div>
                </div>
                <div className="meta" style={{ textAlign: "right", color: f.margin >= 0.4 ? "var(--phosphor)" : "var(--amber)", fontWeight: 600 }}>
                  {(f.margin * 100).toFixed(0)}%
                </div>
                <Pill color={f.flag === "buy" ? "#7ee787" : "#f5a524"}>{f.flag.toUpperCase()}</Pill>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

function AvatarPanel() {
  return (
    <Panel eyebrow="DESKTOP AVATAR · OPEN-LLM-VTUBER" color="var(--claude)" dot
           meta={<><span>localhost:12393</span><span style={{ color: "var(--phosphor)" }}>●</span></>}>
      <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 14, alignItems: "center" }}>
        <div style={{
          position: "relative",
          aspectRatio: "1 / 1",
          background: "radial-gradient(circle at 50% 40%, rgba(217,119,87,0.25), transparent 65%)",
          border: "1px solid var(--border-2)",
          borderRadius: 10,
          display: "grid", placeItems: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--claude)",
            display: "grid", placeItems: "center",
            color: "var(--ink)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.06em",
            boxShadow: "0 0 24px rgba(217,119,87,0.4)",
          }}>C</div>
          {/* mouth waveform */}
          <svg viewBox="0 0 60 14" width="56" height="14" style={{ position: "absolute", bottom: 12 }}>
            <g stroke="#7ee787" strokeWidth="1.5" strokeLinecap="round">
              <line x1="6"  y1="7" x2="6"  y2="7" />
              <line x1="14" y1="3" x2="14" y2="11" />
              <line x1="22" y1="5" x2="22" y2="9" />
              <line x1="30" y1="2" x2="30" y2="12" />
              <line x1="38" y1="4" x2="38" y2="10" />
              <line x1="46" y1="6" x2="46" y2="8" />
              <line x1="54" y1="7" x2="54" y2="7" />
            </g>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 6, letterSpacing: "0.1em" }}>NOW SPEAKING · DAILY BRIEFING</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-1)", lineHeight: 1.5 }}>
            "Top signal: <b style={{ color: "var(--phosphor)" }}>Dewalt drill flip</b> — 92% — buy under $48. WAND has 2 videos queued. Ready for your commands."
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <Pill color="#7ee787" dot pulse>TTS</Pill>
            <Pill color="#7dd3fc" dot>TELEGRAM</Pill>
            <Pill color="#a78bfa">URGENCY 3 / 5</Pill>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PatternEnginePanel() {
  return (
    <Panel eyebrow="PATTERN ENGINE · CHROMADB" color="var(--violet)" dot
           meta={<><span>cmndcenter_patterns</span></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.12em" }}>PATTERNS</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: "var(--violet)", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>187</div>
          <Spark color="#a78bfa" points={[6, 8, 10, 9, 12, 14, 15, 18, 17, 20, 22, 24]} h={22} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.12em" }}>CONF · AVG</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: "var(--phosphor)", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>0.74</div>
          <Spark color="#7ee787" points={[0.5, 0.55, 0.6, 0.62, 0.64, 0.66, 0.68, 0.7, 0.71, 0.72, 0.73, 0.74]} h={22} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.12em" }}>NEW · 7D</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: "var(--amber)", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>+24</div>
          <Spark color="#f5a524" points={[2, 4, 1, 5, 3, 4, 5]} h={22} />
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-hairline)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill color="#7ee787">solutions · 78</Pill>
        <Pill color="#a78bfa">architecture · 32</Pill>
        <Pill color="#7dd3fc">tool_chains · 28</Pill>
        <Pill color="#f5a524">market_signals · 21</Pill>
        <Pill color="#d97757">prompts · 17</Pill>
        <Pill color="#ff5d5d">failures · 11</Pill>
      </div>
    </Panel>
  );
}

window.MissionView = MissionView;
