'use client';
import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';

// --- Type for successful and error responses ---
interface LoginSuccessResponse {
  message: string;
  token?: string; // optional if your backend sends token
}

interface LoginErrorResponse {
  message: string;
}

type LoginResponse = LoginSuccessResponse | LoginErrorResponse;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // include cookies
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as LoginErrorResponse).message || 'Gagal untuk login.');
      }

      window.location.href = '/Admin';
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-gray-200">
      <div className="w-full max-w-md p-8 space-y-8 bg-neutral-800 rounded-2xl shadow-lg border border-neutral-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Admin Login</h1>
          <p className="mt-2 text-gray-400">Masuk untuk mengakses dashboard.</p>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="username" className="text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 block w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500"
              placeholder="Masukkan username Anda"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-center text-red-400 text-sm">
              <p>{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-neutral-600 transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              <span>{loading ? 'Memproses...' : 'Login'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
