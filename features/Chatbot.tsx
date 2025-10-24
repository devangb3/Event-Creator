
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import type { ChatMessage } from '../types';
import ChatMessageComponent from '../components/ChatMessage';
import Spinner from '../components/Spinner';

const Chatbot: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initChat = () => {
            if (!process.env.API_KEY) {
                setError("API_KEY environment variable is not set");
                return;
            }
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                chatRef.current = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                         systemInstruction: 'You are a helpful and friendly AI assistant. Keep your responses concise and informative.',
                    }
                });
            } catch (err) {
                 setError(err instanceof Error ? err.message : 'Failed to initialize chat.');
            }
        };
        initChat();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || !chatRef.current) return;

        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setError(null);

        try {
            const stream = await chatRef.current.sendMessageStream({ message: input });
            
            let modelResponse = '';
            const modelMessageId = (Date.now() + 1).toString();
            
            // Initial empty message
            setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '...' }]);

            for await (const chunk of stream) {
                modelResponse += chunk.text;
                setMessages(prev => prev.map(msg => 
                    msg.id === modelMessageId ? { ...msg, text: modelResponse } : msg
                ));
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: 'Sorry, something went wrong.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    }, [input]);
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !loading) {
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-4 text-center">AI Chatbot</h2>
            <p className="text-center text-gray-400 mb-6">Ask me anything! I'm here to help.</p>
            
            <div className="flex-grow overflow-y-auto pr-2">
                {messages.map(msg => (
                    <ChatMessageComponent key={msg.id} message={msg} />
                ))}
                 {loading && messages[messages.length-1]?.role !== 'model' && (
                     <div className="flex justify-start">
                         <div className="p-4 rounded-lg bg-gray-700">
                             <Spinner />
                         </div>
                     </div>
                 )}
                <div ref={messagesEndRef} />
            </div>

            {error && <div className="my-2 p-2 bg-red-900/50 text-red-300 text-xs rounded">{error}</div>}

            <div className="mt-6 flex items-center gap-4">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-full focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    disabled={loading}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="bg-purple-600 text-white p-3 rounded-full hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default Chatbot;
