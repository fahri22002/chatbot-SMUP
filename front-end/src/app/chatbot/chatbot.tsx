'use client';
import { useState, useRef, useEffect } from 'react';
// Perubahan: Mengimpor ikon dari library 'lucide-react'
import { Send, Bot } from 'lucide-react';

const initialMessages = [
  { sender: 'bot', text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus?' },
];

export default function Chatbot() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
      return data.answer || 'Maaf, saya tidak dapat menemukan jawaban.';
    } catch (error) {
      console.error('Error fetching from FastAPI:', error);
      return '⚠️ Gagal terhubung ke server. Pastikan server FastAPI Anda berjalan.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');

    const botResponse = await sendToBackend(userMsg);
    setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    // Perubahan: Latar belakang sedikit lebih gelap untuk kontras
    <section className="min-h-screen flex items-center justify-center bg-gray-900 p-4 font-sans">
      <div className="w-full max-w-4xl bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col min-h-[700px]">
        {/* Perubahan: Header dibuat lebih menarik dengan ikon dan status */}
        <header className="flex items-center gap-4 bg-neutral-900/70 backdrop-blur-sm border-b border-neutral-700 px-6 py-4 rounded-t-2xl">
          <div className="p-2 bg-blue-500/20 rounded-full">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-100 tracking-wide">Asisten Akademik</h1>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-xs text-green-400">Online</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-5 py-3 rounded-2xl text-base break-words shadow-md ${
                msg.sender === 'user'
                  // Perubahan: Menggunakan warna aksen biru untuk pesan pengguna
                  ? 'self-end bg-blue-600 text-white rounded-br-lg'
                  : 'self-start bg-neutral-700 text-gray-200 rounded-bl-lg'
              }`}
            >
              {msg.text}
            </div>
          ))}
          {/* Perubahan: Indikator loading yang lebih menarik */}
          {loading && (
            <div className="self-start flex items-center gap-2">
              <div className="p-2 bg-neutral-700 rounded-full">
                <Bot className="w-5 h-5 text-gray-300" />
              </div>
              <div className="bg-neutral-700 text-gray-300 px-5 py-3 rounded-2xl flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Perubahan: Input area dengan desain lebih modern */}
        <div className="flex items-center gap-3 border-t border-neutral-700 bg-neutral-900/50 backdrop-blur-sm px-4 py-3 rounded-b-2xl">
          <input
            type="text"
            placeholder="Ketik pertanyaan Anda di sini..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            className="flex-1 bg-neutral-800 text-gray-100 rounded-xl border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 transition-all duration-300"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}