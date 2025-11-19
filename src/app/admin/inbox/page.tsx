import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getInboxMessages } from '@/lib/supabaseAdmin';
import type { InboxMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Admin page for viewing inbox messages
 * Gated by x-admin-key header
 */
export default async function AdminInboxPage() {
  // Check authentication
  const headersList = await headers();
  const adminKey = headersList.get('x-admin-key');
  
  if (!adminKey || adminKey !== env.adminApiKey) {
    redirect('/'); // Redirect if not authenticated
  }
  
  // Fetch messages
  let messages: InboxMessage[] = [];
  let error: string | null = null;
  
  try {
    messages = await getInboxMessages({ limit: 50 });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch messages';
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Inbox Admin</h1>
          <p className="text-white/60">View and manage messages from visitors</p>
        </div>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-white/60">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className="bg-white/5 rounded-lg p-6 border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded">
                        {message.source}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        message.status === 'new' 
                          ? 'bg-green-500/20 text-green-400'
                          : message.status === 'read'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {message.status}
                      </span>
                    </div>
                    <p className="text-white/40 text-sm">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-white/60 text-sm font-mono">
                    {message.id.substring(0, 8)}...
                  </p>
                </div>
                
                <div className="mb-4">
                  <p className="text-white whitespace-pre-wrap">{message.draft_message}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/60 mb-1">Contact</p>
                    <p className="text-white">
                      {message.contact_method === 'anon' 
                        ? 'Anonymous'
                        : `${message.contact_method}: ${message.contact_value || 'N/A'}`
                      }
                    </p>
                  </div>
                  {message.user_query && (
                    <div>
                      <p className="text-white/60 mb-1">Original Question</p>
                      <p className="text-white/80">{message.user_query.substring(0, 100)}{message.user_query.length > 100 ? '...' : ''}</p>
                    </div>
                  )}
                </div>
                
                {message.iris_answer && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white/60 text-sm mb-2">Iris Answer:</p>
                    <p className="text-white/80 text-sm whitespace-pre-wrap">
                      {message.iris_answer.substring(0, 200)}
                      {message.iris_answer.length > 200 ? '...' : ''}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
