'use client';
import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Trash2,
  User,
  Search,
  Bot,
  Loader2,
  LogOut,
  ChevronsLeft,
  ImageIcon,
  Settings,
  Users,
  UserPlus,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

// --- IMPORT VIEW COMPONENTS ---
import ManageAdminView from './manage-admin-view';
import CreateAdminView from './create-admin-view';
import SettingsView from './settings-view';

// --- INTERFACES ---
interface ChatSession {
  _id: string;
  status: string;
  createdAt: string;
}

interface Message {
  sender: 'user' | 'bot';
  msg: string;
  createdAt: string;
  attachmentUrl?: string | null;
}

interface BackendMessage {
  sender: 'USER' | 'BOT';
  msg: string;
  createdAt: string;
  attachment?: string | null;
}

interface SelectedConversation {
  _id: string;
  status: string;
  messages: Message[];
}

interface ChatListResponse {
  data: ChatSession[];
}

interface ChatHistoryResponse {
  data: BackendMessage[];
}

interface DeleteOldChatsResponse {
  message: string;
}

type ActiveView = 'history' | 'knowledge' | 'RAG' | 'manageAdmin' | 'createAdmin' | 'settings';

// --- KOMPONEN Sidebar (Glassmorphism Enhanced & Recolored) ---
const AdminSidebar = ({
  activeView,
  onNavClick,
  onLogout,
  isLoggingOut,
  userRole,
}: {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  userRole: string | null;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const allNavItems = [
    {
      view: 'history' as ActiveView,
      icon: MessageSquare,
      label: 'Chat History',
    },
    {
      view: 'manageAdmin' as ActiveView,
      icon: Users,
      label: 'Manajemen Admin',
      requiresSuperAdmin: true,
    },
    {
      view: 'createAdmin' as ActiveView,
      icon: UserPlus,
      label: 'Buat Admin',
      requiresSuperAdmin: true,
    },
    {
      view: 'settings' as ActiveView,
      icon: Settings,
      label: 'Pengaturan Akun',
    },
  ];

  const navItems = allNavItems.filter((item) => {
    if (item.requiresSuperAdmin) {
      return userRole === 'SUPER_ADMIN';
    }
    return true;
  });

  return (
    <aside
      className={`sticky top-0 h-screen flex flex-col p-4 border-r border-white/40
                 transition-all duration-300 ease-in-out z-20 flex-shrink-0
                 bg-white/60 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.05)]
                 ${isOpen ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className='px-2 mb-8 h-8'>
        {isOpen ? (
          <h1 className='text-2xl font-bold text-gray-800 whitespace-nowrap drop-shadow-sm'>
            Admin Panel
          </h1>
        ) : (
          <ChevronsLeft className='w-6 h-6 text-gray-800' />
        )}
      </div>

      <nav className='flex-1 flex flex-col gap-2'>
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavClick(item.view)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${!isOpen && 'justify-center'} 
                      ${
                        activeView === item.view
                          // REPLACED: bg-blue-600 -> bg-[#F9A129]
                          ? 'bg-[#F9A129] text-white shadow-lg shadow-[#F9A129]/30 backdrop-blur-md'
                          // REPLACED: hover:text-blue-600 -> hover:text-[#F9A129]
                          : 'text-gray-700 hover:bg-white/50 hover:text-[#F9A129] hover:shadow-sm'
                      }`}
          >
            <item.icon className='w-5 h-5 flex-shrink-0' />
            {isOpen && <span className='whitespace-nowrap'>{item.label}</span>}
          </button>
        ))}
      </nav>

      <button
        onClick={onLogout}
        disabled={isLoggingOut}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50/50 hover:shadow-sm transition-all disabled:opacity-50
                  ${!isOpen && 'justify-center'}`}
      >
        {isLoggingOut ? (
          <Loader2 className='w-5 h-5 animate-spin flex-shrink-0' />
        ) : (
          <LogOut className='w-5 h-5 flex-shrink-0' />
        )}
        {isOpen && (
          <span className='whitespace-nowrap'>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </span>
        )}
      </button>
    </aside>
  );
};

// --- KOMPONEN Tampilan History Chat (Glassmorphism Enhanced & Recolored) ---
const ChatHistoryView = () => {
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<SelectedConversation | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchChatList = async () => {
    try {
      setListLoading(true);
      const res = await fetch('http://localhost:5000/api/admin/chats/all', {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Gagal mengambil daftar chat.');
      const data: ChatListResponse = await res.json();
      setChatList(data.data || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchChatList();
  }, []);

  const handleSelectConversation = async (chatId: string) => {
    if (selectedConversation?._id === chatId) return;
    try {
      setDetailLoading(true);
      setSelectedConversation(null);
      const res = await fetch(
        `http://localhost:5000/api/admin/chats/history?chatId=${chatId}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Gagal mengambil riwayat chat.');
      const data: ChatHistoryResponse = await res.json();

      const transformedMessages: Message[] = data.data.map(
        (msg: BackendMessage): Message => ({
          msg: msg.msg,
          createdAt: msg.createdAt,
          sender: msg.sender === 'USER' ? 'user' : 'bot',
          attachmentUrl: msg.attachment || null,
        })
      );

      const currentChat = chatList.find((chat) => chat._id === chatId);
      setSelectedConversation({
        _id: chatId,
        status: currentChat?.status || 'UNKNOWN',
        messages: transformedMessages,
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat mengambil detail chat.');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const executeDeleteChat = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/chats/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Gagal menghapus chat.');

      setChatList((prev) => prev.filter((c) => c._id !== id));
      setSelectedConversation(null);
      toast.success('Percakapan berhasil dihapus.');
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Error: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui saat menghapus.');
      }
    }
  };

  const handleDeleteChat = async (id: string) => {
    toast.warning('Konfirmasi Hapus', {
      description:
        'Apakah Anda yakin ingin menghapus percakapan ini secara permanen?',
      action: {
        label: 'Ya, Hapus',
        onClick: () => executeDeleteChat(id),
      },
      cancel: {
        label: 'Batal',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const executeDeleteOldChats = async () => {
    try {
      const res = await fetch(
        'http://localhost:5000/api/admin/chats/delete-old',
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!res.ok) throw new Error('Gagal menghapus chat lama.');

      const result: DeleteOldChatsResponse = await res.json();
      toast.success(result.message);
      fetchChatList();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Error: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui saat menghapus.');
      }
    }
  };

  const handleDeleteOldChats = async () => {
    toast.warning('Konfirmasi Hapus', {
      description:
        'Apakah Anda yakin ingin menghapus semua chat lama (NONACTIVE > 7 hari)? Tindakan ini tidak dapat dibatalkan.',
      action: {
        label: 'Ya, Hapus Semua',
        onClick: () => executeDeleteOldChats(),
      },
      cancel: {
        label: 'Batal',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const filteredConversations = chatList.filter((conv) =>
    conv._id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col'>
      {/* Header */}
      <header className='mb-6 flex justify-between items-start flex-shrink-0'>
        <div className='bg-white/20 backdrop-blur-sm p-4 rounded-2xl border border-white/40 shadow-sm'>
          <h1 className='text-3xl font-bold text-gray-900 tracking-tight drop-shadow-sm'>
            Chat History
          </h1>
          <p className='text-gray-700 mt-1 font-medium'>
            Manajemen dan monitoring aktivitas chatbot.
          </p>
        </div>
        <button
          onClick={handleDeleteOldChats}
          className='flex items-center gap-2 bg-red-500/90 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl shadow-lg shadow-red-500/20 backdrop-blur-sm transition-all'
        >
          <Trash2 className='w-5 h-5' />
          <span>Hapus Chat Lama</span>
        </button>
      </header>

      {/* Chat History Section */}
      <section className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 pb-2'>
        
        {/* List Panel (Glassmorphism) */}
        <div className='lg:col-span-1 bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl h-[500px] lg:h-[calc(100vh-180px)] flex flex-col shadow-xl ring-1 ring-white/60'>
          <div className='p-4 border-b border-white/30 flex-shrink-0 bg-white/20 rounded-t-2xl'>
            <h2 className='text-lg font-semibold flex items-center mb-4 gap-2 text-gray-800'>
              <MessageSquare /> Riwayat Percakapan
            </h2>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500' />
              <input
                type='text'
                placeholder='Cari ID percakapan...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                // REPLACED: focus:border-blue-400 -> focus:border-[#F9A129]
                className='w-full bg-white/40 focus:bg-white/80 text-gray-900 rounded-xl border border-white/40 focus:border-[#F9A129] pl-10 pr-4 py-2 text-sm outline-none transition-all placeholder:text-gray-500 shadow-inner'
              />
            </div>
          </div>
          <div className='overflow-y-auto flex-1 custom-scrollbar p-2 space-y-2'>
            {listLoading ? (
              <div className='flex justify-center items-center h-full text-gray-500'>
                <Loader2 className='w-8 h-8 animate-spin' />
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => handleSelectConversation(conv._id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                    selectedConversation?._id === conv._id
                      // REPLACED: bg-blue-600/10 border-blue-400/50 -> bg-[#F9A129]/10 border-[#F9A129]/50
                      ? 'bg-[#F9A129]/10 border-[#F9A129]/50 shadow-md backdrop-blur-sm'
                      : 'border-transparent hover:bg-white/40 hover:border-white/40'
                  }`}
                >
                  <p className='font-bold text-gray-800 text-sm truncate'>
                    ID: {conv._id}
                  </p>
                  <p className='text-sm text-gray-600 truncate mt-1'>
                    Status: {conv.status}
                  </p>
                  <p className='text-xs text-gray-500 mt-2'>
                    {new Date(conv.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            ) : (
              <div className='text-center text-gray-500 p-8'>
                <p>{error || 'Percakapan tidak ditemukan.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel (Glassmorphism) */}
        <div className='lg:col-span-2 bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl h-[600px] lg:h-[calc(100vh-180px)] flex flex-col shadow-xl ring-1 ring-white/60'>
          {detailLoading ? (
            <div className='flex justify-center items-center h-full text-gray-500'>
              <Loader2 className='w-12 h-12 animate-spin' />
            </div>
          ) : selectedConversation ? (
            <>
              <header className='p-4 border-b border-white/30 flex justify-between items-center flex-shrink-0 bg-white/20 rounded-t-2xl'>
                <div>
                  <h3 className='font-bold text-gray-900'>
                    Detail Percakapan
                  </h3>
                  <p className='text-sm text-gray-600'>
                    {selectedConversation._id}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteChat(selectedConversation._id)}
                  className='flex items-center gap-2 bg-red-600/90 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg shadow-md transition-all backdrop-blur-sm'
                >
                  <Trash2 className='w-4 h-4' />
                  <span>Hapus</span>
                </button>
              </header>
              <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar bg-white/10'>
                {selectedConversation.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 max-w-[85%] ${
                      msg.sender === 'user'
                        ? 'self-end flex-row-reverse'
                        : 'self-start'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-full flex-shrink-0 shadow-lg ${
                        msg.sender === 'user'
                          // REPLACED: bg-blue-600 -> bg-[#F9A129]
                          ? 'bg-[#F9A129] text-white'
                          : 'bg-white/90 text-gray-600 backdrop-blur-sm'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <User className='w-4 h-4' />
                      ) : (
                        <Bot className='w-4 h-4' />
                      )}
                    </div>
                    <div
                      className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {/* RENDER GAMBAR JIKA ADA ATTACHMENT */}
                      {msg.attachmentUrl && (
                        <div className='bg-white/60 p-2 rounded-xl border border-white/50 mb-1 shadow-sm backdrop-blur-sm'>
                          <a
                            href={msg.attachmentUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='block'
                          >
                            <Image
                              src={msg.attachmentUrl}
                              alt='Attachment Gambar'
                              width={0}
                              height={0}
                              sizes='100vw'
                              className='w-full max-w-[200px] h-auto rounded-lg hover:opacity-90 transition-opacity'
                              unoptimized 
                            />
                          </a>
                          <div className='flex items-center gap-1 mt-2 text-xs text-gray-600'>
                            <ImageIcon className='w-3 h-3' />
                            <span>Attachment</span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`px-4 py-2 rounded-2xl shadow-md backdrop-blur-md border ${
                          msg.sender === 'user'
                            // REPLACED: bg-blue-600/90 ... border-blue-500 -> bg-[#F9A129]/90 ... border-[#F9A129]
                            ? 'bg-[#F9A129]/90 text-white rounded-tr-none border-[#F9A129]'
                            : 'bg-white/80 text-gray-900 border-white/60 rounded-tl-none'
                        }`}
                      >
                        <div
                          className={`text-sm leading-relaxed 
                            [&_p]:mb-2 [&_p:last-child]:mb-0 
                            [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-2
                            [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-2
                            [&_li]:pl-1 [&_li]:mb-1
                            [&_strong]:font-bold
                            [&_a]:underline 
                            [&_table]:w-full [&_table]:border-collapse [&_table]:mb-2 [&_table]:mt-2
                            [&_th]:border [&_th]:p-2 [&_th]:bg-black/5 [&_th]:text-left
                            [&_td]:border [&_td]:p-2
                            
                            ${
                              msg.sender === 'user'
                                // REPLACED: text-blue-200 -> text-white (agar kontras di background kuning/orange)
                                ? '[&_a]:text-white hover:[&_a]:text-yellow-100 [&_th]:border-white/20 [&_td]:border-white/20'
                                // REPLACED: text-blue-600 -> text-[#F9A129]
                                : '[&_a]:text-[#F9A129] [&_th]:border-gray-300 [&_td]:border-gray-300'
                            }
                          `}
                          dangerouslySetInnerHTML={{ __html: msg.msg }}
                        />
                      </div>

                      <span className='text-[10px] text-gray-700 font-bold opacity-80 shadow-black/10 drop-shadow-sm'>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className='flex flex-col items-center justify-center h-full text-gray-600'>
              <div className="bg-white/40 p-6 rounded-full mb-4 shadow-inner border border-white/50 backdrop-blur-sm">
                <MessageSquare className='w-12 h-12 text-gray-500' />
              </div>
              <h3 className='text-xl font-semibold text-gray-800 drop-shadow-sm'>Pilih Percakapan</h3>
              <p className="text-gray-600 font-medium bg-white/30 px-3 py-1 rounded-lg">
                Pilih salah satu percakapan dari daftar di sebelah kiri.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// --- KOMPONEN UTAMA: AdminDashboard (Updated Layout with Background) ---
export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('history');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Proses logout gagal.');
      
      localStorage.removeItem('role'); 
      
      window.location.href = '/login';
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Error saat logout: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui saat logout.');
      }
      setIsLoggingOut(false);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'history':
        return <ChatHistoryView />;

      case 'manageAdmin':
        if (userRole !== 'SUPER_ADMIN') return <ChatHistoryView />;
        return <ManageAdminView onBack={() => setActiveView('history')} />;
      
      case 'createAdmin':
        if (userRole !== 'SUPER_ADMIN') return <ChatHistoryView />;
        return <CreateAdminView onBack={() => setActiveView('manageAdmin')} />;
        
      case 'settings':
        return <SettingsView />;
      default:
        return <ChatHistoryView />;
    }
  };

  return (
    <div className='flex min-h-screen font-sans relative overflow-hidden'>
      {/* BACKGROUND LAYER */}
      <div className="fixed inset-0 z-[0]">
        {/* Gambar Background Utama */}
        <Image 
          src="/Logo.jpg" 
          alt="Background" 
          fill 
          className="object-cover object-center"
          priority
        />
        {/* Overlay Putih Transparan (Kunci Kenyamanan Mata) */}
        {/* Menggunakan opacity/85 agar gambar terlihat samar (glass) tapi teks tetap kontras */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
        
        {/* Gradient Overlay untuk estetika - REPLACED blue-50 -> #F9A129 (Yellow/Orange) tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-[#F9A129]/10" />
      </div>

      <AdminSidebar
        activeView={activeView}
        onNavClick={setActiveView}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        userRole={userRole}
      />
      
      <main className='flex-1 w-full relative z-10'>
        {renderView()}
      </main>
    </div>
  );
}