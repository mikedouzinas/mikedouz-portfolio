/**
 * Tests for scripts/lib/kleinberg.ts
 *
 * Run with: npx tsx scripts/lib/__tests__/kleinberg.test.ts
 */

import {
  kleinbergBurstDetection,
  extractBurstRegions,
  splitIntoPeaks,
} from "../kleinberg";

// ---------------------------------------------------------------------------
// Minimal assertion helpers (no external test framework needed)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    received: ${JSON.stringify(actual)}`);
    failed++;
  }
}

function describe(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  fn();
}

// ---------------------------------------------------------------------------
// Test 1 — All-zero input → all state-0
// ---------------------------------------------------------------------------

describe("Test 1: All-zero input → all state-0", () => {
  const counts = new Array(20).fill(0);
  const { states, stateRates } = kleinbergBurstDetection(counts);

  assertEqual(states.length, 20, "states array has correct length");
  assert(
    states.every((s) => s === 0),
    "all states are 0 for zero input"
  );
  assert(stateRates.length === 4, "default numStates produces 4 rates");
  assert(stateRates[0] > 0, "stateRates[0] is positive");
  assert(
    stateRates[1] > stateRates[0],
    "stateRates are strictly increasing"
  );
});

// ---------------------------------------------------------------------------
// Test 2 — Single spike → state >= 1 at spike, 0 elsewhere
// ---------------------------------------------------------------------------

describe("Test 2: Single spike → state >= 1 at spike location, 0 elsewhere", () => {
  // Build a series that is 0 for most weeks with a large spike in the middle.
  const counts = new Array(30).fill(0);
  const spikeIdx = 15;
  counts[spikeIdx] = 1000; // extreme spike

  const { states } = kleinbergBurstDetection(counts, { s: 2, gamma: 1.5 });

  assert(
    states[spikeIdx] >= 1,
    `state at spike index ${spikeIdx} is >= 1 (got ${states[spikeIdx]})`
  );

  // Weeks far from the spike (first 10 and last 10) should be state 0
  const farFromSpike = [...counts.keys()].filter(
    (i) => Math.abs(i - spikeIdx) > 5
  );
  assert(
    farFromSpike.every((i) => states[i] === 0),
    "weeks far from the spike are state 0"
  );
});

// ---------------------------------------------------------------------------
// Test 3 — extractBurstRegions with known state sequence
// ---------------------------------------------------------------------------

describe(
  "Test 3: extractBurstRegions finds correct regions from [0,0,1,2,2,1,0,0,1,0]",
  () => {
    const states = [0, 0, 1, 2, 2, 1, 0, 0, 1, 0];
    const regions = extractBurstRegions(states, 1);

    assertEqual(regions.length, 2, "two burst regions detected");

    // First region: indices 2–5
    assertEqual(regions[0].start, 2, "region 0 starts at index 2");
    assertEqual(regions[0].end, 5, "region 0 ends at index 5");
    assertEqual(regions[0].maxState, 2, "region 0 maxState is 2");
    assertEqual(
      regions[0].stateSeq,
      [1, 2, 2, 1],
      "region 0 stateSeq is [1,2,2,1]"
    );

    // Second region: index 8
    assertEqual(regions[1].start, 8, "region 1 starts at index 8");
    assertEqual(regions[1].end, 8, "region 1 ends at index 8");
    assertEqual(regions[1].maxState, 1, "region 1 maxState is 1");
    assertEqual(regions[1].stateSeq, [1], "region 1 stateSeq is [1]");
  }
);

// ---------------------------------------------------------------------------
// Test 4 — splitIntoPeaks splits at valleys correctly
// ---------------------------------------------------------------------------

describe("Test 4: splitIntoPeaks splits at valleys correctly", () => {
  // Two clear peaks separated by a 2-week valley
  // Weeks:  0   1   2   3   4   5   6   7   8   9
  // Counts: 10  20  15  1   1   12  25  18  10  5
  //                     ^   ^  valley (2 weeks, count < median of active weeks)
  const weeklyCounts = [10, 20, 15, 1, 1, 12, 25, 18, 10, 5];
  const regionStart = 0;
  const regionEnd = 9;

  const peaks = splitIntoPeaks(weeklyCounts, regionStart, regionEnd);

  assert(peaks.length >= 2, `at least 2 peaks detected (got ${peaks.length})`);

  // First peak should cover weeks 0-2, second should start at week 5 or later
  const firstPeak = peaks[0];
  const secondPeak = peaks[peaks.length - 1];

  assert(
    firstPeak.relStart <= 2,
    `first peak starts at or before relStart 2 (got ${firstPeak.relStart})`
  );
  assert(
    firstPeak.relEnd < 4,
    `first peak ends before valley (relEnd=${firstPeak.relEnd})`
  );
  assert(
    secondPeak.relStart >= 4,
    `second peak starts after valley (relStart=${secondPeak.relStart})`
  );

  // Play counts should be correct
  const firstPlays = weeklyCounts
    .slice(regionStart + firstPeak.relStart, regionStart + firstPeak.relEnd + 1)
    .reduce((a, b) => a + b, 0);
  assertEqual(firstPeak.plays, firstPlays, "first peak play count is correct");
});

// ---------------------------------------------------------------------------
// Test 5 — splitIntoPeaks returns whole region if no valleys
// ---------------------------------------------------------------------------

describe("Test 5: splitIntoPeaks returns whole region if no valleys", () => {
  // Monotonically increasing then decreasing — no valley of 2+ weeks
  const weeklyCounts = [5, 10, 20, 30, 20, 10, 5];
  const regionStart = 0;
  const regionEnd = 6;

  const peaks = splitIntoPeaks(weeklyCounts, regionStart, regionEnd);

  assertEqual(peaks.length, 1, "exactly 1 peak returned (no valleys)");
  assertEqual(peaks[0].relStart, 0, "peak relStart is 0");
  assertEqual(peaks[0].relEnd, 6, "peak relEnd is 6 (whole region)");
  assertEqual(
    peaks[0].plays,
    weeklyCounts.reduce((a, b) => a + b, 0),
    "peak plays equals total count"
  );
  assertEqual(peaks[0].weeks, 7, "peak weeks equals region length");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed.");
}
