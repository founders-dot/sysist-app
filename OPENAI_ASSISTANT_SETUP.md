# OpenAI Assistant Setup Guide

This guide explains how to create and configure your OpenAI Assistant for the Sysist booking application.

## Overview

The Sysist app uses OpenAI's Assistants API (beta) instead of the Chat Completions API. This allows for:
- Persistent conversation threads
- Built-in function calling (tools)
- Better context management
- Stateful conversations

## Step 1: Create Your Assistant

1. Go to [OpenAI Platform](https://platform.openai.com/assistants)
2. Click **"Create"** to create a new assistant
3. Configure the assistant with the following settings:

### Basic Configuration

**Name**: `Sysist Booking Assistant`

**Instructions**:
```
You are Sysist, a professional AI booking assistant that helps users make reservations at restaurants, hotels, and book taxi services through automated phone calls.

Your role:
- Engage in friendly, professional conversation
- Collect all necessary booking information from users
- Validate information before making calls
- Use the start_booking_call function when you have all required details
- Keep users informed about booking status

For restaurant reservations, collect:
- Restaurant name
- Phone number (in E.164 format, e.g., +12125551234)
- Date and time (be specific, e.g., "2025-01-15 19:00")
- Party size (number of guests)
- Customer name
- Special requests (optional)

For hotel bookings, collect:
- Hotel name
- Phone number
- Check-in date and time
- Check-out date
- Number of guests
- Room preferences
- Customer name

For taxi services, collect:
- Pickup location
- Destination
- Date and time
- Phone number
- Customer name

Important guidelines:
- Always confirm all details with the user before calling
- Ask clarifying questions if information is unclear
- Be patient and helpful
- If a booking fails, offer to retry or suggest alternatives
- Maintain context throughout the conversation
```

**Model**: `gpt-4-turbo-preview` or `gpt-4-1106-preview`

**Temperature**: `0.7` (for natural conversation)

## Step 2: Add Tools (Functions)

Add the following two functions to your assistant:

### Function 1: start_booking_call

This function initiates a booking call through your MCP server.

```json
{
  "name": "start_booking_call",
  "description": "Initiates a phone call to make a booking reservation at a restaurant, hotel, or for a taxi service. Only call this function when you have confirmed all required information with the user.",
  "parameters": {
    "type": "object",
    "properties": {
      "restaurantName": {
        "type": "string",
        "description": "The name of the restaurant, hotel, or taxi service to call"
      },
      "phoneNumber": {
        "type": "string",
        "description": "Phone number in E.164 format (e.g., +12125551234 or +972501234567)"
      },
      "dateTime": {
        "type": "string",
        "description": "Date and time for the booking in format: YYYY-MM-DD HH:MM (e.g., 2025-01-15 19:00)"
      },
      "partySize": {
        "type": "number",
        "description": "Number of people for the reservation"
      },
      "customerName": {
        "type": "string",
        "description": "Name of the customer making the booking"
      },
      "specialRequests": {
        "type": "string",
        "description": "Any special requests or notes for the booking (optional)"
      },
      "bookingType": {
        "type": "string",
        "enum": ["restaurant", "hotel", "taxi"],
        "description": "Type of booking being made",
        "default": "restaurant"
      }
    },
    "required": [
      "restaurantName",
      "phoneNumber",
      "dateTime",
      "partySize",
      "customerName"
    ]
  }
}
```

### Function 2: get_booking_status

This function retrieves the status of a booking.

```json
{
  "name": "get_booking_status",
  "description": "Gets the current status of a booking by its ID. Use this to check if a call has completed.",
  "parameters": {
    "type": "object",
    "properties": {
      "bookingId": {
        "type": "string",
        "description": "The UUID of the booking to check"
      }
    },
    "required": ["bookingId"]
  }
}
```

## Step 3: Advanced Settings (Optional)

### File Search
- **Enable**: No (not needed for this use case)

### Code Interpreter
- **Enable**: No (not needed)

### Retrieval
- **Enable**: No (unless you want to add knowledge base documents)

## Step 4: Get Your Assistant ID

1. After creating the assistant, copy the **Assistant ID**
2. It will look like: `asst_abc123xyz...`
3. Add it to your `.env.local` file:

```env
OPENAI_ASSISTANT_ID=asst_your_assistant_id_here
```

## Step 5: Update Your Supabase Database

Run the updated schema to add the `openai_thread_id` column to the chats table:

```sql
-- Add openai_thread_id column to chats table
ALTER TABLE chats ADD COLUMN IF NOT EXISTS openai_thread_id TEXT UNIQUE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_chats_thread_id ON chats(openai_thread_id);
```

This is already included in the updated `supabase/schema.sql` file.

## How It Works

### Conversation Flow

1. **User sends message** → Saved to Supabase
2. **Check for thread** → Get or create OpenAI thread
3. **Add message to thread** → User message added to thread
4. **Run assistant** → Execute assistant on the thread
5. **Poll for completion** → Wait for assistant response
6. **Handle tool calls** (if any):
   - Assistant requests to call `start_booking_call`
   - App executes the function
   - Returns result to assistant
   - Assistant continues with updated info
7. **Get response** → Retrieve assistant's message
8. **Save response** → Store in Supabase
9. **Real-time update** → User sees response instantly

### Thread Management

- **One thread per chat**: Each chat has a persistent OpenAI thread
- **Thread ID stored**: `openai_thread_id` in chats table
- **Automatic creation**: Thread created on first message
- **Persistent context**: Full conversation history maintained
- **Efficient**: Reuses same thread for entire conversation

### Tool Call Handling

When the assistant needs to make a booking:

1. Assistant determines it has enough information
2. Calls `start_booking_call` function
3. App receives function call request
4. App calls `/api/booking/start` endpoint
5. MCP server initiates VAPI call
6. Function returns result to assistant
7. Assistant informs user call has started
8. When call completes, webhook updates chat
9. User sees completion message in real-time

## Testing Your Assistant

### Test in OpenAI Playground

1. Go to your assistant in the OpenAI dashboard
2. Use the **Playground** to test conversations
3. Try different scenarios:
   - "Book a table for 2 at Mario's Pizza tomorrow at 7pm"
   - "I need a hotel room at Hilton for next Friday"
   - "Book me a taxi to the airport at 5am tomorrow"

### Test in Your App

1. Start your Next.js app: `npm run dev`
2. Create a new chat
3. Send a booking request
4. Verify the assistant:
   - Asks for missing information
   - Confirms details before calling
   - Calls the `start_booking_call` function
   - Updates you with status

## Troubleshooting

### Assistant not responding

- Check `OPENAI_ASSISTANT_ID` is set correctly
- Verify API key has access to Assistants API
- Check OpenAI API usage limits

### Tool calls not working

- Ensure functions are properly defined in assistant
- Check function parameters match exactly
- Verify `/api/booking/start` endpoint is working
- Check server logs for errors

### Thread errors

- Verify `openai_thread_id` column exists in chats table
- Check database permissions
- Ensure Supabase connection is working

### Timeout errors

- Assistant responses can take up to 60 seconds
- Increase `maxDuration` in route.ts if needed
- Check if assistant is stuck in a loop

## Function Call Examples

### Example 1: Successful Restaurant Booking

**User**: "Book a table for 4 at The Garden Restaurant tonight at 7pm. My name is John Smith."

**Assistant thinks**:
- Restaurant name: The Garden Restaurant ✓
- Party size: 4 ✓
- Date/time: Need to calculate "tonight at 7pm"
- Customer name: John Smith ✓
- Phone number: Missing ✗

**Assistant responds**: "I'd be happy to help you book a table for 4 at The Garden Restaurant tonight at 7pm. Could you provide their phone number?"

**User**: "+12125551234"

**Assistant calls function**:
```json
{
  "restaurantName": "The Garden Restaurant",
  "phone": "+12125551234",
  "dateTime": "2025-01-15 19:00",
  "partySize": 4,
  "customerName": "John Smith",
  "bookingType": "restaurant"
}
```

**Function returns**:
```json
{
  "success": true,
  "callId": "vapi_123abc",
  "bookingId": "uuid-xyz",
  "message": "Started calling The Garden Restaurant. You'll be notified when complete."
}
```

**Assistant responds**: "Perfect! I've initiated the call to The Garden Restaurant to book a table for 4 tonight at 7pm under the name John Smith. I'll notify you as soon as the reservation is confirmed."

## Best Practices

1. **Clear Instructions**: Make sure your assistant instructions are specific
2. **Error Handling**: Assistant should handle missing information gracefully
3. **Confirmation**: Always confirm details before making calls
4. **Status Updates**: Keep users informed about booking progress
5. **Retry Logic**: Offer to retry if bookings fail
6. **Context Awareness**: Use thread history to avoid re-asking questions

## Updating Your Assistant

To update your assistant:

1. Go to OpenAI Platform
2. Navigate to your assistant
3. Click **Edit**
4. Make changes to instructions or tools
5. Save changes
6. No code changes needed - uses same Assistant ID

## Costs

OpenAI Assistants API pricing:
- **GPT-4 Turbo**: ~$0.01-0.03 per message exchange
- **Thread storage**: Minimal (messages stored)
- **Function calls**: Same as regular messages

Monitor usage in OpenAI dashboard.

## Next Steps

1. Create your assistant in OpenAI Platform
2. Copy the Assistant ID
3. Add to `.env.local`
4. Run the updated Supabase schema
5. Test with your app
6. Monitor and refine instructions based on usage

Your Sysist booking assistant is now ready to help users make reservations! 🎉
