// Admin/manage-admin-view.tsx
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

// Define this near your AdminItem interface
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
    setShowPassword(false);       // Reset visibility
    setShowConfirmPassword(false);
  };

  // 3. Handle Switch to Create Mode
  const handleCreateMode = () => {
    setSelectedAdmin(null);
    setMode('create');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);       // Reset visibility
    setShowConfirmPassword(false);
  };

  // 4. Submit Handler (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- VALIDASI ---
    if (password.length < 6) {
      return toast.warning('Password minimal 6 karakter');
    }
    if (password !== confirmPassword) {
      return toast.warning('Konfirmasi password tidak cocok!');
    }
    // ----------------
    
    setIsSubmitting(true);
    try {
      let url = 'http://localhost:5000/api/admin/create-account';
      let method = 'POST';
      
      // Use the interface instead of 'any'
      let body: AdminRequest = { username, password };

      if (mode === 'edit' && selectedAdmin) {
        url = `http://localhost:5000/api/admin/${selectedAdmin._id}/password`;
        method = 'PUT';
        // Resolve Ln 103 'as any' warning
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
      // Resolve Ln 124 'error: any' warning
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
  <div>
    <h1 className='text-3xl font-bold text-gray-900 dark:text-white tracking-tight'>
      Manajemen Admin
    </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            Kelola akses administrator sistem.
          </p>
        </div>
        {/* ADD THIS BUTTON */}
        <button
          onClick={onBack}
          className='flex items-center gap-2 py-2 px-4 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors'
        >
          <CornerDownLeft className='w-4 h-4' />
          <span>Kembali</span>
        </button>
      </header>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1'>
        
        {/* KOLOM KIRI: DAFTAR ADMIN */}
        <div className='lg:col-span-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm h-[600px] flex flex-col overflow-hidden'>
          <div className='p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50 flex justify-between items-center'>
            <h2 className='text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-200 uppercase tracking-wider'>
              <Users className='w-4 h-4' /> Daftar Admin
            </h2>
            <button 
              onClick={handleCreateMode}
              className='p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 transition'
              title="Tambah Baru"
            >
              <UserPlus className='w-4 h-4' />
            </button>
          </div>
          
          <div className='overflow-y-auto flex-1 p-2 space-y-2'>
            {loadingList ? (
              <div className='flex justify-center p-4'><Loader2 className='animate-spin text-gray-400' /></div>
            ) : (
              admins.map((admin) => (
                <div 
                  key={admin._id}
                  onClick={() => handleSelectAdmin(admin)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                    selectedAdmin?._id === admin._id 
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                      : 'bg-white border-transparent hover:bg-gray-50 dark:bg-neutral-900 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    <div className={`p-2 rounded-full ${admin.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
                      {admin.role === 'SUPER_ADMIN' ? <ShieldCheck className='w-4 h-4' /> : <Shield className='w-4 h-4' />}
                    </div>
                    <div>
                      <p className='text-sm font-bold text-gray-900 dark:text-white'>{admin.username}</p>
                      <p className='text-[10px] text-gray-500'>{admin.role}</p>
                    </div>
                  </div>
                  
                  {admin.role !== 'SUPER_ADMIN' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(admin._id); }}
                      className='p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* KOLOM KANAN: FORM */}
        <div className='lg:col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm h-fit p-6'>
          <div className='mb-6 pb-4 border-b border-gray-100 dark:border-neutral-800'>
            <h2 className='text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              {mode === 'create' ? <UserPlus className='w-6 h-6 text-blue-500' /> : <Key className='w-6 h-6 text-amber-500' />}
              {mode === 'create' ? 'Buat Admin Baru' : `Ganti Password: ${selectedAdmin?.username}`}
            </h2>
            <p className='text-sm text-gray-500 mt-1'>
              {mode === 'create' 
                ? 'Tambahkan administrator baru ke dalam sistem.' 
                : 'Masukkan password baru untuk mereset akses admin ini.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-5 max-w-lg'>
            {mode === 'create' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className='w-full p-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none'
                  placeholder='Contoh: admin_kampus'
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* PASSWORD FIELD */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  {mode === 'create' ? 'Password' : 'Password Baru'}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} // TOGGLE TYPE
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='w-full p-2.5 pl-9 pr-10 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none'
                    placeholder='Min 6 karakter'
                    required
                  />
                  {/* ICON KIRI (LOCK) */}
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  
                  {/* ICON KANAN (TOGGLE) */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD FIELD */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} // TOGGLE TYPE
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full p-2.5 pl-9 pr-10 rounded-lg border bg-white dark:bg-neutral-950 dark:text-white outline-none focus:ring-2
                      ${confirmPassword && password !== confirmPassword 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 dark:border-neutral-700 focus:ring-blue-500'}`}
                    placeholder='Ulangi password'
                    required
                  />
                  {/* ICON KIRI (LOCK) */}
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  
                  {/* ICON KANAN (TOGGLE) */}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>
                )}
              </div>
            </div>

            <div className='flex gap-3 pt-4 border-t border-gray-100 dark:border-neutral-800 mt-2'>
              {mode === 'edit' && (
                <button 
                  type="button" 
                  onClick={handleCreateMode}
                  className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300'
                >
                  Batal
                </button>
              )}
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-lg
                  ${mode === 'create' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}
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