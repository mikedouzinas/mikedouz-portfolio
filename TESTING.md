# Iris Testing Guide

This document outlines the testing procedure for Iris to ensure all functionality works correctly before deployment.

## Testing Categories

### 1. Base Cases - Core Functionality
These queries should work perfectly with relevant context from the knowledge base.

| Query | Expected Result | What to Verify |
|-------|----------------|----------------|
| "what projects has mike worked on?" | Lists HiLiTe, Portfolio, Euros Predictor, Momentum, Knight Life | ✅ All major projects mentioned<br>✅ Brief descriptions included |
| "where does mike go to school?" | Rice University, Computer Science, mentions junior year | ✅ School name correct<br>✅ Degree mentioned |
| "what is mike's headline?" | Junior, Computer Science @ Rice University \| AI, Full-Stack, and Data-Driven Product Builder | ✅ Exact headline returned |
| "tell me about mike's work experience" | Mentions Parsons, Veson, VesselsValue, Liu Idea Lab | ✅ Recent experiences listed<br>✅ Role details included |
| "what classes has mike taken?" | Lists CS courses like COMP 646, COMP 321, etc. | ✅ Multiple classes mentioned<br>✅ Relevant to query |
| "what are mike's key values?" | Integrity, Ambition, Serenity, Creativity | ✅ Values listed with explanations |

### 2. Filter Queries - Structured Search
These use the filter engine for precise results.

| Query | Expected Result | What to Verify |
|-------|----------------|----------------|
| "show me all python projects" | HiLiTe, Euros Predictor | ✅ Only Python projects listed<br>✅ No hallucinated projects |
| "list experiences from 2024" | Veson 2024, VesselsValue, Liu Idea Lab | ✅ Only 2024 experiences<br>✅ Dates are correct |
| "what ml classes has mike taken?" | COMP 646 (Computer Vision) | ✅ Only ML-related classes<br>✅ Correct course info |
| "show me projects using react" | Portfolio (Iris), Liu Idea Lab work | ✅ Only React projects<br>✅ Accurate tech stack |

### 3. Personal/Bio Queries
These test the new education and bio KB items.

| Query | Expected Result | What to Verify |
|-------|----------------|----------------|
| "what's mike's GPA?" | 3.88 at Rice University | ✅ Correct GPA<br>✅ School context |
| "when does mike graduate?" | May 2027 | ✅ Correct date |
| "tell me about mike's education" | Rice University, CS, GPA, grad date | ✅ Complete education info |
| "what is mike's full name?" | Mike Konstantinos Veson | ✅ Correct full name |

### 4. Edge Cases - No Context
These should trigger fallback responses with contact info.

| Query | Expected Result | What to Verify |
|-------|----------------|----------------|
| "what's mike's favorite ice cream?" | "I don't have specific information..." + contact info | ✅ Admits no information<br>✅ Provides email, LinkedIn, GitHub<br>✅ Suggests reaching out |
| "show me all rust projects" | Fallback with contact info (no Rust projects exist) | ✅ Clean fallback (not an error)<br>✅ Contact info present |
| "what did mike do in 2010?" | Either admits no info or acknowledges he was young | ✅ Doesn't hallucinate<br>✅ Reasonable response |

### 5. Anti-Hallucination Tests
These verify the system doesn't make things up.

| Query | Expected Result | What to Verify |
|-------|----------------|----------------|
| "did mike work at google?" | Admits no information about Google OR says no based on context | ✅ Doesn't hallucinate a Google job<br>✅ Stays truthful |
| "what languages does mike speak?" | Should find Greek/Spanish from interests/profile if present | ✅ Only mentions what's in KB<br>✅ Doesn't add languages |
| "tell me about mike's startup" | References Veson Nautical family connection OR admits no startup info | ✅ Accurate based on context<br>✅ No fake startups |

### 6. Intent Detection Tests
Verify the system correctly identifies query types.

| Query | Expected Intent | What to Verify |
|-------|----------------|----------------|
| "list all ml projects" | filter_query | ✅ Uses filter engine<br>✅ Structured results |
| "how can i contact mike?" | contact | ✅ Fast-path response<br>✅ All contact info present |
| "tell me about hilite" | specific_item | ✅ Detailed HiLiTe info<br>✅ Architecture, tech stack |
| "what are mike's hobbies?" | personal | ✅ Searches personal types<br>✅ Interests mentioned |

### 7. Complex Queries
Test synthesis and multi-item responses.

| Query | Expected Result | What to Verify |
|-------|----------------|----------------|
| "what has mike done in 2025?" | Parsons internship, COMP classes (646, 321, 312) | ✅ Synthesizes multiple items<br>✅ All from 2025 |
| "tell me about mike's ai experience" | ML projects + classes + relevant work | ✅ Spans projects, classes, work<br>✅ Coherent synthesis |
| "what technical skills does mike have?" | Lists languages, frameworks, domains | ✅ Multiple skills from various sources<br>✅ Organized response |

## Running the Tests

### Prerequisites
```bash
# Make sure dev server is running
npm run dev
# Note the port (usually 3000 or 3001)
```

### Manual Testing
Use the interactive test script:
```bash
npm run test:iris
```

This will:
1. Run through each test category
2. Show you the query and expected result
3. Make the API call
4. Display the response
5. Prompt you to verify (y/n)
6. Track pass/fail for each test
7. Generate a summary report
```

### Final Build Verification
After all manual tests pass:
```bash
npm run build
```
Verify:
- ✅ No TypeScript errors
- ✅ No linter errors
- ✅ Build completes successfully
- ✅ All pages generate

## Common Issues & Solutions

### Issue: Empty Results Fallback Triggering Too Often
**Symptom**: Valid queries returning "I don't have information..."
**Check**: Are embeddings up to date?
```bash
npm run build:embeddings
```

### Issue: Hallucinated Information
**Symptom**: Iris invents projects, skills, or details not in KB
**Fix**: Review system prompt anti-hallucination rules
**Location**: `src/app/api/iris/answer/route.ts` line ~845

### Issue: Filter Queries Not Working
**Symptom**: "show me X projects" returns wrong results
**Check**: `applyFilters` function in `answer/route.ts`
**Verify**: Skills in KB match query terms (case-insensitive)

### Issue: Personal Queries Failing
**Symptom**: Education/bio queries return fallback
**Check**: 
1. Are education/bio items in embeddings.json?
2. Run `npm run build:embeddings`
3. Verify `loadEducation()` and `loadBio()` in load.ts

## Pre-Push Checklist

- [ ] All base cases pass (6/6)
- [ ] All filter queries pass (4/4)
- [ ] All personal queries pass (4/4)
- [ ] All edge cases behave correctly (3/3)
- [ ] Anti-hallucination tests pass (3/3)
- [ ] Intent detection works (4/4)
- [ ] Complex queries synthesize well (3/3)
- [ ] No linter errors
- [ ] `npm run build` succeeds
- [ ] Embeddings are up to date

## Notes

- **Cache**: Responses are cached for 1 hour. If testing the same query repeatedly, clear cache or modify query slightly.
- **Model**: Default is `gpt-4.1-mini`. Check `src/lib/iris/config.ts` to verify.
- **Embeddings**: Always rebuild after changing KB JSON files: `npm run build:embeddings`

