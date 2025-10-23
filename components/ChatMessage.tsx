import { Message } from '@/types';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center py-4 px-4">
        <div className="max-w-3xl w-full">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-4">
      <div className="max-w-3xl w-full mx-auto">
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isUser
                ? 'bg-[#343541] text-white'
                : 'bg-green-600 text-white'
            }`}
          >
            {isUser ? (
              <User size={18} />
            ) : (
              <Bot size={18} />
            )}
          </div>

          {/* Message Bubble */}
          <div
            className={`flex-1 max-w-[80%] rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-[#343541] text-white'
                : 'bg-[#f7f7f8] text-gray-800'
            }`}
          >
            <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
              {message.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
