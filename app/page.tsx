'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Phone, Calendar, Hotel, Car } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartChat = async () => {
    setIsLoading(true);
    try {
      // For demo purposes, create a new chat with a demo user
      // In production, you'd have proper authentication
      const demoUserId = 'demo-user-id';

      // Create or get user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', demoUserId)
        .single();

      if (!existingUser) {
        await supabase.from('users').insert({
          id: demoUserId,
          email: 'demo@sysist.com',
          name: 'Demo User',
        });
      }

      // Create new chat
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
          user_id: demoUserId,
          title: 'New Chat',
        })
        .select()
        .single();

      if (error) throw error;

      // Redirect to chat
      router.push(`/chat?chatId=${newChat.id}&userId=${demoUserId}`);
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 text-gray-900">
            Sysist
          </h1>
          <p className="text-2xl text-gray-600 mb-8">
            Your AI-Powered Booking Assistant
          </p>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Make restaurant reservations, book hotel rooms, and arrange taxi services
            with the power of AI phone calls. Just tell us what you need, and we'll handle the rest.
          </p>

          <button
            onClick={handleStartChat}
            disabled={isLoading}
            className="bg-black text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : 'Start Chatting'}
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="text-green-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Restaurant Reservations</h3>
            <p className="text-gray-600">
              Book tables at your favorite restaurants. We'll call and confirm your reservation.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Hotel className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Hotel Bookings</h3>
            <p className="text-gray-600">
              Reserve hotel rooms with ease. We handle the calls and confirmations for you.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <Car className="text-yellow-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Taxi Services</h3>
            <p className="text-gray-600">
              Book taxis and rides. Tell us where and when, and we'll arrange it.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-center">How It Works</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Tell us what you need</h4>
                <p className="text-gray-600">Describe your booking request in natural language</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">We make the call</h4>
                <p className="text-gray-600">Our AI assistant calls the business on your behalf</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">Get confirmation</h4>
                <p className="text-gray-600">Receive real-time updates and confirmation in the chat</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
