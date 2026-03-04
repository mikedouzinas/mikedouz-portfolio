import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadKBItems, loadContact } from '@/lib/iris/load';
import { logQuery } from '@/lib/iris/analytics';
import { generateQuickActions } from '@/lib/iris/quickActions_v2';
import { loadRankings } from '@/lib/iris/loadRankings';

// Ensure Node.js runtime for streaming support
export const runtime = 'nodejs';
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Claude-based Iris endpoint
 *
 * This is a simplified implementation that leverages Claude's extended context window
 * instead of complex RAG retrieval. The entire knowledge base is passed as context
 * with prompt caching for cost efficiency.
 *
 * Advantages over RAG:
 * - Simpler architecture (no embeddings, semantic search, intent classification)
 * - Better quality responses (Claude Sonnet >> GPT-4o-mini)
 * - Prompt caching reduces cost by ~90% for repeated KB context
 * - No build step needed for embeddings
 *
 * Trade-offs:
 * - Less control over retrieval (Claude decides what's relevant)
 * - No fine-grained ranking or filtering
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body or query params
    const body = await request.json().catch(() => ({}));
    const searchParams = request.nextUrl.searchParams;
    const query = body.q || searchParams.get('q');

    // Get conversation context for quick actions
    const depth = parseInt(searchParams.get('depth') || '0', 10);
    const visitedNodesRaw = searchParams.get('visitedNodes');
    const visitedNodes: string[] = visitedNodesRaw ? JSON.parse(visitedNodesRaw) : [];

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Missing or invalid query' }, { status: 400 });
    }

    // Validate query length (max 500 characters)
    if (query.length > 500) {
      return Response.json({
        error: 'Query too long',
        answer: 'Your question is too long. Please keep it under 500 characters.'
      }, { status: 400 });
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🤖 CLAUDE DIRECT (Simplified Implementation)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Query: "${query}"`);
    console.log('Method: Full KB context with prompt caching');

    // Load entire knowledge base and rankings for quick actions
    const [kbItems, contactInfo, rankings] = await Promise.all([
      loadKBItems(),
      loadContact(),
      loadRankings(),
    ]);

    console.log(`KB Size: ${kbItems.length} items loaded`);

    // Format KB for Claude
    const kbContext = {
      contact: contactInfo,
      items: kbItems.map(item => ({
        ...item,
      })),
    };

    // System prompt with instructions
    const systemPrompt = `You are Iris, Mike Veson's AI assistant embedded in his portfolio website.

Your purpose is to help visitors learn about Mike's background, skills, experience, and projects by answering questions using ONLY the knowledge base provided below.

## Response Guidelines

1. **Accuracy**: Only use information from the knowledge base. If you don't have the information, say so.
2. **Conciseness**: Keep responses under 150 words unless more detail is explicitly requested.
3. **Natural tone**: Be conversational, friendly, and professional. Avoid robotic language.
4. **Markdown**: Use markdown formatting (bold, lists, etc.) for readability.
5. **No URLs in text**: NEVER include raw URLs, email addresses, or contact links in your response text. Just mention that resources exist (e.g., "The code is on GitHub" or "You can reach Mike via email").

## Anti-Hallucination Rules

- NEVER make up projects, skills, or experiences not in the KB
- NEVER invent dates, companies, or technical details
- If uncertain, say "I don't have information about that" rather than guessing
- If the KB is incomplete, acknowledge limitations honestly

## CRITICAL: Contact Information Policy

**NEVER include contact details (email, LinkedIn, GitHub, calendly links) directly in your response text.**

When users ask "how to contact Mike" or "how to reach Mike", respond with:
"Mike is happy to connect! You'll see contact options below."

The UI will automatically display contact buttons - your job is NOT to list the contact details in text.

## Knowledge Base

The following is Mike's complete knowledge base. Use this to answer all questions:

\`\`\`json
${JSON.stringify(kbContext, null, 2)}
\`\`\``;

    // Generate query ID for streaming response
    const queryId = `claude_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Log analytics (non-blocking)
    logQuery({
      query,
      intent: 'claude_direct', // Special intent for analytics
      filters: undefined,
      results_count: kbItems.length,
      answer_length: 0,
      latency_ms: 0,
      cached: false,
    }).catch(err => console.warn('Failed to log query:', err));

    // Create streaming response with Claude
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }, // Cache the KB context
        },
      ],
      messages: [
        {
          role: 'user',
          content: query,
        },
      ],
      stream: true,
    });

    // Convert Claude stream to SSE format (matching current Iris format)
    const encoder = new TextEncoder();
    let accumulatedText = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send query ID first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ queryId })}\n\n`)
          );

          // Send debug info
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              debug: {
                intent: 'claude_direct',
                resultsCount: kbItems.length,
                detailLevel: 'full',
              }
            })}\n\n`)
          );

          // Stream text chunks from Claude
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              accumulatedText += text;

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }

          // Generate quick actions after streaming completes
          // Use all KB items as "results" since Claude has access to everything
          const quickActions = generateQuickActions({
            query,
            intent: 'claude_direct',
            results: kbItems.map((item, idx) => ({
              score: 1 - (idx * 0.01), // Descending scores
              doc: item,
            })),
            fullAnswer: accumulatedText,
            allItems: kbItems,
            rankings,
            depth,
            visitedNodes,
          });

          // Send quick actions
          if (quickActions.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ quickActions })}\n\n`)
            );
          }

          // Send completion signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

          const latency = Date.now() - startTime;
          console.log(`Response complete (${latency}ms, ${accumulatedText.length} chars, ${quickActions.length} actions)`);
          console.log('═══════════════════════════════════════════════════════════════\n');

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Claude endpoint error:', error);

    // Return error as SSE stream to match expected format
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            text: `Sorry, I encountered an error: ${errorMessage}. Please try again.`
          })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(errorStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

// Support GET requests with query params (matching original endpoint)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return Response.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  // Create a synthetic POST request body and call POST handler
  const syntheticRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ q: query }),
  });

  return POST(syntheticRequest as NextRequest);
}
