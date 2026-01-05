'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Send,
  Loader2,
  Paperclip,
  FileImage,
  X,
  RotateCcw,
  Wifi,
  WifiOff,
  Sun,
  Moon,
} from 'lucide-react';
import Image from 'next/image';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Assets (make sure Logo.jpg exists in /public)
const BG_IMAGE = '/Logo.jpg';
const BOT_AVATAR_SRC = '/logo.jpg';
const PLACEHOLDER_AVATAR = '/logo-unpad-placeholder.png';

type Message = {
  sender: 'bot' | 'user';
  text: string;
  attachmentUrl?: string;
};

interface WsResponse {
  status: 'ok' | 'error';
  action?: string;
  message?: string;
  deviceToken?: string;
  chatId?: string;
  reply?: string;
  attachment?: string;
  reason?: string;
  remaining?: number;
  messages?: Message[];
}

const initialMessages: Message[] = [
  {
    sender: 'bot',
    text: 'Selamat datang di **Layanan SMUP Unpad**! 👋\n\nAda yang bisa saya bantu terkait informasi kampus? (Saya bisa menampilkan tabel, list, dan format rapi lainnya).',
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [isWsConnected, setIsWsConnected] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  const WS_URL = 'ws://localhost:8765';

  useEffect(() => {
    const storedToken = localStorage.getItem('deviceToken');
    if (storedToken) setDeviceToken(storedToken);

    connectWs();

    return () => {
      ws.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWs = () => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      setIsWsConnected(true);

      const storedToken = localStorage.getItem('deviceToken');
      if (!storedToken) {
        socket.send(JSON.stringify({ action: 'register_device' }));
      } else {
        socket.send(
          JSON.stringify({
            action: 'create_chat',
            deviceToken: storedToken,
          })
        );
      }
    };

    socket.onclose = () => {
      setIsWsConnected(false);
      setTimeout(() => connectWs(), 3000);
    };

    socket.onmessage = async (event) => {
      try {
        const data: WsResponse = JSON.parse(event.data);
        handleWsMessage(data);
      } catch {
        console.error('Non-JSON message received:', event.data);
      }
    };

    ws.current = socket;
  };

  const handleWsMessage = (data: WsResponse) => {
    if (data.status === 'error') {
      setLoading(false);
      if (
        data.message === 'chat_not_bound_to_device' ||
        data.message === 'invalid deviceToken'
      ) {
        localStorage.removeItem('deviceToken');
        ws.current?.send(JSON.stringify({ action: 'register_device' }));
      } else if (data.message === 'rate_limit_exceeded') {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: `⚠️ Terlalu banyak pesan. Mohon tunggu beberapa saat. (Sisa: ${data.remaining})`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: `⚠️ Error: ${data.message || 'Unknown error'}`,
          },
        ]);
      }
      return;
    }

    switch (data.action) {
      case 'register_device':
        if (data.deviceToken) {
          localStorage.setItem('deviceToken', data.deviceToken);
          setDeviceToken(data.deviceToken);
          ws.current?.send(
            JSON.stringify({
              action: 'create_chat',
              deviceToken: data.deviceToken,
            })
          );
        }
        break;

      case 'create_chat':
        if (data.chatId) {
          setChatId(data.chatId);
          const token = localStorage.getItem('deviceToken');
          if (token) {
            ws.current?.send(
              JSON.stringify({
                action: 'get_history',
                chatId: data.chatId,
                deviceToken: token,
              })
            );
          }
        }
        break;

      case 'get_history':
        if (data.messages && Array.isArray(data.messages)) {
          if (data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
        break;

      case 'send_message':
        setLoading(false);
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { sender: 'bot', text: data.reply || '' },
          ]);
        }
        break;

      case 'ready_for_binary':
        if (pendingFileRef.current && ws.current) {
          const file = pendingFileRef.current;
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              ws.current?.send(reader.result);
            }
          };
          reader.readAsArrayBuffer(file);
          pendingFileRef.current = null;
        }
        break;

      case 'send_message_with_attachment':
        setLoading(false);
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            {
              sender: 'bot',
              text: data.reply || '',
            },
          ]);
        }
        break;

      case 'pong':
        break;
    }
  };

  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading || !isWsConnected) return;
    if (!deviceToken || !chatId) {
      alert('Sedang menghubungkan ke sesi chat, coba lagi sesaat lagi...');
      return;
    }

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

    if (currentFile) {
      pendingFileRef.current = currentFile;
      ws.current?.send(
        JSON.stringify({
          action: 'send_message_with_attachment',
          deviceToken: deviceToken,
          chatId: chatId,
          msg: userMsg,
          filename: currentFile.name,
          mimetype: currentFile.type,
          filesize: currentFile.size,
        })
      );
    } else {
      ws.current?.send(
        JSON.stringify({
          action: 'send_message',
          deviceToken: deviceToken,
          chatId: chatId,
          msg: userMsg,
        })
      );
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ action: 'ping', chatId }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [chatId]);

  if (!mounted) return null;

  const isDarkMode = resolvedTheme === 'dark';

  return (
    <div className='min-h-[100dvh] w-full flex items-center justify-center relative'>
      {/* Background image */}
      <div
        className='absolute inset-0 bg-center bg-cover filter brightness-95'
        style={{
          backgroundImage: `url("${BG_IMAGE}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      {/* subtle overlay so content stays readable */}
      <div
        className='absolute inset-0 transition-colors duration-300'
        style={{
          background: isDarkMode
            ? 'rgba(8,8,10,0.6)'
            : 'rgba(255,255,255,0.55)',
        }}
      />

      {/* Chat wrapper */}
      <div className='relative z-10 w-full max-w-6xl mx-4 md:mx-6 lg:mx-8'>
        <div
          className={`w-full h-[85vh] mx-auto flex flex-col overflow-hidden rounded-2xl transition-all duration-300`}
          style={{
            // Glass: semi-transparent + backdrop blur
            background: isDarkMode
              ? 'rgba(6,6,6,0.5)'
              : 'rgba(255,255,255,0.66)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: isDarkMode
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(0,0,0,0.06)',
            boxShadow: isDarkMode
              ? '0 10px 30px rgba(0,0,0,0.6)'
              : '0 10px 30px rgba(16,24,40,0.08)',
          }}
        >
          {/* Header */}
          <div
            className='shrink-0 flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b'
            style={{
              borderColor: isDarkMode
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
            }}
          >
            <div className='flex items-center gap-3 md:gap-4'>
              <div
                className='relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden flex items-center justify-center'
                style={{
                  border: '2px solid rgba(255,199,0,0.95)',
                  background: isDarkMode
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.03)',
                }}
              >
                <Image
                  src={BOT_AVATAR_SRC}
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_AVATAR;
                  }}
                  alt='Unpad Bot'
                  width={48}
                  height={48}
                  className='object-cover w-full h-full'
                />
              </div>

              <div>
                <h1 className='font-bold text-lg md:text-xl tracking-wide transition-colors'>
                  Layanan{' '}
                  <span className='text-[#F9A129] dark:text-unpad-gold'>
                    SMUP UNPAD
                  </span>
                </h1>
                <div className='flex items-center gap-2 mt-1'>
                  {isWsConnected ? (
                    <Wifi className='w-3 h-3 text-green-500 animate-pulse' />
                  ) : (
                    <WifiOff className='w-3 h-3 text-[#F9A129]' />
                  )}
                  <p
                    className='text-[11px] md:text-xs font-medium'
                    style={{ color: isDarkMode ? '#C7CBD0' : '#6b7280' }}
                  >
                    {isWsConnected ? 'Terhubung' : 'Menghubungkan...'}
                  </p>
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <button
                onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
                className='p-2 md:p-2.5 rounded-lg transition-all'
                title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
                style={{
                  background: isDarkMode
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.03)',
                  border: isDarkMode
                    ? '1px solid rgba(255,255,255,0.06)'
                    : '1px solid rgba(0,0,0,0.04)',
                }}
              >
                {isDarkMode ? (
                  <Sun className='w-5 h-5' />
                ) : (
                  <Moon className='w-5 h-5' />
                )}
              </button>

              <button
                onClick={() => {
                  setMessages(initialMessages);
                  if (deviceToken) {
                    ws.current?.send(
                      JSON.stringify({
                        action: 'create_chat',
                        deviceToken: deviceToken,
                      })
                    );
                  }
                }}
                className='p-2 md:p-2.5 rounded-lg transition-all'
                title='Reset Sesi Chat'
                style={{
                  background: isDarkMode
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.02)',
                  border: isDarkMode
                    ? '1px solid rgba(255,255,255,0.04)'
                    : '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <RotateCcw className='w-5 h-5' />
              </button>
            </div>
          </div>

          {/* Chat body */}
          <div className='flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar'>
            <div className='space-y-4 md:space-y-6'>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'bot' && (
                    <div className='hidden md:flex shrink-0 mt-1'>
                      <div
                        className='w-9 h-9 rounded-full overflow-hidden flex items-center justify-center'
                        style={{
                          border: '1px solid rgba(255,199,0,0.95)',
                          background: isDarkMode
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.03)',
                        }}
                      >
                        <Image
                          src={BOT_AVATAR_SRC}
                          onError={(e) => {
                            e.currentTarget.src = PLACEHOLDER_AVATAR;
                          }}
                          alt='Bot'
                          width={36}
                          height={36}
                          className='object-contain'
                        />
                      </div>
                    </div>
                  )}

                  <div
                    className='max-w-[95%] md:max-w-[85%] message-bubble p-4 rounded-2xl shadow-sm transition-all'
                    style={{
                      background:
                        msg.sender === 'user'
                          ? '#9E6600' // FIX: User Bubble Dark Yellow (Konsisten)
                          : isDarkMode
                          ? 'rgba(44,46,49,0.9)' // Bot Dark (Slate Transparan)
                          : '#FEF5D4', // Bot Light (Cream)
                      color:
                        msg.sender === 'user'
                          ? '#FFFFFF' // FIX: User Text Putih agar terbaca di kuning
                          : isDarkMode
                          ? '#f3f4f6' // Bot Text Dark (Putih Tulang)
                          : '#111827', // Bot Text Light (Hitam)
                      border:
                        msg.sender === 'bot'
                          ? isDarkMode
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(0,0,0,0.06)'
                          : undefined,
                    }}
                  >
                    {msg.attachmentUrl && (
                      <div className='mb-3'>
                        <Image
                          src={msg.attachmentUrl}
                          alt='Attachment'
                          width={400}
                          height={260}
                          className='rounded-lg border border-black/10 object-contain max-h-[200px] w-auto bg-white'
                        />
                      </div>
                    )}

                    {msg.sender === 'bot' ? (
                      <div className='prose prose-sm max-w-none text-sm leading-relaxed break-words dark:prose-invert transition-colors duration-300'>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            // 1. REVISI DIVIDER (HR)
                            // Menggunakan inline style untuk memaksa warna dan ketebalan
                            hr: ({ ...props }) => (
                              <hr
                                {...props}
                                style={{
                                  borderColor: isDarkMode
                                    ? '#FFC700'
                                    : '#111111', // Emas (Dark) / Hitam (Light)
                                  borderTopWidth: '2px',
                                  opacity: 1,
                                  margin: '1.5rem 0',
                                  width: '100%',
                                }}
                                className='border-t-2'
                              />
                            ),

                            // 2. REVISI BOLD (STRONG) - SOLUSI FINAL
                            // Kita hapus class text warna dan ganti pakai style={{ color: ... }}
                            // Ini AKAN MENGALAHKAN semua css global/prose.
                            strong: ({ ...props }) => (
                              <strong
                                {...props}
                                style={{
                                  color: isDarkMode ? '#FFC700' : '#111111', // Emas (Dark) / Hitam (Light)
                                  fontWeight: 800,
                                }}
                              />
                            ),

                            // 3. REVISI LIST ANGKA (OL)
                            // Menggunakan !marker:text-... (Important) untuk menimpa prose
                            ol: ({ ...props }) => (
                              <ol
                                {...props}
                                className='list-decimal list-inside ml-0 pl-4 mb-3 space-y-1 font-semibold'
                                style={{
                                  // Fallback manual jika class tailwind tertimpa
                                  color: isDarkMode ? '#EDEDED' : '#111827',
                                }}
                              >
                                {/* Kita manipulasi children agar li mewarisi marker yang benar */}
                                <style jsx>{`
                                  ol > li::marker {
                                    color: ${isDarkMode
                                      ? '#EDEDED'
                                      : '#111111'} !important;
                                    font-weight: bold;
                                  }
                                `}</style>
                                {props.children}
                              </ol>
                            ),

                            // --- Komponen Lainnya ---
                            p: ({ ...props }) => (
                              <p
                                {...props}
                                className='mb-2 last:mb-0 text-sm leading-relaxed'
                              />
                            ),
                            // Link tetap menggunakan style yang sudah oke
                            a: ({ ...props }) => (
                              <a
                                {...props}
                                target='_blank'
                                rel='noopener noreferrer'
                                style={{
                                  color: isDarkMode ? '#FFC700' : '#9E6600', // Gold (Dark) / DarkYellow (Light)
                                  textDecoration: 'underline',
                                }}
                                className='font-bold decoration-dotted underline-offset-4 hover:opacity-80'
                              />
                            ),
                            ul: ({ ...props }) => (
                              <ul
                                {...props}
                                className='list-disc ml-5 mb-3 space-y-1'
                                style={{
                                  color: isDarkMode ? '#EDEDED' : '#111827',
                                }}
                              />
                            ),
                            li: ({ ...props }) => (
                              <li {...props} className='pl-1 font-normal' />
                            ),
                            table: ({ ...props }) => (
                              <div className='overflow-x-auto my-3 rounded-lg border border-[#1E3A8A]/70 shadow-sm'>
                                <table
                                  {...props}
                                  className='min-w-full text-sm'
                                />
                              </div>
                            ),
                            thead: ({ ...props }) => (
                              <thead
                                {...props}
                                className='bg-[#1E3A8A] text-white'
                              />
                            ),
                            tbody: ({ ...props }) => (
                              <tbody
                                {...props}
                                className='divide-y divide-gray-200 dark:divide-gray-700'
                              />
                            ),
                            tr: ({ ...props }) => (
                              <tr
                                {...props}
                                className='hover:bg-[#FFC700]/10 transition-colors'
                              />
                            ),
                            th: ({ ...props }) => (
                              <th
                                {...props}
                                className='px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider'
                              />
                            ),
                            td: ({ ...props }) => (
                              <td
                                {...props}
                                className='px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/0'
                              />
                            ),
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                        {msg.text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div
            className='shrink-0 p-3 md:p-6'
            style={{
              borderTop: isDarkMode
                ? '1px solid rgba(255,255,255,0.04)'
                : '1px solid rgba(0,0,0,0.06)',
              background: 'transparent',
            }}
          >
            {selectedFile && (
              <div
                className='flex items-center space-x-2 mb-3 p-2.5 rounded-lg'
                style={{
                  background: isDarkMode
                    ? 'rgba(44,46,49,0.85)'
                    : 'rgba(254,245,212,0.9)',
                  border: '1px solid rgba(255,199,0,0.95)',
                }}
              >
                <div className='p-1 rounded' style={{ background: '#FFC700' }}>
                  <FileImage className='w-4 h-4 text-black' />
                </div>
                <span
                  className='text-xs font-bold truncate max-w-[200px] md:max-w-[240px]'
                  style={{ color: isDarkMode ? '#fff' : '#111827' }}
                >
                  {selectedFile.name}
                </span>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className='ml-auto text-gray-400 hover:text-rose-600'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            )}

            <div className='flex items-end gap-2 md:gap-3'>
              <button
                onClick={() => fileInputRef.current?.click()}
                className='p-3 mb-2 text-gray-400 hover:text-[#1E3A8A] hover:bg-[#1E3A8A]/10 rounded-xl transition-all'
                title='Lampirkan File'
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

              <div className='flex-1 relative'>
                <textarea
                  rows={1}
                  placeholder={
                    !isWsConnected
                      ? 'Menghubungkan...'
                      : selectedFile
                      ? 'Tambahkan keterangan...'
                      : 'Ketik pertanyaan kamu...'
                  }
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!loading) handleSend();
                    }
                  }}
                  disabled={loading || !isWsConnected}
                  className='w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none'
                  style={{
                    minHeight: '48px',
                    maxHeight: '120px',
                    background: isDarkMode
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.03)',
                    color: isDarkMode ? '#EDEDED' : '#111827',
                    border: isDarkMode
                      ? '1px solid rgba(255,255,255,0.04)'
                      : '1px solid rgba(0,0,0,0.06)',
                  }}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={
                  loading || (!input.trim() && !selectedFile) || !isWsConnected
                }
                className='p-3 mb-2 rounded-xl shadow-md transition-transform'
                style={{ background: '#F9A129', color: '#fff' }}
              >
                {loading ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <Send className='w-5 h-5' />
                )}
              </button>
            </div>

            <p
              className='text-center text-[10px] md:text-[11px] mt-2'
              style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
            >
              {isWsConnected ? (
                <span>
                  Powered by{' '}
                  <span style={{ color: '#FFC700', fontWeight: 700 }}>
                    Unpad
                  </span>{' '}
                  AI System
                </span>
              ) : (
                'Sedang menghubungkan ke server...'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
