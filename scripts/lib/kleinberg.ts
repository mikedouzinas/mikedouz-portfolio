/**
 * Kleinberg Burst Detection Algorithm
 *
 * Implements Kleinberg's (2002) algorithm for detecting bursts in event streams
 * using a hidden Markov model and the Viterbi algorithm.
 *
 * Reference: Kleinberg, J. (2002). Bursty and Hierarchical Structure in Streams.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KleinbergParams {
  /** Scaling factor between adjacent state rates. Default: 2.0 */
  s?: number;
  /** Transition cost multiplier. Default: 2.0 */
  gamma?: number;
  /** Number of hidden states. Default: 4 */
  numStates?: number;
  /**
   * Override the baseline event rate (state-0 rate). When provided, this
   * replaces the default mean-of-input estimate. Pass the track's all-time
   * average plays/week so the baseline isn't inflated by the burst itself.
   */
  baseRate?: number;
}

export interface KleinbergResult {
  /** Viterbi-decoded state sequence (0 = baseline, higher = more bursty) */
  states: number[];
  /** Event rate associated with each state */
  stateRates: number[];
}

export interface BurstRegion {
  /** Inclusive start index in the original event-count array */
  start: number;
  /** Inclusive end index in the original event-count array */
  end: number;
  /** Highest state reached during this region */
  maxState: number;
  /** Full state sub-sequence for this region */
  stateSeq: number[];
}

export interface Peak {
  /** Start offset relative to the burst region start */
  relStart: number;
  /** End offset relative to the burst region start (inclusive) */
  relEnd: number;
  /** Total play count inside this peak */
  plays: number;
  /** Number of weeks inside this peak */
  weeks: number;
}

// ---------------------------------------------------------------------------
// 1. Kleinberg Burst Detection (Viterbi on HMM)
// ---------------------------------------------------------------------------

/**
 * Run Kleinberg burst detection on a time series of event counts.
 *
 * @param eventCounts - Array of non-negative integer counts per time bucket.
 * @param params      - Algorithm hyper-parameters (all optional).
 * @returns Viterbi state sequence and the rate for each state.
 */
export function kleinbergBurstDetection(
  eventCounts: number[],
  params: KleinbergParams = {}
): KleinbergResult {
  const s = params.s ?? 2.0;
  const gamma = params.gamma ?? 2.0;
  const numStates = params.numStates ?? 4;

  const T = eventCounts.length;

  // Degenerate case: empty input
  if (T === 0) {
    return { states: [], stateRates: [] };
  }

  // Base rate: use caller-supplied value if provided (e.g. all-time average
  // plays/week), otherwise fall back to the mean of the input window.
  // The caller-supplied value prevents the burst from inflating its own baseline.
  const sum = eventCounts.reduce((a, b) => a + b, 0);
  const baseRate = Math.max(params.baseRate ?? sum / T, 1e-9);

  // State rates: rate_i = baseRate * s^i
  const stateRates: number[] = new Array(numStates);
  for (let i = 0; i < numStates; i++) {
    stateRates[i] = baseRate * Math.pow(s, i);
  }

  // DP tables (row-major: [t * numStates + state])
  // cost[t][j] = min cost of being in state j at time t
  const cost = new Float64Array(T * numStates).fill(Infinity);
  const back = new Int32Array(T * numStates).fill(-1);

  // ---------------------------------------------------------------------------
  // Initialisation (t = 0): only state 0 is free to enter; higher states cost
  // a transition penalty from a hypothetical state-0 at time -1.
  // ---------------------------------------------------------------------------
  const logT = Math.log(T > 1 ? T : 2); // avoid log(1)=0 making transitions free

  for (let j = 0; j < numStates; j++) {
    const transCost = j > 0 ? gamma * j * logT : 0.0;
    const emitCost = emissionCost(stateRates[j], eventCounts[0]);
    cost[0 * numStates + j] = transCost + emitCost;
    back[0 * numStates + j] = 0; // sentinel: came from state 0 at t=-1
  }

  // ---------------------------------------------------------------------------
  // Viterbi forward pass (t = 1 … T-1)
  // ---------------------------------------------------------------------------
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < numStates; j++) {
      const emit = emissionCost(stateRates[j], eventCounts[t]);
      let bestCost = Infinity;
      let bestPrev = 0;

      for (let i = 0; i < numStates; i++) {
        // Transition cost: moving up costs gamma*(j-i)*log(T), moving down is free
        const trans = j > i ? gamma * (j - i) * logT : 0.0;
        const candidate = cost[(t - 1) * numStates + i] + trans;
        if (candidate < bestCost) {
          bestCost = candidate;
          bestPrev = i;
        }
      }

      cost[t * numStates + j] = bestCost + emit;
      back[t * numStates + j] = bestPrev;
    }
  }

  // ---------------------------------------------------------------------------
  // Backtrack: find minimum cost state at t = T-1, then follow pointers
  // ---------------------------------------------------------------------------
  const states = new Array<number>(T);

  // Find best final state
  let bestFinal = 0;
  let bestFinalCost = cost[(T - 1) * numStates + 0];
  for (let j = 1; j < numStates; j++) {
    const c = cost[(T - 1) * numStates + j];
    if (c < bestFinalCost) {
      bestFinalCost = c;
      bestFinal = j;
    }
  }

  states[T - 1] = bestFinal;
  for (let t = T - 2; t >= 0; t--) {
    states[t] = back[(t + 1) * numStates + states[t + 1]];
  }

  return { states, stateRates };
}

