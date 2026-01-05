'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  Loader2,
  Paperclip,
  FileImage,
  X,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
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

// Tipe respons dari Server Python
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
  messages?: Message[]; // Tambahan untuk memuat history
}

const initialMessages: Message[] = [
  {
    sender: 'bot',
    text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus? (Saya bisa menampilkan tabel, list, dan format rapi lainnya).',
  },
];

export default function Chatbot() {
  // --- STATE UTAMA ---
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // --- STATE KONEKSI & SESI ---
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ws = useRef<WebSocket | null>(null);

  // Ref untuk menyimpan file sementara saat menunggu sinyal binary dari server
  const pendingFileRef = useRef<File | null>(null);

  // --- KONFIGURASI URL ---
  const WS_URL = 'ws://localhost:8765';

  // ----------------------------------------------------------------------
  // 1. WEBSOCKET SETUP & HANDSHAKE
  // ----------------------------------------------------------------------
  useEffect(() => {
    // Ambil token dari localStorage jika ada
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
      console.log('✅ WS Connected');
      setIsWsConnected(true);

      // LOGIKA HANDSHAKE AWAL
      const storedToken = localStorage.getItem('deviceToken');
      if (!storedToken) {
        // 1. Jika belum punya token, register device
        socket.send(JSON.stringify({ action: 'register_device' }));
      } else {
        // 2. Jika punya token, langsung buat/resume chat
        socket.send(
          JSON.stringify({
            action: 'create_chat',
            deviceToken: storedToken,
          })
        );
      }
    };

    socket.onclose = () => {
      console.log('❌ WS Disconnected');
      setIsWsConnected(false);
      // Reconnect otomatis setelah 3 detik
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

  // ----------------------------------------------------------------------
  // 2. LOGIKA PENANGANAN PESAN MASUK (ROUTER)
  // ----------------------------------------------------------------------
  const handleWsMessage = (data: WsResponse) => {
    console.log('[WS RECV]', data);

    if (data.status === 'error') {
      setLoading(false);
      // Handle error spesifik
      if (
        data.message === 'chat_not_bound_to_device' ||
        data.message === 'invalid deviceToken'
      ) {
        // Reset token dan register ulang
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
          // Setelah register, langsung create chat
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
          console.log('Chat Session Active:', data.chatId);

          // === FIX: REQUEST HISTORY SETELAH CHAT AKTIF ===
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
        // === FIX: LOAD HISTORY ===
        if (data.messages && Array.isArray(data.messages)) {
          // Jika ada history, kita gunakan (gabung dengan welcome message jika kosong)
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
        // Server siap menerima file binary
        if (pendingFileRef.current && ws.current) {
          const file = pendingFileRef.current;
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              ws.current?.send(reader.result); // KIRIM BINARY
            }
          };
          reader.readAsArrayBuffer(file);
          pendingFileRef.current = null; // Clear pending
        }
        break;

      case 'send_message_with_attachment':
        setLoading(false);
        // Tampilkan balasan RAG
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
        // Keep-alive response
        break;
    }
  };

  // ----------------------------------------------------------------------
  // 3. UI HANDLERS (SEND MESSAGE)
  // ----------------------------------------------------------------------

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // 1. Tampilkan Chat User di UI
    const newMessage: Message = { sender: 'user', text: userMsg };
    if (currentFile) {
      newMessage.attachmentUrl = URL.createObjectURL(currentFile);
      if (!userMsg) newMessage.text = `Mengirim file: ${currentFile.name}`;
    }
    setMessages((prev) => [...prev, newMessage]);

    // Reset UI State
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    // 2. Kirim ke WebSocket
    if (currentFile) {
      // FLOW ATTACHMENT:
      // a. Simpan file di ref sementara
      pendingFileRef.current = currentFile;

      // b. Kirim header JSON
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
      // c. Tunggu respons 'ready_for_binary' di handleWsMessage untuk mengirim body file
    } else {
      // FLOW TEXT ONLY
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

  // Auto-scroll ke bawah
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep-alive ping setiap 30 detik
  useEffect(() => {
    const interval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ action: 'ping', chatId }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [chatId]);

  // --- RENDER UI ---
  return (
    <div className='flex flex-col items-center justify-center w-full h-[100dvh] md:min-h-[95vh] md:h-auto md:py-8 md:px-6 bg-gray-50 dark:bg-gray-950'>
      {/* Container Utama */}
      <div className='w-full h-full md:h-[80vh] md:max-w-6xl mx-auto bg-white dark:bg-gray-900 md:rounded-2xl md:shadow-2xl md:border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden'>
        {/* HEADER */}
        <div className='shrink-0 flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-gradient-to-r from-blue-600 to-blue-700'>
          <div className='flex items-center gap-3 md:gap-4'>
            <div className='logo w-9 h-9 md:w-11 md:h-11 bg-white/95 rounded-full flex items-center justify-center shadow-sm'>
              <Bot className='w-4 h-4 md:w-5 md:h-5 text-blue-600' />
            </div>
            <div>
              <h1 className='text-white font-semibold text-base md:text-lg tracking-wide'>
                Layanan Unpad
              </h1>
              <div className='flex items-center gap-2 mt-0.5'>
                {isWsConnected ? (
                  <Wifi className='w-3 h-3 text-green-300' />
                ) : (
                  <WifiOff className='w-3 h-3 text-red-300' />
                )}
                <p className='text-blue-100 text-[10px] md:text-xs font-medium'>
                  {isWsConnected
                    ? 'Terhubung'
                    : 'Terputus (Mencoba reconnect...)'}
                </p>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-2 md:gap-3'>
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
              className='p-1.5 md:p-2 rounded-md bg-white/10 hover:bg-white/20 transition'
              title='Reset Chat'
            >
              <RotateCcw className='w-4 h-4 md:w-5 md:h-5 text-white/90' />
            </button>
          </div>
        </div>

        {/* CHAT BODY */}
        <div className='flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900/60 custom-scrollbar'>
          <div className='space-y-4 md:space-y-5'>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-row flex items-start gap-2 md:gap-4 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'bot' && (
                  <div className='avatar shrink-0 hidden md:block'>
                    <div className='w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm'>
                      <Bot className='w-4 h-4 text-blue-600' />
                    </div>
                  </div>
                )}

                <div
                  className={`message-bubble max-w-[95%] md:max-w-[85%] ${
                    msg.sender === 'user'
                      ? 'user-bubble text-white bg-blue-600 rounded-br-none p-3 md:p-4 rounded-2xl'
                      : 'bot-bubble bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-none p-4 md:p-5 rounded-2xl shadow-sm w-full'
                  }`}
                >
                  {/* Tampilan Gambar/Attachment di chat bubble */}
                  {msg.attachmentUrl && (
                    <div className='mb-3'>
                      <Image
                        src={msg.attachmentUrl}
                        alt='Attachment'
                        width={400}
                        height={260}
                        className='rounded-lg border border-white/10 object-contain max-h-[200px] w-auto'
                      />
                    </div>
                  )}

                  {msg.sender === 'bot' ? (
                    <div className='prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words'>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          // 1. Handling Paragraf
                          p: ({ ...props }) => (
                            <p {...props} className='mb-2 last:mb-0' />
                          ),

                          // 2. Handling Link (HTML <a>)
                          a: ({ ...props }) => (
                            <a
                              {...props}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-blue-600 dark:text-blue-400 hover:underline font-medium break-all'
                            />
                          ),

                          // 3. Handling Ordered List (Numbering <ol>)
                          ol: ({ ...props }) => (
                            // Use list-inside so markers appear inside the content box (prevents clipping of 2-digit markers)
                            <ol
                              {...props}
                              className='list-decimal list-inside ml-0 pl-4 mb-4 space-y-1'
                            />
                          ),

                          // 4. Handling Unordered List (Bullet <ul>)
                          ul: ({ ...props }) => (
                            <ul
                              {...props}
                              className='list-disc ml-5 mb-4 space-y-1'
                            />
                          ),

                          // 5. Handling List Item (<li>)
                          li: ({ ...props }) => (
                            // remove extra left padding on items to keep marker aligned
                            <li {...props} className='pl-0' />
                          ),

                          // 6. Handling Table (HTML <table>)
                          table: ({ ...props }) => (
                            <div className='overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700'>
                              <table
                                {...props}
                                className='min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm'
                              />
                            </div>
                          ),
                          thead: ({ ...props }) => (
                            <thead
                              {...props}
                              className='bg-gray-50 dark:bg-gray-800'
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
                              className='hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
                            />
                          ),
                          th: ({ ...props }) => (
                            <th
                              {...props}
                              className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-700'
                            />
                          ),
                          td: ({ ...props }) => (
                            <td
                              {...props}
                              className='px-4 py-3 whitespace-normal text-gray-700 dark:text-gray-300'
                            />
                          ),

                          // 7. Handling Bold (<strong>)
                          strong: ({ ...props }) => (
                            <strong
                              {...props}
                              className='font-bold text-gray-900 dark:text-white'
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

          {loading && (
            <div className='flex items-center gap-3 mt-3'>
              <div className='bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2'>
                <Loader2 className='w-4 h-4 animate-spin text-blue-600' />
                <span className='text-xs text-gray-500 font-medium'>
                  Sedang mengetik...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className='shrink-0 p-3 md:p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800'>
          {selectedFile && (
            <div className='flex items-center space-x-2 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800'>
              <FileImage className='w-4 h-4 text-blue-600' />
              <span className='text-xs text-blue-700 dark:text-blue-300 truncate max-w-[200px] md:max-w-[240px]'>
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

          <div className='flex items-center gap-2 md:gap-3'>
            <button
              onClick={() => fileInputRef.current?.click()}
              className='p-2.5 md:p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all'
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
                !isWsConnected
                  ? 'Menghubungkan...'
                  : selectedFile
                  ? 'Tambahkan keterangan...'
                  : 'Ketik pertanyaan...'
              }
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
              disabled={loading || !isWsConnected}
              className='flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-2.5 md:py-3 text-sm disabled:opacity-50'
            />

            <button
              onClick={handleSend}
              disabled={
                loading || (!input.trim() && !selectedFile) || !isWsConnected
              }
              className='p-2.5 md:p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:bg-gray-300 shadow-md shrink-0'
            >
              {loading ? (
                <Loader2 className='w-5 h-5 animate-spin' />
              ) : (
                <Send className='w-5 h-5' />
              )}
            </button>
          </div>
          <p className='text-center text-[10px] md:text-[11px] text-gray-400 mt-2'>
            {isWsConnected
              ? 'Bot AI Layanan Unpad'
              : 'Sedang menghubungkan ke server...'}
          </p>
        </div>
      </div>
    </div>
  );
}