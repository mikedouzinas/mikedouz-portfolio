import { NextRequest } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getPostBySlug } from '@/lib/blog';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  getConversationPrompt,
  getDraftCommentPrompt,
  getDraftMessagePrompt,
  truncateToTokens,
} from '@/app/the-web/lib/blogIrisPrompt';

const RequestSchema = z.object({
  message: z.string().min(1).max(500),
  passage: z.string().min(1).max(500),
  mode: z.enum(['conversation', 'draft_comment', 'draft_message']),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(20).optional().default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limit
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const { allowed } = checkRateLimit(ip, userAgent);
  if (!allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { slug } = await params;

  // Parse request
  let body;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Load post
  const post = await getPostBySlug(slug);
  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  const { message, passage, mode, history } = body;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Build context with token budgets
  const postBody = truncateToTokens(post.body, 3000);
  const irisContext = post.iris_context
    ? truncateToTokens(post.iris_context, 2000)
    : null;

  if (mode === 'conversation') {
    // SSE streaming response
    const systemPrompt = getConversationPrompt(post.title, postBody, irisContext, passage);
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 400,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // Draft modes — return JSON
  const draftPrompt = mode === 'draft_comment'
    ? getDraftCommentPrompt()
    : getDraftMessagePrompt(post.title);

  const conversationContext = history
    .map((h) => `${h.role === 'user' ? 'Reader' : 'Iris'}: ${h.content}`)
    .join('\n');

  const draftMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: draftPrompt },
    {
      role: 'user',
      content: `Post: "${post.title}"\nPassage: "${passage}"\n\nConversation:\n${conversationContext}\nReader: ${message}`,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: draftMessages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const draft = completion.choices[0]?.message?.content?.trim() || message;
    return Response.json({ draft });
  } catch {
    // Fallback: use reader's own message
    return Response.json({ draft: message });
  }
}
