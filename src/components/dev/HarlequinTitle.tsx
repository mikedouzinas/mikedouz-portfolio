'use client';

/**
 * THE HARLEQUIN wordmark — all-caps, letters cycling the Google palette
 * (built during Mike's time at Google), flanked by harlequin diamonds.
 */
const GOOGLE = ['#4285F4', '#EA4335', '#FBBC05', '#34A853']; // blue, red, yellow, green

export function HarlequinTitle() {
  const letters = 'THE HARLEQUIN'.split('');
  let idx = 0;
  return (
    <h1 className="flex items-center gap-2 select-none">
      <span aria-hidden className="text-base" style={{ color: GOOGLE[1] }}>
        ◆
      </span>
      <span className="text-2xl font-extrabold tracking-[0.22em]">
        {letters.map((ch, i) => {
          if (ch === ' ') return <span key={i}>&nbsp;&nbsp;</span>;
          const color = GOOGLE[idx % GOOGLE.length];
          idx += 1;
          return (
            <span key={i} style={{ color }}>
              {ch}
            </span>
          );
        })}
      </span>
      <span aria-hidden className="text-base" style={{ color: GOOGLE[3] }}>
        ◆
      </span>
    </h1>
  );
}
