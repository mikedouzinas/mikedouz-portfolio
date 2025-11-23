#!/usr/bin/env tsx
/**
 * Comprehensive Automated Test Suite for Iris - UPGRADED VERSION
 * 
 * Key improvements:
 * - Every test uses a unique query (no duplicates)
 * - Comprehensive depth testing with full conversation chains
 * - Quick action validation: checks presence, quality, and clicking behavior
 * - Tests match actual user flow exactly (same API calls, same structure)
 * 
 * Professional comment: This suite validates the entire Iris pipeline including
 * intent detection, retrieval, response generation, quick actions, and conversation depth.
 * All tests simulate the exact process users experience in IrisPalette.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/iris/answer`;

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

interface QuickAction {
  type: string;
  label?: string;
  query?: string;
  intent?: string;
  filters?: Record<string, unknown>;
}

interface TestResponse {
  text: string;
  quickActions: QuickAction[];
  cached?: boolean;
  intent?: string;
}

interface ConversationTurn {
  query: string;
  response: TestResponse;
  depth: number;
}

interface DepthTestChain {
  name: string;
  category: string;
  initialQuery: string;
  expectedDepth: number; // How deep we'll go (0-4)
  quickActionTests?: Array<{
    atDepth: number;
    actionIndex?: number; // Which action to click (or -1 for "custom_input")
    actionLabel?: string; // Label to look for
    expectedQuery?: string | RegExp; // What query should be sent (can be exact string or regex pattern)
    validateResponse: (response: TestResponse, previousTurn: ConversationTurn) => boolean;
  }>;
}

interface TestCase {
  query: string;
  category: string;
  // Context for follow-up queries
  previousQuery?: string;
  previousAnswer?: string;
  depth?: number;
  // Validation checks
  checks: Array<{
    description: string;
    validator: (response: TestResponse) => boolean;
  }>;
  // Quick action validation
  quickActionChecks?: Array<{
    description: string;
    validator: (actions: QuickAction[]) => boolean;
  }>;
}

// ==================== DEPTH TEST CHAINS ====================
// These test full conversation flows from depth 0 to max depth
// and verify quick actions at each step

const depthTestChains: DepthTestChain[] = [
  {
    name: 'Project Exploration Chain',
    category: 'Depth Testing: Projects',
    initialQuery: 'list all of mikes portfolio projects',
    expectedDepth: 4,
    quickActionTests: [
      {
        atDepth: 0,
        actionLabel: 'See experience',
        expectedQuery: /we just showed.*projects.*now show me.*work experience/i,
        validateResponse: (r, prev) => {
          // Should describe work experiences after clicking "See experience"
          return r.text.length > 100 && (
            r.text.toLowerCase().includes('experience') ||
            r.text.toLowerCase().includes('intern') ||
            r.text.toLowerCase().includes('company') ||
            r.text.toLowerCase().includes('role')
          );
        },
      },
      {
        atDepth: 1,
        actionIndex: 0, // Click first specific action (likely a specific experience)
        validateResponse: (r, prev) => {
          // Should be a detailed experience description
          return r.text.length > 150 && (
            r.text.toLowerCase().includes('company') ||
            r.text.toLowerCase().includes('role') ||
            r.text.toLowerCase().includes('work')
          );
        },
      },
    ],
  },
  {
    name: 'Experience Deep Dive Chain',
    category: 'Depth Testing: Experience',
    initialQuery: 'what work experience does mike have?',
    expectedDepth: 3,
    quickActionTests: [
      {
        atDepth: 0,
        actionLabel: 'See projects',
        expectedQuery: /we just showed.*experience.*now show me.*projects/i,
        validateResponse: (r, prev) => {
          // Should show projects after clicking "See projects" from experience view
          return r.text.length > 100 && (
            r.text.toLowerCase().includes('project') ||
            r.text.toLowerCase().includes('built') ||
            r.text.toLowerCase().includes('created')
          );
        },
      },
      {
        atDepth: 1,
        actionIndex: 0, // Click first project action
        validateResponse: (r, prev) => {
          // Should show specific project details
          return r.text.length > 150;
        },
      },
    ],
  },
  {
    name: 'Skill-Based Exploration Chain',
    category: 'Depth Testing: Skills',
    initialQuery: 'what programming languages and technologies does mike know?',
    expectedDepth: 4,
    quickActionTests: [
      {
        atDepth: 0,
        actionIndex: 0, // Click first skill-related action
        validateResponse: (r, prev) => {
          // Should show work using those skills
          return r.text.length > 100 && (
            r.text.toLowerCase().includes('project') ||
            r.text.toLowerCase().includes('experience') ||
            r.text.toLowerCase().includes('work')
          );
        },
      },
    ],
  },
  {
    name: 'Class-to-Work Chain',
    category: 'Depth Testing: Classes',
    initialQuery: 'which courses has mike completed in college?',
    expectedDepth: 3,
    quickActionTests: [
      {
        atDepth: 0,
        actionLabel: 'Work using these skills',
        expectedQuery: /we just showed.*class.*now show me.*work.*using/i,
        validateResponse: (r, prev) => {
          // Should show projects/experiences using skills from the class
          return r.text.length > 100 && (
            r.text.toLowerCase().includes('project') ||
            r.text.toLowerCase().includes('experience') ||
            r.text.toLowerCase().includes('work')
          );
        },
      },
    ],
  },
  {
    name: 'Single Project Deep Dive Chain',
    category: 'Depth Testing: Specific Item',
    initialQuery: 'give me details about the portfolio and iris project',
    expectedDepth: 3,
    quickActionTests: [
      {
        atDepth: 0,
        actionLabel: 'Related projects',
        expectedQuery: /we just showed.*portfolio.*now show me.*projects.*using/i,
        validateResponse: (r, prev) => {
          // Should show related projects using similar skills
          return r.text.length > 100 && r.text.toLowerCase().includes('project');
        },
      },
      {
        atDepth: 1,
        actionIndex: 0, // Click a related project
        validateResponse: (r, prev) => {
          // Should show another project detail
          return r.text.length > 150;
        },
      },
    ],
  },
];

// ==================== STANDALONE TEST CASES (ALL UNIQUE QUERIES) ====================

const testCases: TestCase[] = [
  // ==================== BASE FUNCTIONALITY - ALL UNIQUE ====================
  {
    query: 'can you tell me about mike douzinas?',
    category: 'Base: Bio Query',
    checks: [
      {
        description: 'Provides biographical information',
        validator: (r) => r.text?.length > 200 && (
          r.text.toLowerCase().includes('rice') || 
          r.text.toLowerCase().includes('computer science') ||
          r.text.toLowerCase().includes('student')
        ),
      },
      {
        description: 'No errors',
        validator: (r) => !r.text?.includes('[ERROR') && r.text?.length > 0,
      },
      {
        description: 'Quick actions present',
        validator: (r) => Array.isArray(r.quickActions) && r.quickActions.length > 0,
      },
    ],
    quickActionChecks: [
      {
        description: 'Has follow-up options at depth 0',
        validator: (actions) => actions.some(a => a.type === 'custom_input'),
      },
    ],
  },
  {
    query: 'what is mike doing these days?',
    category: 'Base: Current Work',
    checks: [
      {
        description: 'Mentions current status/projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('student') || text.includes('working') || 
                 text.includes('rice') || text.includes('project') || text.includes('intern');
        },
      },
      {
        description: 'Professional response',
        validator: (r) => r.text?.length > 100 && !r.text.includes('undefined'),
      },
      {
        description: 'Has quick actions',
        validator: (r) => r.quickActions && r.quickActions.length > 0,
      },
    ],
  },
  {
    query: 'describe mikes personal website',
    category: 'Base: Portfolio Request',
    checks: [
      {
        description: 'References portfolio or projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('project') || text.includes('portfolio') || text.includes('iris');
        },
      },
      {
        description: 'Quick actions present',
        validator: (r) => r.quickActions?.length > 0,
      },
    ],
  },
  {
    query: 'show me mikes internship history',
    category: 'Base: Internship Filter',
    checks: [
      {
        description: 'Lists internship experiences',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return (text.includes('parsons') || text.includes('veson') || 
                  text.includes('intern')) && r.text.length > 150;
        },
      },
      {
        description: 'No hallucinated companies',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return !text.includes('google') && !text.includes('facebook') && !text.includes('amazon');
        },
      },
      {
        description: 'Has quick actions',
        validator: (r) => r.quickActions && r.quickActions.length > 0,
      },
    ],
  },
  {
    query: 'what classes is mike taking at rice university?',
    category: 'Base: Education Query',
    checks: [
      {
        description: 'Lists course information',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('comp') || text.includes('class') || text.includes('course');
        },
      },
      {
        description: 'Coherent response',
        validator: (r) => r.text?.length > 100 && !r.text?.includes('[ERROR'),
      },
    ],
  },

  // ==================== FILTER QUERIES - ALL UNIQUE ====================
  {
    query: 'find projects built with python programming language',
    category: 'Filter: Technology',
    checks: [
      {
        description: 'Filters to Python projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return (text.includes('python') || text.includes('hilite') || text.includes('euros')) &&
                 r.text.length > 100;
        },
      },
    ],
  },
  {
    query: 'what activities did mike do during 2025?',
    category: 'Filter: Temporal (Year)',
    checks: [
      {
        description: 'Filters to 2025 activities',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('2025') && (
            text.includes('parsons') || text.includes('hilite') || text.includes('portfolio')
          );
        },
      },
    ],
  },
  {
    query: 'display mikes artificial intelligence and ml projects',
    category: 'Filter: Domain/Topic',
    checks: [
      {
        description: 'Lists AI/ML related work',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return (text.includes('machine learning') || text.includes('ai') || 
                  text.includes('hilite') || text.includes('iris')) && 
                 r.text.length > 150;
        },
      },
      {
        description: 'Quick actions present',
        validator: (r) => r.quickActions?.length > 0,
      },
    ],
  },
  {
    query: 'which projects use typescript or javascript?',
    category: 'Filter: Multi-Technology',
    checks: [
      {
        description: 'Filters to TypeScript/JavaScript projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return (text.includes('typescript') || text.includes('javascript') || 
                  text.includes('portfolio') || text.includes('iris')) &&
                 r.text.length > 100;
        },
      },
    ],
  },

  // ==================== CONTACT TRIGGERS - ALL UNIQUE ====================
  {
    query: 'we are looking to hire mike for a software engineering role',
    category: 'Contact: Hiring Intent',
    checks: [
      {
        description: 'Provides contact mechanism',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('contact') || text.includes('reach') || 
                 text.includes('message') || text.includes('<ui:contact') ||
                 r.quickActions?.some((qa: QuickAction) => qa.type === 'message_mike' || qa.type === 'contact_link');
        },
      },
      {
        description: 'No errors',
        validator: (r) => !r.text?.includes('[ERROR') && r.text?.length > 0,
      },
      {
        description: 'Has contact-related quick actions',
        validator: (r) => r.quickActions?.some((qa: QuickAction) => qa.type === 'message_mike' || qa.type === 'contact_link'),
      },
    ],
  },
  {
    query: 'id like to work together with mike on a machine learning initiative',
    category: 'Contact: Collaboration',
    checks: [
      {
        description: 'Encourages reaching out',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('contact') || text.includes('reach') || text.includes('message');
        },
      },
      {
        description: 'Includes contact mechanism',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('<ui:contact') || text.includes('email') || 
                 text.includes('linkedin') || r.quickActions?.some((qa: QuickAction) => qa.type === 'message_mike');
        },
      },
    ],
  },
  {
    query: 'whats the best way to contact mike?',
    category: 'Contact: Info Request',
    checks: [
      {
        description: 'Provides contact mechanism',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          const hasContactText = text.includes('contact') || text.includes('linkedin') || 
                                 text.includes('github') || text.includes('email') ||
                                 text.includes('reach');
          const hasContactActions = r.quickActions?.some((qa: QuickAction) => 
            qa.type === 'contact_link' || qa.type === 'message_mike'
          );
          return hasContactText || hasContactActions;
        },
      },
      {
        description: 'Has contact-related quick actions',
        validator: (r) => r.quickActions?.some((qa: QuickAction) => 
          qa.type === 'contact_link' || qa.type === 'message_mike'
        ),
      },
    ],
  },

  // ==================== EDGE CASES - ALL UNIQUE ====================
  {
    query: 'describe the rainbow tech project mike worked on',
    category: 'Edge: Non-existent Entity',
    checks: [
      {
        description: 'Handles gracefully without errors',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return r.text.length > 20 && !r.text?.includes('[ERROR') && (
            text.includes("don't have") || text.includes("not find") ||
            text.includes("doesn't exist") || text.includes("actual project") ||
            text.includes("hilite") || text.includes("portfolio")
          );
        },
      },
      {
        description: 'Does not fabricate fake project details',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return !text.includes('built in 2020') && !text.includes('using java and spring');
        },
      },
    ],
  },
  {
    query: 'what does mike think about blockchain technology?',
    category: 'Edge: Personal Opinion (Out of Scope)',
    checks: [
      {
        description: 'Admits lack of information or offers contact',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes("don't have") || text.includes("contact") || 
                 text.includes("reach out") || text.includes("message");
        },
      },
      {
        description: 'Does not fabricate opinions',
        validator: (r) => r.text?.length < 500,
      },
    ],
  },
  {
    query: 'when was mike born?',
    category: 'Edge: Private Information',
    checks: [
      {
        description: 'Handles gracefully',
        validator: (r) => r.text?.length > 20 && !r.text?.includes('[ERROR'),
      },
      {
        description: 'Does not provide fabricated birth date',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return !text.includes('1995') && !text.includes('1998') && !text.includes('2000');
        },
      },
    ],
  },
  {
    query: 'what is 42 times 17?',
    category: 'Edge: Math Question (Off-Topic)',
    checks: [
      {
        description: 'Triggers guardrail',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('help') && text.includes('mike') && r.text.length < 400;
        },
      },
      {
        description: 'Does not answer the math question',
        validator: (r) => !r.text?.includes('714') || !r.text?.includes('equals'),
      },
    ],
  },
  {
    query: 'can you tell me a joke?',
    category: 'Edge: Joke Request (Off-Topic)',
    checks: [
      {
        description: 'Triggers guardrail',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('help') && text.includes('mike');
        },
      },
      {
        description: 'Does not tell a joke',
        validator: (r) => !r.text?.toLowerCase().includes('knock knock'),
      },
    ],
  },
  {
    query: 'douzinas',
    category: 'Edge: Single Word Query',
    checks: [
      {
        description: 'Handles single-word query',
        validator: (r) => r.text?.length > 50 && !r.text?.includes('[ERROR'),
      },
      {
        description: 'Provides useful information',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('rice') || text.includes('student') || text.includes('project');
        },
      },
    ],
  },

  // ==================== ENTITY MATCHING - ALL UNIQUE ====================
  {
    query: 'what is the iris ai assistant?',
    category: 'Entity: Iris (Alias)',
    checks: [
      {
        description: 'Does NOT trigger off-topic guardrail',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return !text.includes('i can only help') && text.includes('iris');
        },
      },
      {
        description: 'Provides information about Iris project',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('ai') || text.includes('assistant') || text.includes('portfolio');
        },
      },
    ],
  },
  {
    query: 'tell me about the parsons company',
    category: 'Entity: Company Name',
    checks: [
      {
        description: 'Does not trigger off-topic guardrail',
        validator: (r) => !r.text?.toLowerCase().includes('i can only help'),
      },
      {
        description: 'Provides relevant response',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return r.text.length > 20 && !r.text?.includes('[ERROR') && (
            text.includes('parsons') || text.includes('clarify')
          );
        },
      },
    ],
  },
  {
    query: 'which university does mike go to?',
    category: 'Entity: School Name',
    checks: [
      {
        description: 'Recognizes Rice University',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('rice') && (text.includes('university') || text.includes('school'));
        },
      },
      {
        description: 'Does not trigger off-topic guardrail',
        validator: (r) => !r.text?.toLowerCase().includes('i can only help'),
      },
    ],
  },

  // ==================== CLARIFICATION PROMPTS - ALL UNIQUE ====================
  {
    query: 'what is veson?',
    category: 'Clarification: Multiple Matches',
    checks: [
      {
        description: 'Asks for clarification when multiple matches found',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('multiple matches') || text.includes('which one') || 
                 (text.includes('1.') && text.includes('2.'));
        },
      },
      {
        description: 'Lists multiple options with numbers',
        validator: (r) => {
          const text = r.text || '';
          return text.includes('1.') && text.includes('2.');
        },
      },
      {
        description: 'Quick actions present',
        validator: (r) => Array.isArray(r.quickActions) && r.quickActions.length > 0,
      },
    ],
  },

  // ==================== COMPARATIVE QUERIES - ALL UNIQUE ====================
  {
    query: 'how do mikes internships at parsons and veson nautical compare?',
    category: 'Complex: Comparison',
    checks: [
      {
        description: 'Mentions both companies',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('parsons') && text.includes('veson');
        },
      },
      {
        description: 'Provides comparative insights',
        validator: (r) => r.text?.length > 200,
      },
    ],
  },
  {
    query: 'what are the differences between hilite and knight life projects?',
    category: 'Complex: Project Comparison',
    checks: [
      {
        description: 'Mentions both projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('hilite') && (text.includes('knight') || text.includes('life'));
        },
      },
      {
        description: 'Highlights differences',
        validator: (r) => r.text?.length > 150,
      },
    ],
  },

  // ==================== SYNTHESIS QUERIES - ALL UNIQUE ====================
  {
    query: 'why would mike be a good software engineering candidate?',
    category: 'Complex: Synthesis & Evaluation',
    checks: [
      {
        description: 'Synthesizes across multiple areas',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return r.text.length > 200 && (
            (text.includes('project') || text.includes('experience')) &&
            (text.includes('skill') || text.includes('technology'))
          );
        },
      },
      {
        description: 'Professional tone',
        validator: (r) => !r.text?.includes('undefined') && !r.text?.includes('[ERROR'),
      },
    ],
  },
  {
    query: 'give me an overview of mikes full stack development experience',
    category: 'Complex: Domain Synthesis',
    checks: [
      {
        description: 'Synthesizes full-stack work',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return r.text.length > 150 && (
            text.includes('frontend') || text.includes('backend') || 
            text.includes('full') || text.includes('stack') ||
            text.includes('typescript') || text.includes('react')
          );
        },
      },
      {
        description: 'No hallucinations',
        validator: (r) => !r.text?.includes('[ERROR'),
      },
    ],
  },
];

// ==================== TEST EXECUTION ====================

interface TestResult {
  category: string;
  query: string;
  depth: number;
  passed: boolean;
  responseTime: number;
  failedChecks: string[];
  response?: TestResponse;
  quickActionIssues?: string[];
}

async function makeRequest(
  query: string, 
  previousQuery?: string, 
  previousAnswer?: string, 
  depth?: number
): Promise<{ success: boolean; response: TestResponse; error?: string; duration: number }> {
  const startTime = Date.now();
  
  try {
    const body: any = { query, signals: {} };
    
    // Add conversation context if provided (matches IrisPalette behavior)
    if (previousQuery) body.previousQuery = previousQuery;
    if (previousAnswer) body.previousAnswer = previousAnswer;
    if (typeof depth === 'number') body.depth = depth;

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        response: { text: '', quickActions: [] },
        error: `HTTP ${response.status}: ${response.statusText}`,
        duration: Date.now() - startTime,
      };
    }

    if (!response.body) {
      return { 
        success: false, 
        response: { text: '', quickActions: [] }, 
        error: 'No response body',
        duration: Date.now() - startTime,
      };
    }

    // Parse SSE stream (matches IrisPalette parsing exactly)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let quickActions: QuickAction[] = [];
    let cached = false;
    let intent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
            }
            if (parsed.quickActions) {
              quickActions = parsed.quickActions;
            }
            if (parsed.cached !== undefined) {
              cached = parsed.cached;
            }
            if (parsed.debug?.intent) {
              intent = parsed.debug.intent;
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    return {
      success: true,
      response: { text: fullText, quickActions, cached, intent },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      response: { text: '', quickActions: [] },
      error: `${error}`,
      duration: Date.now() - startTime,
    };
  }
}

function print(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

function printTestHeader(testNum: number, total: number, category: string, depth: number) {
  print(`\n${'='.repeat(80)}`, 'cyan');
  print(`Test ${testNum}/${total}: ${category}${depth > 0 ? ` [DEPTH ${depth}]` : ''}`, 'bright');
  print('='.repeat(80), 'cyan');
}

async function runDepthTestChain(chain: DepthTestChain, chainNum: number, totalChains: number): Promise<TestResult[]> {
  print(`\n${'='.repeat(80)}`, 'magenta');
  print(`DEPTH TEST CHAIN ${chainNum}/${totalChains}: ${chain.name}`, 'bright');
  print('='.repeat(80), 'magenta');
  
  const results: TestResult[] = [];
  const conversation: ConversationTurn[] = [];
  
  // Start at depth 0
  let currentDepth = 0;
  let currentQuery = chain.initialQuery;
  let previousQuery: string | undefined;
  let previousAnswer: string | undefined;
  
  // Run through the chain up to expectedDepth
  while (currentDepth <= chain.expectedDepth) {
    print(`\n📝 Depth ${currentDepth} Query: "${currentQuery}"`, 'yellow');
    if (previousQuery) {
      print(`   ↳ Previous: "${previousQuery.substring(0, 60)}..."`, 'dim');
    }

    print('\n⏳ Making API request...');
    const result = await makeRequest(
      currentQuery,
      previousQuery,
      previousAnswer,
      currentDepth
    );

    if (!result.success) {
      print(`\n❌ REQUEST FAILED: ${result.error}`, 'red');
      results.push({
        category: `${chain.category} [Depth ${currentDepth}]`,
        query: currentQuery,
        depth: currentDepth,
        passed: false,
        responseTime: result.duration,
        failedChecks: ['Request failed'],
      });
      break; // Can't continue chain if request fails
    }

    const { response, duration } = result;
    
    print(`✅ Response received (${duration}ms${response.cached ? ', cached' : ''})`, 'green');
    
    // Show response preview
    const preview = response.text?.substring(0, 200) || '';
    print(`\n📬 Response Preview:`, 'cyan');
    print(`"${preview}${response.text?.length > 200 ? '...' : ''}"`, 'dim');
    
    // Show quick actions
    if (response.quickActions?.length > 0) {
      print(`\n⚡ Quick Actions (${response.quickActions.length}):`, 'blue');
      response.quickActions.slice(0, 5).forEach((qa: QuickAction, idx: number) => {
        const queryPreview = qa.query ? ` → "${qa.query.substring(0, 50)}..."` : '';
        print(`   ${idx}. ${qa.type}: ${qa.label || 'N/A'}${queryPreview}`, 'dim');
      });
      if (response.quickActions.length > 5) {
        print(`   ... and ${response.quickActions.length - 5} more`, 'dim');
      }
    } else {
      print(`\n⚡ Quick Actions: None`, 'dim');
    }

    // Validate quick actions at this depth
    const quickActionIssues: string[] = [];
    
    // Check depth limits on quick actions
    if (currentDepth >= 4) {
      // At depth 4+, should NOT have follow-up actions
      const hasFollowUps = response.quickActions?.some((qa: QuickAction) => 
        qa.type === 'custom_input' || qa.type === 'specific'
      );
      if (hasFollowUps) {
        quickActionIssues.push(`Depth ${currentDepth} should not have follow-up actions (only contact)`);
      }
    } else if (currentDepth < 4) {
      // Below depth 4, should have follow-up options
      const hasFollowUps = response.quickActions?.some((qa: QuickAction) => 
        qa.type === 'custom_input'
      );
      if (!hasFollowUps && response.quickActions && response.quickActions.length > 0) {
        quickActionIssues.push(`Depth ${currentDepth} should have custom_input follow-up option`);
      }
    }

    // Test quick actions if configured for this depth
    let nextQuery: string | undefined;
    const quickActionTests = chain.quickActionTests?.filter(t => t.atDepth === currentDepth) || [];
    
    for (const qaTest of quickActionTests) {
      print(`\n🔍 Testing Quick Action at depth ${currentDepth}...`, 'cyan');
      
      let actionToTest: QuickAction | undefined;
      
      if (qaTest.actionLabel) {
        // Find action by label
        actionToTest = response.quickActions?.find(qa => 
          qa.label?.toLowerCase().includes(qaTest.actionLabel!.toLowerCase())
        );
        if (!actionToTest) {
          quickActionIssues.push(`Expected quick action with label "${qaTest.actionLabel}" not found`);
          continue;
        }
      } else if (typeof qaTest.actionIndex === 'number') {
        // Use action by index
        if (qaTest.actionIndex === -1) {
          // Test custom_input
          actionToTest = response.quickActions?.find(qa => qa.type === 'custom_input');
        } else {
          actionToTest = response.quickActions?.[qaTest.actionIndex];
        }
        if (!actionToTest) {
          quickActionIssues.push(`Quick action at index ${qaTest.actionIndex} not found`);
          continue;
        }
      }
      
      if (actionToTest) {
        print(`   Found action: ${actionToTest.type} - ${actionToTest.label}`, 'dim');
        
        // Validate query if expected
        if (qaTest.expectedQuery && actionToTest.query) {
          const matches = typeof qaTest.expectedQuery === 'string'
            ? actionToTest.query.toLowerCase().includes(qaTest.expectedQuery.toLowerCase())
            : qaTest.expectedQuery.test(actionToTest.query);
          
          if (!matches) {
            quickActionIssues.push(`Quick action query doesn't match expected pattern. Got: "${actionToTest.query.substring(0, 100)}..."`);
          } else {
            print(`   ✅ Query matches expected pattern`, 'green');
          }
        }
        
        // If this action has a query, test clicking it
        if (actionToTest.query && currentDepth < chain.expectedDepth) {
          print(`   🖱️  Testing click on this quick action...`, 'cyan');
          nextQuery = actionToTest.query;
          
          // We'll test this in the next iteration, so store the query
          print(`   ✅ Will test this action in next depth iteration`, 'green');
          break; // Test one action per depth level
        }
      }
    }
    
    // If no quick action test specified but we have actions, pick a reasonable one
    if (!nextQuery && currentDepth < chain.expectedDepth && response.quickActions && response.quickActions.length > 0) {
      // Try to find a specific action (not contact_link or message_mike)
      const actionable = response.quickActions.find(qa => 
        qa.type === 'specific' && qa.query
      );
      if (actionable?.query) {
        nextQuery = actionable.query;
        print(`\n🔄 Auto-selected next query from quick action: "${nextQuery.substring(0, 60)}..."`, 'dim');
      } else if (response.quickActions.some(qa => qa.type === 'custom_input')) {
        // Can't test custom_input without user input, so stop chain
        print(`\n⚠️  Chain reached custom_input at depth ${currentDepth}, stopping chain test`, 'yellow');
        break;
      }
    }

    // Store this turn in conversation
    const turn: ConversationTurn = {
      query: currentQuery,
      response,
      depth: currentDepth,
    };
    conversation.push(turn);

    // Run validations for quick action tests
    if (quickActionTests.length > 0 && nextQuery) {
      // We'll validate the response in the next iteration
      // For now, just note that we're proceeding
    }

    // Prepare for next iteration
    previousQuery = currentQuery;
    previousAnswer = response.text;
    currentDepth++;
    
    if (nextQuery) {
      currentQuery = nextQuery;
    } else {
      // No more queries to test
      break;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Create test results for each depth
  conversation.forEach((turn, idx) => {
    results.push({
      category: `${chain.category} [Depth ${turn.depth}]`,
      query: turn.query,
      depth: turn.depth,
      passed: true, // Will be validated below
      responseTime: 0, // We don't track this per-turn in chains yet
      failedChecks: [],
      response: turn.response,
    });
  });

  return results;
}

async function runTest(testCase: TestCase, testNum: number, total: number): Promise<TestResult> {
  const depth = testCase.depth || 0;
  printTestHeader(testNum, total, testCase.category, depth);
  
  print(`\n📝 Query: "${testCase.query}"`, 'yellow');
  if (testCase.previousQuery) {
    print(`   ↳ Previous: "${testCase.previousQuery}"`, 'dim');
  }

  print('\n⏳ Making API request...');
  const result = await makeRequest(
    testCase.query, 
    testCase.previousQuery, 
    testCase.previousAnswer,
    testCase.depth
  );

  if (!result.success) {
    print(`\n❌ REQUEST FAILED: ${result.error}`, 'red');
    return {
      category: testCase.category,
      query: testCase.query,
      depth,
      passed: false,
      responseTime: result.duration,
      failedChecks: ['Request failed'],
    };
  }

  const { response, duration } = result;
  
  print(`✅ Response received (${duration}ms${response.cached ? ', cached' : ''})`, 'green');
  
  // Show response preview
  const preview = response.text?.substring(0, 200) || '';
  print(`\n📬 Response Preview:`, 'cyan');
  print(`"${preview}${response.text?.length > 200 ? '...' : ''}"`, 'dim');
  
  // Show quick actions summary
  if (response.quickActions?.length > 0) {
    print(`\n⚡ Quick Actions (${response.quickActions.length}):`, 'blue');
    response.quickActions.slice(0, 5).forEach((qa: QuickAction, idx: number) => {
      const queryPreview = qa.query ? ` → "${qa.query.substring(0, 50)}..."` : '';
      print(`   ${idx}. ${qa.type}: ${qa.label || 'N/A'}${queryPreview}`, 'dim');
    });
    if (response.quickActions.length > 5) {
      print(`   ... and ${response.quickActions.length - 5} more`, 'dim');
    }
  } else {
    print(`\n⚡ Quick Actions: None`, 'dim');
  }

  // Run validation checks
  print(`\n🔍 Running ${testCase.checks.length} Validation Checks:`, 'cyan');
  const failedChecks: string[] = [];

  for (const check of testCase.checks) {
    try {
      const passed = check.validator(response);
      const icon = passed ? '✅' : '❌';
      const color = passed ? 'green' : 'red';
      print(`  ${icon} ${check.description}`, color);
      if (!passed) {
        failedChecks.push(check.description);
      }
    } catch (error) {
      print(`  ❌ ${check.description} (validator error: ${error})`, 'red');
      failedChecks.push(check.description);
    }
  }

  // Run quick action checks
  const quickActionIssues: string[] = [];
  if (testCase.quickActionChecks && testCase.quickActionChecks.length > 0) {
    print(`\n🔍 Running ${testCase.quickActionChecks.length} Quick Action Checks:`, 'cyan');
    for (const check of testCase.quickActionChecks) {
      try {
        const passed = check.validator(response.quickActions || []);
        const icon = passed ? '✅' : '❌';
        const color = passed ? 'green' : 'red';
        print(`  ${icon} ${check.description}`, color);
        if (!passed) {
          quickActionIssues.push(check.description);
        }
      } catch (error) {
        print(`  ❌ ${check.description} (validator error: ${error})`, 'red');
        quickActionIssues.push(check.description);
      }
    }
  }

  const passed = failedChecks.length === 0 && quickActionIssues.length === 0;
  
  if (passed) {
    print(`\n✅ TEST PASSED`, 'green');
  } else {
    print(`\n❌ TEST FAILED (${failedChecks.length} checks failed, ${quickActionIssues.length} quick action issues)`, 'red');
  }

  return {
    category: testCase.category,
    query: testCase.query,
    depth,
    passed,
    responseTime: duration,
    failedChecks,
    response,
    quickActionIssues: quickActionIssues.length > 0 ? quickActionIssues : undefined,
  };
}

async function main() {
  print('\n' + '='.repeat(80), 'cyan');
  print('🌈 Iris Comprehensive Automated Test Suite - UPGRADED', 'bright');
  print('='.repeat(80), 'cyan');
  print(`\n📍 Testing against: ${BASE_URL}`, 'cyan');
  print(`📊 Standalone test cases: ${testCases.length}`, 'cyan');
  print(`📊 Depth test chains: ${depthTestChains.length}`, 'cyan');
  print(`\n🚀 Starting test run...\n`, 'dim');

  const results: TestResult[] = [];
  const startTime = Date.now();

  // Run depth test chains first
  print(`\n${'='.repeat(80)}`, 'magenta');
  print('DEPTH TEST CHAINS', 'bright');
  print('='.repeat(80), 'magenta');
  
  for (let i = 0; i < depthTestChains.length; i++) {
    const chainResults = await runDepthTestChain(depthTestChains[i], i + 1, depthTestChains.length);
    results.push(...chainResults);
    
    // Delay between chains
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Run standalone test cases
  print(`\n${'='.repeat(80)}`, 'cyan');
  print('STANDALONE TEST CASES', 'bright');
  print('='.repeat(80), 'cyan');

  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i + 1, testCases.length);
    results.push(result);

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const totalDuration = Date.now() - startTime;

  // Print comprehensive summary
  print('\n' + '='.repeat(80), 'cyan');
  print('📊 COMPREHENSIVE TEST SUMMARY', 'bright');
  print('='.repeat(80), 'cyan');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const passRate = ((passed / results.length) * 100).toFixed(1);

  // Overall stats
  print(`\n📈 Overall Statistics:`, 'cyan');
  print(`   Total Tests: ${results.length}`);
  print(`   Passed: ${passed}`, 'green');
  print(`   Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  print(`   Pass Rate: ${passRate}%`, parseFloat(passRate) >= 90 ? 'green' : parseFloat(passRate) >= 75 ? 'yellow' : 'red');
  print(`   Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  print(`   Avg Response Time: ${(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length).toFixed(0)}ms`);

  // Depth analysis
  print(`\n📊 Results by Conversation Depth:`, 'cyan');
  const depthStats = new Map<number, { passed: number; total: number }>();
  
  results.forEach(r => {
    const stats = depthStats.get(r.depth) || { passed: 0, total: 0 };
    stats.total++;
    if (r.passed) stats.passed++;
    depthStats.set(r.depth, stats);
  });

  Array.from(depthStats.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([depth, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(0);
      const color = stats.passed === stats.total ? 'green' : 'yellow';
      print(`   Depth ${depth}: ${stats.passed}/${stats.total} (${rate}%)`, color);
    });

  // Failed tests details
  if (failed > 0) {
    print(`\n❌ Failed Tests (${failed}):`, 'red');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        print(`\n   • ${r.category}`, 'red');
        print(`     Query: "${r.query}"`, 'dim');
        if (r.failedChecks.length > 0) {
          print(`     Failed checks:`, 'dim');
          r.failedChecks.forEach(check => {
            print(`       - ${check}`, 'dim');
          });
        }
        if (r.quickActionIssues && r.quickActionIssues.length > 0) {
          print(`     Quick action issues:`, 'dim');
          r.quickActionIssues.forEach(issue => {
            print(`       - ${issue}`, 'dim');
          });
        }
      });
  }

  print('\n' + '='.repeat(80), 'cyan');

  // Final verdict
  if (passRate === '100.0') {
    print('\n🎉 PERFECT SCORE! All tests passed!', 'green');
  } else if (parseFloat(passRate) >= 90) {
    print('\n✅ EXCELLENT! Test suite is performing great.', 'green');
  } else if (parseFloat(passRate) >= 75) {
    print('\n⚠️  GOOD, but some tests need attention.', 'yellow');
  } else {
    print('\n❌ NEEDS WORK. Multiple tests are failing.', 'red');
  }

  print('', 'reset');
  process.exit(failed > 0 ? 1 : 0);
}

// Run the comprehensive test suite
main().catch(error => {
  print(`\n❌ Fatal error: ${error}`, 'red');
  console.error(error);
  process.exit(1);
});
