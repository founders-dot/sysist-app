# MCP Server Integration Guide

This document explains how to integrate your existing MCP server (running on Render) with the Sysist Next.js application.

## Overview

The integration flow:
1. Next.js app calls MCP server's `/mcp` endpoint to initiate a booking call
2. MCP server starts VAPI call
3. When call completes, MCP server sends webhook to Next.js app
4. Next.js app updates database and notifies user in real-time

## Step 1: Add Webhook Handler to Your MCP Server

Add this code to your MCP server to handle VAPI call completion webhooks:

```javascript
// webhook-handler.js or in your main server file

const crypto = require('crypto');

/**
 * Handle VAPI webhook when call ends
 * This should be called from your existing VAPI webhook endpoint
 */
async function handleVAPICallComplete(vapiWebhookData) {
  try {
    // Extract call information from VAPI webhook
    const callId = vapiWebhookData.call?.id;
    const callStatus = vapiWebhookData.call?.status; // 'ended', 'failed', etc.
    const transcript = vapiWebhookData.transcript;
    const duration = vapiWebhookData.call?.duration;
    const endedReason = vapiWebhookData.call?.endedReason;

    // Map VAPI status to our app status
    let status = 'completed';
    let reason = '';

    if (callStatus === 'failed') {
      status = 'failed';
      reason = endedReason || 'Call failed';
    } else if (endedReason === 'assistant-error') {
      status = 'failed';
      reason = 'Assistant error';
    } else if (endedReason === 'voicemail') {
      status = 'no-answer';
      reason = 'Reached voicemail';
    } else if (endedReason === 'busy') {
      status = 'busy';
      reason = 'Line was busy';
    }

    // Prepare payload for Next.js app
    const payload = {
      callId: callId,
      status: status,
      transcript: transcript || '',
      duration: duration,
      result: {
        endedReason: endedReason,
        // Add any other relevant data from VAPI
      },
      reason: reason
    };

    // Send to Next.js app webhook
    await sendWebhookToNextJS(payload);

    console.log('Successfully sent webhook to Next.js app for call:', callId);
  } catch (error) {
    console.error('Error handling VAPI call complete:', error);
    throw error;
  }
}

/**
 * Send webhook to Next.js application
 */
async function sendWebhookToNextJS(payload) {
  const webhookUrl = process.env.NEXTJS_APP_URL + '/api/booking/callback';
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Generate HMAC signature for security
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
      const errorText = await response.text();
      throw new Error(`Webhook request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Webhook response:', result);
    return result;
  } catch (error) {
    console.error('Error sending webhook to Next.js app:', error);
    throw error;
  }
}

module.exports = {
  handleVAPICallComplete,
  sendWebhookToNextJS
};
```

## Step 2: Update Your VAPI Webhook Endpoint

Integrate the webhook handler into your existing VAPI webhook endpoint:

```javascript
// In your Express/Fastify/etc. server

const { handleVAPICallComplete } = require('./webhook-handler');

// Your existing VAPI webhook endpoint
app.post('/vapi/webhook', async (req, res) => {
  try {
    const vapiWebhookData = req.body;

    // Log the webhook for debugging
    console.log('Received VAPI webhook:', JSON.stringify(vapiWebhookData, null, 2));

    // Check if this is a call-ended event
    if (vapiWebhookData.type === 'call-ended' ||
        vapiWebhookData.message?.type === 'end-of-call-report') {

      // Send webhook to Next.js app
      await handleVAPICallComplete(vapiWebhookData);
    }

    // Always return 200 to VAPI
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing VAPI webhook:', error);
    // Still return 200 to prevent VAPI from retrying
    res.status(200).json({ success: false, error: error.message });
  }
});
```

## Step 3: Add Environment Variables to Your MCP Server

Add these to your Render environment variables (or .env file for local):

```env
# Next.js App URL (your Vercel deployment URL)
NEXTJS_APP_URL=https://your-vercel-app.vercel.app

# Webhook secret (must match the one in Next.js .env.local)
WEBHOOK_SECRET=your_random_secret_key_here_make_it_long_and_random
```

**Important:** Use the same `WEBHOOK_SECRET` in both your MCP server and your Next.js app!

## Step 4: Update Your MCP Server Dependencies

Make sure you have these packages installed:

```bash
npm install node-fetch
# or if using older Node version
npm install node-fetch@2
```

## Step 5: Test the Integration

### Local Testing

1. Start your Next.js app locally:
   ```bash
   cd sysist-app
   npm run dev
   ```

2. Use ngrok to expose your local Next.js app:
   ```bash
   ngrok http 3000
   ```

3. Update your MCP server's `NEXTJS_APP_URL` to the ngrok URL

4. Make a test booking and verify the webhook is received

### Production Testing

1. Deploy Next.js app to Vercel
2. Update MCP server's `NEXTJS_APP_URL` to Vercel URL
3. Restart your MCP server on Render
4. Make a test booking

## Webhook Payload Reference

### What Next.js App Expects

```typescript
{
  callId: string;           // Required: VAPI call ID
  status: string;           // Required: 'completed' | 'failed' | 'busy' | 'no-answer'
  transcript?: string;      // Optional: Call transcript
  duration?: number;        // Optional: Call duration in seconds
  result?: any;            // Optional: Additional data
  reason?: string;         // Optional: Failure reason
}
```

### Status Values

- `completed`: Call was successful, booking confirmed
- `failed`: Call failed for technical reasons
- `busy`: Line was busy
- `no-answer`: No one answered / voicemail

## Troubleshooting

### Webhook Not Being Received

1. Check MCP server logs for errors
2. Verify `NEXTJS_APP_URL` is correct
3. Check that webhook secret matches in both apps
4. Test webhook signature generation manually

### Signature Verification Failing

Make sure both servers use the exact same `WEBHOOK_SECRET` and generate signatures the same way:

```javascript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))  // Use exact same payload
  .digest('hex');
```

### Call Status Not Updating in App

1. Check Supabase logs for errors
2. Verify `callId` matches between systems
3. Check browser console for real-time subscription errors

## Security Best Practices

1. **Always use HTTPS** in production
2. **Verify webhook signatures** on Next.js side
3. **Use strong webhook secrets** (at least 32 random characters)
4. **Rate limit webhook endpoint** to prevent abuse
5. **Log all webhook attempts** for debugging

## Example: Complete MCP Server Structure

```
your-mcp-server/
├── index.js                 # Main server file
├── webhook-handler.js       # New file with webhook code
├── tools/
│   └── booking-tool.js     # Your existing booking tool
└── .env                    # Add new environment variables
```

## Next Steps

After integration:
1. Monitor webhook logs on both servers
2. Test different call outcomes (success, failure, busy, no-answer)
3. Verify real-time updates work in Next.js app
4. Set up error alerting for webhook failures

## Support

If you encounter issues:
1. Check both server logs (MCP server and Vercel logs)
2. Verify environment variables are set correctly
3. Test webhook signature generation separately
4. Create an issue in the repository with logs