/**
 * Poisson emission cost: -log P(count | rate) ∝ rate - count*log(rate)
 * (constant terms dropped).
 */
function emissionCost(rate: number, count: number): number {
  if (count === 0) return rate;
  return rate - count * Math.log(rate);
}

// ---------------------------------------------------------------------------
// 2. Extract Burst Regions
// ---------------------------------------------------------------------------

/**
 * Extract contiguous regions where `state >= minState`.
 *
 * @param states   - State sequence returned by `kleinbergBurstDetection`.
 * @param minState - Minimum state to be considered a burst (default: 1).
 * @returns Array of burst regions sorted by start index.
 */
export function extractBurstRegions(
  states: number[],
  minState = 1
): BurstRegion[] {
  const regions: BurstRegion[] = [];
  let inBurst = false;
  let start = 0;

  for (let t = 0; t <= states.length; t++) {
    const active = t < states.length && states[t] >= minState;

    if (active && !inBurst) {
      // Burst begins
      start = t;
      inBurst = true;
    } else if (!active && inBurst) {
      // Burst ends (exclusive at t, inclusive at t-1)
      const end = t - 1;
      const stateSeq = states.slice(start, end + 1);
      const maxState = stateSeq.reduce((m, v) => Math.max(m, v), 0);
      regions.push({ start, end, maxState, stateSeq });
      inBurst = false;
    }
  }

  return regions;
}

// ---------------------------------------------------------------------------
// 3. Split Into Peaks
// ---------------------------------------------------------------------------

/**
 * Split a burst region into sub-peaks separated by valleys.
 *
 * A valley is defined as 2 or more consecutive weeks whose play count is
 * strictly below the median of non-zero weeks within the region.
 *
 * Rules:
 * - Minimum 5 plays per peak.
 * - If no valid split point exists, return the whole region as a single peak.
 *
 * @param weeklyCounts  - Full weekly count array (same length as `states`).
 * @param regionStart   - Inclusive start index of the burst region.
 * @param regionEnd     - Inclusive end index of the burst region.
 * @returns Array of peaks with relative offsets inside the region.
 */
