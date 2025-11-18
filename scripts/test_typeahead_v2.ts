import { TypeaheadV2, createTypeaheadV2 } from "@/lib/iris/typeahead_v2";

async function testTypeahead() {
  console.log("Testing Enhanced Typeahead V2\n");
  
  const typeahead = await createTypeaheadV2();
  
  // Test cases
  const queries = [
    // Empty query - should return default suggestions
    "",
    
    // Partial questions
    "what is",
    "tell me about",
    "how can I",
    
    // Technology queries
    "react",
    "python proj",
    "machine learning",
    
    // Experience queries
    "experience at",
    "what did you do at",
    
    // Specific items
    "hilite",
    "imos",
    "veson",
    
    // Evaluative queries
    "best project",
    "what makes you",
    
    // Contact queries
    "contact",
    "email",
    
    // Skill aliases
    "typescript",
    "ts",
    "c#",
  ];
  
  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log("-".repeat(50));
    
    const results = typeahead.suggest(query, 5);
    
    if (results.length === 0) {
      console.log("No results");
    } else {
      results.forEach((result, idx) => {
        console.log(`${idx + 1}. [${result.matchType}] ${result.text}`);
        if (result.metadata?.originalTitle) {
          console.log(`   (from: ${result.metadata.originalTitle})`);
        }
      });
    }
  }
  
  // Test performance
  console.log("\n\nPerformance Test");
  console.log("-".repeat(50));
  
  const perfQueries = ["react", "what is", "experience", "python", "contact"];
  for (const q of perfQueries) {
    const start = performance.now();
    typeahead.suggest(q, 10);
    const elapsed = performance.now() - start;
    console.log(`Query "${q}": ${elapsed.toFixed(2)}ms`);
  }
}

testTypeahead().catch(console.error);