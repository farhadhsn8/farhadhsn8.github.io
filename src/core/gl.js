// ============================================================
// gl.js — Three.js bootstrapping for the computational visuals.
//
// Every major visualization owns a small WebGLRenderer bound to its
// placeholder canvas. They all render inside the single animation
// loop from machine.js and are only drawn while on screen.
// ============================================================

import * as THREE from "three";

export { THREE };

export const C = {
  cyan: 0x67d4ff,
  blue: 0x5b8cff,
  violet: 0x9b7bff,
  good: 0x6fe6b4,
  ink: 0xe9eef6,
  muted: 0x828d9f,
  dim: 0x5a6375
};

let available = null;

export function glAvailable() {
  if (available != null) return available;
  try {
    const c = document.createElement("canvas");
    available = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    available = false;
  }
  if (!available) document.documentElement.classList.add("no-webgl");
  return available;
}

// Create a renderer/scene/camera trio for a placeholder canvas.
export function makeGL(canvas, opts = {}) {
  if (!canvas || !glAvailable()) return null;
  const { alpha = true, antialias = true, dpr = 1.75, fov = 45 } = opts;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha,
      antialias,
      powerPreference: "high-performance"
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(dpr, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return { w, h };
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return { THREE, renderer, scene, camera, resize, ro, canvas };
}

// A soft round sprite texture, used for point clouds.
export function discTexture(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A 2D canvas + texture that a visual can redraw on demand.
export function drawSurface(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return { canvas: c, ctx, tex, flip: () => (tex.needsUpdate = true) };
}

export const damp3 = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
