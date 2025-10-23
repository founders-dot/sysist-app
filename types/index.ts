export interface User {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  created_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title?: string;
  openai_thread_id?: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  metadata?: {
    callId?: string;
    bookingId?: string;
    [key: string]: any;
  };
  created_at: string;
}

export type BookingType = 'restaurant' | 'hotel' | 'taxi';
export type BookingStatus = 'initiated' | 'calling' | 'completed' | 'failed';

export interface BookingDetails {
  restaurantName?: string;
  businessName?: string;
  phone?: string;
  dateTime?: string;
  partySize?: number;
  customerName?: string;
  specialRequests?: string;
  address?: string;
  [key: string]: any;
}

export interface BookingResult {
  transcript?: string;
  confirmation?: string;
  duration?: number;
  status?: string;
  reason?: string;
  [key: string]: any;
}

export interface Booking {
  id: string;
  user_id: string;
  chat_id: string;
  call_id?: string;
  booking_type: BookingType;
  status: BookingStatus;
  details: BookingDetails;
  result?: BookingResult;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface SendMessageRequest {
  chatId: string;
  message: string;
  userId: string;
}

export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  error?: string;
}

export interface StartBookingRequest {
  chatId: string;
  userId: string;
  bookingType: BookingType;
  restaurantName: string;
  phone: string;
  dateTime: string;
  partySize: number;
  customerName: string;
  specialRequests?: string;
}

export interface StartBookingResponse {
  success: boolean;
  callId?: string;
  bookingId?: string;
  error?: string;
}

export interface BookingCallbackRequest {
  callId: string;
  status: 'completed' | 'failed' | 'busy' | 'no-answer';
  result?: any;
  transcript?: string;
  duration?: number;
  reason?: string;
}

export interface BookingCallbackResponse {
  success: boolean;
  error?: string;
}

// MCP Server types
export interface MCPToolCallRequest {
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
      specialRequests?: string;
      language?: string;
    };
  };
  id: number;
}

export interface MCPToolCallResponse {
  jsonrpc: '2.0';
  result: {
    callId: string;
    status: string;
    message: string;
  };
  id: number;
}
