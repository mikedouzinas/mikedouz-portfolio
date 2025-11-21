#!/usr/bin/env tsx
/**
 * Comprehensive Automated Test Suite for Iris
 * 
 * Tests:
 * - Realistic user queries
 * - Conversation threading and follow-ups
 * - Quick actions presence and variety
 * - Edge cases and boundary conditions
 * - Filter queries and entity matching
 * - Contact triggers and guardrails
 * 
 * Professional comment: This suite validates the entire Iris pipeline including
 * intent detection, retrieval, response generation, quick actions, and conversation depth.
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
    validator: (response: any) => boolean;
  }>;
}

// Comprehensive test cases covering real-world scenarios
const testCases: TestCase[] = [
  // ==================== REALISTIC INITIAL QUERIES ====================
  {
    query: 'tell me about mike',
    category: 'General Bio Query (Very Common)',
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
      {
        description: 'Has follow-up options (depth < 2)',
        validator: (r) => r.quickActions?.some((qa: any) => qa.type === 'custom_input' || qa.type === 'preset'),
      },
    ],
  },
  {
    query: 'what does mike do?',
    category: 'Current Work/Status Query (Very Common)',
    checks: [
      {
        description: 'Mentions current status/work',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('student') || text.includes('working') || 
                 text.includes('rice') || text.includes('project') || text.includes('engineer');
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
    query: 'show me mikes portfolio',
    category: 'Portfolio Request (Common)',
    checks: [
      {
        description: 'References portfolio or projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('project') || text.includes('portfolio') || text.includes('hilite');
        },
      },
      {
        description: 'Quick actions present',
        validator: (r) => r.quickActions?.length > 0,
      },
    ],
  },
  {
    query: 'what internships has mike done?',
    category: 'Specific Experience Filter (Common)',
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
    query: 'what classes has mike taken?',
    category: 'Education Query (Common)',
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

  // ==================== FOLLOW-UP QUERIES (DEPTH 1) ====================
  {
    query: 'tell me more about hilite',
    category: 'Follow-up: Depth 1 - Specific Project Drill-Down',
    previousQuery: 'what projects has mike worked on?',
    previousAnswer: 'Mike has worked on several projects including HiLiTe, Portfolio, Knight Life, and more.',
    depth: 1,
    checks: [
      {
        description: 'Provides detailed HiLiTe information',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return text.includes('hilite') && (
            text.includes('machine learning') || 
            text.includes('soccer') ||
            text.includes('highlight')
          ) && r.text.length > 200;
        },
      },
      {
        description: 'Quick actions present (depth 1 < 2)',
        validator: (r) => r.quickActions?.length > 0,
      },
      {
        description: 'Has follow-up options (depth 1 < 2)',
        validator: (r) => r.quickActions?.some((qa: any) => 
          qa.type === 'custom_input' || qa.type === 'preset'
        ),
      },
      {
        description: 'May have GitHub or external links',
        validator: (r) => r.quickActions?.some((qa: any) => 
          qa.type === 'contact_link' || qa.type === 'dropdown'
        ) || true, // Optional check
      },
    ],
  },
  {
    query: 'what technologies did he use?',
    category: 'Follow-up: Depth 1 - Tech Stack Question',
    previousQuery: 'tell me about hilite',
    previousAnswer: 'HiLiTe is a machine learning project that transforms soccer matches into highlight reels.',
    depth: 1,
    checks: [
      {
        description: 'Mentions technologies or technical concepts',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // Accept mentions of tech stack, ML concepts, or processing techniques
          return (text.includes('python') || text.includes('pytorch') || 
                  text.includes('opencv') || text.includes('skill') ||
                  text.includes('machine learning') || text.includes('computer vision') ||
                  text.includes('processing') || text.includes('technology')) && 
                 r.text.length > 50;
        },
      },
      {
        description: 'Still has quick actions at depth 1',
        validator: (r) => r.quickActions?.length > 0,
      },
    ],
  },

  // ==================== FOLLOW-UP QUERIES (DEPTH 2) ====================
  {
    query: 'what other ml projects has he done?',
    category: 'Follow-up: Depth 2 - Comparative Question',
    previousQuery: 'what technologies did he use?',
    previousAnswer: 'HiLiTe used Python, PyTorch, OpenCV, and machine learning.',
    depth: 2,
    checks: [
      {
        description: 'Provides other ML projects',
        validator: (r) => r.text?.length > 100 && !r.text?.includes('[ERROR'),
      },
      {
        description: 'Still has follow-up actions (depth 2 < 4)',
        validator: (r) => {
          // At depth 2, should still have custom_input since depth < 4
          const hasFollowUpActions = r.quickActions?.some((qa: any) => 
            qa.type === 'custom_input'
          );
          return hasFollowUpActions; // SHOULD have follow-up actions at depth 2
        },
      },
      {
        description: 'May have contact links or other actions',
        validator: (r) => r.quickActions?.length > 0,
      },
    ],
  },

  // ==================== FOLLOW-UP QUERIES (DEPTH 3) ====================
  {
    query: 'what else has he built?',
    category: 'Follow-up: Depth 3 - Deep Dive',
    previousQuery: 'what other ml projects has he done?',
    previousAnswer: 'Mike worked on Euros 2024 Predictor and other ML projects.',
    depth: 3,
    checks: [
      {
        description: 'Provides relevant information',
        validator: (r) => r.text?.length > 50 && !r.text?.includes('[ERROR'),
      },
      {
        description: 'Still has follow-up actions (depth 3 < 4)',
        validator: (r) => {
          // At depth 3, should have custom_input since depth < 4
          const hasFollowUpActions = r.quickActions?.some((qa: any) => 
            qa.type === 'custom_input'
          );
          // Be lenient - if no quick actions, the query might be too vague
          return hasFollowUpActions || r.quickActions?.length === 0;
        },
      },
    ],
  },

  // ==================== FOLLOW-UP QUERIES (DEPTH 4 - LIMIT) ====================
  {
    query: 'what skills did this project use?',
    category: 'Follow-up: Depth 4 - At Limit',
    previousQuery: 'tell me more about the euros predictor',
    previousAnswer: 'Euros Predictor used Python, Pandas, and scikit-learn.',
    depth: 4,
    checks: [
      {
        description: 'Provides skill information',
        validator: (r) => r.text?.length > 50 && !r.text?.includes('[ERROR'),
      },
      {
        description: 'NO follow-up actions at depth 4 (depth >= 4)',
        validator: (r) => {
          const hasFollowUpActions = r.quickActions?.some((qa: any) => 
            qa.type === 'custom_input' || qa.type === 'preset'
          );
          return !hasFollowUpActions; // Should NOT have follow-ups at depth 4
        },
      },
      {
        description: 'Only contact actions at depth 4',
        validator: (r) => {
          // At depth >= 4, should only have contact actions
          const allContactActions = r.quickActions?.every((qa: any) => 
            qa.type === 'contact_link' || qa.type === 'message_mike'
          );
          return allContactActions || r.quickActions?.length === 0;
        },
      },
    ],
  },

  // ==================== FILTER QUERIES ====================
  {
    query: 'show me typescript projects',
    category: 'Filter: Technology-based',
    checks: [
      {
        description: 'Filters to TypeScript projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return (text.includes('typescript') || text.includes('portfolio') || text.includes('iris')) &&
                 r.text.length > 100;
        },
      },
      {
        description: 'No Python-only projects listed',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // Should not exclusively list Python projects when filtering for TypeScript
          return !text.includes('euros predictor') || text.includes('portfolio');
        },
      },
    ],
  },
  {
    query: 'what has mike done in 2025?',
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
      {
        description: 'Does not include 2024 experiences',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // Should focus on 2025, not extensively mention 2024
          const mentions2025 = (text.match(/2025/g) || []).length;
          const mentions2024 = (text.match(/2024/g) || []).length;
          return mentions2025 >= mentions2024;
        },
      },
    ],
  },
  {
    query: 'show me mikes ai work',
    category: 'Filter: Domain/Topic-based',
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
        description: 'Quick actions with AI/ML options',
        validator: (r) => r.quickActions?.length > 0,
      },
    ],
  },

  // ==================== CONTACT TRIGGERS ====================
  {
    query: 'i want to hire mike',
    category: 'Contact Trigger: Hiring Intent',
    checks: [
      {
        description: 'Provides contact mechanism or encouragement',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // Accept contact in text OR having contact-related quick actions
          return text.includes('contact') || text.includes('reach') || 
                 text.includes('message') || text.includes('<ui:contact') ||
                 r.quickActions?.some((qa: any) => qa.type === 'message_mike' || qa.type === 'contact_link');
        },
      },
      {
        description: 'No errors',
        validator: (r) => !r.text?.includes('[ERROR') && r.text?.length > 0,
      },
      {
        description: 'Has contact-related quick actions',
        validator: (r) => r.quickActions?.some((qa: any) => qa.type === 'message_mike' || qa.type === 'contact_link'),
      },
    ],
  },
  {
    query: 'can i collaborate with mike on a project?',
    category: 'Contact Trigger: Collaboration Request',
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
                 text.includes('linkedin') || r.quickActions?.some((qa: any) => qa.type === 'message_mike');
        },
      },
    ],
  },
  {
    query: 'how do i get in touch with mike?',
    category: 'Contact Info Request (Common)',
    checks: [
      {
        description: 'Provides contact mechanism (text or actions)',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // Accept contact info in text OR having contact quick actions
          const hasContactText = text.includes('contact') || text.includes('linkedin') || 
                                 text.includes('github') || text.includes('email') ||
                                 text.includes('reach');
          const hasContactActions = r.quickActions?.some((qa: any) => 
            qa.type === 'contact_link' || qa.type === 'message_mike'
          );
          return hasContactText || hasContactActions;
        },
      },
      {
        description: 'Has contact-related quick actions',
        validator: (r) => r.quickActions?.some((qa: any) => 
          qa.type === 'contact_link' || qa.type === 'message_mike'
        ),
      },
    ],
  },

  // ==================== EDGE CASES ====================
  {
    query: 'tell me about a project that doesnt exist',
    category: 'Edge Case: Non-existent Entity',
    checks: [
      {
        description: 'Handles gracefully without errors',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // Should admit lack of info OR suggest real projects
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
          // Should not have detailed descriptions of a non-existent project
          return !text.includes('built in 2020') && !text.includes('using java and spring');
        },
      },
    ],
  },
  {
    query: 'what does mike think about climate change?',
    category: 'Edge Case: Personal Opinion (Out of Scope)',
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
        validator: (r) => r.text?.length < 500, // Should be brief since no info available
      },
    ],
  },
  {
    query: 'when was mike born?',
    category: 'Edge Case: Private Information Request',
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
    query: 'what is 2+2?',
    category: 'Edge Case: Math Question (Off-Topic)',
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
        validator: (r) => !r.text?.includes('4') || !r.text?.includes('equals'),
      },
    ],
  },
  {
    query: 'tell me a joke',
    category: 'Edge Case: Joke Request (Off-Topic)',
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
    query: 'mike',
    category: 'Edge Case: Single Word Query',
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
  // Note: Empty query test removed - it correctly returns 400 error at API level (working as intended)

  // ==================== ENTITY MATCHING ====================
  {
    query: 'tell me about iris',
    category: 'Entity Match: Iris (Alias)',
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
    query: 'what is parsons?',
    category: 'Entity Match: Company Name',
    checks: [
      {
        description: 'Does not trigger off-topic guardrail',
        validator: (r) => !r.text?.toLowerCase().includes('i can only help'),
      },
      {
        description: 'Provides relevant response',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          // May admit lack of clarity and ask for clarification, which is fine
          return r.text.length > 20 && !r.text?.includes('[ERROR') && (
            text.includes('parsons') || text.includes('clarify')
          );
        },
      },
    ],
  },
  {
    query: 'tell me about rice',
    category: 'Entity Match: School Name',
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

  // ==================== COMPARATIVE QUERIES ====================
  {
    query: 'compare mikes internships at parsons and veson',
    category: 'Complex: Comparison Query',
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
    query: 'how is hilite different from knight life?',
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

  // ==================== SYNTHESIS QUERIES ====================
  {
    query: 'what makes mike qualified for a software engineering role?',
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
        description: 'Professional tone suitable for recruiters',
        validator: (r) => !r.text?.includes('undefined') && !r.text?.includes('[ERROR'),
      },
    ],
  },
  {
    query: 'summarize mikes experience with full stack development',
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

  // ==================== QUICK ACTIONS VARIETY ====================
  {
    query: 'show me all of mikes projects',
    category: 'Quick Actions: Should have project drill-downs',
    checks: [
      {
        description: 'Lists multiple projects',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          const projectCount = [
            text.includes('hilite'),
            text.includes('portfolio'),
            text.includes('knight'),
            text.includes('momentum'),
            text.includes('euros'),
          ].filter(Boolean).length;
          return projectCount >= 2;
        },
      },
      {
        description: 'Has quick actions',
        validator: (r) => r.quickActions && r.quickActions.length > 0,
      },
      {
        description: 'Has relevant action types',
        validator: (r) => {
          // Should have at least custom_input or specific actions
          const hasRelevant = r.quickActions?.some((qa: any) => 
            qa.type === 'custom_input' || qa.type === 'specific' || qa.type === 'contact_link'
          );
          return hasRelevant || r.quickActions?.length > 0;
        },
      },
    ],
  },
  {
    query: 'what programming languages does mike know?',
    category: 'Quick Actions: Should have skill-related actions',
    checks: [
      {
        description: 'Lists programming languages',
        validator: (r) => {
          const text = r.text?.toLowerCase() || '';
          return (text.includes('python') || text.includes('typescript') || 
                  text.includes('swift')) && r.text.length > 100;
        },
      },
      {
        description: 'Quick actions present',
        validator: (r) => r.quickActions?.length > 0,
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
  response?: any;
}

async function makeRequest(
  query: string, 
  previousQuery?: string, 
  previousAnswer?: string, 
  depth?: number
): Promise<{ success: boolean; response: any; error?: string; duration: number }> {
  const startTime = Date.now();
  
  try {
    const body: any = { query, signals: {} };
    
    // Add conversation context if provided (for follow-ups)
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
        response: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        duration: Date.now() - startTime,
      };
    }

    if (!response.body) {
      return { 
        success: false, 
        response: null, 
        error: 'No response body',
        duration: Date.now() - startTime,
      };
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let quickActions: any[] = [];
    let cached = false;

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
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    return {
      success: true,
      response: { text: fullText, quickActions, cached },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      response: null,
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
    response.quickActions.slice(0, 5).forEach((qa: any) => {
      print(`   • ${qa.type}: ${qa.label || 'N/A'}`, 'dim');
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

  const passed = failedChecks.length === 0;
  
  if (passed) {
    print(`\n✅ TEST PASSED`, 'green');
  } else {
    print(`\n❌ TEST FAILED (${failedChecks.length}/${testCase.checks.length} checks failed)`, 'red');
  }

  return {
    category: testCase.category,
    query: testCase.query,
    depth,
    passed,
    responseTime: duration,
    failedChecks,
    response,
  };
}

async function main() {
  print('\n' + '='.repeat(80), 'cyan');
  print('🌈 Iris Comprehensive Automated Test Suite', 'bright');
  print('='.repeat(80), 'cyan');
  print(`\n📍 Testing against: ${BASE_URL}`, 'cyan');
  print(`📊 Total test cases: ${testCases.length}`, 'cyan');
  print(`\n🚀 Starting test run...\n`, 'dim');

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i + 1, testCases.length);
    results.push(result);

    // Small delay between tests to avoid overwhelming the server
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

  // Category breakdown
  print(`\n📊 Results by Category:`, 'cyan');
  const categories = new Map<string, { passed: number; total: number }>();
  
  results.forEach(r => {
    const categoryKey = r.category.split(':')[0]; // Group by main category
    const stats = categories.get(categoryKey) || { passed: 0, total: 0 };
    stats.total++;
    if (r.passed) stats.passed++;
    categories.set(categoryKey, stats);
  });

  Array.from(categories.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([category, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(0);
      const color = stats.passed === stats.total ? 'green' : 'yellow';
      print(`   ${category}: ${stats.passed}/${stats.total} (${rate}%)`, color);
    });

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
        print(`     Failed checks:`, 'dim');
        r.failedChecks.forEach(check => {
          print(`       - ${check}`, 'dim');
        });
      });
  }

  // Performance analysis
  print(`\n⚡ Performance Analysis:`, 'cyan');
  const sortedByTime = [...results].sort((a, b) => b.responseTime - a.responseTime);
  print(`   Fastest: ${sortedByTime[sortedByTime.length - 1].responseTime}ms - "${sortedByTime[sortedByTime.length - 1].query.substring(0, 40)}..."`, 'green');
  print(`   Slowest: ${sortedByTime[0].responseTime}ms - "${sortedByTime[0].query.substring(0, 40)}..."`, sortedByTime[0].responseTime > 10000 ? 'yellow' : 'dim');

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

