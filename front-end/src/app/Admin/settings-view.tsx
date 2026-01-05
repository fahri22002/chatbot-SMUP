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

const PasswordInput = ({ 
  label, value, onChange, show, setShow, placeholder 
}: PasswordInputProps) => (
  <div className="mb-4">
    <label className="block text-sm font-semibold text-gray-800 mb-1 ml-1">
      {label}
    </label>
    <div className="relative group">
      <input 
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 pl-10 pr-10 rounded-xl border border-white/40 bg-white/40 text-gray-900 outline-none focus:bg-white/80 focus:ring-2 focus:ring-[#9E6600] transition-all backdrop-blur-sm shadow-inner placeholder:text-gray-500"
        placeholder={placeholder}
        required
      />
      <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[#9E6600]" />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors p-1"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

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
      
      {/* Glass Card Container */}
      <div className="w-full max-w-md bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl shadow-xl ring-1 ring-white/60 relative overflow-hidden p-8">
        
      

        <header className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-white/60 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 text-[#9E6600] shadow-sm ring-1 ring-white/50">
            <UserCog className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pengaturan Akun</h1>
          <p className="text-sm text-gray-700 mt-1 font-medium">Perbarui keamanan akun Anda</p>
        </header>

        <form onSubmit={handleSubmit} className="relative z-10">
          
          <PasswordInput 
            label="Password Lama" 
            value={currentPassword} 
            onChange={setCurrentPassword} 
            show={showCurrent} 
            setShow={setShowCurrent} 
            placeholder="Masukkan password saat ini"
          />

          <div className="my-6 border-t border-white/40 w-full" />

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
            // Style Button: Dark Yellow (#9E6600)
            className="w-full mt-6 flex items-center justify-center gap-2 py-3 px-4 bg-[#F9A129] hover:bg-[#8a5a00] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#9E6600]/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>

        </form>
      </div>
    </div>
  );
}