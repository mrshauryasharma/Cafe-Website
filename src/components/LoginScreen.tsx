import React, { useState } from 'react';
import { Coffee, Lock, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface LoginScreenProps {
  cafeName: string;
  onLoginSuccess: (user: User, cafeName: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ cafeName, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = (await res.json()) as { error?: string; user?: User; cafe_name?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (!data.user) {
        throw new Error('User record missing in response');
      }

      onLoginSuccess(data.user, data.cafe_name || cafeName);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#FAF9F6]">
      <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] rounded-2xl flex items-center justify-center mb-3">
            <Coffee className="w-7 h-7 text-[#111111]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight font-serif">
            {cafeName || 'The Grove Cafe'}
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#52525B] mt-1 font-sans font-medium">
            Staff & Owner Counter Terminal
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-10 pr-3.5 py-2.5 text-base text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors lowercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-10 pr-3.5 py-2.5 text-base text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] mt-2 bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Terminal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
