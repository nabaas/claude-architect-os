/* ui_kits/architect-os/shared.jsx — atomic building blocks */
const { useState, useEffect, useMemo } = React;
const D = window.HUD_DATA;

const PHASE_BY_ID = Object.fromEntries(D.PHASES.map(p => [p.id, p]));

function Glyph({ id, size = 22 }) {
  const p = PHASE_BY_ID[id];
  if (!p) return null;
  return (
    <span
      style={{
        width: size, height: size,
        borderRadius: size > 28 ? 6 : 4,
        background: p.color + "1f",
        color: p.color,
        border: "1px solid " + p.color + "55",
        display: "inline-grid",
        placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.5),
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}
    >
      {id}
    </span>
  );
}

function Pill({ children, color = "var(--fg-3)", bg, border, dot, pulse, style }) {
  const wash = color.startsWith("#")
    ? color + "1c"
    : "rgba(201,196,184,0.06)";
  const brd = color.startsWith("#") ? color + "55" : "var(--border-1)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 7px", borderRadius: 999, fontSize: 10,
      fontWeight: 500, letterSpacing: "0.04em",
      background: bg || wash, color, border: "1px solid " + (border || brd),
      ...style,
    }}>
      {dot && <span className={pulse ? "pulse" : ""} style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />}
      {children}
    </span>
  );
}

function Eyebrow({ children, color = "var(--fg-3)", dot }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: 10, fontWeight: 600,
      letterSpacing: "0.18em", color, textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: 8,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} className="pulse" />}
      {children}
    </div>
  );
}

function Spark({ points, color = "var(--phosphor)", h = 28, w = "100%" }) {
  // points is array of numbers
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * 200;
    const y = 30 - ((v - min) / span) * 26 - 2;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 200 32" width={w} height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ScoreBar({ value, color = "var(--phosphor)", h = 4 }) {
  return (
    <div style={{ height: h, background: "rgba(201,196,184,0.08)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}

function Panel({ eyebrow, color = "var(--fg-3)", meta, children, glow, tight, dot }) {
  const cls = "panel" + (glow === "claude" ? " glow-claude" : glow === "phosphor" ? " glow-phosphor" : "");
  return (
    <div className={cls}>
      <div className="panel-h">
        <Eyebrow color={color} dot={dot}>{eyebrow}</Eyebrow>
        {meta && <div className="meta">{meta}</div>}
      </div>
      <div className={"panel-b" + (tight ? " tight" : "")}>{children}</div>
    </div>
  );
}

function StatusDot({ st }) {
  const map = {
    live: { c: "var(--phosphor)", t: "LIVE", pulse: true },
    proc: { c: "var(--amber)",    t: "PROC", pulse: true },
    idle: { c: "var(--fog)",      t: "IDLE", pulse: false },
    fail: { c: "var(--crimson)",  t: "FAIL", pulse: false },
  };
  const x = map[st] || map.idle;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, color: x.c, letterSpacing: "0.1em" }}>
      <span className={x.pulse ? "pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: x.c }} />
      {x.t}
    </span>
  );
}

function ScoreText({ value, of = 100 }) {
  const c =
    value >= 80 ? "var(--phosphor)" :
    value >= 60 ? "var(--amber)" :
    value >= 40 ? "var(--cyan)" :
                  "var(--fog)";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontWeight: 600,
      fontVariantNumeric: "tabular-nums slashed-zero",
      color: c, letterSpacing: "-0.01em"
    }}>
      {value}<span style={{ color: "var(--fog)", fontWeight: 400, marginLeft: 1, fontSize: "0.7em" }}>/{of}</span>
    </span>
  );
}

Object.assign(window, { Glyph, Pill, Eyebrow, Spark, ScoreBar, Panel, StatusDot, ScoreText, PHASE_BY_ID });
