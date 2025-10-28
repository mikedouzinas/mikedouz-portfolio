# Inbox Feature Documentation

## Overview

The inbox feature allows visitors to send messages to Mike directly from within the Iris command palette. It supports three trigger types:

1. **Explicit**: User explicitly requests to message Mike
2. **Auto-insufficient**: Iris lacks context to provide a good answer
3. **Suggested**: Iris suggests contacting Mike for additional detail

## Architecture

### Components

- **MessageComposer** (`src/components/iris/MessageComposer.tsx`): Main form component
- **ContactCta** (`src/components/iris/ContactCta.tsx`): CTA button for non-auto scenarios
- **useUiDirectives** (`src/components/iris/useUiDirectives.ts`): Parser hook for streaming directives
- **IrisPalette integration**: Wires everything into the command palette

### API Routes

- **POST /api/inbox**: Submit messages
- **GET /api/inbox**: Admin retrieval (requires `x-admin-key` header)

### Database

Supabase table: `public.inbox_messages`

```sql
- id (uuid)
- created_at (timestamptz)
- source ('iris-explicit' | 'iris-suggested' | 'auto-insufficient')
- user_query (text)
- iris_answer (text)
- draft_message (text)
- contact_method ('email' | 'phone' | 'anon')
- contact_value (text)
- user_agent (text)
- ip_hash (text)
- status ('new' | 'read' | 'replied')
```

## Environment Variables

Required for full functionality:

```bash
RESEND_API_KEY=re_...              # Email notifications
ADMIN_API_KEY=your_secret_key      # Admin authentication
SUPABASE_URL=https://...           # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...      # Service role key (bypasses RLS)
INBOX_RECIPIENT_EMAIL=mike@...     # Optional, defaults to mike@douzinas.com
```

## Iris System Prompt Integration

The system prompt includes instructions for emitting UI directives:

```
<ui:contact reason="{insufficient_context|more_detail|user_request}" draft="{a short 5–15 word suggestion}" />
```

### Directive Behavior

- **insufficient_context**: Auto-opens composer immediately
- **user_request**: Auto-opens composer if user asked to contact
- **more_detail**: Shows CTA button first (user clicks to open composer)

## Features

### Security

- **Rate limiting**: 3 requests per 60 seconds per IP+UA
- **Honeypot field**: Detects automated spam
- **Input sanitization**: HTML escaping, control char removal
- **Privacy**: IP addresses hashed before storage

### User Experience

- **localStorage caching**: Remembers last contact method
- **Anonymous option**: No contact info required
- **Phone validation**: E.164 format with libphonenumber-js
- **Email validation**: Basic regex + Zod
- **Success/failure states**: Clear feedback on submission

### Email Notifications

Resend sends HTML emails with:
- Message ID and source
- Contact information (if provided)
- User's message
- Original question (context)
- Iris's answer (context)

## Admin Access

Access the admin page at `/admin/inbox` with header:

```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" https://yourdomain.com/admin/inbox
```

The admin page displays:
- Message list with status badges
- Full message content
- Contact information
- Original question context
- Iris's answer context

## Deployment Checklist

1. ✅ Set up Supabase project
2. ✅ Run migrations: `supabase/migrations/20251027_inbox.sql`
3. ✅ Configure environment variables
4. ✅ Verify Resend domain (or use test mode)
5. ✅ Test composer submission
6. ✅ Verify email delivery
7. ✅ Test admin access

## Testing

### Local Testing

```bash
# Start dev server
npm run dev

# Test submission
curl -X POST http://localhost:3000/api/inbox \
  -H "Content-Type: application/json" \
  -d '{
    "source": "iris-explicit",
    "message": "Test message",
    "contact": {"method": "anon"},
    "nonce": "test12345678"
  }'
```

### Trigger Scenarios

1. **Explicit request**: "How can I contact you?"
2. **Insufficient context**: "What are your summer internship plans?" (no info in KB)
3. **More detail**: "Tell me more about the HiLiTe project architecture"

## Troubleshooting

### Composer not showing

- Check browser console for errors
- Verify streaming completed (`isProcessingQuery` should be false)
- Check if directive was detected in `answer` text

### Email not sending

- Verify Resend API key
- Check Resend dashboard for delivery status
- Ensure domain is verified (production)

### Database errors

- Verify Supabase credentials
- Check RLS policies (should be bypassed by service role)
- Ensure migrations ran successfully

## Future Enhancements

- [ ] Mark as read/replied functionality
- [ ] Reply from admin interface
- [ ] Email notifications to Mike
- [ ] Analytics dashboard
- [ ] Spam detection improvements
