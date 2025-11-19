/**
 * Response builder utilities for generating API responses
 */

import { type KBItem } from '@/lib/iris/schema';
import { loadContact } from '@/lib/iris/load';
import { generateGuardrailResponse, rewriteToValidQuery } from '@/lib/iris/intents';
import { type QueryFilter } from './types';
import { escapeAttribute } from './text';
import { extractPrimaryYear } from './temporal';

/**
 * Kind labels for building no-match responses
 */
const KIND_LABELS: Record<string, string> = {
  project: 'Projects',
  experience: 'Experience',
  class: 'Classes',
  blog: 'Writing',
  story: 'Stories',
  value: 'Values',
  interest: 'Interests',
  education: 'Education',
  bio: 'Bio',
  skill: 'Skills'
};

/**
 * Small helper to stream plain text responses (guardrails, clarifications, fallbacks)
 * so the client continues to receive uniform SSE payloads.
 *
 * @param message - The message to stream
 * @returns Response object with streaming text
 */
export function streamTextResponse(message: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: message })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

/**
 * Builds a contact message draft from the user's query
 * Converts references to Mike into direct address using "you" and "your"
 *
 * @param query - The user's query
 * @returns Drafted contact message
 */
export function buildContactDraft(query: string): string {
  const stripped = query
    .replace(/["<>]/g, '')
    .replace(/\b(show|list|tell me|give me|find|can you|could you|would you|please|kindly)\b/gi, '')
    .replace(/\b(show|describe|explain)\s+me\b/gi, '')
    .trim();

  // CRITICAL: Convert Mike references to direct address
  // Must happen before other cleaning to preserve context
  const cleaned = stripped
    .replace(/\bmike's\b/gi, 'your')  // "mike's" or "Mike's" → "your"
    .replace(/\bmikes\b/gi, 'your')   // "mikes" (without apostrophe) → "your" 
    .replace(/\bmike\b/gi, 'you')     // "mike" or "Mike" → "you"
    .replace(/^(about|regarding|on)\s+/i, '')
    .trim();

  if (!cleaned) {
    return 'I would love to chat about opportunities to collaborate.';
  }

  // Ensure sentence starts lowercase for natural flow
  const sentence = cleaned.charAt(0).toLowerCase() === cleaned.charAt(0)
    ? cleaned
    : cleaned.charAt(0).toLowerCase() + cleaned.slice(1);

  return `I'd love to talk about ${sentence}`;
}

/**
 * Builds a no-match response when filters don't match any items
 *
 * @param query - The user's query
 * @param filters - The filters that didn't match
 * @returns Formatted no-match response
 */
export function buildNoMatchResponse(query: string, filters?: QueryFilter): string {
  const parts: string[] = [];

  if (filters?.type?.length) {
    const typeNames = filters.type.map(type => KIND_LABELS[type] || type);
    parts.push(`${typeNames.join(' or ')} work`);
  }

  if (filters?.skills?.length) {
    const list = filters.skills.join(', ');
    parts.push(`that uses ${list}`);
  }

  if (filters?.company?.length) {
    parts.push(`for ${filters.company.join(', ')}`);
  }

  if (filters?.year?.length) {
    parts.push(`from ${filters.year.join(', ')}`);
  }

  const descriptor = parts.length > 0
    ? parts.join(' ')
    : 'anything in that area';

  const draft = buildContactDraft(query);

  return `Mike hasn't shared ${descriptor.trim()} yet, so I teed up his contact info if you want to reach out directly.\n\n<ui:contact reason="insufficient_context" draft="${escapeAttribute(draft)}" />`;
}

/**
 * Generates a clarification prompt when a specific-item query matches multiple KB entries.
 *
 * @param query - The user's query
 * @param results - The matching results
 * @returns Formatted clarification prompt
 */
export function buildClarificationPrompt(query: string, results: Array<{ doc: Partial<KBItem> }>): string {
  const options = results.slice(0, 5).map((result, idx) => {
    const doc = result.doc;
    const label = ('title' in doc && doc.title)
      ? doc.title
      : ('role' in doc && doc.role)
        ? `${doc.role}${('company' in doc && doc.company) ? ` at ${doc.company}` : ''}`
        : doc.id || `Option ${idx + 1}`;
    const year = extractPrimaryYear(doc);
    const kind = 'kind' in doc && doc.kind ? doc.kind : 'item';
    return `${idx + 1}. ${label}${year ? ` (${year})` : ''} - ${kind}`;
  }).join('\n');

  return `I found multiple matches for "${query}". Which one do you want to dive into?\n${options}\n\nReply with the number or title so I can focus on the right work.`;
}

/**
 * Builds a consistent guardrail response so Iris politely declines off-topic questions.
 *
 * @param query - The user's query
 * @returns Response with guardrail message
 */
export function buildGuardrailResponse(query: string): Response {
  const base = generateGuardrailResponse(query) ||
    "I can only help with Mike's work, background, and contact details.";
  const rewrite = rewriteToValidQuery(query);
  const suggestion = rewrite ? `\n\nTry asking something like: "${rewrite}".` : '';
  return streamTextResponse(`${base}${suggestion}`);
}

/**
 * Creates a fallback response when no relevant context is found
 * Loads contact information and returns a helpful message directing users to reach out
 * This prevents hallucination when the knowledge base has no matching information
 *
 * @param query - The user's query (optional)
 * @param intent - The detected intent (optional)
 * @returns Response with fallback message
 */
export async function createNoContextResponse(query?: string, intent?: string): Promise<Response> {
  // Debug: Log no context response
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('⚠️  NO CONTEXT RESPONSE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Query: "${query || 'unknown'}"`);
  console.log(`Intent: ${intent || 'unknown'}`);
  console.log('Reason: No matching results found in knowledge base');

  try {
    await loadContact(); // Load contact for context, but don't use it directly in fallback message
    const fallbackMessage =
      `Mike hasn't shared anything about that yet. Here are some ways to explore what he has shared:\n\n` +
      `**Quick Actions:** Use the buttons below to see his projects, experiences, and more.\n\n` +
      `**Search Bar:** You can also type a new question in the search bar above to explore different topics.\n\n`
    // Debug: Log fallback message
    console.log(`Fallback Message Length: ${fallbackMessage.length} characters`);
    console.log('\nFallback Response:');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(fallbackMessage);
    console.log('───────────────────────────────────────────────────────────────');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Return as streaming response for consistent client behavior
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fallbackMessage })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[Answer API] Failed to create fallback response:', error);

    // Minimal fallback if contact loading fails
    const minimalFallback = `Mike hasn't shared anything about that yet. I teed up a note so you can reach him directly.\n\n<ui:contact reason="insufficient_context" draft="I'd love to learn more about this if you have a moment." />`;

    console.log('\n⚠️  Using minimal fallback (contact loading failed)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: minimalFallback })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }
}
