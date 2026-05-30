import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useKanjiStore } from '../../store/useKanjiStore';
import { supabase } from '../../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, User, KeyRound, Check, Eye, EyeOff, AlertCircle, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LoginView() {
  const { 
    login, 
    registerMaster, 
    registerWithToken, 
    initializeAuth 
  } = useAuthStore();
  
  const { initializeDatabase } = useKanjiStore();

  const [tab, setTab] = useState<'login' | 'token' | 'setup'>('login'); // Default to standard premium Login tab!
  const [hasMaster, setHasMaster] = useState<boolean>(true);
  const [showMasterSetupTab, setShowMasterSetupTab] = useState(false);
  
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

  // Initialize auth store on mount & check master online
  useEffect(() => {
    initializeAuth();
    checkMasterOnline();
  }, []);

  const checkMasterOnline = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'master')
        .limit(1);
      
      const exists = data && data.length > 0;
      setHasMaster(!!exists);
      
      if (!exists) {
        // If no master exists in the database, automatically show the setup tab
        setShowMasterSetupTab(true);
        setTab('setup');
      } else {
        setTab('login');
      }
    } catch (e) {
      console.error(e);
      // Fallback: Default to standard login screen
      setTab('login');
    }
  };

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
        await initializeDatabase();
        triggerConfetti();
      } else {
        setError(res.error || 'Username atau password salah.');
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
      const ok = await registerMaster(masterPassword);
      if (ok) {
        await initializeDatabase();
        setSuccess('Akun Master berhasil dibuat! Selamat datang di KanjiZen.');
        setHasMaster(true);
        setTab('login');
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
        await initializeDatabase();
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
            className="text-4xl font-extrabold tracking-tight text-tokyo-darkText flex items-center justify-center gap-3 drop-shadow-md cursor-default select-none font-sans"
          >
            KanjiZen <span className="text-lg font-normal text-gray-500 font-kanji bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">漢字禅</span>
          </motion.h1>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Akses belajar Bahasa Jepang dengan pengingat memori sains repitisi spasi.
          </p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="p-6 rounded-3xl border border-gray-800/80 bg-tokyo-card/40 backdrop-blur-xl shadow-glass relative"
        >
          {/* Decorative Torii Grid */}
          <div className="absolute inset-0 grid-bg opacity-15 rounded-3xl pointer-events-none" />

          <div className="space-y-5 relative z-10">
            {/* Error and Success alerts */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-tokyo-torii/10 border border-tokyo-torii/30 text-tokyo-torii text-xs flex items-center gap-2"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-tokyo-bamboo/10 border border-tokyo-bamboo/30 text-tokyo-bamboo text-xs flex items-center gap-2"
              >
                <Check size={14} className="shrink-0" />
                <span>{success}</span>
              </motion.div>
            )}

            {/* Forms rendering */}
            <AnimatePresence mode="wait">
              {tab === 'login' && (
                <motion.form
                  key="login-form"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div className="text-center space-y-1.5 pb-1">
                    <h2 className="text-lg font-extrabold text-tokyo-darkText">Masuk Sesi Belajar</h2>
                    <p className="text-[11px] text-gray-400 px-4">
                      Gunakan nama pengguna dan password yang telah Anda daftarkan.
                    </p>
                  </div>

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
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Password / Kode Akses</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                        <Lock size={15} />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password atau kode akses..."
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
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-tokyo-sakura via-tokyo-torii to-tokyo-sakura text-tokyo-darkText text-sm font-extrabold shadow-lg hover:shadow-sakura/30 transition-all active:scale-[0.98] mt-2"
                  >
                    {loading ? 'Masuk Sesi...' : 'Masuk Sesi Belajar ✓'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setTab('token'); setError(null); setSuccess(null); }}
                      className="text-xs text-tokyo-pond hover:underline font-bold"
                    >
                      Punya Kode Akses Baru? Daftar di sini →
                    </button>
                  </div>
                </motion.form>
              )}

              {tab === 'token' && (
                <motion.form
                  key="token-form"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRegisterWithToken}
                  className="space-y-4"
                >
                  <div className="text-center space-y-1.5 pb-1">
                    <h2 className="text-lg font-extrabold text-tokyo-darkText">Registrasi Kode Akses</h2>
                    <p className="text-[11px] text-gray-400 px-4">
                      Daftarkan akun baru Anda menggunakan Kode Akses unik dari Master.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                      <KeyRound size={12} className="text-tokyo-pond" />
                      Kode Akses Pengguna
                    </label>
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Tempel kode akses di sini (Contoh: budi-xxxx)..."
                      className="w-full px-4 py-3 rounded-xl bg-gray-950/45 border border-gray-800 text-xs text-tokyo-darkText placeholder-gray-600 focus:outline-none focus:border-tokyo-pond transition-colors font-mono"
                      required
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-gray-950/30 border border-gray-800/80 text-[10px] text-gray-400 leading-relaxed flex items-start gap-2.5">
                    <HelpCircle size={14} className="text-tokyo-pond shrink-0 mt-0.5 animate-pulse" />
                    <span>
                      Tempel Kode Akses Anda di atas untuk mendaftarkan perangkat Anda secara otomatis ke cloud database.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-tokyo-pond to-blue-500 text-[#0b0f19] text-sm font-extrabold shadow-lg hover:shadow-pond/30 transition-all active:scale-[0.98]"
                  >
                    {loading ? 'Memvalidasi...' : 'Daftar & Masuk Instan ✓'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
                      className="text-xs text-tokyo-sakura hover:underline font-bold"
                    >
                      ← Kembali ke Menu Masuk Akun
                    </button>
                  </div>
                </motion.form>
              )}

              {tab === 'setup' && !hasMaster && showMasterSetupTab && (
                <motion.form
                  key="setup-form"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRegisterMaster}
                  className="space-y-4"
                >
                  <div className="text-center space-y-1.5 pb-1">
                    <div className="mx-auto w-10 h-10 rounded-2xl bg-tokyo-torii/15 border border-tokyo-torii/30 flex items-center justify-center text-tokyo-torii text-xl">
                      <Shield size={20} />
                    </div>
                    <h2 className="text-sm font-extrabold text-tokyo-darkText">Inisialisasi Master Akun</h2>
                    <p className="text-[10px] text-gray-400 px-4">
                      Tentukan password master untuk proyek online ini agar Anda dapat mengelola akses pembeli.
                    </p>
                  </div>

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

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
                      className="text-xs text-tokyo-sakura hover:underline font-bold"
                    >
                      Sudah mengaktifkan Akun Master? Masuk di sini →
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Small footer text */}
        <p className="text-[10px] text-center text-gray-500">
          KanjiZen Spaced Repetition System. Keamanan Cloud & Sinkronisasi Online Otomatis.
        </p>
      </div>
    </div>
  );
}
