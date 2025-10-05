/**
 * Iris Streaming Answer API
 * 
 * POST /api/iris/answer
 * Body: { q: string }
 * 
 * Streams Iris answers using RAG + guardrails pipeline:
 * 1. Rate/session limiting (20 answers per session)  
 * 2. Intent classification and guardrails
 * 3. Semantic retrieval from knowledge base
 * 4. Recent commit context (if available)
 * 5. GPT-4o-mini streaming with system prompt
 * 6. Optional answer caching
 */

import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import { config, validateEnvironment } from '@/lib/iris/config';
import { classifyIntent, generateGuardrailResponse, getAllowedIntents } from '@/lib/iris/intents';
import { retrieveRelevantChunks, initializeRetrieval } from '@/lib/iris/retrieval';
import { getRecentActivityContext } from '@/lib/iris/github';
import { irisCache } from '@/lib/iris/cache';

// Session tracking for rate limiting (simple in-memory store)
const sessionCounts = new Map<string, { count: number; resetTime: number }>();

// Initialize systems on first load
let systemsInitialized = false;

async function ensureSystemsInitialized() {
  if (systemsInitialized) return;
  
  try {
    await initializeRetrieval();
    systemsInitialized = true;
    console.log('Iris answer systems initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Iris answer systems:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables', missing: envCheck.missing }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    const { q: query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter "q" is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize systems
    await ensureSystemsInitialized();
    
    // Check session rate limits
    const sessionId = getSessionId(request);
    if (isRateLimited(sessionId)) {
      return new Response(
        createStreamResponse("I appreciate your curiosity! You've reached the session limit of questions. Please refresh the page to continue our conversation."),
        { 
          headers: { 
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache'
          } 
        }
      );
    }
    
    // Increment session counter
    incrementSessionCount(sessionId);
    
    // Check cache first (if query is cacheable)
    if (irisCache.shouldCache(query)) {
      const cached = await irisCache.get(query);
      if (cached) {
        return new Response(
          createStreamResponse(cached),
          { 
            headers: { 
              'Content-Type': 'text/plain',
              'Cache-Control': 'no-cache',
              'X-Iris-Cached': 'true'
            } 
          }
        );
      }
    }
    
    // Classify intent and apply guardrails
    const intentResult = classifyIntent(query);
    
    if (intentResult.intent === 'out_of_scope') {
      const guardrailResponse = generateGuardrailResponse(query);
      return new Response(
        createStreamResponse(guardrailResponse),
        { 
          headers: { 
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache'
          } 
        }
      );
    }
    
    // Generate streaming answer
    return generateStreamingAnswer(query, intentResult.intent);
    
  } catch (error) {
    console.error('Answer API error:', error);
    
    const errorMessage = "I apologize, but I'm having trouble processing your question right now. Please try asking something else or contact Mike directly via email.";
    
    return new Response(
      createStreamResponse(errorMessage),
      { 
        status: 200, // Return 200 with error message rather than 500
        headers: { 
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache'
        } 
      }
    );
  }
}

/**
 * Generate streaming answer using RAG pipeline
 */
async function generateStreamingAnswer(query: string, intent: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Retrieve relevant context from knowledge base
  const retrieval = await retrieveRelevantChunks(query, config.topK);
  
  // Get recent activity context if available
  const recentActivity = await getRecentActivityContext();
  
  // Build context for the LLM
  const contextChunks = retrieval.chunks
    .map(chunk => `${chunk.source}: ${chunk.content}`)
    .join('\n\n');
    
  const relevantRoutes = retrieval.routes.length > 0 
    ? `\n\nRelevant internal links: ${retrieval.routes.join(', ')}`
    : '';
    
  const recentContext = recentActivity 
    ? `\n\nRecent portfolio activity: ${recentActivity}`
    : '';
  
  // Build system prompt with all context
  const systemPrompt = buildSystemPrompt(contextChunks + relevantRoutes + recentContext);
  
  // Create streaming response
  const stream = await openai.chat.completions.create({
    model: config.models.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ],
    temperature: config.chatSettings.temperature,
    max_tokens: config.chatSettings.maxTokens,
    stream: true,
  });
  
  // Create readable stream for response
  let fullAnswer = '';
  
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullAnswer += content;
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        
        // Cache the complete answer if appropriate
        if (irisCache.shouldCache(query) && fullAnswer) {
          await irisCache.set(query, fullAnswer);
        }
        
        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        controller.error(error);
      }
    }
  });
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'X-Iris-Intent': intent,
      'X-Iris-Chunks': retrieval.chunks.length.toString(),
      'X-Iris-Timing': retrieval.totalTime.toString()
    }
  });
}

