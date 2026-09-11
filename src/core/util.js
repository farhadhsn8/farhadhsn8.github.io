// ============================================================
// util.js — shared math, canvas and visibility helpers.
// ============================================================

export const TAU = Math.PI * 2;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export const mapRange = (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a));

export const smoothstep = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const rgba = (rgb, a = 1) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

export const RGB = {
  cyan: [103, 212, 255],
  blue: [91, 140, 255],
  violet: [155, 123, 255],
  good: [111, 230, 180],
  ink: [233, 238, 246],
  muted: [130, 141, 159],
  dim: [90, 99, 117],
  warn: [255, 207, 107]
};

// Softmax over an array, with temperature.
export function softmax(values, temperature = 1) {
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  const t = Math.max(0.0001, temperature);
  let sum = 0;
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const e = Math.exp((values[i] - max) / t);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < values.length; i++) out[i] /= sum;
  return out;
}

// ------------------------------------------------------------
// Visibility: lazily initialise expensive draws only when the
// canvas is near the viewport. Falls back to always-visible.
// ------------------------------------------------------------
let io = null;
if (typeof IntersectionObserver !== "undefined") {
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.target.__inview = e.isIntersecting;
    },
    { rootMargin: "160px 0px" }
  );
}

export function watch(el) {
  if (!el) return () => false;
  el.__inview = true;
  if (io) io.observe(el);
  return () => el.__inview !== false;
}

export function formatFixed(v, digits = 2) {
  return (Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits);
}
