// Admin/create-admin-view.tsx
'use client';
import { useState } from 'react';
import { UserPlus, Loader2, CornerDownLeft, LogOut } from 'lucide-react';

// DITAMBAHKAN: Impor toast
import { toast } from 'sonner';

interface CreateAdminViewProps {
  onBack: () => void;
}

export default function CreateAdminView({ onBack }: CreateAdminViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Proses logout gagal.');
      window.location.href = '/login';
    } catch (err: unknown) {
      // DIUBAH: Menggunakan toast.error
      if (err instanceof Error) {
        toast.error(`Error saat logout: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui saat logout.');
      }
      setIsLoggingOut(false);
    }
  };
  
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
      setError('Password minimal harus 6 karakter.');
      
      // DIUBAH: Menggunakan toast.warning (lebih baik dari setError saja)
      toast.warning('Password minimal harus 6 karakter.'); 
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal membuat akun.');
      }

      // DIUBAH: Menggunakan toast.success
      toast.success(`Akun admin "${username}" berhasil dibuat!`);
      onBack();

    } catch (err: unknown) { 
      // DIUBAH: Menggunakan toast.error
      if (err instanceof Error) {
        setError(err.message);
        toast.error(err.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui.');
        toast.error('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ... (Bagian return <div...> dari CreateAdminView tetap sama) ...
  return (
    <div className='bg-gray-50 dark:bg-gray-950 min-h-screen text-gray-900 dark:text-gray-200 font-sans p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='mb-8 flex justify-between items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white tracking-tight'>Buat Akun Admin Baru</h1>
            <p className='text-gray-600 dark:text-gray-400 mt-1'>Tambahkan administrator baru untuk mengelola sistem chatbot.</p>
          </div>
          <button onClick={handleLogout} disabled={isLoggingOut} className='flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:bg-neutral-600'>
            {isLoggingOut ? <Loader2 className='w-5 h-5 animate-spin' /> : <LogOut className='w-5 h-5' />}
            <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </header>

        <div className="mt-8 max-w-2xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8">
          <form className="space-y-6" onSubmit={handleCreateAdmin}>
            <div>
              <label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">Username Baru</label>
              <input id="username" name="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 block w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Masukkan username" />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Baru</label>
              <input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 block w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Minimal 6 karakter" />
            </div>

            {error && (<div className="text-center text-red-400 text-sm"><p>{error}</p></div>)}

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={onBack} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800">
                <CornerDownLeft className="w-5 h-5" />
                <span>Kembali</span>
              </button>
              <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                <span>{loading ? 'Memproses...' : 'Buat Akun'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}