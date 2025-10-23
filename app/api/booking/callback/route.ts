import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { BookingCallbackRequest } from '@/types';
import crypto from 'crypto';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature for security
    const signature = request.headers.get('x-webhook-signature');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const body = await request.text();
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { success: false, error: 'Invalid signature' },
          { status: 401 }
        );
      }

      // Parse the body after verification
      var callbackData: BookingCallbackRequest = JSON.parse(body);
    } else {
      // If no signature verification is needed, parse directly
      callbackData = await request.json();
    }

    const { callId, status, result, transcript, duration, reason } = callbackData;

    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'Missing callId' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Find booking by callId
    const { data: booking, error: findError } = await supabase
      .from('bookings')
      .select('*, chats(user_id)')
      .eq('call_id', callId)
      .single();

    if (findError || !booking) {
      console.error('Booking not found for callId:', callId, findError);
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Update booking status and result
    const bookingStatus = status === 'completed' ? 'completed' : 'failed';
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        result: {
          transcript,
          duration,
          reason,
          ...result,
        },
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      throw updateError;
    }

    // Create appropriate message based on status
    let messageContent = '';
    const businessName = booking.details.restaurantName || booking.details.businessName || 'the business';

    switch (status) {
      case 'completed':
        messageContent = `✅ Great news! Your reservation at ${businessName} is CONFIRMED for ${booking.details.dateTime}, party of ${booking.details.partySize}.`;
        if (transcript) {
          messageContent += `\n\nCall Summary:\n${transcript}`;
        }
        break;

      case 'failed':
        messageContent = `❌ We couldn't complete your booking at ${businessName}.`;
        if (reason) {
          messageContent += ` Reason: ${reason}.`;
        }
        messageContent += ' Would you like me to try again or try a different time?';
        break;

      case 'busy':
        messageContent = `📵 The line was busy when we tried to call ${businessName}. Would you like me to retry?`;
        break;

      case 'no-answer':
        messageContent = `📵 There was no answer when we called ${businessName}. They might be closed or very busy. Would you like to try again later?`;
        break;

      default:
        messageContent = `ℹ️ The call to ${businessName} ended with status: ${status}.`;
    }

    // Insert system message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: booking.chat_id,
        role: 'system',
        content: messageContent,
        metadata: {
          callId,
          bookingId: booking.id,
          status,
        },
      });

    if (messageError) {
      console.error('Error inserting message:', messageError);
      throw messageError;
    }

    // Log callback for debugging
    console.log('Booking callback processed:', {
      callId,
      bookingId: booking.id,
      status,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in booking callback API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
