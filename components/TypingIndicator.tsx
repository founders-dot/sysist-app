import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="py-6 px-4">
      <div className="max-w-3xl w-full mx-auto">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white">
            <Bot size={18} />
          </div>

          {/* Typing Animation Bubble */}
          <div className="bg-[#f7f7f8] rounded-2xl px-5 py-3 flex items-center">
            <div className="flex space-x-1.5">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
