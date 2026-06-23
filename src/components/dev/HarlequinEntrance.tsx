'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HarlequinEntrance — the magician's reveal INTO the board.
 *
 * Played by HarlequinTransitionHost (root layout) so it can build over the
 * CURRENT page (the homepage) and survive the client-navigation to /dev.
 *
 * Rhythm (the validated look): a fine harlequin weave is KNIT one diamond at a
 * time, in CONNECTED order (a BFS flood-fill from a seed cell with a shuffled
 * frontier) so each new diamond grows off the laid cluster along a wandering
 * front. The diamonds are DIM and semi-transparent — a dimmer version of the
 * resting board argyle (HarlequinReveal) — so the page underneath shows THROUGH
 * the build instead of the screen slamming to black. ~2.6s assemble.
 *
 * When the weave reaches full coverage we fire `onAssembled`: the host then
 * client-navigates to /dev underneath. A dark backing ramps in at that moment to
 * mask the route swap (the homepage → the dark board). Once the host reports the
 * board has committed (`revealReady`) the WHOLE overlay fades out (~0.5s) to
 * reveal it. A clean fade, then `onDone`.
 *
 * three.js is loaded lazily (dynamic import) so it never enters the homepage
 * bundle. Reduced motion: no build — fire onAssembled (host navigates) then done.
 */

const DURATION_ASSEMBLE = 2.6; // s — diamonds knit in one-by-one to full coverage
const BACKING_RAMP = 0.18; // s — dark backing ramps in once assembled (masks swap)
const BACKING_MAX = 0.96; // dark backing peak opacity
const MIN_HOLD = 0.35; // s — keep the full argyle up briefly before it dims away
const DURATION_DIM = 0.9; // s — the argyle dims down, settling into the background

// A dimmer version of the resting argyle — the page shows through the build.
const DIM = 0.46; // canvas opacity

// Match the live HarlequinReveal tile exactly.
const TILE = 56; // px per argyle cell
const RHOMBUS_INSET = 2 / 28; // ~2px gutter inside a 28px half-cell (28,2 .. 54,28 ..)

