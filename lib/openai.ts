import OpenAI from 'openai';
import type {
  Thread,
  Message,
  Run,
  MessageContentText,
} from 'openai/resources/beta/threads/index';

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Type definitions
export interface AssistantMessage {
  role: 'assistant';
  content: string;
  threadId: string;
  messageId: string;
  runId?: string;
}

export interface ToolCallHandler {
  (toolName: string, args: any): Promise<any>;
}

/**
 * Create a new OpenAI thread
 *
 * @returns The thread ID
 */
export async function createThread(): Promise<string> {
  try {
    const thread = await openai.beta.threads.create();
    console.log('Created new thread:', thread.id);
    return thread.id;
  } catch (error) {
    console.error('Error creating thread:', error);
    throw new Error(
      `Failed to create thread: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Send a message to a thread
 *
 * @param threadId - The ID of the thread
 * @param message - The message content
 * @returns The created message
 */
export async function sendMessage(
  threadId: string,
  message: string
): Promise<Message> {
  try {
    const createdMessage = await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    console.log('Message sent to thread:', threadId);
    return createdMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error(
      `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Run the assistant on a thread and handle tool calls
 *
 * @param threadId - The ID of the thread
 * @param toolCallHandler - Optional function to handle tool calls
 * @param maxWaitTime - Maximum time to wait for completion in seconds (default: 60)
 * @returns The assistant's response message
 */
export async function runAssistant(
  threadId: string,
  toolCallHandler?: ToolCallHandler,
  maxWaitTime: number = 60
): Promise<AssistantMessage> {
  const assistantId = process.env.OPENAI_ASSISTANT_ID;
  if (!assistantId) {
    throw new Error('OPENAI_ASSISTANT_ID environment variable is not set');
  }

  try {
    // Start the run
    console.log('Starting assistant run on thread:', threadId);
    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Poll for completion
    const startTime = Date.now();
    const maxWaitMs = maxWaitTime * 1000;
    let attempts = 0;

    while (run.status === 'queued' || run.status === 'in_progress') {
      // Check timeout
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Assistant run timed out after ${maxWaitTime} seconds`);
      }

      // Wait 1 second before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;

      // Retrieve updated run status
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log(`Run status (attempt ${attempts}):`, run.status);
    }

    // Handle tool calls if required
    if (run.status === 'requires_action') {
      console.log('Assistant requires action (tool calls)');

      if (!toolCallHandler) {
        throw new Error('Tool calls required but no handler provided');
      }

      const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const toolOutputs = await handleToolCalls(toolCalls, toolCallHandler);

        // Submit tool outputs
        console.log('Submitting tool outputs...');
        run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
          tool_outputs: toolOutputs,
        });

        // Poll again after submitting tool outputs
        attempts = 0;
        while (run.status === 'queued' || run.status === 'in_progress') {
          if (Date.now() - startTime > maxWaitMs) {
            throw new Error(`Assistant run timed out after ${maxWaitTime} seconds`);
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
          run = await openai.beta.threads.runs.retrieve(threadId, run.id);
          console.log(`Run status after tool submission (attempt ${attempts}):`, run.status);
        }
      }
    }

    // Handle different final statuses
    if (run.status === 'failed') {
      const errorMessage = run.last_error?.message || 'Unknown error';
      console.error('Assistant run failed:', errorMessage);
      throw new Error(`Assistant run failed: ${errorMessage}`);
    }

    if (run.status === 'expired') {
      throw new Error('Assistant run expired');
    }

    if (run.status === 'cancelled') {
      throw new Error('Assistant run was cancelled');
    }

    if (run.status !== 'completed') {
      throw new Error(`Unexpected run status: ${run.status}`);
    }

    // Retrieve the assistant's response
    const messages = await openai.beta.threads.messages.list(threadId, {
      order: 'desc',
      limit: 1,
    });

    const assistantMessage = messages.data[0];
    if (!assistantMessage || assistantMessage.role !== 'assistant') {
      throw new Error('No assistant response found');
    }

    // Extract text content
    const textContent = assistantMessage.content.find(
      (content): content is MessageContentText => content.type === 'text'
    );

    if (!textContent) {
      throw new Error('No text content in assistant response');
    }

    const responseContent = textContent.text.value;

    console.log('Assistant run completed successfully');

    return {
      role: 'assistant',
      content: responseContent,
      threadId: threadId,
      messageId: assistantMessage.id,
      runId: run.id,
    };
  } catch (error) {
    console.error('Error running assistant:', error);
    throw new Error(
      `Failed to run assistant: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get messages from a thread
 *
 * @param threadId - The ID of the thread
 * @param limit - Maximum number of messages to retrieve (default: 100)
 * @param order - Order of messages: 'asc' or 'desc' (default: 'asc')
 * @returns Array of messages
 */
export async function getMessages(
  threadId: string,
  limit: number = 100,
  order: 'asc' | 'desc' = 'asc'
): Promise<Message[]> {
  try {
    const response = await openai.beta.threads.messages.list(threadId, {
      limit,
      order,
    });

    console.log(`Retrieved ${response.data.length} messages from thread:`, threadId);
    return response.data;
  } catch (error) {
    console.error('Error getting messages:', error);
    throw new Error(
      `Failed to get messages: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle tool calls from the assistant
 *
 * @param toolCalls - Array of tool calls from the assistant
 * @param handler - Function to handle each tool call
 * @returns Array of tool outputs
 */
async function handleToolCalls(
  toolCalls: any[],
  handler: ToolCallHandler
): Promise<Array<{ tool_call_id: string; output: string }>> {
  const toolOutputs = [];

  for (const toolCall of toolCalls) {
    console.log('Processing tool call:', toolCall.function.name);

    const functionName = toolCall.function.name;
    let functionArgs: any;

    try {
      functionArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse tool call arguments:', parseError);
      toolOutputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: 'Failed to parse function arguments',
        }),
      });
      continue;
    }

    try {
      // Call the handler function
      const output = await handler(functionName, functionArgs);

      toolOutputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify(output),
      });
    } catch (error) {
      console.error(`Error executing tool ${functionName}:`, error);
      toolOutputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: error instanceof Error ? error.message : 'Tool execution failed',
        }),
      });
    }
  }

  return toolOutputs;
}

/**
 * Delete a thread (cleanup)
 *
 * @param threadId - The ID of the thread to delete
 */
export async function deleteThread(threadId: string): Promise<void> {
  try {
    await openai.beta.threads.del(threadId);
    console.log('Deleted thread:', threadId);
  } catch (error) {
    console.error('Error deleting thread:', error);
    throw new Error(
      `Failed to delete thread: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the current status of a run
 *
 * @param threadId - The ID of the thread
 * @param runId - The ID of the run
 * @returns The run object
 */
export async function getRunStatus(threadId: string, runId: string): Promise<Run> {
  try {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    return run;
  } catch (error) {
    console.error('Error getting run status:', error);
    throw new Error(
      `Failed to get run status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Cancel a running assistant run
 *
 * @param threadId - The ID of the thread
 * @param runId - The ID of the run to cancel
 */
export async function cancelRun(threadId: string, runId: string): Promise<void> {
  try {
    await openai.beta.threads.runs.cancel(threadId, runId);
    console.log('Cancelled run:', runId);
  } catch (error) {
    console.error('Error cancelling run:', error);
    throw new Error(
      `Failed to cancel run: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
