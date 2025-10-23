import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Webhook request body type definition
interface BookingCallbackRequest {
  callId: string;
  status: string;
  result?: {
    reason?: string;
    [key: string]: any;
  };
  transcript?: string;
  duration?: number;
}

// Booking database record type
interface Booking {
  id: string;
  chat_id: string;
  user_id: string;
  booking_type: string;
  call_id: string;
  status: string;
  details: {
    restaurantName: string;
    phoneNumber: string;
    dateTime: string;
    partySize: number;
    customerName: string;
    specialRequests?: string;
  };
}

/**
 * Creates a status-specific system message for the user
 */
function createSystemMessage(status: string, booking: Booking, result?: any): string {
  const { restaurantName, phoneNumber, dateTime, partySize, customerName } = booking.details;

  switch (status) {
    case 'completed':
    case 'ended':
      return `✅ Great news! Your reservation at ${restaurantName} is CONFIRMED for ${dateTime}, party of ${partySize} people under the name ${customerName}.`;

    case 'failed':
      const reason = result?.reason || 'Unknown error';
      return `❌ Sorry, we couldn't complete your booking. ${reason}. Would you like me to try again or call them directly at ${phoneNumber}?`;

    case 'busy':
      return `📵 The line was busy. Would you like me to retry in a few minutes?`;

    case 'no-answer':
      return `📵 No one answered. The restaurant might be closed or very busy right now.`;

    case 'voicemail':
      return `📧 The call went to voicemail. You may want to call them directly at ${phoneNumber}.`;

    default:
      return `ℹ️ Call status: ${status}. Please check with the restaurant at ${phoneNumber} to confirm your reservation.`;
  }
}

/**
 * POST /api/booking/callback
 * Webhook endpoint called by MCP server when calls complete
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // Validate webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error('[Booking Callback] WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (webhookSecret !== expectedSecret) {
      console.error('[Booking Callback] Unauthorized webhook attempt at', timestamp);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: BookingCallbackRequest = await request.json();
    console.log('[Booking Callback] Received webhook:', {
      timestamp,
      callId: body.callId,
      status: body.status,
      duration: body.duration,
    });

    // Validate required fields
    if (!body.callId || !body.status) {
      console.error('[Booking Callback] Missing required fields:', body);
      return NextResponse.json(
        { error: 'Missing required fields: callId and status' },
        { status: 400 }
      );
    }

    // Find booking by call_id
    console.log('[Booking Callback] Looking up booking with call_id:', body.callId);
    const { data: booking, error: findError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('call_id', body.callId)
      .single();

    if (findError || !booking) {
      console.error('[Booking Callback] Booking not found for call_id:', body.callId, findError);
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    console.log('[Booking Callback] Found booking:', booking.id);

    // Update booking record
    const updateData = {
      status: body.status,
      result: {
        transcript: body.transcript || '',
        duration: body.duration || 0,
        ...body.result,
      },
      updated_at: new Date().toISOString(),
    };

    console.log('[Booking Callback] Updating booking with status:', body.status);
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id);

    if (updateError) {
      console.error('[Booking Callback] Failed to update booking:', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking', details: updateError.message },
        { status: 500 }
      );
    }

    // Create system message based on status
    const systemMessage = createSystemMessage(body.status, booking as Booking, body.result);
    console.log('[Booking Callback] Created system message:', systemMessage.substring(0, 100) + '...');

    // Insert message into messages table
    const { error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: booking.chat_id,
        role: 'system',
        content: systemMessage,
        metadata: {
          callId: body.callId,
          bookingId: booking.id,
          status: body.status,
        },
      });

    if (messageError) {
      console.error('[Booking Callback] Failed to insert message:', messageError);
      // Don't fail the webhook - booking was already updated
      // Just log the error
    }

    console.log('[Booking Callback] Webhook processed successfully for callId:', body.callId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Booking Callback] Unexpected error at', timestamp, ':', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
