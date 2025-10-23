'use client';

import { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="relative flex items-end gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Sysist..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 pr-12 text-[15px] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed max-h-48 shadow-sm"
            style={{
              minHeight: '52px',
              maxHeight: '200px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className="absolute right-3 bottom-3 p-2 rounded-lg bg-black text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-800 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Enter</kbd> to send,
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono ml-1">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
