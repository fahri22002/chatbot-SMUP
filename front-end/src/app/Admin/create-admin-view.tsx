'use client';
import { useState } from 'react';
import { UserPlus, Loader2, CornerDownLeft } from 'lucide-react';
import { toast } from 'sonner';

interface CreateAdminViewProps { onBack: () => void; }

export default function CreateAdminView({ onBack }: CreateAdminViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
      setError('Password minimal harus 6 karakter.');
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
      if (!res.ok) throw new Error(data.message || 'Gagal membuat akun.');

      toast.success(`Akun admin "${username}" berhasil dibuat!`);
      onBack();
    } catch (err: unknown) {
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

  return (
    <div className='p-6 h-full flex flex-col justify-center'>
      <div className='max-w-2xl mx-auto w-full'>
        
        {/* Header Section */}
        <header className='mb-8 text-center sm:text-left'>
          <div className='bg-white/40 backdrop-blur-sm inline-block px-6 py-4 rounded-2xl border border-white/40 shadow-sm'>
            <h1 className='text-3xl font-bold text-gray-900 tracking-tight drop-shadow-sm'>
              Buat Admin Baru
            </h1>
            <p className='text-gray-700 mt-1 font-medium'>
              Tambahkan administrator untuk mengelola sistem.
            </p>
          </div>
        </header>

        {/* Form Card (Glassmorphism) */}
        <div className="bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl p-8 shadow-xl ring-1 ring-white/60 relative overflow-hidden">
            
            

          <form className="space-y-6" onSubmit={handleCreateAdmin}>
            <div className='space-y-1'>
              <label htmlFor="username" className="text-sm font-semibold text-gray-800 ml-1">
                Username Baru
              </label>
              <input 
                id="username" 
                name="username" 
                type="text" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="block w-full px-4 py-3 bg-white/40 border border-white/40 rounded-xl text-gray-900 placeholder:text-gray-500 focus:bg-white/80 focus:ring-2 focus:ring-[#9E6600] focus:border-transparent outline-none transition-all shadow-inner" 
                placeholder="Masukkan username" 
              />
            </div>

            <div className='space-y-1'>
              <label htmlFor="password" className="text-sm font-semibold text-gray-800 ml-1">
                Password Baru
              </label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="block w-full px-4 py-3 bg-white/40 border border-white/40 rounded-xl text-gray-900 placeholder:text-gray-500 focus:bg-white/80 focus:ring-2 focus:ring-[#9E6600] focus:border-transparent outline-none transition-all shadow-inner" 
                placeholder="Minimal 6 karakter" 
              />
            </div>

            {error && (
              <div className="bg-red-50/80 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex justify-center backdrop-blur-sm">
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button 
                type="button" 
                onClick={onBack} 
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-white/40 rounded-xl text-sm font-bold text-gray-700 bg-white/40 hover:bg-white/70 hover:shadow-md transition-all backdrop-blur-sm"
              >
                <CornerDownLeft className="w-5 h-5" />
                <span>Kembali</span>
              </button>
              
              <button 
                type="submit" 
                disabled={loading} 
                // Menggunakan Hex #9E6600 (Dark Yellow) sesuai request
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#F9A129] hover:bg-[#8a5a00] shadow-lg shadow-[#9E6600]/30 disabled:bg-gray-400 disabled:shadow-none transition-all backdrop-blur-sm"
              >
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