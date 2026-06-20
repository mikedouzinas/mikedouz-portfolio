'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HarlequinExit — the diamond-ash disintegration OUT of the board.
 *
 * On mount it html2canvas-snapshots the REAL /dev board DOM (the element tagged
 * `[data-board-root]`) into a texture, then runs a WebGL dissolve on that exact
 * snapshot: the board's own pixels erode left→right into harlequin DIAMOND ash
 * (green burn front #27b06f cooling to navy #143a6b, a blue rim glint #5aa6e6,
 * red #B3122B flecks where the source is reddish). The page beneath shows
 * through as the field clears, then `onDone` navigates.
 *
 * This is the "drive off the REAL board, not a mock" requirement: the texture is
 * the live DOM, captured at the instant of leaving.
 *
 * three.js and html2canvas are loaded lazily (dynamic import) ONLY here so they
 * never enter the homepage bundle.
 *
 * Reliability:
 *   - onDone fires when the sweep finishes (the normal, anim-driven path), and
 *     a self failsafe (armed at animation START, not mount, so a slow snapshot
 *     can't pre-empt the sweep) backs it up. The parent (useHarlequinExit) arms
 *     an additional hard failsafe. onDone is idempotent (a single
 *     window.location assign).
 *   - If the html2canvas snapshot throws OR returns empty, we DON'T abort: we
 *     play the SAME dissolve on a flat board-colored (#0e0c12) fallback texture,
 *     so the user always sees the diamond-ash dissolve.
 *   - Only a genuine WebGL/setup failure fails OPEN (onDone via failsafe).
 *
 * Reduced motion: a brief dark fade, then onDone — no shader.
 */

const DURATION = 1.35; // s — the L→R sweep
const REDUCED_MS = 220;
// Self failsafe past the sweep, armed when the animation actually STARTS.
const SELF_DONE_MS = (DURATION + 0.4) * 1000;
const BASE = '#0e0c12';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uProgress;
  uniform float uTime;
  uniform vec3  uEmber;
  uniform vec3  uAsh;
  uniform vec3  uRed;

  vec2 hash2(vec2 p){
    p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
  }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(dot(hash2(i+vec2(0,0)), f-vec2(0,0)),
                   dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
               mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)),
                   dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }

  void main(){
    vec2 uv = vUv;

    float grain = fbm(uv * vec2(9.0, 6.0) + vec2(0.0, uTime*0.05));
    float fine  = fbm(uv * 38.0);

    float front = uProgress * 1.18 - 0.09;
    float edge  = uv.x + grain * 0.16;
    float band  = 0.13;

    float past = smoothstep(front + 0.01, front - band, edge);
    float burn = smoothstep(front - band, front, edge) *
                 (1.0 - smoothstep(front, front + band*0.55, edge));

    float lift = burn;
    vec2 disp = vec2(0.0);
    disp.y += lift * (0.05 + 0.10 * fine);
    disp.x += lift * (fbm(uv*18.0 + uTime) * 0.06);
    vec2 suv = uv - disp;

    vec4 tex = texture2D(uTex, suv);

    float keep = 1.0 - smoothstep(front - band, front - band*0.35, edge);

    float redness = clamp((tex.r - max(tex.g, tex.b)) * 3.0, 0.0, 1.0);
    vec3 emberCol = mix(uEmber, uRed, redness * 0.85);
    vec3 col = mix(tex.rgb, mix(emberCol, uAsh, fine*0.4 + 0.15), burn);

    float ridge = burn * smoothstep(0.45, 1.0, burn);
    col += emberCol * ridge * 1.6;

    float alpha = keep;
    alpha = max(alpha, burn * (0.85 - fine*0.3));
    alpha *= (1.0 - past*0.0);
    alpha *= tex.a;

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Particle layer: a sparse grid seeded FROM the snapshot, each lifting off as
// the front passes — drifting harlequin-diamond ash of real board pixels.
const PVERT = /* glsl */ `
  precision highp float;
  attribute vec2 aUv;
  attribute float aSeed;
  uniform float uProgress;
  uniform float uTime;
  uniform sampler2D uTex;
  uniform float uPixel;
  varying vec3 vCol;
  varying float vAlpha;

  void main(){
    vec4 src = texture2D(uTex, aUv);
    float front = uProgress * 1.18 - 0.09;
    float n = fract(sin(dot(aUv, vec2(91.7, 47.3))) * 7841.3);
    float edge = aUv.x + (n - 0.5) * 0.10;
    float life = clamp((front - edge) / 0.32, 0.0, 1.0);

    vec2 pos = aUv * 2.0 - 1.0;
    pos.y = -pos.y;

    pos.y += life * (0.18 + 0.5*aSeed);
    pos.x += (sin(uTime*2.0 + aSeed*30.0) * 0.04 + (aSeed-0.5)*0.10) * life;

    float window = life * (1.0 - smoothstep(0.55, 1.0, life));
    float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    float weight = 0.08 + 0.92 * smoothstep(0.06, 0.45, lum);
    vAlpha = window * weight;

    vCol = src.rgb;
    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = uPixel * (1.0 + life * 1.4) * (0.6 + aSeed);
  }
`;
const PFRAG = /* glsl */ `
  precision highp float;
  varying vec3 vCol;
  varying float vAlpha;
  uniform vec3 uEmber;
  uniform vec3 uChampagne;
  void main(){
    vec2 uv = gl_PointCoord;
    float dia = abs(uv.x - 0.5) + abs(uv.y - 0.5);
    if (dia > 0.5) discard;

    float aa = fwidth(dia) + 0.02;
    float soft = smoothstep(0.5, 0.5 - aa - 0.10, dia);
    float rim = smoothstep(0.5 - aa - 0.14, 0.5 - aa, dia)
              * (1.0 - smoothstep(0.5 - aa, 0.5, dia));

    vec3 col = mix(vCol, uEmber, 0.45);
    col = mix(col, uChampagne, rim * 0.55);

    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

export function HarlequinExit({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // While the shader runs we paint a dark base behind the canvas so the page
  // beneath isn't visible until the dissolve reveals it. Reduced motion just
  // fades this veil.
  const [reduced, setReduced] = useState(false);
  // Gate the dark base + canvas until the snapshot is captured and the first
  // frame is painted, so the live board never flashes to black before the
  // (identical) intact snapshot covers it.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (isReduced) {
      setReduced(true);
      const t = setTimeout(() => onDoneRef.current(), REDUCED_MS);
      return () => clearTimeout(t);
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;
    let fired = false;
    const fireOnce = () => {
      if (fired) return;
      fired = true;
      onDoneRef.current();
    };
    // Self failsafe: navigate after the sweep even if onDone path is missed.
    // Armed when the animation STARTS (not at mount) so a slow snapshot can't
    // pre-empt the sweep. Falls back to mount-time only if we never get there.
    let selfTimer: ReturnType<typeof setTimeout> | null = null;
    const armSelfFailsafe = () => {
      if (selfTimer === null) selfTimer = setTimeout(fireOnce, SELF_DONE_MS);
    };

    void (async () => {
      try {
        const [{ default: html2canvas }, THREE] = await Promise.all([
          import('html2canvas'),
          import('three'),
        ]);
        if (disposed) return;

        const root =
          (document.querySelector('[data-board-root]') as HTMLElement | null) ??
          document.body;

        // Snapshot the live board. If html2canvas throws OR yields an empty
        // (0-sized) canvas — e.g. a WebGL surface it can't read — we DON'T abort
        // the exit; we fall back to a flat board-colored texture so the user
        // always sees the diamond-ash dissolve, never a hard cut to navigate.
        const W0 = Math.max(window.innerWidth, 1);
        const H0 = Math.max(window.innerHeight, 1);

        const makeFallbackTexture = (): HTMLCanvasElement => {
          const fb = document.createElement('canvas');
          fb.width = W0;
          fb.height = H0;
          const ctx = fb.getContext('2d');
          if (ctx) {
            ctx.fillStyle = BASE;
            ctx.fillRect(0, 0, fb.width, fb.height);
          }
          return fb;
        };

        let source: HTMLCanvasElement;
        try {
          const snapshot = await html2canvas(root, {
            backgroundColor: BASE,
            scale: Math.min(window.devicePixelRatio || 1, 2),
            logging: false,
            useCORS: true,
            // Capture the visible viewport region of the (possibly scrolled) board.
            x: window.scrollX,
            y: window.scrollY,
            width: window.innerWidth,
            height: window.innerHeight,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight,
          });
          source =
            snapshot && snapshot.width > 0 && snapshot.height > 0
              ? snapshot
              : makeFallbackTexture();
        } catch {
          source = makeFallbackTexture();
        }
        if (disposed) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const tex = new THREE.CanvasTexture(source);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
        });
        renderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene();
        const camera = new THREE.Camera();

        const EMBER = new THREE.Color('#27b06f'); // hot green burn front
        const ASH = new THREE.Color('#143a6b'); // navy cooling ash
        const RED = new THREE.Color('#B3122B'); // harlequin red flecks
        const RIM = new THREE.Color('#5aa6e6'); // blue diamond rim glint

        const planeGeo = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: {
            uTex: { value: tex },
            uProgress: { value: 0 },
            uTime: { value: 0 },
            uEmber: { value: EMBER },
            uAsh: { value: ASH },
            uRed: { value: RED },
          },
        });
        const plane = new THREE.Mesh(planeGeo, material);
        scene.add(plane);

        const COLS = 200;
        const ROWS = 125;
        const count = COLS * ROWS;
        const uvs = new Float32Array(count * 2);
        const seeds = new Float32Array(count);
        let k = 0;
        for (let j = 0; j < ROWS; j++) {
          for (let i = 0; i < COLS; i++) {
            uvs[k * 2] = (i + 0.5) / COLS;
            uvs[k * 2 + 1] = (j + 0.5) / ROWS;
            seeds[k] = Math.random();
            k++;
          }
        }
        const pgeo = new THREE.BufferGeometry();
        pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        pgeo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
        pgeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

        const pointsMat = new THREE.ShaderMaterial({
          vertexShader: PVERT,
          fragmentShader: PFRAG,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTex: { value: tex },
            uProgress: { value: 0 },
            uTime: { value: 0 },
            uPixel: { value: 3 },
            uEmber: { value: EMBER },
            uChampagne: { value: RIM },
          },
        });
        const points = new THREE.Points(pgeo, pointsMat);
        scene.add(points);

        function resize() {
          const W = window.innerWidth;
          const H = window.innerHeight;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          renderer.setPixelRatio(dpr);
          renderer.setSize(W, H, false);
          pointsMat.uniforms.uPixel.value = 3.1 * dpr;
        }
        resize();
        window.addEventListener('resize', resize);

        const ease = (t: number) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        let startTime = performance.now();
        let rafId = 0;

        function frame(now: number) {
          if (disposed) return;
          const t = (now - startTime) / 1000;
          const tn = Math.min(t / DURATION, 1);
          const p = ease(tn);

          material.uniforms.uProgress.value = p;
          material.uniforms.uTime.value = t;
          pointsMat.uniforms.uProgress.value = p;
          pointsMat.uniforms.uTime.value = t;

          renderer.render(scene, camera);

          if (!readyRef.current) {
            readyRef.current = true;
            canvas!.style.opacity = '1';
            setReady(true);
          }

          if (tn >= 1) {
            canvas!.style.opacity = '0';
            fireOnce();
            return;
          }
          rafId = requestAnimationFrame(frame);
        }
        startTime = performance.now();
        armSelfFailsafe();
        rafId = requestAnimationFrame(frame);

        cleanup = () => {
          if (rafId) cancelAnimationFrame(rafId);
          window.removeEventListener('resize', resize);
          plane.geometry.dispose();
          material.dispose();
          points.geometry.dispose();
          pointsMat.dispose();
          tex.dispose();
          renderer.dispose();
        };
      } catch {
        // Genuine WebGL/setup failure (the snapshot itself already has a flat
        // fallback). Nothing can render — fail OPEN so we still navigate.
        fireOnce();
      }
    })();

    return () => {
      disposed = true;
      if (selfTimer !== null) clearTimeout(selfTimer);
      cleanup?.();
    };
  }, []);

  if (reduced) {
    // Reduced motion: a brief dark fade-in over the board, then navigate.
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[125]"
        style={{
          background: BASE,
          opacity: 1,
          transition: `opacity ${REDUCED_MS}ms ease`,
        }}
      />
    );
  }

  return (
    <>
      {/* Dark base behind the canvas: covers the live board so the dissolving
          snapshot erodes into the dark void (then we navigate to `/`). Gated on
          `ready` so the live board never flashes black before the (identical)
          intact snapshot is painted over it. */}
      {ready && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[125]"
          style={{ background: BASE }}
        />
      )}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[130] block h-full w-full"
        style={{ opacity: 0 }}
      />
    </>
  );
}
