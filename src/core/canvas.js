// ============================================================
// canvas.js — DPR-aware canvas fitting + resize handling.
// ============================================================

export function fitCanvas(canvas, maxDpr = 2) {
  const ctx = canvas.getContext("2d");
  const state = { ctx, w: 0, h: 0, dpr: 1 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height || canvas.height / (canvas._dpr || 1)));
    state.w = w;
    state.h = h;
    state.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  state.resize = resize;
  return state;
}

// A tiny smooth value used for indicator motion.
export function smooth(prev, next, k, dt) {
  return prev + (next - prev) * (1 - Math.exp(-k * dt));
}

export function cssColor(name, alpha = 1) {
  const map = {
    cyan: "103, 212, 255",
    blue: "91, 140, 255",
    violet: "155, 123, 255",
    ink: "233, 238, 246",
    muted: "130, 141, 159",
    good: "111, 230, 180"
  };
  return `rgba(${map[name] || map.cyan}, ${alpha})`;
}
