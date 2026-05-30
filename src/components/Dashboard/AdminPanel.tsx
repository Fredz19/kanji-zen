import React, { useState } from 'react';
import { useAuthStore, UserAccount } from '../../store/useAuthStore';
import { useKanjiStore } from '../../store/useKanjiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, UserPlus, Trash2, KeyRound, Copy, Check, Users, Lock, ChevronRight, AlertTriangle, Smartphone } from 'lucide-react';

export default function AdminPanel() {
  const { 
    usersRegistry, 
    currentUser, 
    createUser, 
    deleteUser, 
    changeMasterPassword,
    generateTokenForUser,
    removeUserDevice,
    importDeviceReport,
    deviceId
  } = useAuthStore();

  const { userProgressMap } = useKanjiStore();

  // Tab & Form states
  const [newUsername, setNewUsername] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');

  // Generated user result state
  const [createdResult, setCreatedResult] = useState<{
    username: string;
    password?: string;
    token?: string;
  } | null>(null);

  // Copy states
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedExistingToken, setCopiedExistingToken] = useState<string | null>(null);

  // Device Report import states
  const [deviceReportInput, setDeviceReportInput] = useState('');
  const [deviceReportError, setDeviceReportError] = useState<string | null>(null);
  const [deviceReportSuccess, setDeviceReportSuccess] = useState<string | null>(null);
  const [deviceReportLoading, setDeviceReportLoading] = useState(false);

  const handleImportDeviceReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceReportError(null);
    setDeviceReportSuccess(null);
    setDeviceReportLoading(true);
    const res = await importDeviceReport(deviceReportInput.trim());
    setDeviceReportLoading(false);
    if (res.success) {
      setDeviceReportSuccess(`✅ Perangkat "${res.deviceName}" berhasil ditambahkan untuk pengguna "${res.username}"!`);
      setDeviceReportInput('');
    } else {
      setDeviceReportError(res.error || 'Gagal mengimpor laporan perangkat.');
    }
  };

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedResult(null);

    if (!newUsername.trim()) {
      setError('Username tidak boleh kosong.');
      return;
    }

    try {
      const res = await createUser(newUsername);
      if (res.success && res.password && res.token) {
        setCreatedResult({
          username: newUsername.trim().toLowerCase(),
          password: res.password,
          token: res.token
        });
        setNewUsername('');
        setSuccess('Pengguna baru berhasil dibuat!');
      } else {
        setError(res.error || 'Gagal membuat pengguna.');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi.');
      console.error(err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newMasterPassword.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }

    if (newMasterPassword !== confirmMasterPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }

    try {
      const ok = await changeMasterPassword(newMasterPassword);
      if (ok) {
        setSuccess('Password Master berhasil diubah!');
        setNewMasterPassword('');
        setConfirmMasterPassword('');
      } else {
        setError('Gagal mengubah password.');
      }
    } catch (err) {
      setError('Terjadi kesalahan.');
      console.error(err);
    }
  };

  const handleCopyText = (text: string, type: 'token' | 'pass' | 'existing') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === 'pass') {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } else {
      setCopiedExistingToken(text);
      setTimeout(() => setCopiedExistingToken(null), 2000);
    }
  };

  const handleCopyTokenForExisting = async (username: string) => {
    const token = await generateTokenForUser(username);
    if (token) {
      handleCopyText(token, 'existing');
    }
  };

  const usersCount = usersRegistry.length;
  const regularUsers = usersRegistry.filter(u => u.role !== 'master');

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-2xl border border-gray-800/60 bg-tokyo-card/25 backdrop-blur-md flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-tokyo-pond/10 border border-tokyo-pond/25 flex items-center justify-center text-tokyo-pond">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Total Akun Terdaftar</span>
            <span className="text-lg font-bold text-tokyo-darkText leading-none">{usersCount} Pengguna</span>
          </div>
        </div>

        {/* Access Status */}
        <div className="p-4 rounded-2xl border border-gray-800/60 bg-tokyo-card/25 backdrop-blur-md flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-tokyo-sakura/10 border border-tokyo-sakura/25 flex items-center justify-center text-tokyo-sakura">
            <Shield size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Level Otoritas Sesi</span>
            <span className="text-lg font-bold text-tokyo-sakura leading-none">Akses Master 👑</span>
          </div>
        </div>

        {/* Protection Key */}
        <div className="p-4 rounded-2xl border border-gray-800/60 bg-tokyo-card/25 backdrop-blur-md flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-tokyo-gold/10 border border-tokyo-gold/25 flex items-center justify-center text-tokyo-gold">
            <KeyRound size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Status Enkripsi Token</span>
            <span className="text-lg font-bold text-tokyo-bamboo leading-none">Aktif & Aman</span>
          </div>
        </div>
      </div>

      {/* Main Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Create User Panel */}
        <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-tokyo-darkText flex items-center gap-2 border-b border-gray-800/40 pb-3">
            <UserPlus size={16} className="text-tokyo-pond" /> Buat Pengguna Baru
          </h3>

          {error && (
            <div className="p-3 rounded-xl bg-tokyo-torii/10 border border-tokyo-torii/30 text-tokyo-torii text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-tokyo-bamboo/10 border border-tokyo-bamboo/30 text-tokyo-bamboo text-xs">
              {success}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Username Pengguna Baru</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: budi, siska..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-tokyo-darkText focus:outline-none focus:border-tokyo-pond"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-tokyo-pond text-[#0b0f19] text-xs font-extrabold shadow-md hover:shadow-pond/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Generate Akun
                </button>
              </div>
              <p className="text-[9px] text-gray-500 leading-normal">
                Sistem akan membuatkan password acak dan melahirkan Kode Akses bertanda tangan kriptografis untuk dibagikan kepada mereka.
              </p>
            </div>
          </form>

          {/* Generated Result Display Card */}
          <AnimatePresence>
            {createdResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 p-4 rounded-2xl bg-gray-950/50 border border-tokyo-pond/20 space-y-3 relative overflow-hidden"
              >
                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                <h4 className="text-xs font-extrabold text-tokyo-pond flex items-center gap-1.5">
                  <Check size={14} /> Kredensial Pengguna Berhasil Dibuat
                </h4>

                <div className="space-y-2 text-xs">
                  {/* Username display */}
                  <div className="flex justify-between border-b border-gray-900 pb-1.5">
                    <span className="text-gray-500">Username:</span>
                    <strong className="text-tokyo-darkText font-mono">{createdResult.username}</strong>
                  </div>

                  {/* Password display */}
                  <div className="flex justify-between border-b border-gray-900 pb-1.5 items-center">
                    <span className="text-gray-500">Password Acak:</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <strong className="text-tokyo-darkText">{createdResult.password}</strong>
                      <button
                        onClick={() => handleCopyText(createdResult.password || '', 'pass')}
                        className="text-gray-500 hover:text-tokyo-pond transition-colors"
                        title="Salin Password"
                      >
                        {copiedPass ? <Check size={13} className="text-tokyo-bamboo" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Token display */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Kode Akses Kriptografis:</span>
                      <button
                        onClick={() => handleCopyText(createdResult.token || '', 'token')}
                        className="text-[10px] text-tokyo-pond font-bold hover:underline flex items-center gap-1 transition-all"
                      >
                        {copiedToken ? (
                          <>
                            <Check size={12} className="text-tokyo-bamboo" /> Tersalin!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Salin Kode Akses
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 rounded bg-gray-900 text-[9px] font-mono text-gray-500 truncate max-w-full">
                      {createdResult.token}
                    </div>
                    <span className="text-[9px] text-amber-500 block leading-normal pt-1">
                      ⚠️ <strong>Penting:</strong> Berikan password acak atau Kode Akses di atas ke teman Anda. Kode Akses memungkinkan pendaftaran instan tanpa setting apa pun.
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Security & Change Password Panel */}
        <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-tokyo-darkText flex items-center gap-2 border-b border-gray-800/40 pb-3">
            <Lock size={16} className="text-tokyo-sakura" /> Ubah Password Master
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-3">
              {/* New Password input */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Password Master Baru</label>
                <input
                  type="password"
                  value={newMasterPassword}
                  onChange={(e) => setNewMasterPassword(e.target.value)}
                  placeholder="Minimal 6 karakter..."
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-tokyo-darkText focus:outline-none focus:border-tokyo-sakura"
                  required
                />
              </div>

              {/* Confirm Password input */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirmMasterPassword}
                  onChange={(e) => setConfirmMasterPassword(e.target.value)}
                  placeholder="Ulangi password baru..."
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-tokyo-darkText focus:outline-none focus:border-tokyo-sakura"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-tokyo-sakura text-tokyo-darkText text-xs font-extrabold shadow-md hover:shadow-sakura/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              Ubah Password Master ✓
            </button>
          </form>
        </div>

      </div>

      {/* Import Device Report Panel */}
      <div className="p-5 rounded-3xl border border-tokyo-pond/20 bg-tokyo-card/30 backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold text-tokyo-darkText flex items-center gap-2 border-b border-gray-800/40 pb-3">
          <Smartphone size={16} className="text-tokyo-pond" /> Import Laporan Perangkat
        </h3>

        <p className="text-[10px] text-gray-500 leading-relaxed">
          Tempel kode yang dikirimkan pengguna dari halaman dashboard mereka untuk mendaftarkan perangkat baru ke akun mereka.
        </p>

        {deviceReportError && (
          <div className="p-3 rounded-xl bg-tokyo-torii/10 border border-tokyo-torii/30 text-tokyo-torii text-xs">
            {deviceReportError}
          </div>
        )}
        {deviceReportSuccess && (
          <div className="p-3 rounded-xl bg-tokyo-bamboo/10 border border-tokyo-bamboo/30 text-tokyo-bamboo text-xs">
            {deviceReportSuccess}
          </div>
        )}

        <form onSubmit={handleImportDeviceReport} className="flex gap-2">
          <input
            type="text"
            value={deviceReportInput}
            onChange={(e) => setDeviceReportInput(e.target.value)}
            placeholder="Tempel Kode Laporan Perangkat di sini..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-tokyo-darkText font-mono focus:outline-none focus:border-tokyo-pond placeholder-gray-600"
            required
          />
          <button
            type="submit"
            disabled={deviceReportLoading || !deviceReportInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-tokyo-pond text-[#0b0f19] text-xs font-extrabold shadow-md hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {deviceReportLoading ? 'Memproses...' : 'Import Perangkat'}
          </button>
        </form>
      </div>

      {/* Users List Board */}
      <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold text-tokyo-darkText flex items-center gap-2 border-b border-gray-800/40 pb-3">
          <Users size={16} className="text-tokyo-gold" /> Daftar Pengguna Terdaftar
        </h3>

        {regularUsers.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            Belum ada pengguna biasa yang dibuat. Silakan tambahkan satu di form atas!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-800/60 text-gray-500 font-bold uppercase tracking-widest text-[9px] pb-2">
                  <th className="pb-3 pr-4">Username</th>
                  <th className="pb-3 pr-4">Tanggal Dibuat</th>
                  <th className="pb-3 pr-4">Progress XP</th>
                  <th className="pb-3 pr-4">Perangkat Terdaftar (Maks. 2)</th>
                  <th className="pb-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900/40">
                {regularUsers.map(user => {
                  // Get XP from progress maps
                  const progress = userProgressMap[user.username];
                  const userXP = progress ? progress.xp : 0;
                  const userLv = progress ? progress.level : 1;
                  const devices = user.devices || [];
                  
                  return (
                    <tr key={user.username} className="hover:bg-gray-900/10 transition-colors">
                      <td className="py-3.5 font-semibold text-tokyo-darkText font-mono">{user.username}</td>
                      <td className="py-3.5 text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 rounded bg-tokyo-pond/10 border border-tokyo-pond/20 text-tokyo-pond text-[10px]">
                          Lv.{userLv} ({userXP} XP)
                        </span>
                      </td>
                      <td className="py-3.5">
                        {devices.length === 0 ? (
                          <span className="text-gray-600 italic text-[11px]">Belum ada perangkat</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 py-1">
                            {devices.map(d => {
                              const isCurrent = d.id === deviceId;
                              return (
                                <span 
                                  key={d.id} 
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] transition-all hover:bg-gray-900 ${
                                    isCurrent 
                                      ? 'bg-tokyo-sakura/15 border border-tokyo-sakura/30 text-tokyo-sakura font-semibold shadow-[0_0_8px_rgba(246,135,179,0.1)]' 
                                      : 'bg-gray-950/60 border border-gray-800 text-gray-400'
                                  }`}
                                  title={`Terdaftar: ${new Date(d.registeredAt).toLocaleString('id-ID')}`}
                                >
                                  <span>{d.name}</span>
                                  {isCurrent && (
                                    <span className="text-[8px] bg-tokyo-sakura text-[#0b0f19] px-1 py-0.2 rounded font-black tracking-wide">
                                      INI
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (confirm(`Apakah Anda yakin ingin menghapus pendaftaran perangkat "${d.name}" untuk pengguna "${user.username}"?`)) {
                                        removeUserDevice(user.username, d.id);
                                      }
                                    }}
                                    className="ml-1 text-gray-500 hover:text-tokyo-torii transition-colors font-bold text-xs leading-none"
                                    title="Hapus Perangkat"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 text-right flex items-center justify-end gap-2.5">
                        {/* Copy Access Token */}
                        <button
                          onClick={() => handleCopyTokenForExisting(user.username)}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-800 hover:border-tokyo-pond bg-gray-950/20 text-gray-400 hover:text-tokyo-pond transition-all flex items-center gap-1"
                          title="Salin Kode Akses"
                        >
                          {copiedExistingToken === user.username ? (
                            <>
                              <Check size={11} className="text-tokyo-bamboo" />
                              Tersalin
                            </>
                          ) : (
                            <>
                              <KeyRound size={11} />
                              Token
                            </>
                          )}
                        </button>

                        {/* Delete User Button */}
                        <button
                          onClick={() => {
                            if (confirm(`Apakah Anda yakin ingin menghapus pengguna "${user.username}"? Semua progress belajarnya akan terhapus dan aksesnya akan langsung dibatalkan.`)) {
                              deleteUser(user.username);
                              setSuccess(`Pengguna "${user.username}" berhasil dihapus.`);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-gray-800 hover:border-tokyo-torii bg-gray-950/20 text-gray-400 hover:text-tokyo-torii transition-colors"
                          title="Hapus Pengguna"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
