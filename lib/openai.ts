import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Creates a new thread for conversation
 * @returns The thread ID
 */
export async function createThread(): Promise<string> {
  const thread = await openai.beta.threads.create();
  return thread.id;
}

/**
 * Sends a message to a thread
 * @param threadId - The ID of the thread
 * @param message - The message content to send
 * @returns The created message object
 */
export async function sendMessage(
  threadId: string,
  message: string
): Promise<OpenAI.Beta.Threads.Messages.Message> {
  const createdMessage = await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: message,
  });
  return createdMessage;
}

/**
 * Runs the assistant on a thread and waits for completion
 * @param threadId - The ID of the thread
 * @returns The final assistant message content
 */
export async function runAssistant(threadId: string): Promise<string> {
  const assistantId = process.env.OPENAI_ASSISTANT_ID;

  if (!assistantId) {
    throw new Error('OPENAI_ASSISTANT_ID environment variable is not set');
  }

  // Create a run
  let run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
  });

  // Poll for completion
  while (run.status === 'queued' || run.status === 'in_progress') {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    run = await openai.beta.threads.runs.retrieve(threadId, run.id);
  }

  // Handle tool calls if the assistant requires them
  while (run.status === 'requires_action') {
    const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;

    if (toolCalls) {
      const toolOutputs = await Promise.all(
        toolCalls.map(async (toolCall) => {
          // Handle different tool types here
          // This is a placeholder - implement your tool logic
          let output = '';

          try {
            // Example: You would implement your tool handling logic here
            // For now, we'll just return an empty result
            output = JSON.stringify({ result: 'Tool execution not implemented' });
          } catch (error) {
            output = JSON.stringify({ error: String(error) });
          }

          return {
            tool_call_id: toolCall.id,
            output,
          };
        })
      );

      // Submit tool outputs
      run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
        tool_outputs: toolOutputs,
      });
    }

    // Continue polling
    while (run.status === 'queued' || run.status === 'in_progress') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
  }

  // Check if run completed successfully
  if (run.status === 'completed') {
    // Get the latest messages
    const messages = await openai.beta.threads.messages.list(threadId, {
      limit: 1,
      order: 'desc',
    });

    const lastMessage = messages.data[0];

    if (lastMessage && lastMessage.role === 'assistant') {
      // Extract text content from the message
      const content = lastMessage.content[0];
      if (content.type === 'text') {
        return content.text.value;
      }
    }
  }

  // Handle error cases
  throw new Error(`Run failed with status: ${run.status}`);
}

/**
 * Gets all messages from a thread
 * @param threadId - The ID of the thread
 * @returns Array of messages
 */
export async function getMessages(
  threadId: string
): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
  const messages = await openai.beta.threads.messages.list(threadId);
  return messages.data;
}
