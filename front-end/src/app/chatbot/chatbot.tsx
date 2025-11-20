'use client';

import { useState, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Send, Bot, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const initialMessages = [
  {
    sender: 'bot',
    text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus?',
  },
];

export default function Chatbot() {
  const { theme } = useTheme();

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userConsent, setUserConsent] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);

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
        console.log('Sesi chat berhasil dibuat dan persetujuan dikirim.');
        setIsCaptchaVerified(true);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal membuat sesi chat');
      }
    } catch (error: unknown) {
      console.error('Error saat membuat sesi chat:', error);
      let errorMessage = 'Gagal membuat sesi chat';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
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
      console.warn('Pengguna tidak setuju. History chat tidak akan disimpan.');
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
    if (token) {
      console.log('CAPTCHA token diterima, mengirim ke backend...', token);
      createNewChatSession(token);
    } else {
      console.log('CAPTCHA challenge failed or expired.');
      setIsCaptchaVerified(false);
    }
  };

  const sendMessageToServer = async (
    userMsg: string,
    canSaveHistory: boolean
  ) => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/send-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          msg: userMsg,
          saveHistory: canSaveHistory,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.refresh) {
          window.location.reload();
        }
        throw new Error(errorData.message || 'Server error');
      }
      const data = await res.json();
      return data.reply || 'Maaf, saya tidak dapat menemukan jawaban.';
    } catch (error) {
      console.error('Error fetching from Node.js backend:', error);
      if (error instanceof Error) {
        return `⚠️ Gagal terhubung: ${error.message}`;
      }
      return '⚠️ Gagal terhubung ke server. Pastikan semua server berjalan.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || showConsentModal || !isCaptchaVerified) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    const canSaveHistory = userConsent === 'true';
    const botResponse = await sendMessageToServer(userMsg, canSaveHistory);
    setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className='min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-4 font-sans relative'>
      {/* Modal Persetujuan */}
      {showConsentModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
              Persetujuan History Chat
            </h3>
            <p className='text-sm text-gray-600 dark:text-gray-400 mb-6'>
              Apakah Anda mengizinkan kami menyimpan history chat untuk
              peningkatan kualitas layanan?
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

      {/* Chat Container */}
      <div className='w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col min-h-[700px]'>
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

        {/* Messages Area */}
        <div className='flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-4 bg-gray-50 dark:bg-gray-800'>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-5 py-3 rounded-2xl text-base break-words shadow-sm prose dark:prose-invert prose-sm sm:prose-base leading-relaxed [&>p]:mb-3 [&>ul]:mb-3 [&>ol]:mb-3 [&>h1]:mb-2 [&>h2]:mb-2 [&>h3]:mb-1 ${
                msg.sender === 'user'
                  ? 'self-end bg-blue-500 text-white rounded-br-lg prose-headings:text-white prose-strong:text-white'
                  : 'self-start bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-lg'
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.text}
              </ReactMarkdown>
            </div>
          ))}

          {loading && (
            <div className='self-start flex items-center gap-2'>
              <div className='p-2 bg-gray-200 dark:bg-gray-700 rounded-full'>
                <Bot className='w-5 h-5 text-gray-700 dark:text-gray-100' />
              </div>
              <div className='bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100 px-5 py-3 rounded-2xl flex items-center gap-1.5'>
                <span className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-75'></span>
                <span className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200'></span>
                <span className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-300'></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* CAPTCHA */}
        {!showConsentModal && !isCaptchaVerified && (
          <div className='flex flex-col items-center justify-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'>
            <p className='text-sm text-gray-600 dark:text-gray-400 mb-3'>
              Silakan verifikasi untuk memulai chat.
            </p>

            {recaptchaSiteKey ? (
              <ReCAPTCHA
                sitekey={recaptchaSiteKey}
                onChange={handleCaptchaChange}
                theme={theme === 'dark' ? 'dark' : 'light'}
              />
            ) : (
              <p className='text-sm text-red-600 font-medium px-4 py-2 bg-red-100 rounded-md'>
                Error: Kunci ReCAPTCHA tidak ditemukan.
              </p>
            )}
          </div>
        )}

        {/* Input */}
        <div className='flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-3 rounded-b-2xl'>
          <input
            type='text'
            placeholder='Ketik pertanyaan Anda di sini...'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            disabled={loading || showConsentModal || !isCaptchaVerified}
            className='flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 transition-all duration-300 disabled:opacity-50'
          />
          <button
            onClick={handleSend}
            disabled={
              loading || !input.trim() || showConsentModal || !isCaptchaVerified
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
    </section>
  );
}
