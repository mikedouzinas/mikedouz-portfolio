#!/usr/bin/env tsx
// scripts/test_iris.ts
// Interactive testing script for Iris AI assistant
// Runs through test cases and prompts for manual verification

import * as readline from 'readline';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/iris/answer`;

interface TestCase {
  query: string;
  expected: string;
  category: string;
  verifyPoints: string[];
}

const testSuites: Record<string, TestCase[]> = {
  'Base Cases': [
    {
      query: 'what projects has mike worked on?',
      expected: 'Lists HiLiTe, Portfolio, Euros Predictor, Momentum, Knight Life',
      category: 'projects',
      verifyPoints: [
        'All major projects mentioned',
        'Brief descriptions included',
        'No hallucinated projects',
      ],
    },
    {
      query: 'where does mike go to school?',
      expected: 'Rice University, Computer Science, junior year',
      category: 'education',
      verifyPoints: [
        'School name correct',
        'Degree mentioned',
        'Year/status included',
      ],
    },
    {
      query: "what is mike's headline?",
      expected: 'Junior, Computer Science @ Rice University | AI, Full-Stack...',
      category: 'bio',
      verifyPoints: [
        'Exact headline or close match',
        'Contains key elements',
      ],
    },
    {
      query: "tell me about mike's work experience",
      expected: 'Mentions Parsons, Veson, VesselsValue, Liu Idea Lab',
      category: 'experience',
      verifyPoints: [
        'Recent experiences listed',
        'Role details included',
        'Companies accurate',
      ],
    },
  ],

  'Filter Queries': [
    {
      query: 'show me all python projects',
      expected: 'HiLiTe, Euros Predictor (Python projects)',
      category: 'filter',
      verifyPoints: [
        'Only Python projects listed',
        'No hallucinated projects',
        'Accurate tech stack',
      ],
    },
    {
      query: 'list experiences from 2024',
      expected: 'Veson 2024, VesselsValue, Liu Idea Lab',
      category: 'filter',
      verifyPoints: [
        'Only 2024 experiences',
        'Dates are correct',
        'No other years included',
      ],
    },
    {
      query: 'show me projects using rust',
      expected: 'Fallback response with contact info (no Rust projects)',
      category: 'filter-empty',
      verifyPoints: [
        'Clean fallback (not error)',
        'Contact info present',
        'Suggests alternatives',
      ],
    },
  ],

  'Personal/Bio': [
    {
      query: "what's mike's GPA?",
      expected: '3.88 at Rice University',
      category: 'education-detail',
      verifyPoints: [
        'Correct GPA (3.88)',
        'School context included',
      ],
    },
    {
      query: 'when does mike graduate?',
      expected: 'May 2027',
      category: 'education-detail',
      verifyPoints: [
        'Correct graduation date',
        'Degree info may be included',
      ],
    },
    {
      query: "what is mike's full name?",
      expected: 'Mike Konstantinos Veson',
      category: 'bio-detail',
      verifyPoints: [
        'Correct full name',
        'All three names present',
      ],
    },
  ],

  'Edge Cases': [
    {
      query: "what's mike's favorite ice cream?",
      expected: '"I don\'t have specific information..." + contact info',
      category: 'no-context',
      verifyPoints: [
        'Admits no information',
        'Email present',
        'LinkedIn present',
        'Suggests reaching out',
      ],
    },
    {
      query: 'what did mike do in 2010?',
      expected: 'Admits no info OR acknowledges he was young/in school',
      category: 'no-context-temporal',
      verifyPoints: [
        'Doesn\'t hallucinate activities',
        'Reasonable response',
      ],
    },
  ],

  'Anti-Hallucination': [
    {
      query: 'did mike work at google?',
      expected: 'Admits no information OR says no based on context',
      category: 'hallucination-check',
      verifyPoints: [
        'Doesn\'t hallucinate a Google job',
        'Stays truthful',
        'May suggest checking context',
      ],
    },
    {
      query: "tell me about mike's startup",
      expected: 'References Veson Nautical family OR admits no startup info',
      category: 'hallucination-check',
      verifyPoints: [
        'Accurate based on KB',
        'No fake startups',
        'May mention family business',
      ],
    },
  ],

  'Complex Queries': [
    {
      query: 'what has mike done in 2025?',
      expected: 'Parsons internship + spring classes (COMP 646, 321, 312)',
      category: 'synthesis',
      verifyPoints: [
        'Synthesizes multiple items',
        'All from 2025',
        'Coherent narrative',
      ],
    },
    {
      query: "tell me about mike's ai experience",
      expected: 'ML projects (HiLiTe) + classes (COMP 646) + relevant work',
      category: 'synthesis',
      verifyPoints: [
        'Spans projects, classes, work',
        'Coherent synthesis',
        'Relevant details',
      ],
    },
  ],
};

// Test results tracking
interface TestResult {
  suite: string;
  query: string;
  passed: boolean;
  response?: string;
  notes?: string;
}

const results: TestResult[] = [];

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function print(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

function printHeader(title: string) {
  print('\n' + '='.repeat(80), 'cyan');
  print(`  ${title}`, 'bright');
  print('='.repeat(80), 'cyan');
}

function printSubheader(title: string) {
  print(`\n${title}`, 'blue');
  print('-'.repeat(title.length), 'blue');
}

async function makeRequest(query: string): Promise<string> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        signals: {},
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

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
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    return fullText;
  } catch (error) {
    print(`❌ Error making request: ${error}`, 'red');
    return `[ERROR: ${error}]`;
  }
}

async function runTestCase(testCase: TestCase, suiteNumber: number, testNumber: number, total: number): Promise<boolean> {
  printSubheader(`\nTest ${suiteNumber}.${testNumber}/${total}: ${testCase.category}`);

  print(`\n📝 Query: "${testCase.query}"`, 'yellow');
  print(`📋 Expected: ${testCase.expected}`, 'dim');
  print('\n✅ Verify:', 'cyan');
  testCase.verifyPoints.forEach((point) => print(`   • ${point}`, 'dim'));

  print('\n⏳ Sending request...');
  const response = await makeRequest(testCase.query);

  print('\n📬 Response:', 'green');
  print(`"${response}"\n`, 'bright');

  let answer = '';
  while (!['y', 'n', 's'].includes(answer.toLowerCase())) {
    answer = await question('Did this test PASS? (y/n/s to skip): ');
  }

  if (answer.toLowerCase() === 's') {
    print('⏭️  Skipped\n', 'yellow');
    results.push({
      suite: testCase.category,
      query: testCase.query,
      passed: false,
      notes: 'Skipped by user',
    });
    return false;
  }

  const passed = answer.toLowerCase() === 'y';
  
  if (passed) {
    print('✅ PASS\n', 'green');
  } else {
    print('❌ FAIL\n', 'red');
    const notes = await question('Notes on failure (optional): ');
    results.push({
      suite: testCase.category,
      query: testCase.query,
      passed: false,
      response,
      notes: notes || undefined,
    });
    return false;
  }

  results.push({
    suite: testCase.category,
    query: testCase.query,
    passed: true,
    response,
  });

  return true;
}

async function runTestSuite(suiteName: string, tests: TestCase[], suiteNumber: number) {
  printHeader(`${suiteNumber}. ${suiteName} (${tests.length} tests)`);

  let passed = 0;
  for (let i = 0; i < tests.length; i++) {
    const testPassed = await runTestCase(tests[i], suiteNumber, i + 1, tests.length);
    if (testPassed) passed++;
  }

  print(`\n${suiteName}: ${passed}/${tests.length} passed`, passed === tests.length ? 'green' : 'yellow');
  return passed === tests.length;
}

async function printSummary() {
  printHeader('Test Summary');

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  print(`\nTotal Tests: ${totalTests}`);
  print(`Passed: ${passedTests}`, 'green');
  print(`Failed: ${failedTests}`, 'red');
  print(`Pass Rate: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');

  if (failedTests > 0) {
    print('\n❌ Failed Tests:', 'red');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        print(`\n  • ${r.suite}: "${r.query}"`, 'red');
        if (r.notes) {
          print(`    Notes: ${r.notes}`, 'dim');
        }
      });
  }

  print('\n' + '='.repeat(80));
}

