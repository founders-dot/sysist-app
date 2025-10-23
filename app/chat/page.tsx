'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot } from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import TypingIndicator from '@/components/TypingIndicator';
import { supabase, subscribeToMessages } from '@/lib/supabase';
import { Message } from '@/types';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chatId');
  const userId = searchParams.get('userId') || 'demo-user-id'; // Replace with actual auth

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from Supabase
  useEffect(() => {
    if (!chatId) return;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

    // Subscribe to real-time updates
    const channel = subscribeToMessages(chatId, (payload) => {
      const newMessage = payload.new as Message;
      setMessages((prev) => [...prev, newMessage]);
      setIsTyping(false);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (content: string) => {
    if (!chatId || !userId) return;

    setIsTyping(true);

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          userId,
          message: content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Message will be added via real-time subscription
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      alert('Failed to send message. Please try again.');
    }
  };

  if (!chatId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Chat Selected</h2>
          <p className="text-gray-600">Please select or create a chat to start.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-800">Sysist</h1>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl px-6">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot size={32} className="text-white" />
                </div>
                <h2 className="text-3xl font-semibold mb-3 text-gray-800">Welcome to Sysist</h2>
                <p className="text-gray-600 text-lg mb-8">
                  Your AI-powered booking assistant. I can help you make restaurant reservations,
                  book hotel rooms, and arrange taxi services through phone calls.
                </p>
              </div>

              <div className="grid gap-3 text-left max-w-md mx-auto">
                <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-xl border border-gray-200 cursor-pointer">
                  <p className="text-sm font-medium text-gray-700 mb-1">Restaurant Reservation</p>
                  <p className="text-sm text-gray-600">"Book a table for 4 at The Garden Restaurant tonight at 7pm"</p>
                </div>
                <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-xl border border-gray-200 cursor-pointer">
                  <p className="text-sm font-medium text-gray-700 mb-1">Hotel Booking</p>
                  <p className="text-sm text-gray-600">"Reserve a double room at Downtown Hotel for next Friday"</p>
                </div>
                <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-xl border border-gray-200 cursor-pointer">
                  <p className="text-sm font-medium text-gray-700 mb-1">Taxi Service</p>
                  <p className="text-sm text-gray-600">"Book a taxi from airport to downtown at 3pm tomorrow"</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <ChatInput onSend={handleSendMessage} disabled={isTyping} />
    </div>
  );
}