/**
 * Build system prompt with knowledge base context
 * Uses the exact prompt specified in requirements
 */
function buildSystemPrompt(context: string): string {
  const today = new Date().toISOString().split('T')[0];
  
  return `You are Iris, an assistant that answers questions about Mike Veson and his portfolio site. Speak in crisp, friendly prose. Use third person and no emojis. Prefer 2–5 sentences or short bullet points. Provide concrete, accurate facts. When relevant, include exactly one internal link to help the visitor go deeper (e.g., /playground/…, /projects, /experience#org). Never invent facts outside the knowledge base provided. If a question is outside the allowed scope (projects, experience, values, contact, skills, education, languages, current work, fun facts, availability, interview resources), politely steer the user back with two example questions. Refuse financial questions and exact phone/location; redirect to email or LinkedIn for contact. Today's date is ${today}. A summary of recent portfolio commits and a knowledge base are provided below; use them carefully.

${context}`;
}

/**
 * Get session ID for rate limiting (simplified approach)
 */
function getSessionId(request: NextRequest): string {
  // Use a combination of IP and User-Agent for basic session identification
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a simple hash-like session ID
  const sessionKey = `${ip}-${userAgent}`;
  return Buffer.from(sessionKey).toString('base64').substring(0, 16);
}

/**
 * Check if session is rate limited
 */
function isRateLimited(sessionId: string): boolean {
  const session = sessionCounts.get(sessionId);
  
  if (!session) {
    return false; // New session, not limited
  }
  
  // Reset count if hour has passed
  if (Date.now() > session.resetTime) {
    sessionCounts.delete(sessionId);
    return false;
  }
  
  return session.count >= config.maxAnswersPerSession;
}

/**
 * Increment session answer count
 */
function incrementSessionCount(sessionId: string): void {
  const session = sessionCounts.get(sessionId);
  const resetTime = Date.now() + (60 * 60 * 1000); // Reset after 1 hour
  
  if (!session) {
    sessionCounts.set(sessionId, { count: 1, resetTime });
  } else if (Date.now() > session.resetTime) {
    // Reset expired session
    sessionCounts.set(sessionId, { count: 1, resetTime });
  } else {
    session.count++;
  }
  
  // Clean up old sessions periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupOldSessions();
  }
}

/**
 * Clean up expired sessions to prevent memory leaks
 */
function cleanupOldSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessionCounts.entries()) {
    if (now > session.resetTime) {
      sessionCounts.delete(sessionId);
    }
  }
}

/**
 * Create a simple streaming response for non-streamed content
 */
function createStreamResponse(content: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    }
  });
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      return new Response(
        JSON.stringify({ 
          status: 'unhealthy', 
          error: 'Environment validation failed',
          missing: envCheck.missing 
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    await ensureSystemsInitialized();
    
    return new Response(
      JSON.stringify({ 
        status: 'healthy',
        systems: {
          environment: 'ok',
          retrieval: systemsInitialized ? 'ok' : 'initializing',
          github: !!process.env.GITHUB_TOKEN ? 'ok' : 'disabled'
        },
        limits: {
          maxAnswersPerSession: config.maxAnswersPerSession,
          topK: config.topK
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy', 
        error: 'System initialization failed' 
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}