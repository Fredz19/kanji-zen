import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useKanjiStore } from '../../store/useKanjiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, User, KeyRound, Check, Eye, EyeOff, AlertCircle, Copy, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LoginView() {
  const { 
    usersRegistry, 
    login, 
    registerMaster, 
    registerWithToken, 
    initializeAuth 
  } = useAuthStore();
  
  const { switchUserProgress } = useKanjiStore();

  const [tab, setTab] = useState<'login' | 'token'>('login');
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  
  // Master setup states
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  
  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize auth store on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const hasMaster = usersRegistry.some(u => u.role === 'master');

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff4a5a', '#f687b3', '#00f2fe', '#00e676', '#ffd700']
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username dan password harus diisi.');
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      const res = await login(username, password);
      if (res.success) {
        // Muat progress belajar user tersebut
        switchUserProgress(username);
        triggerConfetti();
      } else {
        setError(res.error || 'Terjadi kesalahan saat masuk.');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword.length < 6) {
      setError('Password Master minimal harus 6 karakter.');
      return;
    }
    if (masterPassword !== confirmMasterPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const success = await registerMaster(masterPassword);
      if (success) {
        switchUserProgress('master');
        setSuccess('Akun Master berhasil dibuat! Selamat datang di KanjiZen.');
        triggerConfetti();
      } else {
        setError('Gagal membuat akun Master.');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat pendaftaran.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Silakan masukkan Kode Akses terlebih dahulu.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await registerWithToken(tokenInput);
      if (res.success && res.username) {
        switchUserProgress(res.username);
        setSuccess(`Kode Akses Valid! Selamat datang, ${res.username}.`);
        triggerConfetti();
      } else {
        setError(res.error || 'Kode Akses tidak valid.');
      }
    } catch (err) {
      setError('Gagal memverifikasi Kode Akses.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden select-none">
      
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-tokyo-sakura/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-tokyo-pond/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Logo and Brand */}
        <div className="text-center space-y-2">
          <motion.h1 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-extrabold tracking-tight text-tokyo-darkText flex items-center justify-center gap-3 drop-shadow-md"
          >
            KanjiZen <span className="text-lg font-normal text-gray-500 font-kanji bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">漢字禅</span>
          </motion.h1>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Akses belajar Bahasa Jepang dengan pengingat memori sains repitisi spasi.
          </p>
        </div>

        {/* Auth Box */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="p-6 rounded-3xl border border-gray-800/80 bg-tokyo-card/40 backdrop-blur-xl shadow-glass relative"
        >
          {/* Decorative Torii Grid */}
          <div className="absolute inset-0 grid-bg opacity-15 rounded-3xl pointer-events-none" />

          {/* Setup Master Password (First Run) */}
          {!hasMaster ? (
            <div className="space-y-4 relative z-10">
              <div className="text-center space-y-1.5 pb-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-tokyo-torii/15 border border-tokyo-torii/30 flex items-center justify-center text-tokyo-torii text-xl">
                  <Shield />
                </div>
                <h2 className="text-lg font-extrabold text-tokyo-darkText">Inisialisasi Master Akun</h2>
                <p className="text-[11px] text-gray-400 px-4">
                  Ini adalah pertama kalinya aplikasi dijalankan. Silakan tetapkan password untuk **Akses Master** Anda.
                </p>
              </div>

              <form onSubmit={handleRegisterMaster} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-tokyo-torii/10 border border-tokyo-torii/30 text-tokyo-torii text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Password Master Baru</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                      <Lock size={15} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      placeholder="Minimal 6 karakter..."
                      className="w-full pl-10 pr-10 py-3 rounded-xl bg-gray-950/45 border border-gray-800 text-sm text-tokyo-darkText placeholder-gray-600 focus:outline-none focus:border-tokyo-torii transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Konfirmasi Password Master</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                      <Lock size={15} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmMasterPassword}
                      onChange={(e) => setConfirmMasterPassword(e.target.value)}
                      placeholder="Ulangi password..."
                      className="w-full pl-10 pr-10 py-3 rounded-xl bg-gray-950/45 border border-gray-800 text-sm text-tokyo-darkText placeholder-gray-600 focus:outline-none focus:border-tokyo-torii transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-tokyo-torii to-tokyo-sakura text-tokyo-darkText text-sm font-extrabold shadow-lg hover:shadow-torii/40 transition-all active:scale-[0.98]"
                >
                  {loading ? 'Menyimpan...' : 'Aktifkan Akses Master ✓'}
                </button>
              </form>
            </div>
          ) : (
            /* Normal Login/Token Tabs */
            <div className="space-y-5 relative z-10">
              {/* Tab toggles */}
              <div className="flex bg-gray-950/50 p-1 rounded-xl border border-gray-800 text-xs">
                <button
                  onClick={() => { setTab('login'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all duration-300 ${
                    tab === 'login'
                      ? 'bg-tokyo-sakura text-tokyo-darkText shadow-sakura'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Masuk Akun
                </button>
                <button
                  onClick={() => { setTab('token'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all duration-300 ${
                    tab === 'token'
                      ? 'bg-tokyo-pond text-[#0b0f19] shadow-pond'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Gunakan Kode Akses
                </button>
              </div>

              {/* Error and Success alerts */}
              {error && (
                <div className="p-3 rounded-xl bg-tokyo-torii/10 border border-tokyo-torii/30 text-tokyo-torii text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="p-3 rounded-xl bg-tokyo-bamboo/10 border border-tokyo-bamboo/30 text-tokyo-bamboo text-xs flex items-center gap-2">
                  <Check size={14} className="shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* Tab: Standard Login Form */}
              <AnimatePresence mode="wait">
                {tab === 'login' ? (
                  <motion.form
                    key="login-form"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Username</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                          <User size={15} />
                        </span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Masukkan username..."
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-950/45 border border-gray-800 text-sm text-tokyo-darkText placeholder-gray-600 focus:outline-none focus:border-tokyo-sakura transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Password</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                          <Lock size={15} />
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Masukkan password..."
                          className="w-full pl-10 pr-10 py-3 rounded-xl bg-gray-950/45 border border-gray-800 text-sm text-tokyo-darkText placeholder-gray-600 focus:outline-none focus:border-tokyo-sakura transition-colors"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-tokyo-sakura to-tokyo-torii text-tokyo-darkText text-sm font-extrabold shadow-lg hover:shadow-sakura/30 transition-all active:scale-[0.98]"
                    >
                      {loading ? 'Masuk Sesi...' : 'Masuk Sesi Belajar ✓'}
                    </button>
                  </motion.form>
                ) : (
                  /* Tab: Import Token Form */
                  <motion.form
                    key="token-form"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleRegisterWithToken}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                        <KeyRound size={12} className="text-tokyo-pond" />
                        Kode Akses Kriptografis
                      </label>
                      <textarea
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        rows={4}
                        placeholder="Tempelkan Kode Akses panjang (Base64) yang diberikan oleh Master di sini..."
                        className="w-full p-3.5 rounded-xl bg-gray-950/45 border border-gray-800 text-xs text-tokyo-darkText placeholder-gray-600 focus:outline-none focus:border-tokyo-pond transition-colors resize-none font-mono"
                        required
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-gray-950/30 border border-gray-800/80 text-[10px] text-gray-400 leading-relaxed flex items-start gap-2.5">
                      <HelpCircle size={14} className="text-tokyo-pond shrink-0 mt-0.5 animate-pulse" />
                      <span>
                        <strong>Tentang Kode Akses:</strong> Kode ini dienkripsi secara lokal oleh Master Akses. Menempelkannya di sini akan mendaftarkan profil Anda secara lokal di browser ini agar Anda dapat langsung belajar menggunakan username Anda.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-tokyo-pond to-blue-500 text-[#0b0f19] text-sm font-extrabold shadow-lg hover:shadow-pond/30 transition-all active:scale-[0.98]"
                    >
                      {loading ? 'Memvalidasi...' : 'Daftar & Masuk Instan ✓'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Small footer text */}
        <p className="text-[10px] text-center text-gray-500">
          KanjiZen Spaced Repetition System. Keamanan Lokal & 100% Offline-First.
        </p>
      </div>
    </div>
  );
}
