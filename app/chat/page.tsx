'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase';

interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
      <div className="flex justify-end">
        <div className="h-16 w-2/3 bg-gray-200 rounded-3xl"></div>
      </div>
      <div className="flex justify-start">
        <div className="h-20 w-3/4 bg-gray-200 rounded-3xl"></div>
      </div>
      <div className="flex justify-end">
        <div className="h-12 w-1/2 bg-gray-200 rounded-3xl"></div>
      </div>
      <div className="flex justify-start">
        <div className="h-24 w-2/3 bg-gray-200 rounded-3xl"></div>
      </div>
    </div>
  );
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-3xl px-5 py-3 max-w-[70%]">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

// Error toast component
function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-xl shadow-xl z-50 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-3">
        <span className="text-lg">⚠️</span>
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200 transition-colors text-xl leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chatId');
  const userId = searchParams.get('userId') || 'demo-user';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial messages and set up real-time subscription
  useEffect(() => {
    if (!chatId) return;

    // Load existing messages
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading messages:', error);
          setError('Failed to load messages. Please refresh the page.');
          return;
        }

        setMessages(data || []);
      } catch (error) {
        console.error('Error loading messages:', error);
        setError('Failed to load messages. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

    // Set up real-time subscription
    const channel = supabaseClient
      .channel('messages-' + chatId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'chat_id=eq.' + chatId,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          // Only add message if it's not already in the state (prevent duplicates)
          setMessages((prev) => {
            const exists = prev.some((msg) => msg.id === newMessage.id);
            if (exists) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // If it's an assistant or system message, hide typing indicator
          if (newMessage.role === 'assistant' || newMessage.role === 'system') {
            setIsTyping(false);
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [chatId]);

  // Auto-scroll to bottom when messages or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !chatId || isSending) return;

    const messageContent = input.trim();
    setInput('');
    setIsSending(true);
    setIsTyping(true); // Show typing indicator immediately

    try {
      // Insert user message into Supabase
      const { error } = await supabaseClient
        .from('messages')
        .insert({
          chat_id: chatId,
          role: 'user',
          content: messageContent,
        });

      if (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message. Please try again.');
        setInput(messageContent); // Restore input on error
        setIsTyping(false);
        return;
      }

      // TODO: Call your AI assistant API here
      // For now, just log that the message was sent
      console.log('Message sent successfully, waiting for AI response...');

      // The message will appear via real-time subscription
      // Typing indicator will be hidden when assistant response arrives
    } catch (error) {
      console.error('Error sending message:', error);
      setError('An unexpected error occurred. Please try again.');
      setInput(messageContent); // Restore input on error
      setIsTyping(false);
    } finally {
      setIsSending(false);
    }
  };

  if (!chatId) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Chat Selected</h2>
          <p className="text-gray-600">Please provide a chatId parameter to start chatting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Error Toast */}
      {error && <ErrorToast message={error} onClose={() => setError(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900">Sysist</h1>
          <p className="text-xs text-gray-500 mt-0.5">AI-powered booking assistant</p>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : messages.length === 0 && !isTyping ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-2xl px-6">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-semibold mb-3 text-gray-900">Welcome to Sysist</h2>
                  <p className="text-gray-600 text-lg mb-8">
                    Your AI-powered booking assistant. I can help you make restaurant reservations,
                    book hotel rooms, and arrange taxi services through phone calls.
                  </p>
                </div>

                <div className="grid gap-3 text-left max-w-lg mx-auto">
                  <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-2xl border border-gray-200 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900 mb-1">🍽️ Restaurant Reservation</p>
                    <p className="text-sm text-gray-600">"Book a table for 4 at The Garden Restaurant tonight at 7pm"</p>
                  </div>
                  <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-2xl border border-gray-200 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900 mb-1">🏨 Hotel Booking</p>
                    <p className="text-sm text-gray-600">"Reserve a double room at Downtown Hotel for next Friday"</p>
                  </div>
                  <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-2xl border border-gray-200 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900 mb-1">🚕 Taxi Service</p>
                    <p className="text-sm text-gray-600">"Book a taxi from airport to downtown at 3pm tomorrow"</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-3xl px-5 py-3 ${
                      message.role === 'user'
                        ? 'bg-black text-white'
                        : message.role === 'system'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.role === 'system' && (
                      <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide text-amber-700">
                        System
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Sysist..."
              disabled={isSending}
              className="flex-1 px-5 py-3 border border-gray-300 rounded-3xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed text-[15px] transition-all"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="px-6 py-3 bg-black text-white rounded-3xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
