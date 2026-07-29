import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Signal, Shield, Zap, Globe, Mail, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter username'); return; }
    if (!password.trim()) { setError('Please enter password'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.success) { navigate('/', { replace: true }); }
    else { setError(result.error || 'Invalid credentials'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        <div className="hidden lg:flex flex-1 flex-col items-center text-center">
          <div className="bg-blue-500/20 p-6 rounded-3xl mb-6"><Signal size={80} className="text-blue-400" /></div>
          <h1 className="text-4xl font-bold text-white mb-3">Net2App Hub</h1>
          <p className="text-blue-200 text-lg">Enterprise SMS Platform</p>
          <div className="flex items-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-blue-300 text-sm"><Shield size={16} /> SMPP</div>
            <div className="flex items-center gap-2 text-blue-300 text-sm"><Zap size={16} /> HTTP</div>
            <div className="flex items-center gap-2 text-blue-300 text-sm"><Globe size={16} /> WhatsApp</div>
            <div className="flex items-center gap-2 text-blue-300 text-sm"><Mail size={16} /> RCS</div>
          </div>
        </div>

        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
          <div className="lg:hidden text-center mb-6">
            <div className="bg-blue-500/20 p-3 rounded-2xl inline-block mb-3"><Signal size={32} className="text-blue-400" /></div>
            <h1 className="text-2xl font-bold text-white">Net2App Hub</h1>
          </div>
          <Signal size={36} className="text-blue-400 mx-auto mb-4 hidden lg:block" />
          <h2 className="text-2xl font-bold text-white text-center mb-1">Welcome Back</h2>
          <p className="text-blue-200 text-sm text-center mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-300 shrink-0 mt-0.5" /><p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username" autoFocus autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-center text-blue-300/60 text-[11px]">© 2024 Tri Angle Trade Centre FZE LLC</p>
          </form>
        </div>
      </div>
    </div>
  );
};
