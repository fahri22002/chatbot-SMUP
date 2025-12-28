'use client';

import { useState, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  Send,
  Bot,
  Loader2,
  Paperclip,
  FileImage,
  X,
  MessageCircle,
  RotateCcw,
  Circle,
  Sparkles
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';

type Message = {
  sender: 'bot' | 'user';
  text: string;
  attachmentUrl?: string;
};

export default function Chatbot() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'Halo! Saya asisten virtual Anda. Ada yang bisa saya bantu hari ini?',
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [showWAPrompt, setShowWAPrompt] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!isCaptchaVerified) return;
    const socket = new WebSocket("ws://localhost:8765");
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      const token = localStorage.getItem('deviceToken');
      if (!token) {
        socket.send(JSON.stringify({ action: "register_device" }));
      } else {
        socket.send(JSON.stringify({ action: "create_chat", deviceToken: token }));
      }
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === "register_device" && data.deviceToken) {
          localStorage.setItem('deviceToken', data.deviceToken);
          socket.send(JSON.stringify({ action: "create_chat", deviceToken: data.deviceToken }));
        }
        if (data.action === "create_chat" && data.chatId) {
          chatIdRef.current = data.chatId;
        }
        if (data.reply) {
          setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
          setLoading(false);
          setUserMessageCount(prev => prev + 1);
        }
        if (data.action === "ready_for_binary" && selectedFile) {
          const arrayBuffer = await selectedFile.arrayBuffer();
          socket.send(arrayBuffer);
        }
      } catch (err) {
        console.error("Error:", err);
      }
    };

    socket.onclose = () => setIsConnected(false);
    return () => socket.close();
  }, [isCaptchaVerified]);

  useEffect(() => {
    if (userMessageCount === 5) setShowWAPrompt(true);
  }, [userMessageCount]);

  const handleSend = () => {
    if (!isConnected || !chatIdRef.current || (!input.trim() && !selectedFile)) return;
    const deviceToken = localStorage.getItem('deviceToken');
    setLoading(true);

    if (selectedFile) {
      socketRef.current?.send(JSON.stringify({
        action: "send_message_with_attachment",
        chatId: chatIdRef.current,
        deviceToken,
        msg: input,
        filename: selectedFile.name,
        filesize: selectedFile.size,
        mimetype: selectedFile.type
      }));
      setMessages(prev => [...prev, { 
        sender: 'user', 
        text: input || "Mengirim lampiran...", 
        attachmentUrl: URL.createObjectURL(selectedFile) 
      }]);
    } else {
      socketRef.current?.send(JSON.stringify({
        action: "send_message",
        chatId: chatIdRef.current,
        deviceToken,
        msg: input
      }));
      setMessages(prev => [...prev, { sender: 'user', text: input }]);
    }
    setInput('');
    setSelectedFile(null);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className='min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-0 sm:p-4 font-sans transition-colors duration-500'>
      
      {/* Modal Consent - Glassmorphism style */}
      {showConsentModal && (
        <div className='fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4'>
          <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-100'>
            <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
              <Sparkles className='w-8 h-8 text-blue-600' />
            </div>
            <h3 className='text-xl font-bold mb-2 text-slate-900 dark:text-white'>Data & Privasi</h3>
            <p className='text-sm text-slate-500 dark:text-slate-400 mb-8'>Izinkan kami menyimpan riwayat chat untuk meningkatkan kualitas layanan asisten kami.</p>
            <div className='flex flex-col gap-3'>
              <button onClick={() => setShowConsentModal(false)} className='w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all active:scale-95'>Setuju & Lanjutkan</button>
              <button onClick={() => setShowConsentModal(false)} className='w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all'>Lain kali</button>
            </div>
          </div>
        </div>
      )}

      <div className='w-full max-w-5xl h-[100vh] sm:h-[850px] bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative'>
        
        {/* Header - Glassmorphism */}
        <header className='flex items-center justify-between bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-6 py-5 z-20'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none'>
                <Bot className='w-6 h-6 text-white' />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div>
              <h1 className='text-md font-bold text-slate-900 dark:text-white'>AI Akademik</h1>
              <p className='text-[10px] uppercase tracking-wider font-semibold text-slate-400'>{isConnected ? 'System Online' : 'Connecting...'}</p>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className='flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 px-4 sm:px-8 py-8 bg-[#fdfdfd] dark:bg-slate-900/50'>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-message`}>
              <div className={`max-w-[85%] sm:max-w-[70%] group relative ${msg.sender === 'user' ? 'order-1' : 'order-2'}`}>
                <div className={`px-5 py-3.5 rounded-[1.5rem] shadow-sm text-sm leading-relaxed ${
                  msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none' 
                  : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                }`}>
                  {msg.attachmentUrl && (
                    <div className='mb-3 rounded-xl overflow-hidden border border-black/5'>
                      <Image src={msg.attachmentUrl} alt='attachment' width={400} height={300} className='w-full object-cover' unoptimized />
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                  
                  {msg.sender === 'bot' && (
                    <div className='mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity'>
                      <button onClick={() => {}} className='p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 transition-colors'>
                        <RotateCcw className='w-3.5 h-3.5' />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className='flex justify-start animate-message'>
              <div className='bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-5 py-4 rounded-[1.5rem] rounded-tl-none'>
                <div className='flex gap-1.5'>
                  <span className='w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce'></span>
                  <span className='w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]'></span>
                  <span className='w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]'></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Captcha & Footer Area */}
        <div className='px-4 sm:px-8 pb-6 bg-gradient-to-t from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent pt-4'>
          
          {!isCaptchaVerified && !showConsentModal && (
            <div className='flex flex-col items-center gap-4 py-4 mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl'>
              <p className='text-xs font-medium text-slate-500'>Verifikasi bahwa Anda manusia</p>
              {recaptchaSiteKey && (
                <ReCAPTCHA sitekey={recaptchaSiteKey} onChange={(token) => setIsCaptchaVerified(!!token)} theme={theme === 'dark' ? 'dark' : 'light'} />
              )}
            </div>
          )}

          {/* WA Prompt - Floating Style */}
          {showWAPrompt && (
            <div className='mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-2xl flex items-center gap-4'>
              <div className='p-2.5 bg-green-500 rounded-xl'><MessageCircle className='w-5 h-5 text-white' /></div>
              <div className='flex-1'>
                <h4 className='font-bold text-sm text-green-900 dark:text-green-100'>Butuh bantuan manusia?</h4>
                <p className='text-xs text-green-700 dark:text-green-300'>Hubungi Admin WhatsApp kami sekarang.</p>
              </div>
              <a href='https://wa.me/6281122301410' target='_blank' className='px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors'>Chat WA</a>
              <button onClick={() => setShowWAPrompt(false)} className='text-green-400 hover:text-green-600'><X className='w-4 h-4' /></button>
            </div>
          )}

          {/* Input Interface */}
          <div className={`relative group transition-all duration-300 ${!isCaptchaVerified ? 'opacity-20 pointer-events-none grayscale' : ''}`}>
            {selectedFile && (
              <div className='absolute -top-14 left-0 right-0 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-t-xl text-xs font-medium animate-in slide-in-from-bottom-2'>
                <FileImage className='w-4 h-4' />
                <span className='truncate flex-1'>{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)}><X className='w-4 h-4 hover:scale-125 transition-transform' /></button>
              </div>
            )}
            
            <div className='flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-[1.8rem] border border-transparent focus-within:border-blue-500/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:shadow-xl transition-all'>
              <input type='file' ref={fileInputRef} hidden onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={loading || !isConnected} 
                className='p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all'
              >
                <Paperclip className='w-5 h-5' />
              </button>
              
              <input 
                type='text' 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                placeholder={isConnected ? 'Tanyakan sesuatu...' : 'Menghubungkan...'} 
                disabled={loading || !isConnected} 
                className='flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none text-slate-700 dark:text-slate-200' 
              />
              
              <button 
                onClick={handleSend} 
                disabled={loading || !isConnected || (!input.trim() && !selectedFile)} 
                className='p-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-90'
              >
                {loading ? <Loader2 className='w-5 h-5 animate-spin' /> : <Send className='w-5 h-5' />}
              </button>
            </div>
          </div>
          <p className='text-center text-[10px] text-slate-400 mt-4 font-medium'>AI can make mistakes. Check important info.</p>
        </div>
      </div>
    </section>
  );
}