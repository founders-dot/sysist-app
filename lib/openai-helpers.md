# OpenAI Helper Functions Documentation

This document describes the helper functions available in `/lib/openai.ts` for working with OpenAI's Assistants API.

## Available Functions

### 1. `createThread()`

Creates a new OpenAI thread for conversation.

**Returns:** `Promise<string>` - The thread ID

**Example:**
```typescript
import { createThread } from '@/lib/openai';

const threadId = await createThread();
console.log('Thread created:', threadId);
```

---

### 2. `sendMessage(threadId, message)`

Sends a user message to a thread.

**Parameters:**
- `threadId: string` - The ID of the thread
- `message: string` - The message content

**Returns:** `Promise<Message>` - The created message object

**Example:**
```typescript
import { sendMessage } from '@/lib/openai';

const message = await sendMessage(
  'thread_abc123',
  'Hello, I need to book a table for 4 people'
);
console.log('Message sent:', message.id);
```

---

### 3. `runAssistant(threadId, toolCallHandler?, maxWaitTime?)`

Runs the assistant on a thread and handles tool calls.

**Parameters:**
- `threadId: string` - The ID of the thread
- `toolCallHandler?: ToolCallHandler` - Optional function to handle tool calls
- `maxWaitTime?: number` - Maximum wait time in seconds (default: 60)

**Returns:** `Promise<AssistantMessage>` - The assistant's response

**Example (without tool calls):**
```typescript
import { runAssistant } from '@/lib/openai';

const response = await runAssistant('thread_abc123');
console.log('Assistant response:', response.content);
```

**Example (with tool calls):**
```typescript
import { runAssistant } from '@/lib/openai';

const toolHandler = async (toolName: string, args: any) => {
  if (toolName === 'start_booking_call') {
    // Call your booking API
    const result = await fetch('/api/booking/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await result.json();
  }

  return { error: 'Unknown tool' };
};

const response = await runAssistant('thread_abc123', toolHandler);
console.log('Assistant response:', response.content);
```

---

### 4. `getMessages(threadId, limit?, order?)`

Retrieves messages from a thread.

**Parameters:**
- `threadId: string` - The ID of the thread
- `limit?: number` - Maximum messages to retrieve (default: 100)
- `order?: 'asc' | 'desc'` - Message order (default: 'asc')

**Returns:** `Promise<Message[]>` - Array of messages

**Example:**
```typescript
import { getMessages } from '@/lib/openai';

// Get last 10 messages in descending order
const messages = await getMessages('thread_abc123', 10, 'desc');
messages.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

---

### 5. `deleteThread(threadId)`

Deletes a thread (cleanup).

**Parameters:**
- `threadId: string` - The ID of the thread to delete

**Returns:** `Promise<void>`

**Example:**
```typescript
import { deleteThread } from '@/lib/openai';

await deleteThread('thread_abc123');
console.log('Thread deleted');
```

---

### 6. `getRunStatus(threadId, runId)`

Gets the current status of a run.

**Parameters:**
- `threadId: string` - The ID of the thread
- `runId: string` - The ID of the run

**Returns:** `Promise<Run>` - The run object

**Example:**
```typescript
import { getRunStatus } from '@/lib/openai';

const run = await getRunStatus('thread_abc123', 'run_xyz789');
console.log('Run status:', run.status);
```

---

### 7. `cancelRun(threadId, runId)`

Cancels a running assistant run.

**Parameters:**
- `threadId: string` - The ID of the thread
- `runId: string` - The ID of the run to cancel

**Returns:** `Promise<void>`

**Example:**
```typescript
import { cancelRun } from '@/lib/openai';

await cancelRun('thread_abc123', 'run_xyz789');
console.log('Run cancelled');
```

---

## TypeScript Types

### `AssistantMessage`

```typescript
interface AssistantMessage {
  role: 'assistant';
  content: string;
  threadId: string;
  messageId: string;
  runId?: string;
}
```

### `ToolCallHandler`

```typescript
interface ToolCallHandler {
  (toolName: string, args: any): Promise<any>;
}
```

---

## Complete Usage Example

Here's a complete example of using these helpers in an API route:

```typescript
// app/api/chat/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  createThread,
  sendMessage,
  runAssistant,
  getMessages
} from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Create a new thread
    const threadId = await createThread();

    // Send user message
    await sendMessage(threadId, message);

    // Define tool handler
    const toolHandler = async (toolName: string, args: any) => {
      if (toolName === 'start_booking_call') {
        // Call booking API
        const response = await fetch(
          `${process.env.NEXTJS_APP_URL}/api/booking/start`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...args,
              chatId: 'chat-id',
              userId: 'user-id',
            }),
          }
        );
        return await response.json();
      }
      return { error: 'Unknown tool' };
    };

    // Run assistant with tool handler
    const response = await runAssistant(threadId, toolHandler);

    // Get all messages
    const allMessages = await getMessages(threadId);

    return NextResponse.json({
      success: true,
      response: response.content,
      messageCount: allMessages.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

---

## Error Handling

All functions include comprehensive error handling and will throw descriptive errors:

```typescript
try {
  const threadId = await createThread();
} catch (error) {
  console.error('Failed to create thread:', error.message);
  // Error messages are user-friendly and descriptive
  // Example: "Failed to create thread: Invalid API key"
}
```

---

## Logging

All functions include console logging for debugging:

- Thread creation/deletion
- Message sending
- Assistant run status updates
- Tool call processing
- Error details

Example log output:
```
Created new thread: thread_abc123
Message sent to thread: thread_abc123
Starting assistant run on thread: thread_abc123
Run status (attempt 1): queued
Run status (attempt 2): in_progress
Run status (attempt 3): in_progress
Assistant requires action (tool calls)
Processing tool call: start_booking_call
Submitting tool outputs...
Run status after tool submission (attempt 1): in_progress
Run status after tool submission (attempt 2): completed
Assistant run completed successfully
```

---

## Best Practices

1. **Store thread IDs**: Save thread IDs in your database for persistent conversations
2. **Use tool handlers**: Always provide a tool handler when your assistant uses tools
3. **Set appropriate timeouts**: Adjust `maxWaitTime` based on your use case
4. **Clean up threads**: Delete threads when conversations are complete to save costs
5. **Handle errors gracefully**: Wrap calls in try-catch blocks
6. **Monitor run status**: Use `getRunStatus()` for long-running operations

---

## Performance Tips

- **Reuse threads**: Don't create a new thread for every message in the same conversation
- **Batch message retrieval**: Use the `limit` parameter to get only recent messages
- **Optimize polling**: The default 1-second polling interval balances responsiveness with API calls
- **Parallel operations**: When possible, send messages to multiple threads in parallel

---

## OpenAI Client

The raw OpenAI client is also exported if you need direct access:

```typescript
import { openai } from '@/lib/openai';

// Use any OpenAI API directly
const models = await openai.models.list();
```

---

## Environment Variables Required

```env
OPENAI_API_KEY=sk-your-api-key
OPENAI_ASSISTANT_ID=asst-your-assistant-id
```

---

## Testing

Example test using these helpers:

```typescript
import { createThread, sendMessage, runAssistant } from '@/lib/openai';

async function testAssistant() {
  const threadId = await createThread();

  await sendMessage(threadId, 'Hello!');

  const response = await runAssistant(threadId);

  console.log('Response:', response.content);
}

testAssistant().catch(console.error);
```
