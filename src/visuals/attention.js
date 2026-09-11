// ============================================================
// attention.js — transformer attention over latent tokens.
//
// A query token is selected from the pointer's horizontal focus.
// Its attention distribution drives a three-dimensional bar matrix
// (height = weight), the token strip and the latent-vector field —
// one shared pattern across WebGL and 2D.
// ============================================================

import { machine, hash01 } from "../core/machine.js";
import { fitCanvas } from "../core/canvas.js";
import { clamp, softmax, RGB, rgba, roundRect, watch } from "../core/util.js";
import { makeGL, THREE, C } from "../core/gl.js";

const N = 16;
const score = (i, j) => hash01(i * N + j, 17);

function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 48;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(130,141,159,0.9)";
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 0.9, 1);
  return sp;
}

export function initAttention() {
  const cAttn = document.getElementById("attention");
  const cTok = document.getElementById("tokens");
  const cLat = document.getElementById("latent");
  const statusEl = document.getElementById("attn-status");
  if (!cAttn || !cTok || !cLat) return;

  const gl = makeGL(cAttn, { antialias: true, dpr: 1.75, fov: 46 });
  const a = gl ? null : fitCanvas(cAttn, 2);
  const t = fitCanvas(cTok, 2);
  const l = fitCanvas(cLat, 2);
  const inT = watch(cTok);
  const inL = watch(cLat);

  let inView = () => true;
  let scene, camera, renderer, bars, dummy, blue, cyan, violet, tmp;

  if (gl) {
    ({ renderer, scene, camera } = gl);
    camera.position.set(0, 13, 15);
    camera.lookAt(0, 0, 0);

    const geo = new THREE.BoxGeometry(0.62, 1, 0.62);
    geo.translate(0, 0.5, 0);
    bars = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial(),
      N * N
    );
    bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(bars);
    dummy = new THREE.Object3D();

    const grid = new THREE.GridHelper(N + 2, N + 2, C.dim, 0x14181f);
    grid.position.y = 0;
    grid.material.transparent = true;
    grid.material.opacity = 0.14;
    scene.add(grid);

    blue = new THREE.Color(C.blue);
    cyan = new THREE.Color(C.cyan);
    violet = new THREE.Color(C.violet);
    tmp = new THREE.Color();

    const ql = makeLabel("KEY →");
    ql.position.set(0, 0, N / 2 + 2);
    scene.add(ql);
    const kl = makeLabel("QUERY ↓");
    kl.position.set(-(N / 2 + 2.2), 0, 0);
    scene.add(kl);

    let v = true;
    const io = new IntersectionObserver((es) => (v = es[0].isIntersecting), { rootMargin: "160px" });
    io.observe(cAttn);
    inView = () => v;
  }

  let lastStatus = "";

  machine.register((dt, d, s) => {
    const q = clamp(Math.floor(s.fx * N), 0, N - 1);
    const temp = 0.22 + (1 - d.rate) * 0.9;

    const weights = new Array(N);
    for (let i = 0; i < N; i++) {
      const row = new Array(N);
      for (let j = 0; j < N; j++) {
        row[j] = score(i, j) + Math.exp(-Math.abs(i - j) / 5) * 0.6;
      }
      weights[i] = softmax(row, temp);
    }
    const qw = weights[q];
    let topK = Array.from({ length: N }, (_, j) => j);
    topK.sort((x, y) => qw[y] - qw[x]);
    topK = topK.slice(0, 4);

    // ---------- 3D matrix ----------
    if (gl && inView()) {
      const off = (N - 1) / 2;
      let k = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const v = weights[i][j];
          const h = Math.pow(v, 0.62) * 9 + 0.02;
          dummy.position.set(j - off, 0, i - off);
          dummy.scale.set(1, h, 1);
          dummy.updateMatrix();
          bars.setMatrixAt(k, dummy.matrix);

          if (v < 0.5) tmp.copy(blue).lerp(cyan, v * 2);
          else tmp.copy(cyan).lerp(violet, (v - 0.5) * 2);
          if (i === q) tmp.lerp(cyan, 0.35);
          if (i === q && topK.includes(j)) tmp.lerp(violet, 0.3);
          bars.setColorAt(k, tmp);
          k++;
        }
      }
      bars.instanceMatrix.needsUpdate = true;
      if (bars.instanceColor) bars.instanceColor.needsUpdate = true;

      scene.rotation.y = (s.fx - 0.5) * 0.2 + (s.reduced || s.paused ? 0 : s.time * 0.05);
      scene.rotation.x = -(s.fy - 0.5) * 0.1;
      renderer.render(scene, camera);
    } else if (!gl && a) {
      drawFallback(a, weights, q, topK);
    }

    // ---------- token strip ----------
    if (inT()) {
      const ctx = t.ctx;
      const w = t.w;
      const h = t.h;
      ctx.clearRect(0, 0, w, h);
      const gap = 3;
      const tw = (w - gap * (N - 1)) / N;
      const th = Math.min(h * 0.5, tw * 1.6);
      const ty = h * 0.62;
      for (let i = 0; i < N; i++) {
        const x = i * (tw + gap);
        const v = qw[i];
        const on = topK.includes(i);
        ctx.beginPath();
        roundRect(ctx, x, ty, tw, th, 2);
        ctx.fillStyle = on ? rgba(RGB.cyan, 0.12 + v * 0.5) : rgba(RGB.ink, 0.02 + v * 0.12);
        ctx.fill();
        ctx.strokeStyle = i === q ? rgba(RGB.ink, 0.7) : rgba(RGB.muted, 0.2);
        ctx.stroke();
        ctx.fillStyle = rgba(on ? RGB.cyan : RGB.muted, 0.4 + v * 0.6);
        ctx.fillRect(x + 1, ty + th - 2 - v * th * 0.6, tw - 2, 2);
      }
      const qx = q * (tw + gap) + tw / 2;
      ctx.strokeStyle = rgba(RGB.violet, 0.5);
      ctx.lineWidth = 1;
      for (const j of topK) {
        const jx = j * (tw + gap) + tw / 2;
        const midX = (qx + jx) / 2;
        const lift = 14 + Math.abs(qx - jx) * 0.12;
        ctx.beginPath();
        ctx.moveTo(qx, ty);
        ctx.quadraticCurveTo(midX, ty - lift, jx, ty);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(qx, ty + th / 2, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(RGB.ink, 0.95);
      ctx.fill();
    }

    // ---------- latent field ----------
    if (inL()) {
      const ctx = l.ctx;
      const w = l.w;
      const h = l.h;
      ctx.clearRect(0, 0, w, h);
      const K = 6;
      const cw = w / N;
      const ch = h / K;
      for (let j = 0; j < N; j++) {
        for (let kk = 0; kk < K; kk++) {
          const base = hash01(j * K + kk, 29);
          const infl = qw[j] * (1 - Math.abs(kk - K / 2) / K);
          const v = clamp(base * 0.6 + infl * 0.7);
          const on = topK.includes(j);
          ctx.fillStyle = rgba(on ? RGB.violet : RGB.blue, 0.06 + v * 0.55);
          ctx.fillRect(j * cw + 0.5, kk * ch + 0.5, cw - 1, ch - 1);
        }
      }
      ctx.strokeStyle = rgba(RGB.ink, 0.55);
      ctx.strokeRect(q * cw + 0.5, 0.5, cw - 1, h - 1);
    }

    if (statusEl) {
      const txt = `query ${q} / ${N} · τ ${temp.toFixed(2)}`;
      if (txt !== lastStatus) {
        lastStatus = txt;
        statusEl.textContent = txt;
      }
    }
  });
}

// 2D fallback when WebGL is unavailable
function drawFallback(a, weights, q, topK) {
  const ctx = a.ctx;
  const w = a.w;
  const h = a.h;
  const size = Math.min(w, h);
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  const cell = size / N;
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = weights[i][j];
      const col = v < 0.5
        ? [91 + 12 * v * 2, 140 + 72 * v * 2, 255]
        : [103 + 52 * (v - 0.5) * 2, 212 - 89 * (v - 0.5) * 2, 255];
      ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${0.05 + Math.pow(v, 0.7) * 0.9})`;
      ctx.fillRect(ox + j * cell + 0.5, oy + i * cell + 0.5, cell - 1, cell - 1);
    }
  }
  ctx.strokeStyle = rgba(RGB.ink, 0.6);
  ctx.strokeRect(ox - 1.5, oy + q * cell - 1.5, size + 3, cell + 3);
  for (const j of topK.slice(0, 1)) {
    ctx.strokeStyle = rgba(RGB.violet, 0.5);
    ctx.strokeRect(ox + j * cell - 1.5, oy - 1.5, cell + 3, size + 3);
  }
}
