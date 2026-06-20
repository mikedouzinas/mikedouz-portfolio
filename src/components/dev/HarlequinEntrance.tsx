'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HarlequinEntrance — the magician's reveal INTO the board.
 *
 * Plays once on /dev mount, on top of everything, then dissolves away and
 * unmounts so it never blocks interaction. The real board (and its real
 * HarlequinReveal cursor-bloom argyle) loads BEHIND this overlay; the entrance
 * is a pure WebGL curtain that reveals it.
 *
 * Rhythm (the validated look): a fine harlequin weave is KNIT one diamond at a
 * time. Diamonds are placed in CONNECTED order — a BFS flood-fill from a seed
 * cell with a shuffled frontier — so each new diamond grows off the already-laid
 * cluster along a wandering front. A small rolling set is ever in flight, so the
 * eye follows individual diamonds being set. ~5s deliberate build, then a fast,
 * clean dissolve (green→navy fbm burn) clears the field to reveal the dark board.
 *
 * Tweaks vs. the standalone lockup:
 *   - 56px tile (matches the live HarlequinReveal background exactly: the same
 *     diamond polygon, fill #B3122B, edge #EDE6D6, on #0e0c12) so the build
 *     lands seamlessly on the real /dev background — fewer, bigger diamonds,
 *     even clearer one-at-a-time.
 *   - faster + cleaner reveal: the dissolve is short and eases out hard so the
 *     curtain clears quickly to the board.
 *
 * three.js is loaded lazily (dynamic import) ONLY here so it never enters the
 * homepage bundle. Reduced motion: mounts nothing, fires onDone immediately.
 */

// Slow & deliberate build, then a fast clean clear.
const DURATION_ASSEMBLE = 5.0; // s — diamonds knit in one-by-one to full coverage
const HOLD = 0.18; // s — brief full-coverage beat
const DURATION_DISSOLVE = 0.62; // s — fast, clean clear to the board

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
  uniform float uDissolve;
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

    center.y += uDissolve * (0.04 + 0.10 * aSeed) * smoothstep(0.0, 1.0, uDissolve);
    center.x += (aSeed - 0.5) * 0.05 * uDissolve;

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
  uniform vec3  uBurn;
  uniform vec3  uNavy;
  uniform float uDissolve;
  uniform float uInset;
  uniform float uTime;

  vec2 hash2(vec2 p){
    p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(dot(hash2(i+vec2(0,0)), f-vec2(0,0)),
                   dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
               mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)),
                   dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*vnoise(p);p*=2.03;a*=0.5;} return v; }

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

    if (uDissolve > 0.0) {
      float grain = fbm(vSlot * vec2(7.0, 5.0) + vec2(uTime * 0.05, 0.0));
      float n = vSeed * 0.55 + grain * 0.30 + 0.15;
      float front = uDissolve * 1.35 - 0.20;
      float band = 0.22;
      float burn = smoothstep(front - band, front, n) *
                   (1.0 - smoothstep(front, front + band, n));
      float gone = smoothstep(front, front - band, n);

      vec3 burnCol = mix(uBurn, uNavy, fbm(vSlot * 12.0) * 0.5 + 0.25);
      col = mix(col, burnCol, burn);
      col += uBurn * burn * 0.7;
      alpha *= (1.0 - gone);
      alpha = max(alpha, burn * soft * 0.8);
    }

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function HarlequinEntrance({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const canvas = canvasRef.current;
    if (!canvas || reduced) {
      setHidden(true);
      onDoneRef.current?.();
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import('three');
      if (disposed || !canvas) return;

      const rand = (a: number, b: number) => a + Math.random() * (b - a);

      const RED = new THREE.Color('#b3122b');
      const CHAMPAGNE = new THREE.Color('#ede6d6');
      const BURN = new THREE.Color('#27b06f');
      const NAVY = new THREE.Color('#143a6b');

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
        const rank = new Int32Array(count).fill(-1);
        const seedC = Math.floor(cols * rand(0.18, 0.38));
        const seedR = Math.floor(rows * rand(0.18, 0.42));
        let frontier = [idx(seedC, seedR)];
        let placed = 0;
        rank[frontier[0]] = placed++;
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
              if (rank[ni] !== -1 || seen.has(ni)) continue;
              seen.add(ni);
              next.push(ni);
            }
          }
          for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
          }
          for (const ni of next) rank[ni] = placed++;
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

            const rk = rank[k] < 0 ? denom : rank[k];
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
            uDissolve: { value: 0 },
            uSpan: { value: spanValue },
            uTileClip: { value: new THREE.Vector2(tileClipX, tileClipY) },
            uRed: { value: RED },
            uChampagne: { value: CHAMPAGNE },
            uBurn: { value: BURN },
            uNavy: { value: NAVY },
            uInset: { value: 1.0 - RHOMBUS_INSET },
            uTime: { value: 0 },
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
          const dv = material.uniforms.uDissolve.value;
          mesh.geometry.dispose();
          (mesh.material as import('three').Material).dispose();
          scene.remove(mesh);
          buildInstances();
          if (material) {
            material.uniforms.uProgress.value = p;
            material.uniforms.uDissolve.value = dv;
          }
        }
      }

      buildInstances();
      resize();
      window.addEventListener('resize', resize);

      const ease = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // fast clean clear — easeOutQuart so the reveal snaps open then settles.
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

      const T_ASSEMBLE = DURATION_ASSEMBLE;
      const T_HOLD = DURATION_ASSEMBLE + HOLD;
      const T_END = DURATION_ASSEMBLE + HOLD + DURATION_DISSOLVE;

      let startTime = performance.now();
      let rafId = 0;
      let finished = false;

      function finish() {
        if (finished) return;
        finished = true;
        canvas!.style.opacity = '0';
        setHidden(true);
        onDoneRef.current?.();
      }

      function frame(now: number) {
        if (disposed || !material) return;
        const t = (now - startTime) / 1000;
        material.uniforms.uTime.value = t;

        if (t <= T_ASSEMBLE) {
          material.uniforms.uProgress.value = Math.min(t / DURATION_ASSEMBLE, 1);
          material.uniforms.uDissolve.value = 0;
        } else if (t <= T_HOLD) {
          material.uniforms.uProgress.value = 1;
          material.uniforms.uDissolve.value = 0;
        } else {
          material.uniforms.uProgress.value = 1;
          const dn = Math.min((t - T_HOLD) / DURATION_DISSOLVE, 1);
          // ease (in-out) into a hard ease-out so the field clears fast & clean.
          material.uniforms.uDissolve.value = easeOut(ease(dn));
        }

        renderer.render(scene, camera);

        if (t >= T_END) {
          finish();
          return;
        }
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
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120] block h-full w-full"
    />
  );
}
