import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';
import { SendMessageRequest, Message } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for assistant response

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const { chatId, userId, message } = body;

    if (!chatId || !userId || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!assistantId) {
      console.error('OPENAI_ASSISTANT_ID not configured');
      return NextResponse.json(
        { success: false, error: 'Assistant not configured' },
        { status: 500 }
      );
    }

    const supabase = getServerSupabase();

    // Save user message to database
    const { data: userMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      throw userMessageError;
    }

    // Get or create OpenAI thread
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('openai_thread_id')
      .eq('id', chatId)
      .single();

    if (chatError) {
      console.error('Error fetching chat:', chatError);
      throw chatError;
    }

    let threadId = chat?.openai_thread_id;

    // Create new thread if it doesn't exist
    if (!threadId) {
      console.log('Creating new OpenAI thread for chat:', chatId);
      const thread = await openai.beta.threads.create();
      threadId = thread.id;

      // Save thread ID to database
      const { error: updateError } = await supabase
        .from('chats')
        .update({ openai_thread_id: threadId })
        .eq('id', chatId);

      if (updateError) {
        console.error('Error saving thread ID:', updateError);
        throw updateError;
      }
    }

    // Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    // Run the assistant
    console.log('Running assistant:', assistantId, 'on thread:', threadId);
    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Poll for completion
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 60; // Max 60 seconds

    while (
      (runStatus === 'queued' || runStatus === 'in_progress') &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);
      runStatus = run.status;
      attempts++;
      console.log(`Run status (attempt ${attempts}):`, runStatus);
    }

    // Handle different run statuses
    if (runStatus === 'requires_action') {
      console.log('Run requires action (tool calls)');

      // Handle tool calls
      const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const toolOutputs = await handleToolCalls(toolCalls, chatId, userId);

        // Submit tool outputs
        run = await openai.beta.threads.runs.submitToolOutputs(
          threadId,
          run.id,
          { tool_outputs: toolOutputs }
        );

        // Poll again after submitting tool outputs
        runStatus = run.status;
        attempts = 0;
        while (
          (runStatus === 'queued' || runStatus === 'in_progress') &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          run = await openai.beta.threads.runs.retrieve(threadId, run.id);
          runStatus = run.status;
          attempts++;
          console.log(`Run status after tool submission (attempt ${attempts}):`, runStatus);
        }
      }
    }

    if (runStatus === 'failed') {
      console.error('Assistant run failed:', run.last_error);
      throw new Error(`Assistant run failed: ${run.last_error?.message || 'Unknown error'}`);
    }

    if (runStatus === 'expired') {
      throw new Error('Assistant run expired');
    }

    if (runStatus === 'cancelled') {
      throw new Error('Assistant run was cancelled');
    }

    // Retrieve assistant's response
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
      (content) => content.type === 'text'
    );

    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in assistant response');
    }

    const assistantResponse = textContent.text.value;

    // Save assistant response to database
    const { data: savedMessage, error: assistantMessageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: assistantResponse,
        metadata: {
          thread_id: threadId,
          run_id: run.id,
        },
      })
      .select()
      .single();

    if (assistantMessageError) {
      console.error('Error saving assistant message:', assistantMessageError);
      throw assistantMessageError;
    }

    return NextResponse.json({
      success: true,
      message: savedMessage,
    });

  } catch (error) {
    console.error('Error in chat send API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle tool calls from the assistant
 */
async function handleToolCalls(
  toolCalls: any[],
  chatId: string,
  userId: string
): Promise<any[]> {
  const toolOutputs = [];

  for (const toolCall of toolCalls) {
    console.log('Processing tool call:', toolCall.function.name);

    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);

    try {
      let output: any;

      // Handle different tool/function calls
      switch (functionName) {
        case 'start_booking_call':
          output = await handleStartBookingCall(functionArgs, chatId, userId);
          break;

        case 'get_booking_status':
          output = await handleGetBookingStatus(functionArgs, chatId);
          break;

        default:
          console.warn('Unknown tool call:', functionName);
          output = { error: `Unknown function: ${functionName}` };
      }

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
 * Handle start_booking_call tool
 */
async function handleStartBookingCall(
  args: any,
  chatId: string,
  userId: string
): Promise<any> {
  const {
    restaurantName,
    phoneNumber,
    dateTime,
    partySize,
    customerName,
    specialRequests,
    bookingType = 'restaurant',
  } = args;

  // Call the booking start API
  const response = await fetch(`${process.env.NEXTJS_APP_URL || 'http://localhost:3000'}/api/booking/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      userId,
      bookingType,
      restaurantName,
      phoneNumber,
      dateTime,
      partySize,
      customerName,
      specialRequests,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Booking API error: ${errorText}`);
  }

  const result = await response.json();
  return {
    success: true,
    callId: result.callId,
    bookingId: result.bookingId,
    message: `Started calling ${restaurantName}. You'll be notified when complete.`,
  };
}

/**
 * Handle get_booking_status tool
 */
async function handleGetBookingStatus(args: any, chatId: string): Promise<any> {
  const { bookingId } = args;

  const supabase = getServerSupabase();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('chat_id', chatId)
    .single();

  if (error || !booking) {
    return { error: 'Booking not found' };
  }

  return {
    bookingId: booking.id,
    status: booking.status,
    bookingType: booking.booking_type,
    details: booking.details,
    result: booking.result,
  };
}
