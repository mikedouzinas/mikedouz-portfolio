'use client';

import { useEffect, useRef, useState } from 'react';
import { captureBoardSnapshot, getBoardSnapshot } from './transition/boardSnapshot';

/**
 * HarlequinExit — the diamond-ash disintegration OUT of the board.
 *
 * Played by HarlequinTransitionHost (root layout) so the overlay survives the
 * /dev → / route change. Reads the EAGERLY-captured board snapshot (see
 * `boardSnapshot.ts`) and renders it as a grid of opaque chips that, at
 * progress 0, perfectly reconstruct the live board — a pristine, instant COVER.
 *
 * Timeline (the whole point — no delay, no dimmed board, no flip):
 *   1. mount → snapshot already cached → draw chips @ progress 0 = opaque board
 *      cover, on screen on the FIRST frame. Fire `onSnapshotReady`.
 *   2. host client-navigates home UNDER the opaque cover (invisible).
 *   3. host reports home painted (`armed`) → chips ignite L-of-sweep first and
 *      peel into harlequin DIAMONDS (green burn front #27b06f cooling to navy
 *      #143a6b, blue #5aa6e6 / red #B3122B flecks), each chip fading to
 *      TRANSPARENT — so the LIVE homepage behind this transparent canvas is
 *      revealed through the gaps. No home texture, nothing to swap to.
 *   4. last chip gone → `onDone` → overlay unmounts; nothing visually changes
 *      because home was already fully revealed.
 *
 * Raw WebGL2 (no three.js here) keeps this overlay tiny. A genuine GL failure or
 * missing snapshot fails OPEN (ready + done) so the host still navigates.
 * Reduced motion: no overlay, instant nav.
 */

