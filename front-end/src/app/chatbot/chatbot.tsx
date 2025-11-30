'use client';

import { useState, useRef, useEffect } from 'react';
import { startHeartbeat } from "../../utils/heartbeat";
import ReCAPTCHA from 'react-google-recaptcha';
import {
  Send,
  Bot,
  Loader2,
  Paperclip,
  FileImage,
  X,
  MessageCircle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';

// Import Library Markdown
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  sender: 'bot' | 'user';
  text: string;
  attachmentUrl?: string;
};

const initialMessages: Message[] = [
  {
    sender: 'bot',
    text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus?',
  },
];

export default function Chatbot() {
  const { theme } = useTheme();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // --- STATE UNTUK FITUR WHATSAPP ---
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [showWAPrompt, setShowWAPrompt] = useState(false);
  // ---------------------------------------

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userConsent, setUserConsent] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);

  // --- 1. NEW: useEffect untuk memantau userMessageCount ---
  // Ini menyelesaikan error eslint karena 'userMessageCount' sekarang digunakan di sini
  useEffect(() => {
    if (userMessageCount === 5) {
      setShowWAPrompt(true);
    }
  }, [userMessageCount]);

  // --- LOGIKA SESI DAN CAPTCHA ---
  const createNewChatSession = async (captchaToken: string) => {
    const consentValue = userConsent || 'false';
    try {
      const res = await fetch('http://localhost:5000/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          captchaToken: captchaToken,
          consent: consentValue,
        }),
      });
      if (res.ok) {
        console.log('Sesi chat berhasil dibuat.');
        setIsCaptchaVerified(true);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal membuat sesi chat');
      }
    } catch (error: unknown) {
      console.error('Error saat membuat sesi chat:', error);
      let errorMessage = 'Gagal membuat sesi chat';
      if (error instanceof Error) errorMessage = error.message;
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ Gagal verifikasi: ${errorMessage}. Silakan muat ulang halaman.`,
        },
      ]);
      setIsCaptchaVerified(false);
    }
  };

  useEffect(() => {
    setUserConsent(null);
    
    setShowConsentModal(true);
  }, []);

  const handleConsent = (hasAgreed: boolean) => {
    const consentValue = hasAgreed ? 'true' : 'false';
    setUserConsent(consentValue);
    setShowConsentModal(false);
    if (!hasAgreed) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Baik, history chat untuk sesi ini tidak akan disimpan.',
        },
      ]);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    if (token) createNewChatSession(token);
    else setIsCaptchaVerified(false);
  };

  // --- LOGIKA FILE ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- LOGIKA PENGIRIMAN PESAN ---
  const sendMessageToServer = async (
    userMsg: string,
    file: File | null,
    canSaveHistory: boolean
  ) => {
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('msg', userMsg);
      formData.append('saveHistory', String(canSaveHistory));

      if (file) {
        formData.append('attachment', file);
      }

      const res = await fetch('http://localhost:5000/api/send-msg', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.refresh) window.location.reload();
        throw new Error(errorData.message || 'Server error');
      }
      const data = await res.json();
      return data.reply || 'Maaf, saya tidak dapat menemukan jawaban.';
    } catch (error) {
      console.error('Error fetching from Node.js backend:', error);
      if (error instanceof Error) return `⚠️ Gagal terhubung: ${error.message}`;
      return '⚠️ Gagal terhubung ke server.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (
      (!input.trim() && !selectedFile) ||
      showConsentModal ||
      !isCaptchaVerified
    )
      return;

    const userMsg = input;
    const currentFile = selectedFile;

    const newMessage: Message = { sender: 'user', text: userMsg };

    if (currentFile) {
      newMessage.attachmentUrl = URL.createObjectURL(currentFile);
    }

    setMessages((prev) => [...prev, newMessage]);

    // Reset Input
    setInput('');
    clearFile();

    const canSaveHistory = userConsent === 'true';
    const botResponse = await sendMessageToServer(
      userMsg,
      currentFile,
      canSaveHistory
    );

    setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);

    // --- 2. UPDATE LOGIC: Cukup increment, pengecekan pindah ke useEffect ---
    setUserMessageCount((prev) => prev + 1);
    // ------------------------------------------------------------------------
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    startHeartbeat();
  }, []);
  return (
    <section className='min-h-screen flex items-center justify-center bg-gray-100 dark:bg-black p-4 font-sans relative'>
      {/* Modal Persetujuan */}
      {showConsentModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
              Persetujuan History Chat
            </h3>
            <p className='text-sm text-gray-600 dark:text-gray-400 mb-6'>
              Apakah Anda mengizinkan kami menyimpan history chat?
            </p>
            <div className='flex justify-center gap-4'>
              <button
                onClick={() => handleConsent(false)}
                className='px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium transition-colors'
              >
                Tidak Setuju
              </button>
              <button
                onClick={() => handleConsent(true)}
                className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors'
              >
                Setuju
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col min-h-[700px] relative'>
        {/* Header */}
        <header className='flex items-center gap-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl'>
          <div className='p-2 bg-blue-100 rounded-full'>
            <Bot className='w-6 h-6 text-blue-600' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-gray-900 dark:text-gray-100 tracking-wide'>
              Asisten Akademik
            </h1>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 rounded-full bg-green-500'></div>
              <p className='text-xs text-gray-600 dark:text-gray-400'>Online</p>
            </div>
          </div>
        </header>

        {/* Area Pesan */}
        <div className='flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-4 bg-gray-50 dark:bg-gray-800 relative'>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-5 py-3 rounded-2xl text-base shadow-sm flex flex-col ${
                msg.sender === 'user'
                  ? 'self-end bg-blue-500 text-white rounded-br-lg'
                  : 'self-start bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-lg'
              }`}
            >
              {msg.attachmentUrl && (
                <div className='mb-2 mt-1 relative w-full h-auto'>
                  <Image
                    src={msg.attachmentUrl}
                    alt='attachment'
                    width={0}
                    height={0}
                    sizes='100vw'
                    className='w-full h-auto rounded-lg border border-white/20'
                    unoptimized
                  />
                </div>
              )}

              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: (props) => (
                    <p className='mb-2 last:mb-0 leading-relaxed' {...props} />
                  ),
                  ul: (props) => (
                    <ul
                      className='list-disc list-outside ml-4 mb-2'
                      {...props}
                    />
                  ),
                  ol: (props) => (
                    <ol
                      className='list-decimal list-outside ml-4 mb-2'
                      {...props}
                    />
                  ),
                  li: (props) => <li className='pl-1' {...props} />,
                  strong: (props) => (
                    <strong className='font-bold' {...props} />
                  ),
                  a: (props) => (
                    <a
                      className='text-blue-200 hover:text-white underline'
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
          ))}

          {loading && (
            <div className='self-start flex items-center gap-2'>
              <div className='p-2 bg-gray-200 dark:bg-gray-700 rounded-full'>
                <Bot className='w-5 h-5 text-gray-700 dark:text-gray-100' />
              </div>
              <div className='bg-gray-200 dark:bg-gray-700 px-5 py-3 rounded-2xl flex items-center gap-1.5'>
                <span className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-75'></span>
                <span className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200'></span>
                <span className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-300'></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Captcha Area */}
        {!showConsentModal && !isCaptchaVerified && (
          <div className='flex flex-col items-center justify-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'>
            {recaptchaSiteKey && (
              <ReCAPTCHA
                sitekey={recaptchaSiteKey}
                onChange={handleCaptchaChange}
                theme={theme === 'dark' ? 'dark' : 'light'}
              />
            )}
          </div>
        )}

        {/* --- FITUR NOTIFIKASI WHATSAPP (Floating Bubble) --- */}
        {showWAPrompt && (
          <div className='absolute bottom-[90px] left-4 right-4 z-20 animate-in slide-in-from-bottom-5 fade-in duration-500'>
            <div className='bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-600 rounded-xl shadow-xl p-4 flex flex-col sm:flex-row items-center gap-4 relative'>
              {/* Tombol Close Kecil */}
              <button
                onClick={() => setShowWAPrompt(false)}
                className='absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              >
                <X className='w-4 h-4' />
              </button>

              <div className='p-3 bg-green-100 dark:bg-green-900/30 rounded-full'>
                <MessageCircle className='w-6 h-6 text-green-600 dark:text-green-400' />
              </div>

              <div className='flex-1 text-center sm:text-left'>
                <h4 className='font-semibold text-gray-900 dark:text-white text-sm mb-1'>
                  Apakah jawaban chatbot membantu?
                </h4>
                <p className='text-xs text-gray-600 dark:text-gray-300'>
                  Jika Anda masih memiliki pertanyaan spesifik atau kendala
                  lain, Anda dapat menghubungi Admin langsung.
                </p>
              </div>

              <a
                // Ganti nomor WA di sini
                href='https://api.whatsapp.com/send/?phone=%2B6281122301410&text&type=phone_number&app_absent=0'
                target='_blank'
                rel='noopener noreferrer'
                className='whitespace-nowrap px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-md'
              >
                <MessageCircle className='w-4 h-4' />
                Chat Admin via WA
              </a>
            </div>
          </div>
        )}
        {/* ---------------------------------------------------- */}

        {/* Area Input & File Upload */}
        <div className='flex flex-col border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-b-2xl relative z-30'>
          {selectedFile && (
            <div className='px-4 pt-3 flex items-center gap-2'>
              <div className='bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg flex items-center gap-2 border border-blue-100 dark:border-blue-800'>
                <FileImage className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                <span className='text-xs text-blue-700 dark:text-blue-300 max-w-[200px] truncate'>
                  {selectedFile.name}
                </span>
                <button
                  onClick={clearFile}
                  className='ml-2 text-gray-500 hover:text-red-500'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            </div>
          )}

          <div className='flex items-center gap-3 px-4 py-3'>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileSelect}
              className='hidden'
              accept='image/*'
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || showConsentModal || !isCaptchaVerified}
              className='p-3 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50'
              title='Upload Gambar'
            >
              <Paperclip className='w-5 h-5' />
            </button>

            <input
              type='text'
              placeholder={
                selectedFile
                  ? 'Tambahkan keterangan...'
                  : 'Ketik pertanyaan Anda...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
              disabled={loading || showConsentModal || !isCaptchaVerified}
              className='flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 transition-all duration-300 disabled:opacity-50'
            />

            <button
              onClick={handleSend}
              disabled={
                loading ||
                (!input.trim() && !selectedFile) ||
                showConsentModal ||
                !isCaptchaVerified
              }
              className='p-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {loading ? (
                <Loader2 className='w-5 h-5 animate-spin' />
              ) : (
                <Send className='w-5 h-5' />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
