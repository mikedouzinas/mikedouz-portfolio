import { NextResponse } from 'next/server';
import { retrieveRelevantChunks } from '@/lib/iris/retrieval';
import { type SignalSummary } from '@/lib/iris/signals';
import { irisCache } from '@/lib/iris/cache';
import { findAnswer } from '@/data/iris-kb';
import { OpenAI } from 'openai';
import { config } from '@/lib/iris/config';
import { getRecentActivityContext } from '@/lib/iris/github';

/**
 * POST /api/iris/answer
 * Get an answer for a user's question with RAG
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const signalsParam = searchParams.get('signals') || '{}';
    
    if (!query.trim()) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[Answer API] Processing query: "${query}"`);
    
    // Parse user signals (for future RAG personalization)
    let signals: SignalSummary | undefined;
    try {
      signals = JSON.parse(signalsParam);
      // TODO: Use signals for personalized RAG retrieval and ranking
      console.log('[Answer API] User signals:', signals);
    } catch (e) {
      console.warn('[Answer API] Failed to parse signals:', e);
    }

    // Check cache first
    const cacheKey = `answer:${query}`;
    const cached = await irisCache.get(cacheKey);
    
    if (cached) {
      console.log(`[Answer API] Cache hit for: "${query}"`);
      
      // Parse cached data
      const cachedData = JSON.parse(cached);
      
      return NextResponse.json({
        answer: cachedData.answer,
        sources: cachedData.sources || [],
        cached: true,
        timing: Date.now()
      });
    }

    // Generate answer
    console.log(`[Answer API] Generating answer for: "${query}"`);
    const startTime = Date.now();
    
    try {
      // Use RAG system for intelligent answer generation
      const retrievalResult = await retrieveRelevantChunks(query, 3);
      const elapsed = Date.now() - startTime;
      
      console.log(`[Answer API] Retrieved ${retrievalResult.chunks.length} chunks in ${elapsed}ms`);
      
      let answer: string;
      let sources: string[] = [];
      
      if (retrievalResult.chunks.length > 0) {
        // Use RAG chunks to generate contextual answer with ChatGPT
        const contextText = retrievalResult.chunks
          .map(chunk => chunk.content)
          .join('\n\n');
        
        // Get recent GitHub activity for additional context (skip in development)
        let recentActivity = null;
        if (process.env.NODE_ENV === 'production') {
          try {
            recentActivity = await getRecentActivityContext();
          } catch (error) {
            console.warn('[Answer API] GitHub activity fetch failed:', error);
            // Continue without GitHub context
          }
        }
        
        try {
          // Generate intelligent answer using ChatGPT
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          // Build enhanced context with recent activity
          let enhancedContext = contextText;
          if (recentActivity) {
            enhancedContext += `\n\nRecent Development Activity:\n${recentActivity}`;
          }
          
          const stream = await openai.chat.completions.create({
            model: config.models.chat,
            messages: [{
              role: 'system',
              content: `You are Iris, Mike's friendly AI assistant. You help visitors learn about Mike's work, experience, and projects in a warm, conversational way.

Core principles:
- Be genuinely helpful and approachable - like a knowledgeable friend
- Use natural language, avoid jargon and corporate speak
- Keep answers concise but complete (aim for 2-3 short paragraphs)
- If you mention contact info, always provide the actual link or email
- If relevant pages exist (like /projects, /playground, /games/rack-rush), suggest visiting them
- Be honest when you don't have enough information

Context about Mike: ${enhancedContext}

Remember: You're here to help people connect with Mike's work in an authentic, human way.`
            }, {
              role: 'user',
              content: query
            }],
            temperature: config.chatSettings.temperature,
            max_tokens: config.chatSettings.maxTokens,
            stream: true
          });
          
          // Stream the response back to client
          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of stream) {
                  const text = chunk.choices[0]?.delta?.content || '';
                  if (text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                  }
                }
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              } catch (error) {
                controller.error(error);
              }
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
          console.error('[Answer API] ChatGPT generation failed:', error);
          // Fallback to simple context-based answer
          answer = `Based on the information available:\n\n${contextText}`;
          sources = retrievalResult.chunks.map(chunk => chunk.source);
        }
      } else {
        // Fallback to static knowledge base
        answer = findAnswer(query);
        sources = ['static-kb'];
      }
      
      // Cache the result
      const result = {
        answer,
        sources,
        cached: false,
        timing: Date.now(),
        chunksUsed: retrievalResult.chunks.length
      };
      
      await irisCache.set(cacheKey, JSON.stringify(result), 3600); // Cache for 1 hour
      
      return NextResponse.json(result);
    } catch (error) {
      console.error('[Answer API] Error generating answer:', error);
      
      // Return a helpful fallback
      return NextResponse.json({
        answer: "I'm sorry, I couldn't generate a complete answer right now. Please try rephrasing your question or ask about something else.",
        sources: [],
        cached: false,
        error: true,
        timing: Date.now()
      });
    }
  } catch (error) {
    console.error('[Answer API] Request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support POST as well for future expansion
export async function POST(request: Request) {
  return GET(request);
}