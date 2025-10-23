# Sysist - AI Booking Assistant

A Next.js 14 application that uses AI-powered phone calls to make restaurant reservations, book hotels, and arrange taxi services. Built with TypeScript, Tailwind CSS, Supabase, and OpenAI.

## Features

- 🤖 ChatGPT-style conversational interface
- 📞 AI-powered phone calls via MCP server integration
- 🍽️ Restaurant reservations
- 🏨 Hotel bookings
- 🚕 Taxi service arrangements
- ⚡ Real-time message updates with Supabase
- 🎨 Clean black and white theme

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4
- **Icons**: Lucide React
- **Phone Calls**: MCP Server (VAPI integration)

## Project Structure

```
sysist-app/
├── app/
│   ├── chat/
│   │   └── page.tsx              # Main chat interface
│   ├── api/
│   │   ├── chat/
│   │   │   └── send/
│   │   │       └── route.ts      # Chat message API
│   │   └── booking/
│   │       ├── start/
│   │       │   └── route.ts      # Initiate booking call
│   │       └── callback/
│   │           └── route.ts      # Webhook for call results
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/
│   ├── ChatMessage.tsx           # Message display component
│   ├── ChatInput.tsx             # Message input component
│   └── TypingIndicator.tsx       # Loading indicator
├── lib/
│   ├── supabase.ts               # Supabase client
│   └── openai.ts                 # OpenAI client
├── types/
│   └── index.ts                  # TypeScript definitions
├── supabase/
│   └── schema.sql                # Database schema
└── .env.local.example            # Environment variables template
```

## Setup Instructions

### 1. Clone and Install

```bash
cd sysist-app
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Get your project URL and keys from Settings > API

### 3. Set up OpenAI

1. Get your API key from https://platform.openai.com
2. Make sure you have access to GPT-4

### 4. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in the values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_key

# MCP Server Configuration
MCP_SERVER_URL=https://your-mcp-server.onrender.com

# Webhook Security
WEBHOOK_SECRET=your_random_secret_key
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## MCP Server Integration

### Webhook Handler Code for Your MCP Server

Add this to your MCP server to send webhook callbacks to this Next.js app:

```javascript
// In your MCP server's webhook handler (when VAPI call ends)
async function handleCallComplete(callData) {
  const webhookUrl = process.env.NEXTJS_APP_URL + '/api/booking/callback';
  const webhookSecret = process.env.WEBHOOK_SECRET;

  const payload = {
    callId: callData.callId,
    status: callData.status, // 'completed', 'failed', 'busy', 'no-answer'
    transcript: callData.transcript,
    duration: callData.duration,
    result: callData.result,
    reason: callData.reason
  };

  // Generate signature for security
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Webhook failed:', await response.text());
    } else {
      console.log('Webhook sent successfully');
    }
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}
```

### MCP Server Environment Variables

Add to your MCP server's environment variables:

```env
NEXTJS_APP_URL=https://your-vercel-app.vercel.app
WEBHOOK_SECRET=same_secret_as_in_nextjs_app
```

## API Endpoints

### POST /api/chat/send

Send a message in the chat.

**Request:**
```json
{
  "chatId": "uuid",
  "userId": "uuid",
  "message": "I want to book a table for 4 at The Garden Restaurant tonight at 7pm"
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "chat_id": "uuid",
    "role": "assistant",
    "content": "I'd be happy to help you book...",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### POST /api/booking/start

Initiate a booking call.

**Request:**
```json
{
  "chatId": "uuid",
  "userId": "uuid",
  "bookingType": "restaurant",
  "restaurantName": "The Garden Restaurant",
  "phone": "+12125551234",
  "dateTime": "2025-01-15 19:00",
  "partySize": 4,
  "customerName": "John Doe",
  "specialRequests": "Window seat please"
}
```

**Response:**
```json
{
  "success": true,
  "callId": "vapi_call_123",
  "bookingId": "uuid"
}
```

### POST /api/booking/callback

Webhook endpoint for call completion (called by MCP server).

**Request:**
```json
{
  "callId": "vapi_call_123",
  "status": "completed",
  "transcript": "Call transcript...",
  "duration": 45,
  "result": { "confirmation": "Confirmed for 7pm" }
}
```

## Database Schema

The application uses four main tables:

- **users**: User accounts
- **chats**: Chat sessions
- **messages**: Individual messages in chats
- **bookings**: Booking records with call tracking

See `supabase/schema.sql` for the complete schema with Row Level Security policies.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Update MCP Server

After deploying, update your MCP server's `NEXTJS_APP_URL` environment variable with your Vercel deployment URL.

## Usage

1. Visit the landing page and click "Start Chatting"
2. Tell the AI what you want to book (e.g., "Book a table for 4 at Pizza Palace tomorrow at 7pm")
3. The AI will collect necessary details through conversation
4. Once confirmed, the AI initiates a phone call via the MCP server
5. You'll receive real-time updates in the chat when the call completes

## Future Enhancements

- [ ] User authentication (Supabase Auth)
- [ ] Call history and recordings
- [ ] Multiple language support
- [ ] Email confirmations
- [ ] Calendar integration
- [ ] Voice memos for special requests
- [ ] Booking modification and cancellation

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