export function splitIntoPeaks(
  weeklyCounts: number[],
  regionStart: number,
  regionEnd: number
): Peak[] {
  const regionCounts = weeklyCounts.slice(regionStart, regionEnd + 1);
  const regionLen = regionCounts.length;

  // Compute median of non-zero weeks in the region
  const active = regionCounts.filter((c) => c > 0).sort((a, b) => a - b);
  const medianActive =
    active.length === 0
      ? 0
      : active.length % 2 === 0
      ? (active[active.length / 2 - 1] + active[active.length / 2]) / 2
      : active[Math.floor(active.length / 2)];

  // Identify valley weeks: count <= 1 OR count < medianActive * 0.4
  // This is more aggressive than just "below median" — it catches real dips
  const valleyThreshold = Math.max(1, medianActive * 0.4);
  const isValley = regionCounts.map((c) => c <= valleyThreshold);

  // Find contiguous valley spans of length >= 1
  // Even a single week of near-zero plays between two hot weeks is a real gap
  const splitPoints: number[] = [];

  let valleyStart = -1;
  for (let i = 0; i < regionLen; i++) {
    if (isValley[i]) {
      if (valleyStart === -1) valleyStart = i;
    } else {
      if (valleyStart !== -1) {
        // Split at any valley — even 1 week if the drop is significant
        splitPoints.push(i);
        valleyStart = -1;
      }
    }
  }
  // Handle trailing valley (ignore — it just means the burst ends early)

  // Build candidate peak ranges from split points.
  const boundaries = splitPoints.length === 0
    ? [0, regionLen]
    : [0, ...splitPoints, regionLen];
  const peaks: Peak[] = [];

  // Thresholds applied to each sub-peak:
  // - MIN_PLAYS_PER_PEAK: prevents a single-play peak from being an "era"
  // - MIN_MAX_WEEKLY_COUNT: a real peak must have at least one week of real
  //   intensity. Filters "phantom" bursts from songs played sporadically over
  //   many months (e.g., interludes auto-played as part of albums).
  // - TAIL_TRIM_RATIO: trim leading/trailing weeks below this fraction of the
  //   peak's max weekly count. Cuts sporadic tails without dropping the song.
  const MIN_PLAYS_PER_PEAK = 5;
  const MIN_MAX_WEEKLY_COUNT = 3;
  const TAIL_TRIM_RATIO = 0.3;

  for (let p = 0; p < boundaries.length - 1; p++) {
    let relStart = boundaries[p];
    let relEnd = boundaries[p + 1] - 1;

    // First pass: trim valley weeks (below valleyThreshold)
    while (relStart <= relEnd && isValley[relStart]) relStart++;
    while (relEnd >= relStart && isValley[relEnd]) relEnd--;
    if (relStart > relEnd) continue;

    // Second pass: tail-trim weeks below TAIL_TRIM_RATIO of the peak max.
    // This tightens the range so that a burst isn't padded by weeks where
    // the track was played only a couple of times.
    let maxCount = 0;
    for (let i = relStart; i <= relEnd; i++) {
      if (regionCounts[i] > maxCount) maxCount = regionCounts[i];
    }
    const tailThreshold = maxCount * TAIL_TRIM_RATIO;
    while (relStart <= relEnd && regionCounts[relStart] < tailThreshold) relStart++;
    while (relEnd >= relStart && regionCounts[relEnd] < tailThreshold) relEnd--;
    if (relStart > relEnd) continue;

    // Reject phantom peaks: a real peak must have at least one week with
    // MIN_MAX_WEEKLY_COUNT plays. A song played 1–2x/week for 50 weeks is not
    // a peak regardless of cumulative play count.
    if (maxCount < MIN_MAX_WEEKLY_COUNT) continue;

    const slice = regionCounts.slice(relStart, relEnd + 1);
    const plays = slice.reduce((a, b) => a + b, 0);
    if (plays < MIN_PLAYS_PER_PEAK) continue;

    peaks.push({ relStart, relEnd, plays, weeks: relEnd - relStart + 1 });
  }

  return peaks;
}
