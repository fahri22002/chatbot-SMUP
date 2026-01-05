'use client';
import { useState, useEffect } from 'react';
import { 
  CornerDownLeft, UserPlus, Loader2, Trash2, Key, Users, ShieldCheck, Shield, Lock, Eye, EyeOff 
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminItem {
  _id: string;
  username: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
}

interface AdminRequest {
  username?: string;
  password?: string;
  newPassword?: string;
}

interface ManageAdminViewProps {
  onBack: () => void;
}

export default function ManageAdminView({ onBack }: ManageAdminViewProps) {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  
  // State Form
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedAdmin, setSelectedAdmin] = useState<AdminItem | null>(null);
  
  // Form Inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // STATE VISIBILITAS PASSWORD
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Admin List
  const fetchAdmins = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/list', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        setAdmins(json.data);
      } else {
        toast.error(json.message || 'Gagal mengambil data admin');
      }
    } catch {
      toast.error('Error koneksi server');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // 2. Handle Select for Edit
  const handleSelectAdmin = (admin: AdminItem) => {
    setSelectedAdmin(admin);
    setMode('edit');
    setUsername(admin.username); 
    setPassword(''); 
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // 3. Handle Switch to Create Mode
  const handleCreateMode = () => {
    setSelectedAdmin(null);
    setMode('create');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // 4. Submit Handler (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      return toast.warning('Password minimal 6 karakter');
    }
    if (password !== confirmPassword) {
      return toast.warning('Konfirmasi password tidak cocok!');
    }
    
    setIsSubmitting(true);
    try {
      let url = 'http://localhost:5000/api/admin/create-account';
      let method = 'POST';
      
      let body: AdminRequest = { username, password };

      if (mode === 'edit' && selectedAdmin) {
        url = `http://localhost:5000/api/admin/${selectedAdmin._id}/password`;
        method = 'PUT';
        body = { newPassword: password };
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await res.json();
      
      if (!res.ok) throw new Error(json.message);

      toast.success(mode === 'create' ? 'Admin berhasil dibuat' : 'Password berhasil diubah');
      
      await fetchAdmins();
      handleCreateMode(); 

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus admin ini?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Admin dihapus');
        fetchAdmins();
        if (selectedAdmin?._id === id) handleCreateMode();
      } else {
        toast.error(json.message);
      }
    } catch {
      toast.error('Gagal menghapus');
    }
  };

  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col'>
      {/* Header */}
      <header className='mb-6 flex justify-between items-start'>
        <div className='bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/40 shadow-sm'>
          <h1 className='text-3xl font-bold text-gray-900 tracking-tight drop-shadow-sm'>
            Manajemen Admin
          </h1>
          <p className='text-gray-700 mt-1 font-medium'>
            Kelola akses administrator sistem.
          </p>
        </div>
        <button
          onClick={onBack}
          className='flex items-center gap-2 py-2 px-4 border border-white/40 rounded-xl text-sm font-bold text-gray-700 bg-white/40 hover:bg-white/70 transition-all backdrop-blur-sm shadow-sm'
        >
          <CornerDownLeft className='w-4 h-4' />
          <span>Kembali</span>
        </button>
      </header>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0'>
        
        {/* KOLOM KIRI: DAFTAR ADMIN (Glassmorphism) */}
        <div className='lg:col-span-1 bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl h-[500px] lg:h-[calc(100vh-180px)] flex flex-col shadow-xl ring-1 ring-white/60 overflow-hidden'>
          <div className='p-4 border-b border-white/30 bg-white/20 flex justify-between items-center'>
            <h2 className='text-sm font-bold flex items-center gap-2 text-gray-800 uppercase tracking-wider'>
              <Users className='w-4 h-4' /> Daftar Admin
            </h2>
            <button 
              onClick={handleCreateMode}
              className='p-1.5 bg-[#F9A129]/20 text-[#F9A129] rounded-lg hover:bg-[#F9A129]/30 transition border border-[#F9A129]/20'
              title="Tambah Baru"
            >
              <UserPlus className='w-4 h-4' />
            </button>
          </div>
          
          <div className='overflow-y-auto flex-1 p-3 space-y-2 custom-scrollbar bg-white/10'>
            {loadingList ? (
              <div className='flex justify-center p-4'><Loader2 className='animate-spin text-gray-500' /></div>
            ) : (
              admins.map((admin) => (
                <div 
                  key={admin._id}
                  onClick={() => handleSelectAdmin(admin)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group backdrop-blur-sm ${
                    selectedAdmin?._id === admin._id 
                      ? 'bg-[#F9A129]/10 border-[#F9A129]/50 shadow-md' 
                      : 'bg-white/40 border-transparent hover:bg-white/60 hover:border-white/40'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    <div className={`p-2 rounded-full shadow-sm ${
                        admin.role === 'SUPER_ADMIN' 
                        ? 'bg-purple-100 text-purple-600' 
                        : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {admin.role === 'SUPER_ADMIN' ? <ShieldCheck className='w-4 h-4' /> : <Shield className='w-4 h-4' />}
                    </div>
                    <div>
                      <p className='text-sm font-bold text-gray-900'>{admin.username}</p>
                      <p className='text-[10px] text-gray-600 font-medium'>{admin.role}</p>
                    </div>
                  </div>
                  
                  {admin.role !== 'SUPER_ADMIN' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(admin._id); }}
                      className='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* KOLOM KANAN: FORM (Glassmorphism) */}
        <div className='lg:col-span-2 bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl h-fit p-6 shadow-xl ring-1 ring-white/60 relative overflow-hidden'>
          

          <div className='mb-6 pb-4 border-b border-white/30'>
            <h2 className='text-xl font-bold text-gray-900 flex items-center gap-2'>
              {mode === 'create' 
                ? <UserPlus className='w-6 h-6 text-[#F9A129]' /> 
                : <Key className='w-6 h-6 text-[#F9A129]' />
              }
              {mode === 'create' ? 'Buat Admin Baru' : `Ganti Password: ${selectedAdmin?.username}`}
            </h2>
            <p className='text-sm text-gray-700 font-medium mt-1'>
              {mode === 'create' 
                ? 'Tambahkan administrator baru ke dalam sistem.' 
                : 'Masukkan password baru untuk mereset akses admin ini.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-5 max-w-lg'>
            {mode === 'create' && (
              <div>
                <label className='block text-sm font-semibold text-gray-800 mb-1 ml-1'>Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className='w-full p-3 rounded-xl border border-white/40 bg-white/40 text-gray-900 focus:bg-white/80 focus:ring-2 focus:ring-[#F9A129] outline-none transition-all shadow-inner placeholder:text-gray-500'
                  placeholder='Contoh: admin_kampus'
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* PASSWORD FIELD */}
              <div>
                <label className='block text-sm font-semibold text-gray-800 mb-1 ml-1'>
                  {mode === 'create' ? 'Password' : 'Password Baru'}
                </label>
                <div className="relative group">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='w-full p-3 pl-9 pr-10 rounded-xl border border-white/40 bg-white/40 text-gray-900 focus:bg-white/80 focus:ring-2 focus:ring-[#F9A129] outline-none transition-all shadow-inner placeholder:text-gray-500'
                    placeholder='Min 6 karakter'
                    required
                  />
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-[#F9A129] transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD FIELD */}
              <div>
                <label className='block text-sm font-semibold text-gray-800 mb-1 ml-1'>
                  Konfirmasi Password
                </label>
                <div className="relative group">
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full p-3 pl-9 pr-10 rounded-xl border bg-white/40 text-gray-900 outline-none transition-all shadow-inner placeholder:text-gray-500 focus:bg-white/80
                      ${confirmPassword && password !== confirmPassword 
                        ? 'border-red-400 focus:ring-2 focus:ring-red-500' 
                        : 'border-white/40 focus:ring-2 focus:ring-[#F9A129]'}`}
                    placeholder='Ulangi password'
                    required
                  />
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-[#F9A129] transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-600 mt-1 font-semibold ml-1">Password tidak cocok.</p>
                )}
              </div>
            </div>

            <div className='flex gap-3 pt-4 border-t border-white/30 mt-4'>
              {mode === 'edit' && (
                <button 
                  type="button" 
                  onClick={handleCreateMode}
                  className='px-4 py-2 text-sm font-bold text-gray-700 bg-white/40 rounded-xl hover:bg-white/60 border border-white/40 transition-all backdrop-blur-sm'
                >
                  Batal
                </button>
              )}
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-white text-sm font-bold transition-all shadow-lg backdrop-blur-sm
                  bg-[#F9A129] hover:bg-[#d68215] shadow-[#F9A129]/30
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting && <Loader2 className='w-4 h-4 animate-spin' />}
                {mode === 'create' ? 'Buat Akun' : 'Simpan Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}