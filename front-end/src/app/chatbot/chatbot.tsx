'use client';
import { useState, useRef, useEffect } from 'react';

const initialMessages = [{ sender: 'bot', text: 'Hi! How can I help you today?' }];

export default function Chatbot() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 🔹 Kirim pesan ke backend FastAPI
  const sendToBackend = async (userMsg: string) => {
    try {
      setLoading(true);
      const res = await fetch('http://127.0.0.1:8080/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
      });

      if (!res.ok) throw new Error('Server error');

      const data = await res.json();
      return data.answer || 'No response from backend.';
    } catch (error) {
      console.error('Error fetching from FastAPI:', error);
      return '⚠️ Failed to reach backend. Please check if FastAPI is running.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');

    setMessages((msgs) => [...msgs, { sender: 'user', text: userMsg }]);

    const botResponse = await sendToBackend(userMsg);
    setMessages((msgs) => [...msgs, { sender: 'bot', text: botResponse }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className="min-h-screen flex items-center justify-center bg-neutral-900 p-4">
      <div className="w-full max-w-4xl bg-neutral-800 border border-neutral-700 rounded-2xl shadow-xl flex flex-col min-h-[600px]">
        {/* Header */}
        <header className="bg-neutral-900 border-b border-neutral-700 px-6 py-4">
          <h1 className="text-lg font-bold text-gray-100 tracking-wide">Chatbot</h1>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[80%] px-4 py-2 rounded-2xl text-base break-words ${
                msg.sender === 'user'
                  ? 'self-end bg-gradient-to-r from-neutral-700 to-neutral-400 text-gray-100 rounded-br-sm'
                  : 'self-start bg-gradient-to-r from-neutral-700 to-neutral-600 text-gray-200 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            <div className="self-start bg-neutral-700 text-gray-300 px-4 py-2 rounded-2xl animate-pulse">
              Typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 py-3">
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-neutral-800 text-gray-100 rounded-xl border border-neutral-700 focus:border-gray-300 focus:outline-none px-4 py-2"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-gray-300 hover:bg-white text-neutral-900 font-semibold px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </section>
  );
}
