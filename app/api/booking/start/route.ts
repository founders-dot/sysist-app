import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Request body type definition
interface BookingStartRequest {
  chatId: string;
  userId: string;
  bookingType: string;
  restaurantName: string;
  phoneNumber: string;
  dateTime: string;
  partySize: number;
  customerName: string;
  specialRequests?: string;
}

// MCP Server request/response types
interface MCPRequest {
  jsonrpc: '2.0';
  method: 'tools/call';
  params: {
    name: 'start_booking_call';
    arguments: {
      phoneNumber: string;
      bookingType: string;
      customerName: string;
      partySize: number;
      dateTime: string;
      businessName: string;
      specialRequests: string;
      language: string;
    };
  };
  id: number;
}

interface MCPResponse {
  jsonrpc: '2.0';
  result: {
    callId: string;
    status?: string;
  };
  id: number;
}

/**
 * Validates phone number is in E.164 format
 * Examples: +1234567890, +972501234567
 */
function isValidE164PhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * POST /api/booking/start
 * Called by OpenAI agent via MCP tool to initiate a booking call
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: BookingStartRequest = await request.json();
    console.log('[Booking Start] Received request:', {
      chatId: body.chatId,
      userId: body.userId,
      bookingType: body.bookingType,
      restaurantName: body.restaurantName,
      phoneNumber: body.phoneNumber?.replace(/\d(?=\d{4})/g, '*'), // Mask phone for logs
    });

    // Validate required fields
    const requiredFields: (keyof BookingStartRequest)[] = [
      'chatId',
      'userId',
      'bookingType',
      'restaurantName',
      'phoneNumber',
      'dateTime',
      'partySize',
      'customerName',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        console.error(`[Booking Start] Missing required field: ${field}`);
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate phone number format (E.164)
    if (!isValidE164PhoneNumber(body.phoneNumber)) {
      console.error('[Booking Start] Invalid phone number format:', body.phoneNumber);
      return NextResponse.json(
        {
          success: false,
          error: 'Phone number must be in E.164 format (e.g., +1234567890 or +972501234567)',
        },
        { status: 400 }
      );
    }

    // Create booking record in Supabase
    console.log('[Booking Start] Creating booking record in database...');
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id: body.userId,
        chat_id: body.chatId,
        booking_type: body.bookingType,
        status: 'initiated',
        details: {
          restaurantName: body.restaurantName,
          phoneNumber: body.phoneNumber,
          dateTime: body.dateTime,
          partySize: body.partySize,
          customerName: body.customerName,
          specialRequests: body.specialRequests || '',
        },
      })
      .select()
      .single();

    if (bookingError) {
      console.error('[Booking Start] Database error:', bookingError);
      return NextResponse.json(
        { success: false, error: 'Failed to create booking record', details: bookingError.message },
        { status: 500 }
      );
    }

    const bookingId = booking.id;
    console.log('[Booking Start] Booking record created:', bookingId);

    // Prepare MCP server request
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    if (!mcpServerUrl) {
      console.error('[Booking Start] MCP_SERVER_URL not configured');
      return NextResponse.json(
        { success: false, error: 'MCP server URL not configured' },
        { status: 500 }
      );
    }

    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'start_booking_call',
        arguments: {
          phoneNumber: body.phoneNumber,
          bookingType: body.bookingType,
          customerName: body.customerName,
          partySize: body.partySize,
          dateTime: body.dateTime,
          businessName: body.restaurantName,
          specialRequests: body.specialRequests || '',
          language: 'en',
        },
      },
      id: 1,
    };

    console.log('[Booking Start] Calling MCP server:', `${mcpServerUrl}/mcp`);

    // Call MCP server with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let mcpResponse: MCPResponse;
    try {
      const response = await fetch(`${mcpServerUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Booking Start] MCP server error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`MCP server returned ${response.status}: ${errorText}`);
      }

      mcpResponse = await response.json();
      console.log('[Booking Start] MCP server response:', mcpResponse);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[Booking Start] MCP server request timeout');
        return NextResponse.json(
          { success: false, error: 'MCP server request timeout after 30 seconds' },
          { status: 504 }
        );
      }

      console.error('[Booking Start] MCP server request failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to contact MCP server',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 502 }
      );
    }

    // Extract callId from MCP response
    const callId = mcpResponse.result?.callId;
    if (!callId) {
      console.error('[Booking Start] No callId in MCP response:', mcpResponse);
      return NextResponse.json(
        { success: false, error: 'MCP server did not return callId' },
        { status: 500 }
      );
    }

    console.log('[Booking Start] Call initiated with callId:', callId);

    // Update booking record with callId and status
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        call_id: callId,
        status: 'calling',
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[Booking Start] Failed to update booking with callId:', updateError);
      // Don't fail the request since the call was initiated successfully
      // Just log the error
    }

    const duration = Date.now() - startTime;
    console.log('[Booking Start] Success! Duration:', `${duration}ms`);

    return NextResponse.json({
      success: true,
      callId,
      bookingId,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Booking Start] Unexpected error:', error);
    console.error('[Booking Start] Failed after:', `${duration}ms`);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
