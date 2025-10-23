import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface BookingStartRequest {
  chatId: string;
  userId: string;
  bookingType: 'restaurant' | 'hotel' | 'taxi';
  restaurantName: string;
  phoneNumber: string;
  dateTime: string;
  partySize: number;
  customerName: string;
  specialRequests?: string;
}

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
  result?: {
    callId?: string;
    status?: string;
    message?: string;
  };
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * Booking Start API Endpoint
 *
 * This endpoint is called BY THE OPENAI AGENT via MCP tool, not directly by the frontend.
 * It initiates a phone call booking through the MCP server.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: BookingStartRequest = await request.json();
    const {
      chatId,
      userId,
      bookingType,
      restaurantName,
      phoneNumber,
      dateTime,
      partySize,
      customerName,
      specialRequests,
    } = body;

    console.log('Booking start request received:', {
      chatId,
      userId,
      bookingType,
      restaurantName,
      phoneNumber: phoneNumber?.replace(/\d(?=\d{4})/g, '*'), // Masked phone
      dateTime,
      partySize,
      customerName,
    });

    // Validate required fields
    if (!chatId || !userId || !bookingType || !restaurantName || !phoneNumber || !dateTime || !partySize || !customerName) {
      console.error('Missing required fields:', {
        chatId: !!chatId,
        userId: !!userId,
        bookingType: !!bookingType,
        restaurantName: !!restaurantName,
        phoneNumber: !!phoneNumber,
        dateTime: !!dateTime,
        partySize: !!partySize,
        customerName: !!customerName,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'chatId, userId, bookingType, restaurantName, phoneNumber, dateTime, partySize, and customerName are required',
        },
        { status: 400 }
      );
    }

    // Validate booking type
    if (!['restaurant', 'hotel', 'taxi'].includes(bookingType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid booking type',
          details: 'bookingType must be one of: restaurant, hotel, taxi',
        },
        { status: 400 }
      );
    }

    // Validate phone number format (E.164: +1234567890 or +972501234567)
    // Must start with + followed by country code and number (total 8-15 digits)
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      console.error('Invalid phone number format:', phoneNumber);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number format',
          details: 'Phone number must be in E.164 format (e.g., +12125551234 or +972501234567)',
        },
        { status: 400 }
      );
    }

    // Validate party size
    if (typeof partySize !== 'number' || partySize < 1 || partySize > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid party size',
          details: 'Party size must be a number between 1 and 100',
        },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Verify chat exists and belongs to user
    const { data: chatExists, error: chatCheckError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatCheckError || !chatExists) {
      console.error('Chat not found or access denied:', { chatId, userId });
      return NextResponse.json(
        {
          success: false,
          error: 'Chat not found or access denied',
        },
        { status: 404 }
      );
    }

    // Create booking record with 'initiated' status
    console.log('Creating booking record in database...');
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: userId,
        chat_id: chatId,
        booking_type: bookingType,
        status: 'initiated',
        details: {
          restaurantName,
          businessName: restaurantName,
          phoneNumber,
          dateTime,
          partySize,
          customerName,
          specialRequests: specialRequests || '',
        },
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking record:', bookingError);
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    console.log('Booking record created:', booking.id);

    // Prepare MCP server request
    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'start_booking_call',
        arguments: {
          phoneNumber: phoneNumber,
          bookingType: bookingType,
          customerName: customerName,
          partySize: partySize,
          dateTime: dateTime,
          businessName: restaurantName,
          specialRequests: specialRequests || '',
          language: 'en',
        },
      },
      id: 1,
    };

    // Get MCP server URL
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    if (!mcpServerUrl) {
      console.error('MCP_SERVER_URL environment variable not configured');
      throw new Error('MCP server not configured');
    }

    console.log('Calling MCP server:', mcpServerUrl + '/mcp');

    // Call MCP server with 30-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds

    let mcpResponse: Response;
    try {
      mcpResponse = await fetch(`${mcpServerUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpRequest),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('MCP server request timed out after 30 seconds');
        throw new Error('MCP server request timed out. Please try again.');
      }

      console.error('MCP server connection error:', fetchError);
      throw new Error(`Failed to connect to MCP server: ${fetchError.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    // Check MCP server response status
    if (!mcpResponse.ok) {
      const errorText = await mcpResponse.text();
      console.error('MCP server HTTP error:', {
        status: mcpResponse.status,
        statusText: mcpResponse.statusText,
        body: errorText,
      });
      throw new Error(`MCP server error (${mcpResponse.status}): ${errorText || mcpResponse.statusText}`);
    }

    // Parse MCP server response
    let mcpData: MCPResponse;
    try {
      mcpData = await mcpResponse.json();
    } catch (parseError) {
      console.error('Failed to parse MCP server response');
      throw new Error('Invalid response from MCP server');
    }

    console.log('MCP server response:', mcpData);

    // Check for JSON-RPC error
    if (mcpData.error) {
      console.error('MCP server returned error:', mcpData.error);
      throw new Error(`MCP server error: ${mcpData.error.message}`);
    }

    // Extract callId from response
    const callId = mcpData.result?.callId;
    if (!callId) {
      console.error('No callId in MCP server response:', mcpData);
      throw new Error('MCP server did not return a callId');
    }

    console.log('Call initiated successfully, callId:', callId);

    // Update booking with callId and status 'calling'
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        call_id: callId,
        status: 'calling',
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking with callId:', updateError);
      // Don't throw here - call was initiated successfully
      // Log the error but return success
      console.warn('Booking call initiated but failed to update database status');
    }

    const duration = Date.now() - startTime;
    console.log(`Booking start completed successfully in ${duration}ms`, {
      bookingId: booking.id,
      callId,
    });

    return NextResponse.json({
      success: true,
      callId,
      bookingId: booking.id,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error in booking start API (after ${duration}ms):`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
