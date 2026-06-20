/**
 * Hover music for the WINDOW portal face — ported verbatim from the
 * `window-frost.html` lockup's audio block.
 *
 * Real 30s preview clips from the iTunes Search API (Apple-hosted), looked up
 * from Mike's "harlequin" Spotify tracklist (Spotify's own API is blocked +
 * previews deprecated, so iTunes is the source). Baked here exactly as in the
 * lockup. Browsers require a prior user gesture before audio can play, so the
 * controller arms on the first document click/keydown/touchend.
 */

// 12 iTunes preview URLs (verbatim from window-frost.html AUDIO_SRCS).
export const AUDIO_SRCS: readonly string[] = [
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9a/d3/62/9ad362bb-dd03-207a-8060-24ff7daaa4b6/mzaf_5149262004917407921.plus.aac.p.m4a', // It Won't Always Be Like This - Inhaler
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f5/62/d6/f562d68a-313e-62e8-60aa-67ccab3bdef7/mzaf_15316799331053655031.plus.aac.p.m4a', // Human - The Killers
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/e8/40/4d/e8404d84-d1f7-66f2-d352-46cd5edf7a4d/mzaf_13166155265677647958.plus.aac.p.m4a', // 4 Chords of the Apocalypse - Julian Casablancas
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/96/f3/e6/96f3e6b3-200e-73e8-a05b-e49f2ab9a97a/mzaf_2138860376088781831.plus.aac.p.m4a', // Superstar - Beach House
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/36/f0/72/36f0723a-24a4-a311-32a8-9d4d5a6508ef/mzaf_1361087582525746526.plus.aac.p.m4a', // Elephant (Todd Rundgren Remix) - Tame Impala
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/e4/78/94/e4789490-e672-bf53-bd6e-6daff7562261/mzaf_12863285223617130832.plus.aac.p.m4a', // My Life - ZHU
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a2/79/87/a279879a-fdee-fac5-1a5d-ac427c1f2b60/mzaf_6587091618139194706.plus.aac.p.m4a', // Sprawl II - Arcade Fire
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/c1/a3/ba/c1a3ba8d-0d85-2a0a-1cad-a0103118b9ce/mzaf_13105396904990412068.plus.aac.p.m4a', // All My Friends - LCD Soundsystem
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/39/6b/c6/396bc6d7-26f4-40b2-d47d-25ac27a59b1a/mzaf_7907687150975595342.plus.aac.p.m4a', // Focus (feat. CLOVES) - John Summit
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b0/c7/c2/b0c7c2a0-7e33-3449-7445-4f22993a13fd/mzaf_14419134591357262363.plus.aac.p.m4a', // For Reasons Unknown - The Killers
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/9d/e4/bf/9de4bfc0-44e4-6233-a2d5-80767d4e4465/mzaf_14340293322069283896.plus.aac.p.m4a', // Beverly Laurel - Tame Impala
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/52/02/71/52027175-88dc-f74d-4240-051cf23cd3c5/mzaf_15152450390755382933.plus.aac.p.m4a', // Heartbeat - Childish Gambino
];

const AUDIO_VOLUME = 0.18; // soft — non-jarring (verbatim from lockup)
const AUDIO_FADE_MS = 600; // ms to fade in/out (verbatim from lockup)

function pickRandomAudio(): string {
  return AUDIO_SRCS[Math.floor(Math.random() * AUDIO_SRCS.length)];
}

/**
 * A small stateful controller that plays a random preview on hover (after the
 * first user gesture) and fades out on leave. One instance per WindowFace.
 *
 * Mirrors the lockup's `startHoverAudio` / `stopHoverAudio` / gesture-gate logic
 * 1:1 (volume 0.18, 600ms fades, gesture arming on first click/keydown/touch).
 */
export function createHoverAudio() {
  // `audioEl` is the active track (playing / fading in). `fadingEl` is a track
  // currently fading out on leave. Keeping them separate — each with its own
  // timer — means a fast re-hover can't orphan the previous track: start() always
  // hard-stops whatever is still sounding, so two clips can never overlap.
  let audioEl: HTMLAudioElement | null = null;
  let fadingEl: HTMLAudioElement | null = null;
  let fadeInTimer: ReturnType<typeof setTimeout> | null = null;
  let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  let audioGestured = false;

  function recordGesture() {
    audioGestured = true;
    document.removeEventListener('click', recordGesture);
    document.removeEventListener('keydown', recordGesture);
    document.removeEventListener('touchend', recordGesture);
  }

  function arm() {
    document.addEventListener('click', recordGesture);
    document.addEventListener('keydown', recordGesture);
    document.addEventListener('touchend', recordGesture);
  }

  // Immediately + fully silence an element (no fade), releasing its network use.
  function hardStop(a: HTMLAudioElement | null) {
    if (!a) return;
    try {
      a.pause();
    } catch {
      /* ignore */
    }
    a.src = '';
  }

  function start() {
    if (!audioGestured) return; // browser gate: need a prior gesture
    // Kill anything still fading out so it can never keep playing under a new clip.
    if (fadeOutTimer) {
      clearTimeout(fadeOutTimer);
      fadeOutTimer = null;
    }
    hardStop(fadingEl);
    fadingEl = null;
    if (audioEl) return; // active track already playing — don't restart on re-hover
    const url = pickRandomAudio();
    const a = new Audio(url);
    a.volume = 0;
    a.loop = false;
    audioEl = a;
    a.play()
      .then(() => {
        if (audioEl !== a) {
          // superseded while the clip was loading — make sure it stays silent
          hardStop(a);
          return;
        }
        if (fadeInTimer) clearTimeout(fadeInTimer);
        const startTime = Date.now();
        function fadeIn() {
          if (audioEl !== a) return;
          const progress = Math.min((Date.now() - startTime) / AUDIO_FADE_MS, 1);
          a.volume = progress * AUDIO_VOLUME;
          if (progress < 1) fadeInTimer = setTimeout(fadeIn, 20);
        }
        fadeIn();
      })
      .catch(() => {
        // Autoplay blocked — clear reference, no error surfaced to the user.
        if (audioEl === a) audioEl = null;
      });
  }

  function stop() {
    if (fadeInTimer) {
      clearTimeout(fadeInTimer);
      fadeInTimer = null;
    }
    if (!audioEl) return;
    const a = audioEl;
    audioEl = null;
    // Hand the active track to `fadingEl` and fade it out; a later start() can
    // still reach and hard-stop it. Cancel any prior fade-out first.
    if (fadeOutTimer) {
      clearTimeout(fadeOutTimer);
      fadeOutTimer = null;
    }
    hardStop(fadingEl);
    fadingEl = a;
    const startVol = a.volume;
    const startTime = Date.now();
    function fadeOut() {
      if (fadingEl !== a) return; // superseded — start() already hard-stopped it
      const progress = Math.min((Date.now() - startTime) / AUDIO_FADE_MS, 1);
      a.volume = startVol * (1 - progress);
      if (progress < 1) {
        fadeOutTimer = setTimeout(fadeOut, 20);
      } else {
        hardStop(a);
        fadingEl = null;
        fadeOutTimer = null;
      }
    }
    fadeOut();
  }

  function dispose() {
    document.removeEventListener('click', recordGesture);
    document.removeEventListener('keydown', recordGesture);
    document.removeEventListener('touchend', recordGesture);
    if (fadeInTimer) clearTimeout(fadeInTimer);
    if (fadeOutTimer) clearTimeout(fadeOutTimer);
    hardStop(audioEl);
    hardStop(fadingEl);
    audioEl = null;
    fadingEl = null;
  }

  return { arm, start, stop, dispose };
}