const BREAK_S = 0.42; // s — the de-rez "screen breaking" wind-up
const DISS_S = 1.5; // s — the diagonal diamond disintegration
const OVERLAP = 0.1; // s — dissolve starts just before the break fully peaks
const SELF_DONE_MS = (BREAK_S + DISS_S + 0.5) * 1000;
const CELL = 14; // px (logical) — chip size; finer = more refined ash
const BASE = '#0e0c12';

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aCell;
layout(location=2) in float aSeed;
uniform vec2  uRes;
uniform float uProgress;
uniform float uTime;
uniform float uBand;
uniform float uCell;
uniform vec2  uSweep;
out vec2  vUV;
out float vLocal;
out float vSeed;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }
void main(){
  vec2 dir = normalize(uSweep);
  float sMax = dot(dir, vec2(1.0,1.0));
  vec2 cellUV = aCell / uRes;
  float s = dot(dir, cellUV) / sMax;
  s += (hash(aCell*0.013) - 0.5) * 0.14;   // jitter range ±0.07 → ragged front
  // Bias so progress 0 leaves EVERY chip intact (front below min s) — a pristine
  // opaque cover — and progress 1 takes every chip past its threshold.
  float front = uProgress * (1.0 + uBand + 0.16) - 0.08;
  float local = clamp((front - s) / uBand, 0.0, 1.0);

  vUV = (aCell + aCorner * uCell) / uRes;
  vLocal = local;
  vSeed = aSeed;

  float e = local;
  float dia = smoothstep(0.0, 0.22, local);          // snap to a 45° diamond fast
  float angle = dia * 0.785398 + e*e * (aSeed - 0.5) * 4.0;
  float scale = 1.0 - smoothstep(0.45, 1.0, e);
  scale *= 1.0 + 0.06*e;

  vec2 outward = normalize(vec2(aSeed-0.5, -(0.4+aSeed*0.6)));
  float sway = sin(uTime*2.0 + aSeed*6.28) * 6.0 * e;
  vec2 grav = vec2(0.0, e*e * 40.0);
  vec2 offset = outward * (e*150.0) + vec2(0.0, -e*150.0) + vec2(sway,0.0) + grav;

  vec2 corner = aCorner * uCell * scale;
  corner.y *= mix(1.0, 1.32, dia);                   // elongate into a harlequin rhombus
  float c = cos(angle), sN = sin(angle);
  vec2 rc = vec2(corner.x*c - corner.y*sN, corner.x*sN + corner.y*c);
  vec2 posPx = aCell + rc + offset;

  vec2 clip = (posPx / uRes) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUV; in float vLocal; in float vSeed;
uniform sampler2D uBoard;
uniform float uBreak;   // 0→1 de-rez wind-up
uniform float uTime;
out vec4 frag;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.99,78.23)))*43758.5453); }
void main(){
  float local = vLocal;

  // ---- B · DE-REZ wind-up: the board glitches/corrupts before it disintegrates.
  // Row-tear + RGB channel split + scanlines, modulated by uBreak.
  vec2 uv = vUV;
  float g = uBreak;
  float row = floor(uv.y * 90.0);
  float tear = step(0.6, h(vec2(row, floor(uTime*9.0)+3.0)));
  uv.x += (h(vec2(row, floor(uTime*18.0))) - 0.5) * 0.06 * g * tear;
  float sp = 0.004*g + 0.002*g*sin(uTime*40.0);
  vec3 board = vec3(
    texture(uBoard, uv + vec2(sp,0.0)).r,
    texture(uBoard, uv).g,
    texture(uBoard, uv - vec2(sp,0.0)).b);
  float bAlpha = texture(uBoard, uv).a;
  board *= 1.0 - 0.25*g*step(0.5, fract(uv.y*220.0));   // scanlines

  // Tone-match: html2canvas can't render the board's grain/backdrop-blur, so the
  // snapshot comes out ~2x too bright (mean luma 42 vs the live board's 21) — it
  // looked "grayed out." This gamma darkens the washed midtones back to live tone.
  board = pow(max(board, 0.0), vec3(1.3));
  vec3 green = vec3(0.153,0.690,0.435);
  vec3 navy  = vec3(0.078,0.227,0.420);
  vec3 red   = vec3(0.702,0.071,0.169);
  vec3 blue  = vec3(0.353,0.651,0.902);
  float ignite = smoothstep(0.0,0.12,local) * (1.0 - smoothstep(0.12,0.5,local));
  vec3 burn = mix(green, navy, smoothstep(0.1,0.6,local));
  if (vSeed > 0.90) burn = red;
  else if (vSeed > 0.78) burn = blue;
  vec3 col = mix(board, burn, ignite * 0.8);
  float edge = (1.0 - smoothstep(0.0, 0.10, local)) * step(0.0006, local);
  vec3 hot = mix(green, vec3(0.92,1.0,0.86), edge*edge);
  col += hot * edge * 2.0;
  col += burn * ignite * 0.5;
  float a = (1.0 - smoothstep(0.5, 1.0, local)) * bAlpha;
  if (a <= 0.003) discard;
  frag = vec4(col, a);
}`;

export function HarlequinExit({
  armed,
  onSnapshotReady,
  onDone,
}: {
  armed: boolean;
  onSnapshotReady: () => void;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onReadyRef = useRef(onSnapshotReady);
  onReadyRef.current = onSnapshotReady;
  const armedRef = useRef(armed);
  armedRef.current = armed;

  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      setReduced(true);
      onReadyRef.current();
      const t = setTimeout(() => onDoneRef.current(), 60);
      return () => clearTimeout(t);
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;
    let fired = false;
    let selfTimer: ReturnType<typeof setTimeout> | null = null;
    const fireOnce = () => {
      if (fired) return;
      fired = true;
      onDoneRef.current();
    };

    void (async () => {
      try {
        // Prefer the eager snapshot; fall back to a click-time capture; finally
        // a flat board-coloured texture so the dissolve always plays.
        let snap = getBoardSnapshot();
        if (!snap) {
          await captureBoardSnapshot();
          if (disposed) return;
          snap = getBoardSnapshot();
        }
        const W = Math.max(window.innerWidth, 1);
        const H = Math.max(window.innerHeight, 1);
        let source: TexImageSource;
        if (snap) {
          source = snap.canvas;
        } else {
          const fb = document.createElement('canvas');
          fb.width = W;
          fb.height = H;
          const ctx = fb.getContext('2d');
          if (ctx) {
            ctx.fillStyle = BASE;
            ctx.fillRect(0, 0, W, H);
          }
          source = fb;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl2', {
          alpha: true,
          premultipliedAlpha: false,
          antialias: true,
        });
        if (!gl) {
          onReadyRef.current();
          fireOnce();
          return;
        }

        const compile = (type: number, src: string) => {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return s;
        };
        const prog = gl.createProgram()!;
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          onReadyRef.current();
          fireOnce();
          return;
        }

        // Geometry: instanced quads, corners at ±0.54 so opaque chips overlap
        // ~8% at rest → the progress-0 cover has zero seams (no home bleed-through).
        const quad = new Float32Array([
          -0.54, -0.54, 0.54, -0.54, 0.54, 0.54, -0.54, -0.54, 0.54, 0.54, -0.54, 0.54,
        ]);
        const cols = Math.ceil(W / CELL);
        const rows = Math.ceil(H / CELL);
        const count = cols * rows;
        const cells = new Float32Array(count * 2);
        const seeds = new Float32Array(count);
        let idx = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            cells[idx * 2] = (c + 0.5) * CELL;
            cells[idx * 2 + 1] = (r + 0.5) * CELL;
            seeds[idx] = ((Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1 + 1) % 1;
            idx++;
          }
        }

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const qb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, qb);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        const cb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cb);
        gl.bufferData(gl.ARRAY_BUFFER, cells, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(1, 1);
        const sb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, sb);
        gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const U = {
          res: gl.getUniformLocation(prog, 'uRes'),
          progress: gl.getUniformLocation(prog, 'uProgress'),
          time: gl.getUniformLocation(prog, 'uTime'),
          band: gl.getUniformLocation(prog, 'uBand'),
          cell: gl.getUniformLocation(prog, 'uCell'),
          sweep: gl.getUniformLocation(prog, 'uSweep'),
          board: gl.getUniformLocation(prog, 'uBoard'),
          brk: gl.getUniformLocation(prog, 'uBreak'),
        };

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const resize = () => {
          canvas.width = Math.round(W * dpr);
          canvas.height = Math.round(H * dpr);
          gl.viewport(0, 0, canvas.width, canvas.height);
        };
        resize();

        const draw = (progress: number, breakAmt: number, time: number) => {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(prog);
          gl.bindVertexArray(vao);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(U.board, 0);
          gl.uniform2f(U.res, W, H);
          gl.uniform1f(U.progress, progress);
          gl.uniform1f(U.brk, breakAmt);
          gl.uniform1f(U.time, time);
          gl.uniform1f(U.band, 0.26);
          gl.uniform1f(U.cell, CELL);
          gl.uniform2f(U.sweep, 0.85, 1.0);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
          gl.disable(gl.BLEND);
          gl.bindVertexArray(null);
        };

        const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

        let startTime = 0;
        let raf = 0;
        let started = false;
        const frame = (now: number) => {
          if (disposed) return;
          if (armedRef.current) {
            if (!started) {
              started = true;
              startTime = now;
              if (selfTimer === null) selfTimer = setTimeout(fireOnce, SELF_DONE_MS);
            }
            const t = (now - startTime) / 1000;
            // Phase 1: the board de-rezzes (break). Phase 2: it disintegrates,
            // starting just before the break peaks so the two flow together.
            const breakAmt = Math.min(t / BREAK_S, 1);
            const dn = Math.min(Math.max(t - (BREAK_S - OVERLAP), 0) / DISS_S, 1);
            draw(ease(dn), breakAmt, t);
            if (dn >= 1) {
              fireOnce();
              return;
            }
          } else {
            draw(0, 0, now / 1000); // hold the pristine opaque cover (no break yet)
          }
          raf = requestAnimationFrame(frame);
        };

        // First frame = the tone-matched cover, crossfaded IN over the live board
        // (~90ms) so the swap blends instead of hard-cutting (hides any residual
        // shift). Navigation fires immediately, but home doesn't paint for
        // ~hundreds of ms — long after the 90ms fade completes — so the cover is
        // fully opaque before home could ever peek through. Blend for free, no
        // added latency.
        draw(0, 0, 0);
        canvas.style.transition = 'opacity 90ms linear';
        requestAnimationFrame(() => {
          canvas.style.opacity = '1';
        });
        onReadyRef.current();
        raf = requestAnimationFrame(frame);

        cleanup = () => {
          if (raf) cancelAnimationFrame(raf);
          gl.deleteTexture(tex);
          gl.deleteBuffer(qb);
          gl.deleteBuffer(cb);
          gl.deleteBuffer(sb);
          gl.deleteVertexArray(vao);
          gl.deleteProgram(prog);
        };
      } catch {
        onReadyRef.current();
        fireOnce();
      }
    })();

    return () => {
      disposed = true;
      if (selfTimer !== null) clearTimeout(selfTimer);
      cleanup?.();
    };
  }, []);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[130] block h-full w-full"
      style={{ opacity: 0 }}
    />
  );
}
