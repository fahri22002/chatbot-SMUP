// Admin/settings-view.tsx
'use client';
import { useState } from 'react';
import { 
  Lock, Save, Loader2, UserCog, Eye, EyeOff 
} from 'lucide-react';
import { toast } from 'sonner';

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  placeholder: string;
}

// --- PERBAIKAN: PINDAHKAN KOMPONEN INI KE LUAR ---
const PasswordInput = ({ 
  label, value, onChange, show, setShow, placeholder 
}: PasswordInputProps) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}
    </label>
    <div className="relative">
      <input 
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 pl-10 pr-10 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        placeholder={placeholder}
        required
      />
      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);
// --------------------------------------------------

export default function SettingsView() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State Toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      return toast.warning('Password baru minimal 6 karakter');
    }
    if (newPassword !== confirmPassword) {
      return toast.warning('Konfirmasi password baru tidak cocok');
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = await res.json();
      if (res.ok) {
        toast.success('Password berhasil diubah!');
        // Reset form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(json.message || 'Gagal mengubah password');
      }
    } catch (error) { 
      console.error(error); 
      toast.error('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col items-center justify-center'>
      
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-lg p-8">
        
        <header className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
            <UserCog className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Akun</h1>
          <p className="text-sm text-gray-500 mt-1">Ganti password akun Anda</p>
        </header>

        <form onSubmit={handleSubmit}>
          
          <PasswordInput 
            label="Password Lama" 
            value={currentPassword} 
            onChange={setCurrentPassword} 
            show={showCurrent} 
            setShow={setShowCurrent} 
            placeholder="Masukkan password saat ini"
          />

          <hr className="my-6 border-gray-100 dark:border-neutral-800" />

          <PasswordInput 
            label="Password Baru" 
            value={newPassword} 
            onChange={setNewPassword} 
            show={showNew} 
            setShow={setShowNew} 
            placeholder="Minimal 6 karakter"
          />

          <PasswordInput 
            label="Konfirmasi Password Baru" 
            value={confirmPassword} 
            onChange={setConfirmPassword} 
            show={showConfirm} 
            setShow={setShowConfirm} 
            placeholder="Ulangi password baru"
          />

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>

        </form>
      </div>
    </div>
  );
}