const VERT = /* glsl */ `
  precision highp float;
  attribute vec2  aSlot;
  attribute vec2  aOrigin;
  attribute float aDepth;
  attribute float aSpin;
  attribute float aDelay;
  attribute float aSeed;

  uniform float uProgress;
  uniform float uSpan;
  uniform vec2  uTileClip;

  varying vec2  vLocal;
  varying float vFill;
  varying float vSeed;
  varying vec2  vSlot;

  float settle(float t){
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    float inv = 1.0 - t;
    return 1.0 - inv * inv * inv; // easeOutCubic — glides in, no wobble
  }

  void main(){
    vLocal = position.xy;
    vSeed = aSeed;
    vSlot = aSlot * 0.5 + 0.5;

    float local = clamp((uProgress - aDelay * (1.0 - uSpan)) / uSpan, 0.0, 1.0);
    float s = settle(local);

    vec2 center = mix(aOrigin, aSlot, s);
    float depth = mix(aDepth, 1.0, s);
    float ang   = aSpin * (1.0 - s);
    float ca = cos(ang), sa = sin(ang);

    vec2 q = position.xy * uTileClip * 2.0 * depth;
    vec2 rq = vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);

    vFill = s;

    gl_Position = vec4(center + rq, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2  vLocal;
  varying float vFill;
  varying float vSeed;
  varying vec2  vSlot;

  uniform vec3  uRed;
  uniform vec3  uChampagne;
  uniform float uInset;

  void main(){
    float dia = abs(vLocal.x) + abs(vLocal.y);
    float tip = 0.5 * uInset;
    if (dia > tip) discard;

    float aa = fwidth(dia) + 0.006;

    float strokeW = (1.0 / 56.0);
    float rim = smoothstep(tip - aa - strokeW * 1.6, tip - aa, dia);
    vec3 col = mix(uRed, uChampagne, rim);

    float soft = 1.0 - smoothstep(tip - aa, tip, dia);

    float lockFlare = smoothstep(0.55, 0.92, vFill) * (1.0 - smoothstep(0.92, 1.0, vFill));
    col = mix(col, uChampagne, lockFlare * 0.5);

    float alpha = soft * smoothstep(0.0, 0.35, vFill);

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function HarlequinEntrance({
  revealReady,
  onAssembled,
  onDone,
}: {
  revealReady: boolean;
  onAssembled: () => void;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const backingRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onAssembledRef = useRef(onAssembled);
  onAssembledRef.current = onAssembled;
  const revealReadyRef = useRef(revealReady);
  revealReadyRef.current = revealReady;

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const canvas = canvasRef.current;
    if (!canvas || reduced) {
      // No build — let the host navigate to /dev, then finish.
      onAssembledRef.current();
      const t = setTimeout(() => {
        setHidden(true);
        onDoneRef.current();
      }, 60);
      return () => clearTimeout(t);
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      let THREE: typeof import('three');
      try {
        THREE = await import('three');
      } catch {
        // three.js failed to load — don't trap the user: navigate + finish.
        if (!disposed) {
          onAssembledRef.current();
          setHidden(true);
          onDoneRef.current();
        }
        return;
      }
      if (disposed || !canvas) return;

      const rand = (a: number, b: number) => a + Math.random() * (b - a);

      const RED = new THREE.Color('#b3122b');
      const CHAMPAGNE = new THREE.Color('#ede6d6');

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      });
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();

      let cols = 0;
      let rows = 0;
      let mesh: import('three').Mesh | null = null;
      let material: import('three').ShaderMaterial | null = null;

      function buildInstances() {
        const W = Math.max(window.innerWidth, 1);
        const H = Math.max(window.innerHeight, 1);

        cols = Math.ceil(W / TILE) + 1;
        rows = Math.ceil(H / TILE) + 1;
        const count = cols * rows;

        const tileClipX = TILE / W;
        const tileClipY = TILE / H;

        const aSlot = new Float32Array(count * 2);
        const aOrigin = new Float32Array(count * 2);
        const aDepth = new Float32Array(count);
        const aSpin = new Float32Array(count);
        const aDelay = new Float32Array(count);
        const aSeed = new Float32Array(count);

        // CONNECTED PLACEMENT ORDER — BFS flood-fill from a seed cell, shuffling
        // each frontier wave so the weave grows outward off the laid cluster.
        const idx = (c: number, r: number) => r * cols + c;
        const rankArr = new Int32Array(count).fill(-1);
        const seedC = Math.floor(cols * rand(0.18, 0.38));
        const seedR = Math.floor(rows * rand(0.18, 0.42));
        let frontier = [idx(seedC, seedR)];
        let placed = 0;
        rankArr[frontier[0]] = placed++;
        const NB = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [-1, -1], [1, -1], [-1, 1],
        ];
        while (frontier.length) {
          const next: number[] = [];
          const seen = new Set<number>();
          for (const cell of frontier) {
            const cr = Math.floor(cell / cols);
            const cc = cell - cr * cols;
            for (const [dc, dr] of NB) {
              const nc = cc + dc;
              const nr = cr + dr;
              if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
              const ni = idx(nc, nr);
              if (rankArr[ni] !== -1 || seen.has(ni)) continue;
              seen.add(ni);
              next.push(ni);
            }
          }
          for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
          }
          for (const ni of next) rankArr[ni] = placed++;
          frontier = next;
        }
        const denom = Math.max(placed - 1, 1);

        let k = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const px = (c + 0.5) * TILE;
            const py = (r + 0.5) * TILE;
            const sx = (px / W) * 2 - 1;
            const sy = -((py / H) * 2 - 1);
            aSlot[k * 2] = sx;
            aSlot[k * 2 + 1] = sy;

            const a = rand(0, Math.PI * 2);
            const d = rand(0.04, 0.16);
            aOrigin[k * 2] = sx + Math.cos(a) * d;
            aOrigin[k * 2 + 1] = sy + Math.sin(a) * d;

            aDepth[k] = rand(0.72, 1.28);
            aSpin[k] = rand(-0.5, 0.5);
            aSeed[k] = Math.random();

            const rk = rankArr[k] < 0 ? denom : rankArr[k];
            aDelay[k] = Math.min(1, rk / denom + (Math.random() - 0.5) * (0.6 / denom));

            k++;
          }
        }

        const FLIGHT_SECONDS = 0.16; // per-diamond glide; small rolling front
        const spanValue = Math.min(0.5, Math.max(0.01, FLIGHT_SECONDS / DURATION_ASSEMBLE));

        const base = new THREE.PlaneGeometry(1, 1);
        const geo = new THREE.InstancedBufferGeometry();
        geo.index = base.index;
        geo.attributes.position = base.attributes.position;
        geo.setAttribute('aSlot', new THREE.InstancedBufferAttribute(aSlot, 2));
        geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(aOrigin, 2));
        geo.setAttribute('aDepth', new THREE.InstancedBufferAttribute(aDepth, 1));
        geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(aSpin, 1));
        geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(aDelay, 1));
        geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
        geo.instanceCount = count;

        material = new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: {
            uProgress: { value: 0 },
            uSpan: { value: spanValue },
            uTileClip: { value: new THREE.Vector2(tileClipX, tileClipY) },
            uRed: { value: RED },
            uChampagne: { value: CHAMPAGNE },
            uInset: { value: 1.0 - RHOMBUS_INSET },
          },
        });

        mesh = new THREE.Mesh(geo, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
      }

      function resize() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);
        const newCols = Math.ceil(W / TILE) + 1;
        const newRows = Math.ceil(H / TILE) + 1;
        if (mesh && material && (newCols !== cols || newRows !== rows)) {
          const p = material.uniforms.uProgress.value;
          mesh.geometry.dispose();
          (mesh.material as import('three').Material).dispose();
          scene.remove(mesh);
          buildInstances();
          if (material) material.uniforms.uProgress.value = p;
        }
      }

      buildInstances();
      resize();
      window.addEventListener('resize', resize);

      const easeInOut = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const T_ASSEMBLE = DURATION_ASSEMBLE;

      let startTime = performance.now();
      let rafId = 0;
      let finished = false;
      let assembled = false;
      let assembleAt = 0;
      let revealAt = -1;
      let backingAtReveal = BACKING_MAX;

      function finish() {
        if (finished) return;
        finished = true;
        if (rootRef.current) rootRef.current.style.opacity = '0';
        setHidden(true);
        onDoneRef.current();
      }

      function frame(now: number) {
        if (disposed || !material) return;
        const t = (now - startTime) / 1000;

        if (t <= T_ASSEMBLE) {
          // Build the weave over the page (dim diamonds, page shows through).
          material.uniforms.uProgress.value = Math.min(t / DURATION_ASSEMBLE, 1);
        } else {
          material.uniforms.uProgress.value = 1;
          if (!assembled) {
            assembled = true;
            assembleAt = t;
            onAssembledRef.current(); // host: client-navigate to /dev underneath
          }
          // The full argyle STAYS through the page transfer. Once the board has
          // painted underneath (revealReady) and a brief beat has passed, the
          // argyle DIMS away and the dark backing lifts together — the weave
          // settles into the board's own faint background, rather than the whole
          // overlay curtain-fading.
          const canReveal = revealReadyRef.current && t - assembleAt >= MIN_HOLD;
          if (!canReveal) {
            // Hold: ramp the dark backing in to mask the homepage → board swap.
            const bk = Math.min((t - assembleAt) / BACKING_RAMP, 1) * BACKING_MAX;
            if (backingRef.current) backingRef.current.style.opacity = String(bk);
          } else {
            if (revealAt < 0) {
              revealAt = t;
              backingAtReveal = backingRef.current
                ? parseFloat(backingRef.current.style.opacity || '0') || BACKING_MAX
                : BACKING_MAX;
            }
            const fn = Math.min((t - revealAt) / DURATION_DIM, 1);
            const e = easeInOut(fn);
            if (canvasRef.current) canvasRef.current.style.opacity = String(DIM * (1 - e));
            if (backingRef.current) {
              backingRef.current.style.opacity = String(backingAtReveal * (1 - e));
            }
            if (fn >= 1) {
              renderer.render(scene, camera);
              finish();
              return;
            }
          }
        }

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
      }

      startTime = performance.now();
      rafId = requestAnimationFrame(frame);

      cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
        if (mesh) {
          mesh.geometry.dispose();
          (mesh.material as import('three').Material).dispose();
          scene.remove(mesh);
        }
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120]"
      style={{ willChange: 'opacity' }}
    >
      {/* Dark backing — transparent during the build (the page shows through the
          dim weave), then ramps in once assembled to mask the homepage → board
          route swap, and fades out with the overlay to reveal the board. */}
      <div
        ref={backingRef}
        className="absolute inset-0"
        style={{ background: '#0e0c12', opacity: 0 }}
      />
      {/* The dim diamond weave knits in on top — a dimmer version of the resting
          argyle, so the page underneath stays visible as it builds. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{ opacity: DIM }}
      />
    </div>
  );
}
