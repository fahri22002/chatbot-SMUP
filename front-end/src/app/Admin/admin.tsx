// app/Admin/admin.tsx
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
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

// --- IMPORT VIEW COMPONENTS ---

import ManageAdminView from './manage-admin-view';
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
  attachmentUrl?: string | null;
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

type ActiveView = 'history' | 'knowledge' | 'RAG' | 'manageAdmin' | 'settings';

// --- KOMPONEN Sidebar ---
const AdminSidebar = ({
  activeView,
  onNavClick,
  onLogout,
  isLoggingOut,
  userRole, // <--- 1. TERIMA PROP ROLE
}: {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  userRole: string | null; // Tipe data role
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Daftar item navigasi dasar
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
      requiresSuperAdmin: true, // <--- Tandai menu ini butuh Super Admin
    },
    {
      view: 'settings' as ActiveView,
      icon: Settings,
      label: 'Pengaturan Akun',
    },
  ];

  // 2. FILTER ITEM BERDASARKAN ROLE
  const navItems = allNavItems.filter((item) => {
    // Jika item butuh super admin, cek apakah userRole == 'SUPER_ADMIN'
    if (item.requiresSuperAdmin) {
      return userRole === 'SUPER_ADMIN';
    }
    // Jika tidak butuh syarat khusus, tampilkan saja
    return true;
  });

  return (
    <aside
      className={`flex flex-col h-screen p-4 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
                 transition-all duration-300 ease-in-out overflow-x-hidden
                 ${isOpen ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className='px-2 mb-8 h-8'>
        {isOpen ? (
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap'>
            Admin Panel
          </h1>
        ) : (
          <ChevronsLeft className='w-6 h-6 text-gray-900 dark:text-white' />
        )}
      </div>

      <nav className='flex-1 flex flex-col gap-2'>
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavClick(item.view)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${!isOpen && 'justify-center'} 
                      ${
                        activeView === item.view
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
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
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50
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

// --- KOMPONEN Tampilan History Chat ---
const ChatHistoryView = () => {
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<SelectedConversation | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch daftar chat
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

  // Handle pilih percakapan (Fetch detail chat history)
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
          attachmentUrl: msg.attachmentUrl,
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

  // Fungsi hapus satu chat
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

  // Fungsi hapus chat lama
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
      <header className='mb-8 flex justify-between items-start'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white tracking-tight'>
            Chat History
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            Manajemen dan monitoring aktivitas chatbot.
          </p>
        </div>
        <button
          onClick={handleDeleteOldChats}
          className='flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-4 py-2 rounded-lg'
        >
          <Trash2 className='w-5 h-5' />
          <span>Hapus Chat Lama</span>
        </button>
      </header>

      {/* Chat History Section */}
      <section className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1'>
        {/* List Panel */}
        <div className='lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg h-[600px] flex flex-col'>
          <div className='p-4 border-b border-gray-200 dark:border-gray-700'>
            <h2 className='text-lg font-semibold flex items-center mb-4 gap-2 text-gray-900 dark:text-white'>
              <MessageSquare /> Riwayat Percakapan
            </h2>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500' />
              <input
                type='text'
                placeholder='Cari ID percakapan...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 pl-10 pr-4 py-2 text-sm'
              />
            </div>
          </div>
          <div className='overflow-y-auto flex-1'>
            {listLoading ? (
              <div className='flex justify-center items-center h-full text-gray-500'>
                <Loader2 className='w-8 h-8 animate-spin' />
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => handleSelectConversation(conv._id)}
                  className={`w-full text-left p-4 border-l-4 hover:bg-gray-100 dark:hover:bg-gray-800/50 ${
                    selectedConversation?._id === conv._id
                      ? 'bg-blue-600/10 dark:bg-blue-600/20 border-blue-500'
                      : 'border-transparent'
                  }`}
                >
                  <p className='font-bold text-gray-900 dark:text-white text-sm truncate'>
                    ID: {conv._id}
                  </p>
                  <p className='text-sm text-gray-600 dark:text-gray-400 truncate mt-1'>
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

        {/* Detail Panel */}
        <div className='lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg h-[600px] flex flex-col'>
          {detailLoading ? (
            <div className='flex justify-center items-center h-full text-gray-500'>
              <Loader2 className='w-12 h-12 animate-spin' />
            </div>
          ) : selectedConversation ? (
            <>
              <header className='p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center'>
                <div>
                  <h3 className='font-bold text-gray-900 dark:text-white'>
                    Detail Percakapan
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {selectedConversation._id}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteChat(selectedConversation._id)}
                  className='flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg'
                >
                  <Trash2 className='w-4 h-4' />
                  <span>Hapus</span>
                </button>
              </header>
              <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-5'>
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
                      className={`p-2 rounded-full ${
                        msg.sender === 'user'
                          ? 'bg-blue-600'
                          : 'bg-gray-500 dark:bg-gray-700'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <User className='w-4 h-4 text-white' />
                      ) : (
                        <Bot className='w-4 h-4 text-white' />
                      )}
                    </div>
                    <div
                      className={`flex flex-col gap-2 ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      {msg.attachmentUrl && (
                        <div className='bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-1'>
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
                              className='w-full max-w-[200px] h-auto rounded-md hover:opacity-90 transition-opacity'
                              unoptimized
                            />
                          </a>
                          <div className='flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400'>
                            <ImageIcon className='w-3 h-3' />
                            <span>Attachment</span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`px-4 py-2 rounded-lg shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200'
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
                            [&_th]:border [&_th]:p-2 [&_th]:bg-black/5 dark:[&_th]:bg-white/5 [&_th]:text-left
                            [&_td]:border [&_td]:p-2
                            
                            ${
                              msg.sender === 'user'
                                ? '[&_a]:text-blue-200 hover:[&_a]:text-white [&_th]:border-white/20 [&_td]:border-white/20'
                                : '[&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_th]:border-gray-300 dark:[&_th]:border-gray-600 [&_td]:border-gray-300 dark:[&_td]:border-gray-600'
                            }
                          `}
                          dangerouslySetInnerHTML={{ __html: msg.msg }}
                        />
                      </div>

                      <span className='text-[10px] text-gray-400 opacity-70'>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className='flex flex-col items-center justify-center h-full text-gray-500'>
              <MessageSquare className='w-16 h-16 mb-4' />
              <h3 className='text-xl font-semibold'>Pilih Percakapan</h3>
              <p>
                Pilih salah satu percakapan dari daftar di sebelah kiri untuk
                melihat detailnya.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// --- KOMPONEN UTAMA: AdminDashboard ---
export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('history');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // 3. STATE BARU UNTUK ROLE
  const [userRole, setUserRole] = useState<string | null>(null);

  // 4. AMBIL ROLE DARI LOCALSTORAGE SAAT MOUNT
  useEffect(() => {
    // Pastikan di halaman Login Anda sudah menyimpan 'role' ke localStorage
    // Contoh: localStorage.setItem('role', response.data.role);
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
      
      // Bersihkan localStorage saat logout
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
        // Extra Protection: Jika bukan super admin tapi memaksa akses view ini, kembalikan ke history
        if (userRole !== 'SUPER_ADMIN') return <ChatHistoryView />;
        return <ManageAdminView onBack={() => setActiveView('history')} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <ChatHistoryView />;
    }
  };

  return (
    <div className='flex h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-200 font-sans'>
      {/* 5. KIRIM ROLE KE SIDEBAR */}
      <AdminSidebar
        activeView={activeView}
        onNavClick={setActiveView}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        userRole={userRole}
      />
      <main className='flex-1 overflow-y-auto h-screen'>{renderView()}</main>
    </div>
  );
}