async function runBuildCheck(): Promise<boolean> {
  printHeader('Final Build Verification');
  
  print('\nRunning: npm run build');
  print('This will verify TypeScript compilation and build the project...\n', 'dim');

  const answer = await question('Run build check now? (y/n): ');
  if (answer.toLowerCase() !== 'y') {
    print('⏭️  Build check skipped', 'yellow');
    return false;
  }

  print('\n⏳ Running build...');
  
  try {
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    print('\n✅ Build PASSED', 'green');
    return true;
  } catch (error) {
    print('\n❌ Build FAILED', 'red');
    print(`Error: ${error}`, 'red');
    return false;
  }
}

async function main() {
  print('\n🌈 Iris Interactive Testing Suite', 'cyan');
  print('This will run through test cases and prompt you to verify each one.\n', 'dim');

  const answer = await question(`Testing against: ${BASE_URL}\nContinue? (y/n): `);
  if (answer.toLowerCase() !== 'y') {
    print('Test cancelled.', 'yellow');
    rl.close();
    return;
  }

  // Run test suites
  let suiteNumber = 1;
  for (const [suiteName, tests] of Object.entries(testSuites)) {
    await runTestSuite(suiteName, tests, suiteNumber++);
  }

  // Print summary
  await printSummary();

  // Final build check
  const buildPassed = await runBuildCheck();

  // Final status
  printHeader('Testing Complete');
  const allPassed = results.every((r) => r.passed) && buildPassed;
  
  if (allPassed) {
    print('\n🎉 All tests passed! Ready to push.', 'green');
  } else {
    print('\n⚠️  Some tests failed. Review before pushing.', 'yellow');
  }

  rl.close();
}

// Run the test suite
main().catch((error) => {
  print(`\n❌ Fatal error: ${error}`, 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});

