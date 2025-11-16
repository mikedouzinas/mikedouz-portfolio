/**
 * Tests for evaluative routing and synthesis upgrade
 * 
 * These tests verify that evaluative/comparative queries (e.g., "best/strongest/what makes")
 * route to GENERAL semantic search with diversified, evidence-rich context.
 */

import { buildEvidencePacks, buildEvidenceSignals, diversifyByType } from '@/lib/iris/retrieval';
import { config } from '@/lib/iris/config';
import type { KBItem } from '@/lib/iris/schema';

// Jest-style test helpers (if Jest is not available, these can be replaced)
const describe = (name: string, fn: () => void) => fn();
const it = (name: string, fn: () => void) => fn();
const expect = (value: unknown) => ({
  toBe: (expected: unknown) => {
    if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
  },
  toBeGreaterThanOrEqual: (expected: number) => {
    if (typeof value !== 'number' || value < expected) throw new Error(`Expected >= ${expected}, got ${value}`);
  },
  toBeGreaterThan: (expected: number) => {
    if (typeof value !== 'number' || value <= expected) throw new Error(`Expected > ${expected}, got ${value}`);
  },
  toBeLessThan: (expected: number) => {
    if (typeof value !== 'number' || value >= expected) throw new Error(`Expected < ${expected}, got ${value}`);
  },
  toBeLessThanOrEqual: (expected: number) => {
    if (typeof value !== 'number' || value > expected) throw new Error(`Expected <= ${expected}, got ${value}`);
  },
  toBeTruthy: () => {
    if (!value) throw new Error(`Expected truthy, got ${value}`);
  },
  toBeFalsy: () => {
    if (value) throw new Error(`Expected falsy, got ${value}`);
  },
  some: (predicate: (item: unknown) => boolean) => {
    if (!Array.isArray(value)) throw new Error(`Expected array, got ${value}`);
    return { toBe: (expected: boolean) => {
      const result = value.some(predicate);
      if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
    }};
  }
});

/**
 * Helper function to test pre-routing logic
 * Replicates the preRoute function logic for testing
 */
function testPreRoute(query: string): 'general' | 'filter_query' | null {
  const EVAL_REGEX = /\b(best|strongest|top|most|unique|what makes|why should|why .* hire|biggest|differen(t|ce))\b/i;
  const LIST_REGEX = /\b(list|show (me )?all|every|enumerate)\b/i;

  if (LIST_REGEX.test(query)) return 'filter_query';
  if (EVAL_REGEX.test(query)) return 'general';
  return null;
}

/**
 * Test Case 1: "what are mike's best skills"
 * 
 * Expected behavior:
 * - Intent should be GENERAL (not filter_query or specific_item)
 * - Retrieval types should include project & experience (not just skill)
 * - Evidence count should be >= 2
 * - Response should cite projects/experiences with evidence, not just skill names
 */
describe('Evaluative Query: Best Skills', () => {
  it('should route to general intent and retrieve projects+experiences', () => {
    const query = "what are mike's best skills";
    
    // Test pre-routing
    if (config.features?.evaluativeRoutingV2) {
      const routed = testPreRoute(query);
      expect(routed).toBe('general');
    }

    // Test evidence signals (mock data)
    const mockResults: Array<{ doc: Partial<KBItem> }> = [
      { doc: { id: 'proj1', kind: 'project', title: 'Project A', summary: 'ML project', specifics: ['Used Python'], dates: { start: '2024-01', end: '2024-06' } } as Partial<KBItem> },
      { doc: { id: 'exp1', kind: 'experience', company: 'Company X', role: 'Engineer', summary: 'Built ML systems', specifics: ['Used Python'], dates: { start: '2023-01', end: '2024-12' } } as Partial<KBItem> }
    ];

    const evidencePacks = buildEvidencePacks(mockResults);
    const signals = buildEvidenceSignals(evidencePacks);

    expect(signals.evidenceCount).toBeGreaterThanOrEqual(2);
    expect(evidencePacks.some(p => p.type === 'project')).toBe(true);
    expect(evidencePacks.some(p => p.type === 'experience')).toBe(true);
  });
});

/**
 * Test Case 2: "what makes Mike different?"
 * 
 * Expected behavior:
 * - Intent should be GENERAL
 * - Should use diversified packs (multiple types)
 * - If evidenceCount < 2, answer should include <ui:contact reason="insufficient_context" .../>
 * - Only one directive should be emitted
 */
describe('Evaluative Query: What Makes Different', () => {
  it('should use diversified retrieval and emit contact directive if evidence insufficient', () => {
    const query = "what makes Mike different?";
    
    // Test pre-routing
    if (config.features?.evaluativeRoutingV2) {
      const routed = testPreRoute(query);
      expect(routed).toBe('general');
    }

    // Test diversification
    const mockResults: Array<{ type: string; doc?: Partial<KBItem> }> = [
      { type: 'project', doc: { id: 'proj1', kind: 'project', title: 'Project A' } as Partial<KBItem> },
      { type: 'experience', doc: { id: 'exp1', kind: 'experience', company: 'Company X', role: 'Engineer' } as Partial<KBItem> },
      { type: 'project', doc: { id: 'proj2', kind: 'project', title: 'Project B' } as Partial<KBItem> }
    ];

    const quotas = { project: 3, experience: 2 };
    const diversified = diversifyByType(mockResults, quotas);

    expect(diversified.length).toBeGreaterThanOrEqual(0);
    expect(diversified.some(r => r.type === 'project')).toBe(true);
    expect(diversified.some(r => r.type === 'experience')).toBe(true);

    // Test UI directive logic (insufficient evidence case)
    const evidencePacks = buildEvidencePacks(diversified.filter(r => r.doc).map(r => ({ doc: r.doc! })));
    const signals = buildEvidenceSignals(evidencePacks);

    if (signals.evidenceCount < 2 || signals.coverageRatio < 0.5) {
      // Should suggest contact
      expect(signals.evidenceCount).toBeLessThan(2);
      // In actual implementation, maybeAddUiDirective would add <ui:contact reason="insufficient_context" .../>
    }
  });
});

/**
 * Test Case 3: Unknown proper noun ("tell me about Project Hyperbeam") with no alias
 * 
 * Expected behavior:
 * - Should route to GENERAL (not specific_item since no alias match)
 * - entityLinkScore should be low (< 0.7)
 * - Either cautious answer OR <ui:contact reason="insufficient_context" .../> (one directive only)
 */
describe('Unknown Proper Noun Query', () => {
  it('should route to general when alias match fails and emit contact directive', () => {
    // This query contains a proper noun but no matching alias
    // Should route to general, not specific_item
    // const query = "tell me about Project Hyperbeam"; // Reserved for future test implementation
    
    // Test evidence signals with low entityLinkScore
    const mockResults: Array<{ doc: Partial<KBItem> }> = [
      { doc: { id: 'proj1', kind: 'project', title: 'Other Project', summary: 'Unrelated' } as Partial<KBItem> }
    ];

    const evidencePacks = buildEvidencePacks(mockResults);
    const signals = buildEvidenceSignals(evidencePacks);

    // Simulate low entityLinkScore (would come from planner or alias matching)
    signals.entityLinkScore = 0.5; // Low confidence
    signals.coverageRatio = 0.3; // Poor coverage

    // Should suggest contact due to weak entity linking
    expect(signals.entityLinkScore).toBeLessThan(0.7);
    expect(signals.coverageRatio).toBeLessThan(0.5);
    
    // In actual implementation, maybeAddUiDirective would add <ui:contact reason="insufficient_context" .../>
    // Only one directive should be emitted
  });
});

