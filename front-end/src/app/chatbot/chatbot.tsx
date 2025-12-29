'use client';

import { useState, useRef, useEffect } from 'react';
import { startHeartbeat } from '../../utils/heartbeat';
import {
  Send,
  Bot,
  Loader2,
  Paperclip,
  FileImage,
  X,
  // MessageCircle, // Dihapus karena tidak terpakai
  RotateCcw,
} from 'lucide-react';
// import { useTheme } from 'next-themes'; // Dihapus karena 'theme' tidak terpakai
import Image from 'next/image';

// --- IMPORT WAJIB UNTUK TABEL & FORMATTING ---
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

type Message = {
  sender: 'bot' | 'user';
  text: string;
  attachmentUrl?: string;
};

const initialMessages: Message[] = [
  {
    sender: 'bot',
    text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus? (Saya bisa menampilkan tabel, list, dan format rapi lainnya).',
  },
];

export default function Chatbot() {
  // const { theme } = useTheme(); // Dihapus karena tidak digunakan

  // --- STATE UTAMA ---
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // --- STATE PENDUKUNG ---
  const [isWsConnected, setIsWsConnected] = useState(false);

  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ws = useRef<WebSocket | null>(null);

  // --- KONFIGURASI URL ---
  const HTTP_API_URL = 'http://127.0.0.1:8080';
  const WS_URL = 'ws://localhost:8765';

  // ----------------------------------------------------------------------
  // 1. WEBSOCKET SETUP
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('✅ WS Connected (Stream Only)');
      setIsWsConnected(true);
      socket.send(
        JSON.stringify({ type: 'stream_event', status: 'user_connected' })
      );
    };

    socket.onclose = () => {
      console.log('❌ WS Disconnected');
      setIsWsConnected(false);
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, []);

  // PERBAIKAN: Mengganti 'any' dengan 'Record<string, unknown>'
  const streamActivity = (
    activityType: string,
    payload: Record<string, unknown> = {}
  ) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'stream_activity',
          action: activityType,
          timestamp: new Date().toISOString(),
          ...payload,
        })
      );
    }
  };

  // ----------------------------------------------------------------------
  // 2. HTTP LOGIC
  // ----------------------------------------------------------------------

  const uploadDocumentHttp = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${HTTP_API_URL}/upload-doc`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Gagal upload file ke RAG Engine');
    return await res.json();
  };

  const getRagAnswerHttp = async (userMsg: string) => {
    const res = await fetch(`${HTTP_API_URL}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg }),
    });

    if (!res.ok) throw new Error('Gagal mengambil jawaban dari RAG');
    const data = await res.json();
    return data.Reply;
  };

  // ----------------------------------------------------------------------
  // 3. UI HANDLERS
  // ----------------------------------------------------------------------

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    streamActivity('user_typing', { length: e.target.value.length });
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading) return;

    const userMsg = input;
    const currentFile = selectedFile;

    const newMessage: Message = { sender: 'user', text: userMsg };
    if (currentFile) {
      newMessage.attachmentUrl = URL.createObjectURL(currentFile);
      if (!userMsg) newMessage.text = `Mengirim file: ${currentFile.name}`;
    }
    setMessages((prev) => [...prev, newMessage]);

    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    try {
      streamActivity('user_sent_message', {
        text: userMsg,
        hasAttachment: !!currentFile,
      });

      if (currentFile) {
        await uploadDocumentHttp(currentFile);
      }

      let queryText = userMsg;
      if (!queryText && currentFile) {
        queryText = `Saya mengunggah dokumen ${currentFile.name}, tolong jelaskan ringkasannya.`;
      }

      const botResponseText = await getRagAnswerHttp(queryText);

      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: botResponseText },
      ]);
    } catch (error) {
      console.error('Error flow:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: '⚠️ Maaf, terjadi gangguan koneksi ke server.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Logic ini dikomentari karena 'setShowWAPrompt' tidak didefinisikan (diatas sudah dikomentari)
  /* useEffect(() => {
    if (userMessageCount === 5) setShowWAPrompt(true);
  }, [userMessageCount]);
  */

  useEffect(() => {
    startHeartbeat();
  }, []);

  // --- RENDER UI ---
  return (
    <div className='min-h-[75vh] flex items-start justify-center px-6 py-8'>
      <div className='chat-container w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800'>
        {/* HEADER */}
        <div className='chat-header flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700'>
          <div className='flex items-center gap-4'>
            <div className='logo w-11 h-11 bg-white/95 rounded-full flex items-center justify-center shadow-sm'>
              <Bot className='w-5 h-5 text-blue-600' />
            </div>
            <div>
              <h1 className='text-white font-semibold text-lg tracking-wide'>
                Layanan Unpad
              </h1>
              <div className='flex items-center gap-2 mt-0.5'>
                <span
                  className={`status-dot w-2 h-2 rounded-full ${
                    isWsConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <p className='text-blue-100 text-xs font-medium'>
                  {isWsConnected
                    ? 'Live Stream Active'
                    : 'Connecting Stream...'}
                </p>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <button
              onClick={() => window.location.reload()}
              className='p-2 rounded-md bg-white/10 hover:bg-white/20 transition'
              title='Reset Chat'
            >
              <RotateCcw className='w-5 h-5 text-white/90' />
            </button>
          </div>
        </div>

        {/* CHAT BODY */}
        <div className='chat-body h-[72vh] overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/60 custom-scrollbar'>
          <div className='space-y-5'>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-row flex items-start gap-4 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'bot' && (
                  <div className='avatar shrink-0'>
                    <div className='w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm'>
                      <Bot className='w-4 h-4 text-blue-600' />
                    </div>
                  </div>
                )}

                <div
                  className={`message-bubble max-w-[90%] md:max-w-[85%] ${
                    msg.sender === 'user'
                      ? 'user-bubble text-white bg-blue-600 rounded-br-none p-3 rounded-2xl'
                      : 'bot-bubble bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-none p-5 rounded-2xl shadow-sm w-full'
                  }`}
                >
                  {msg.attachmentUrl && (
                    <div className='mb-3'>
                      <Image
                        src={msg.attachmentUrl}
                        alt='Attachment'
                        width={400}
                        height={260}
                        className='rounded-lg border border-white/10 object-contain'
                      />
                    </div>
                  )}

                  {msg.sender === 'bot' ? (
                    <div className='prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-x-auto'>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          // PERBAIKAN: Hapus 'node' dari parameter karena tidak dipakai
                          table: (props) => (
                            <div className='overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700'>
                              <table
                                className='min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm'
                                {...props}
                              />
                            </div>
                          ),
                          thead: (props) => (
                            <thead
                              className='bg-gray-50 dark:bg-gray-800'
                              {...props}
                            />
                          ),
                          tbody: (props) => (
                            <tbody
                              className='divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900'
                              {...props}
                            />
                          ),
                          tr: (props) => (
                            <tr
                              className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                              {...props}
                            />
                          ),
                          th: (props) => (
                            <th
                              className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700'
                              {...props}
                            />
                          ),
                          td: (props) => (
                            <td
                              className='px-4 py-3 whitespace-normal text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 leading-relaxed'
                              {...props}
                            />
                          ),
                          ul: (props) => (
                            <ul
                              className='list-disc list-outside ml-6 my-3 space-y-1 text-gray-700 dark:text-gray-300'
                              {...props}
                            />
                          ),
                          ol: (props) => (
                            <ol
                              className='list-decimal list-outside ml-6 my-3 space-y-1 text-gray-700 dark:text-gray-300'
                              {...props}
                            />
                          ),
                          li: (props) => <li className='pl-1' {...props} />,
                          strong: (props) => (
                            <strong
                              className='font-bold text-gray-900 dark:text-white'
                              {...props}
                            />
                          ),
                          p: (props) => (
                            <p
                              className='my-2 leading-7 text-gray-800 dark:text-gray-200'
                              {...props}
                            />
                          ),
                          a: (props) => (
                            <a
                              className='text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium'
                              target='_blank'
                              rel='noopener noreferrer'
                              {...props}
                            />
                          ),
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className='whitespace-pre-wrap text-sm'>{msg.text}</p>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className='avatar shrink-0'>
                    <div className='w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white shadow-sm'>
                      You
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {loading && (
            <div className='flex items-center gap-3 mt-3'>
              <div className='bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2'>
                <Loader2 className='w-4 h-4 animate-spin text-blue-600' />
                <span className='text-xs text-gray-500 font-medium'>
                  Sedang memproses...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className='chat-footer p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800'>
          {selectedFile && (
            <div className='flex items-center space-x-2 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800'>
              <FileImage className='w-4 h-4 text-blue-600' />
              <span className='text-xs text-blue-700 dark:text-blue-300 truncate max-w-[240px]'>
                {selectedFile.name}
              </span>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className='ml-auto text-blue-400 hover:text-blue-600'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          )}

          <div className='flex items-center gap-3'>
            <button
              onClick={() => fileInputRef.current?.click()}
              className='p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all'
            >
              <Paperclip className='w-5 h-5' />
            </button>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileSelect}
              className='hidden'
              accept='.pdf,.jpg,.jpeg,.png,.txt'
            />

            <input
              type='text'
              placeholder={
                selectedFile ? 'Tambahkan keterangan...' : 'Ketik pertanyaan...'
              }
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
              disabled={loading}
              className='flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 text-sm'
            />

            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !selectedFile)}
              className='p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:bg-gray-300 shadow-md'
            >
              {loading ? (
                <Loader2 className='w-5 h-5 animate-spin' />
              ) : (
                <Send className='w-5 h-5' />
              )}
            </button>
          </div>
          <p className='text-center text-[11px] text-gray-400 mt-2'>
            Bot AI dapat melakukan kesalahan.
          </p>
        </div>
      </div>
    </div>
  );
}
