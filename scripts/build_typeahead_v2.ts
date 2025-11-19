import fs from "node:fs/promises";
import path from "node:path";
import { loadKBItems } from "@/lib/iris/load";

const OUT = path.join(process.cwd(), "src/data/iris/derived/typeahead_v2.json");

// Enhanced typeahead item with question patterns
type TypeaheadItem = {
  id: string;
  kind?: string;
  title: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
  questions?: string[]; // Common question patterns for this item
  patterns?: string[]; // Sentence completion patterns
};

// Question templates based on item type
const QUESTION_TEMPLATES: Record<string, (item: any) => string[]> = {
  project: (item) => [
    `What is ${item.title}?`,
    `Tell me about ${item.title}`,
    `How was ${item.title} built?`,
    `What technologies were used in ${item.title}?`,
    `When did you work on ${item.title}?`,
    ...(item.aliases || []).map((alias: string) => `What is ${alias}?`),
  ],
  experience: (item) => [
    `Tell me about your experience at ${item.company}`,
    `What did you do at ${item.company}?`,
    `When did you work at ${item.company}?`,
    `What was your role at ${item.company}?`,
    `${item.role} at ${item.company}`,
  ],
  class: (item) => [
    `What did you learn in ${item.title}?`,
    `Tell me about ${item.title}`,
    `When did you take ${item.title}?`,
    `${item.title} class`,
  ],
  skill: (item) => [
    `Do you know ${item.name}?`,
    `What experience do you have with ${item.name}?`,
    `Projects using ${item.name}`,
    `${item.name} projects`,
    `${item.name} experience`,
    ...(item.aliases || []).map((alias: string) => `Do you know ${alias}?`),
  ],
  blog: (item) => [
    `Tell me about your ${item.title} article`,
    `What is ${item.title} about?`,
    `${item.title} blog post`,
  ],
};

// Common query patterns not tied to specific items
const COMMON_PATTERNS = [
  // Contact queries
  "How can I contact you?",
  "What's your email?",
  "Can I reach out to you?",
  "Contact information",
  
  // General questions
  "What projects have you worked on?",
  "What is your experience?",
  "What technologies do you know?",
  "Tell me about yourself",
  "What have you built?",
  
  // Skill queries
  "What languages do you know?",
  "Do you know Python?",
  "Do you know React?",
  "What frameworks have you used?",
  
  // Time-based queries
  "What are you working on now?",
  "Recent projects",
  "Latest work",
  "Current role",
  
  // Evaluative queries
  "What's your best project?",
  "What makes you unique?",
  "Why should I hire you?",
  "What are your strengths?",
  
  // Specific domain queries
  "Machine learning experience",
  "Web development projects",
  "Data science work",
  "Backend experience",
  "Frontend projects",
];

// Generate contextual sentence starters based on partial input
function generatePatterns(item: any): string[] {
  const patterns: string[] = [];
  
  if (item.kind === 'project') {
    patterns.push(
      `I built ${item.title}`,
      `${item.title} is a`,
      `Check out ${item.title}`,
    );
  } else if (item.kind === 'experience') {
    patterns.push(
      `I worked at ${item.company} as`,
      `At ${item.company}, I`,
      `My role at ${item.company}`,
    );
  } else if (item.kind === 'skill') {
    patterns.push(
      `I have experience with ${item.name}`,
      `I've used ${item.name} for`,
      `My ${item.name} projects include`,
    );
  }
  
  return patterns;
}

(async () => {
  const kb = await loadKBItems();
  
  // Build enhanced typeahead items with questions
  const items: TypeaheadItem[] = kb.map((d: any) => {
    const base: TypeaheadItem = {
      id: d.id,
      kind: d.kind ?? undefined,
      title: d.title || d.name || d.role || d.value || d.interest || '',
      summary: d.summary,
      tags: d.tags ?? [],
      aliases: Array.isArray(d.aliases) ? d.aliases : [],
    };
    
    // Generate questions based on item type
    if (d.kind && QUESTION_TEMPLATES[d.kind]) {
      base.questions = QUESTION_TEMPLATES[d.kind](d);
    }
    
    // Generate sentence patterns
    base.patterns = generatePatterns(d);
    
    return base;
  });
  
  // Add common patterns as special items
  const commonItems: TypeaheadItem[] = COMMON_PATTERNS.map((pattern, idx) => ({
    id: `common_${idx}`,
    kind: 'query',
    title: pattern,
    questions: [pattern],
  }));
  
  // Combine all items
  const allItems = [...items, ...commonItems];
  
  // Build an index of all searchable text for better performance
  const searchIndex = allItems.map(item => ({
    id: item.id,
    searchText: [
      item.title,
      item.summary || '',
      ...(item.tags || []),
      ...(item.aliases || []),
      ...(item.questions || []),
      ...(item.patterns || []),
    ].join(' ').toLowerCase(),
  }));
  
  const output = {
    items: allItems,
    searchIndex,
    metadata: {
      generated: new Date().toISOString(),
      itemCount: allItems.length,
      questionCount: allItems.reduce((sum, item) => sum + (item.questions?.length || 0), 0),
    }
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(output, null, 2));
})();