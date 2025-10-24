
import React from 'react';
import type { ChatMessage } from '../types';


interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {isUser ? (
        <div className="order-2 max-w-lg p-4 rounded-2xl rounded-br-none bg-purple-600 text-white">
          <p className="text-sm">{message.text}</p>
        </div>
      ) : (
        <div className="max-w-lg p-4 rounded-2xl rounded-bl-none bg-gray-700 text-gray-200">
          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        </div>
      )}
    </div>
  );
};

export default ChatMessageComponent;
