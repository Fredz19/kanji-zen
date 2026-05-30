import React, { useState, useEffect } from 'react';
import { Flame, Clock, Target, Play, ShieldAlert, BookOpen, Edit3, Award, Zap, HelpCircle, Layers, FileUp, Download, Eye, LogOut, Shield, Settings, Book, Smartphone, Copy, Check } from 'lucide-react';
import { useKanjiStore, getXPForNextLevel, ALL_ACHIEVEMENTS } from '../../store/useKanjiStore';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import Heatmap from './Heatmap';
import AdminPanel from './AdminPanel';

interface DashboardViewProps {
  onStartMode: (mode: 'flashcard' | 'quiz' | 'writing' | 'speed' | 'confusion' | 'dictionary' | 'jlpt-exam', level: 'N5' | 'N4' | 'N3' | 'ALL') => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function DashboardView({ onStartMode, darkMode, setDarkMode }: DashboardViewProps) {
  const {
    kanjiList,
    xp,
    level,
    streak,
    streakHistory,
    totalStudyTime,
    correctAnswers,
    totalAnswers,
    dailyQuests,
    unlockedAchievements,
    confusionCounts,
    initializeDatabase,
    recoverLeech,
    importCustomMarkdown,
    exportProgress,
    importProgress,
    resetDatabase,
    saveProgress
  } = useKanjiStore();

  const { currentUser, logout, getMyDeviceReport } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'learn' | 'admin'>('learn');

  // Device report state (for non-master users)
  const [deviceReportCode, setDeviceReportCode] = useState<string | null>(null);
  const [deviceReportLoading, setDeviceReportLoading] = useState(false);
  const [deviceReportCopied, setDeviceReportCopied] = useState(false);

  const handleGenerateDeviceReport = async () => {
    setDeviceReportLoading(true);
    const code = await getMyDeviceReport();
    setDeviceReportCode(code);
    setDeviceReportLoading(false);
  };

  const handleCopyDeviceReport = () => {
    if (!deviceReportCode) return;
    navigator.clipboard.writeText(deviceReportCode);
    setDeviceReportCopied(true);
    setTimeout(() => setDeviceReportCopied(false), 2500);
  };

  const [selectedLevelFilter, setSelectedLevelFilter] = useState<'N5' | 'N4' | 'N3' | 'ALL'>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize presets on first render
  useEffect(() => {
    initializeDatabase();
  }, []);

  const handleLogout = () => {
    // Simpan progress belajar sebelum keluar sesi
    saveProgress();
    // Logout auth session
    logout();
  };

  // Compute database metrics
  const now = Date.now();
  
  // Due review count
  const dueCount = kanjiList
    .filter(c => !c.isSuspended)
    .filter(c => (selectedLevelFilter === 'ALL' || c.level === selectedLevelFilter))
    .filter(c => c.nextReviewDate <= now).length;

  // Total learned cards (repetitions > 0)
  const learnedCount = kanjiList.filter(c => c.repetitions > 0).length;
  // Total mastered cards (repetitions >= 3)
  const masteredCount = kanjiList.filter(c => c.repetitions >= 3).length;

  const n5Total = kanjiList.filter(c => c.level === 'N5').length;
  const n5Mastered = kanjiList.filter(c => c.level === 'N5' && c.repetitions >= 3).length;

  const n4Total = kanjiList.filter(c => c.level === 'N4').length;
  const n4Mastered = kanjiList.filter(c => c.level === 'N4' && c.repetitions >= 3).length;

  const n3Total = kanjiList.filter(c => c.level === 'N3').length;
  const n3Mastered = kanjiList.filter(c => c.level === 'N3' && c.repetitions >= 3).length;

  // Leech lists (suspended mistakes >= 8)
  const leechCards = kanjiList.filter(c => c.isLeech && c.isSuspended);

  // Calculate overall recall accuracy
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 100;

  // Convert study time into readable hours and minutes
  const studyHours = Math.floor(totalStudyTime / 3600);
  const studyMinutes = Math.floor((totalStudyTime % 3600) / 60);

  // Parse custom imported markdown table
  const handleMarkdownImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Assume N5 or default import level
        const res = await importCustomMarkdown(text, 'N5');
        if (res.success) {
          triggerMessage(`Berhasil mengimpor ${res.count} Kanji baru dari tabel Markdown!`);
        } else {
          triggerMessage('Format tabel Markdown tidak valid atau kosong.');
        }
      }
    };
    reader.readAsText(file);
  };

  // Export JSON backups
  const handleExportBackup = () => {
    const dataStr = exportProgress();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `kanjizen_backup_${new Date().toLocaleDateString('sv')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import JSON backups
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const success = importProgress(text);
        if (success) {
          triggerMessage('Progress belajar berhasil dipulihkan dari cadangan JSON!');
        } else {
          triggerMessage('Gagal mengimpor file cadangan. JSON rusak atau tidak kompatibel.');
        }
      }
    };
    reader.readAsText(file);
  };

  const triggerMessage = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast alert banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-50 p-4 rounded-2xl bg-tokyo-card border border-tokyo-bamboo/30 text-tokyo-bamboo text-xs font-bold text-center shadow-lg backdrop-blur-md max-w-md mx-auto"
          >
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar and Quick Settings */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-tokyo-darkText tracking-tight flex items-center gap-2">
            KanjiZen <span className="text-sm font-normal text-gray-500 font-kanji">漢字禅</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Aplikasi belajar Kanji JLPT N5-N4-N3 tergamifikasi dengan Sains Memori.
          </p>
        </div>

        {/* Filters, Tabs, Theme & Logout Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {currentUser && (
            <div className="text-xs px-3.5 py-2 rounded-full border border-gray-800 bg-gray-950/20 text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tokyo-bamboo animate-pulse" />
              <span>Halo, <strong className="text-tokyo-darkText font-mono capitalize">{currentUser.username}</strong></span>
            </div>
          )}

          {/* Master Tabs */}
          {currentUser?.role === 'master' && (
            <div className="flex bg-gray-900/80 p-1 rounded-full border border-gray-800 text-xs">
              <button
                onClick={() => setActiveTab('learn')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all duration-300 flex items-center gap-1 ${
                  activeTab === 'learn'
                    ? 'bg-tokyo-sakura text-tokyo-darkText shadow-sakura'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <BookOpen size={12} />
                Belajar
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all duration-300 flex items-center gap-1 ${
                  activeTab === 'admin'
                    ? 'bg-tokyo-pond text-[#0b0f19] shadow-pond'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Shield size={12} />
                Akses 👑
              </button>
            </div>
          )}

          {/* Level Filters (visible in learn mode only) */}
          {activeTab === 'learn' && (
            <div className="flex bg-gray-900/80 p-1 rounded-full border border-gray-800 text-xs">
              {(['ALL', 'N5', 'N4', 'N3'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevelFilter(lvl)}
                  className={`px-3 py-1.5 rounded-full font-bold transition-all duration-300 ${
                    selectedLevelFilter === lvl
                      ? 'bg-tokyo-sakura text-tokyo-darkText shadow-sakura'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {lvl === 'ALL' ? 'Semua' : lvl}
                </button>
              ))}
            </div>
          )}

          {/* Light/Dark Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full border border-gray-800 bg-tokyo-card/30 text-gray-400 hover:text-tokyo-sakura transition-colors"
            title="Ubah Tema"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-full border border-gray-800 bg-tokyo-card/30 text-gray-400 hover:text-tokyo-torii transition-colors"
            title="Keluar Sesi"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'admin' && currentUser?.role === 'master' ? (
        <AdminPanel />
      ) : (
        <>
          {/* Premium Gamification Dashboard Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Streak Board */}
            <div className="p-4 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md flex items-center gap-4 relative overflow-hidden group">
              <div className="absolute inset-0 grid-bg opacity-10" />
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-tokyo-torii/20 border border-tokyo-torii/25 flex items-center justify-center text-tokyo-torii text-2xl fire-glow">
                <Flame className="animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Streak Belajar</span>
                <span className="text-xl font-black text-tokyo-darkText leading-none">{streak} Hari 🔥</span>
              </div>
            </div>

            {/* Study Timer */}
            <div className="p-4 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tokyo-pond/20 to-blue-500/20 border border-tokyo-pond/25 flex items-center justify-center text-tokyo-pond text-2xl">
                <Clock />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Total Waktu Belajar</span>
                <span className="text-xl font-black text-tokyo-darkText leading-none">
                  {studyHours > 0 ? `${studyHours}j ` : ''}{studyMinutes}m
                </span>
              </div>
            </div>

            {/* Overall Accuracy */}
            <div className="p-4 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tokyo-bamboo/20 to-emerald-500/20 border border-tokyo-bamboo/25 flex items-center justify-center text-tokyo-bamboo text-2xl">
                <Target />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Akurasi Ulasan</span>
                <span className="text-xl font-black text-tokyo-darkText leading-none">{accuracy}% Akurasi</span>
              </div>
            </div>

            {/* Level & Mastery Card */}
            <div className="p-4 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tokyo-fuji/20 to-purple-500/20 border border-tokyo-fuji/25 flex items-center justify-center text-tokyo-fuji text-2xl">
                <Award />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Mastery Terkunci</span>
                <span className="text-xl font-black text-tokyo-darkText leading-none">
                  {masteredCount} / {kanjiList.length} Kanji
                </span>
              </div>
            </div>
          </div>

          {/* Main Core SRS Ulasan CTA Banner */}
          <div className="p-6 rounded-3xl border border-tokyo-sakura/25 bg-gradient-to-br from-tokyo-card to-tokyo-card/65 backdrop-blur-xl shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6 glow-pulse-sakura relative overflow-hidden">
            {/* Decorative Grid */}
            <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
            
            <div className="relative z-10 space-y-2">
              <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-tokyo-sakura/20 text-tokyo-sakura border border-tokyo-sakura/30">
                Memory Engine Spaced Repetition (SRS)
              </span>
              <h2 className="text-2xl font-bold text-tokyo-darkText leading-tight">
                {dueCount > 0 ? `Ada ${dueCount} Ulasan Kanji Menanti!` : 'Ulasan Selesai untuk Sementara Waktu! 🎉'}
              </h2>
              <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
                {dueCount > 0
                  ? 'Tinjau kanji terjadwal sekarang untuk memperpanjang forgetting curve memorimu dan mendapatkan poin XP ganda.'
                  : 'Luar biasa! Semua target belajar sudah tercapai. Kamu bisa memulai Mode Quiz atau Latihan Menulis untuk bersenang-senang.'}
              </p>
            </div>

            <div className="relative z-10 shrink-0">
              <button
                onClick={() => onStartMode('flashcard', selectedLevelFilter)}
                disabled={dueCount === 0 && learnedCount === 0}
                className={`px-6 py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2.5 transition-all duration-300 transform active:scale-95 ${
                  dueCount > 0
                    ? 'bg-gradient-to-r from-tokyo-sakura to-tokyo-torii text-tokyo-darkText hover:shadow-torii'
                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                }`}
              >
                <Play size={18} fill="currentColor" />
                Mulai Ulasan ({dueCount})
              </button>
            </div>
          </div>

          {/* Suspended Leech Cards Alert Panel */}
          {leechCards.length > 0 && (
            <div className="p-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide">Peringatan: Terdeteksi Leech! 🚨</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                    Ada {leechCards.length} Kanji yang sering dilupakan dan ditangguhkan dari ulasan normal agar memori tidak lelah: <strong className="text-amber-500 text-xs">{leechCards.map(c => c.character).join(', ')}</strong>. Segera pulihkan mereka!
                  </p>
                </div>
              </div>
              <button
                onClick={() => onStartMode('writing', selectedLevelFilter)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-all shrink-0"
              >
                Pulihkan Leech (Tracer)
              </button>
            </div>
          )}

          {/* Left-Right Dual Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Side: XP Level and Quests Panel */}
            <div className="md:col-span-2 space-y-6">
              
              {/* XP & Level Board */}
              <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Tingkatan Level</span>
                    <span className="text-xl font-bold text-tokyo-darkText flex items-center gap-1.5">
                      Kanji Master Lv.{level}
                    </span>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-tokyo-pond/10 border border-tokyo-pond/25 text-tokyo-pond text-[10px] font-bold uppercase tracking-wider">
                    {xp} / {getXPForNextLevel(level)} XP
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-gray-900 border border-gray-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-tokyo-sakura via-tokyo-pond to-tokyo-bamboo transition-all duration-500 shadow-sakura"
                    style={{ width: `${(xp / getXPForNextLevel(level)) * 100}%` }}
                  />
                </div>

                {/* Achievements preview */}
                {unlockedAchievements.length > 0 && (
                  <div className="pt-2 border-t border-gray-800/40">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 block mb-2 font-semibold">Pencapaian Terbuka ({unlockedAchievements.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {unlockedAchievements.slice(0, 4).map(achId => {
                        const template = ALL_ACHIEVEMENTS.find(a => a.id === achId);
                        return (
                          <span
                            key={achId}
                            title={template?.description}
                            className="px-2 py-0.5 text-[10px] font-medium rounded bg-tokyo-sakura/10 border border-tokyo-sakura/20 text-tokyo-sakura"
                          >
                            🏆 {template?.title || achId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Quests Board */}
              <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-2">
                  <Zap size={14} className="text-tokyo-gold animate-bounce" /> Misi Harian Belajar
                </h3>
                
                <div className="space-y-3">
                  {dailyQuests.map(quest => (
                    <div
                      key={quest.id}
                      className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                        quest.completed
                          ? 'border-tokyo-bamboo/20 bg-tokyo-bamboo/5 text-gray-400'
                          : 'border-gray-800 bg-gray-950/20'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className={`text-xs font-semibold block ${quest.completed ? 'line-through text-gray-500' : 'text-tokyo-darkText'}`}>
                          {quest.title}
                        </span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold">
                          Kemajuan: {quest.current} / {quest.target}
                        </span>
                      </div>

                      {quest.completed ? (
                        <span className="w-6 h-6 rounded-full bg-tokyo-bamboo/25 text-tokyo-bamboo text-xs border border-tokyo-bamboo/45 flex items-center justify-center font-bold">
                          ✓
                        </span>
                      ) : (
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-tokyo-gold transition-all duration-300"
                            style={{ width: `${(quest.current / quest.target) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* GitHub heat map */}
              <Heatmap streakHistory={streakHistory} />
            </div>

            {/* Right Side: Mastery Hub and Menu Portals */}
            <div className="space-y-6">
              
              {/* Level Mastery Progressive Indicators */}
              <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1.5">
                  <Layers size={14} className="text-tokyo-sakura" /> Penguasaan Level Kanji
                </h3>

                {/* N5 Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-tokyo-darkText">Tingkat N5</span>
                    <span className="text-tokyo-sakura font-bold">{n5Mastered} / {n5Total} Mastered</span>
                  </div>
                  <div className="w-full h-2 bg-gray-900 border border-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tokyo-sakura transition-all duration-500"
                      style={{ width: `${n5Total > 0 ? (n5Mastered / n5Total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* N4 Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-tokyo-darkText">Tingkat N4</span>
                    <span className="text-tokyo-pond font-bold">{n4Mastered} / {n4Total} Mastered</span>
                  </div>
                  <div className="w-full h-2 bg-gray-900 border border-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tokyo-pond transition-all duration-500"
                      style={{ width: `${n4Total > 0 ? (n4Mastered / n4Total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* N3 Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-tokyo-darkText">Tingkat N3</span>
                    <span className="text-tokyo-bamboo font-bold">{n3Mastered} / {n3Total} Mastered</span>
                  </div>
                  <div className="w-full h-2 bg-gray-900 border border-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tokyo-bamboo transition-all duration-500"
                      style={{ width: `${n3Total > 0 ? (n3Mastered / n3Total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Alternative Gamified Learning Portals */}
              <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">
                  🎮 Arena Latihan & Game
                </h3>

                {/* Flashcard portal */}
                <button
                  onClick={() => onStartMode('flashcard', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-sakura bg-gray-950/20 hover:bg-tokyo-sakura/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-sakura/10 text-tokyo-sakura">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Spaced Flashcards</span>
                      <span className="text-[10px] text-gray-500 block">Metode Flashcard Aktif SRS</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-sakura group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Quiz portal */}
                <button
                  onClick={() => onStartMode('quiz', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-pond bg-gray-950/20 hover:bg-tokyo-pond/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-pond/10 text-tokyo-pond">
                      <Award size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Arena Kuis (Cloze)</span>
                      <span className="text-[10px] text-gray-500 block">Kuis Pilihan & Tebak Kalimat</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-pond group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Writing portal */}
                <button
                  onClick={() => onStartMode('writing', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-bamboo bg-gray-950/20 hover:bg-tokyo-bamboo/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-bamboo/10 text-tokyo-bamboo">
                      <Edit3 size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Goresan Kanji (Canvas)</span>
                      <span className="text-[10px] text-gray-500 block">Latih Menulis & Tracing Stroke</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-bamboo group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Speed Challenge portal */}
                <button
                  onClick={() => onStartMode('speed', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-gold bg-gray-950/20 hover:bg-tokyo-gold/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-gold/10 text-tokyo-gold">
                      <Zap size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Tantangan Kilat (60s)</span>
                      <span className="text-[10px] text-gray-500 block">Kuis Berpacu Waktu & Combo XP</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-gold group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Visual similarity portal */}
                <button
                  onClick={() => onStartMode('confusion', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-torii bg-gray-950/20 hover:bg-tokyo-torii/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-torii/10 text-tokyo-torii">
                      <Layers size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Kembaran Mirip Drill</span>
                      <span className="text-[10px] text-gray-500 block">Latih Bedakan Kanji土vs士 dll</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-torii group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Kanji Dictionary portal */}
                <button
                  onClick={() => onStartMode('dictionary', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-sakura bg-gray-950/20 hover:bg-tokyo-sakura/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-sakura/10 text-tokyo-sakura">
                      <Book size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Kamus Kanji Zen 📖</span>
                      <span className="text-[10px] text-gray-500 block">Jelajahi Kanji per Topik & Detail Modal</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-sakura group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* JLPT Mock Exam portal */}
                <button
                  onClick={() => onStartMode('jlpt-exam', selectedLevelFilter)}
                  className="w-full p-3 rounded-2xl border border-gray-800 hover:border-tokyo-pond bg-gray-950/20 hover:bg-tokyo-pond/5 text-left transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-tokyo-pond/10 text-tokyo-pond">
                      <Award size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-tokyo-darkText block">Simulasi Ujian JLPT ⏱️</span>
                      <span className="text-[10px] text-gray-500 block">20 Soal Formal Terbatas Waktu 15 Menit</span>
                    </div>
                  </div>
                  <Play size={12} className="text-gray-600 group-hover:text-tokyo-pond group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>

              {/* Backup Management and Markdown Imports */}
              <div className="p-5 rounded-3xl border border-gray-800/60 bg-tokyo-card/30 backdrop-blur-md space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">
                  💾 Manajemen Data & Cadangan
                </h3>
                
                <div className="space-y-2 text-xs">
                  {/* Markdown Import */}
                  <div className="relative">
                    <label
                      htmlFor="md-uploader"
                      className="w-full py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-950/20 text-gray-300 flex items-center justify-center gap-2 cursor-pointer font-semibold transition-colors"
                    >
                      <FileUp size={14} /> Impor Tabel Markdown
                    </label>
                    <input
                      id="md-uploader"
                      type="file"
                      accept=".md"
                      onChange={handleMarkdownImport}
                      className="hidden"
                    />
                  </div>

                  {/* JSON export backup */}
                  <button
                    onClick={handleExportBackup}
                    className="w-full py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-950/20 text-gray-300 flex items-center justify-center gap-2 font-semibold transition-colors"
                  >
                    <Download size={14} /> Ekspor Cadangan (.json)
                  </button>

                  {/* JSON import backup */}
                  <div className="relative">
                    <label
                      htmlFor="json-uploader"
                      className="w-full py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-950/20 text-gray-300 flex items-center justify-center gap-2 cursor-pointer font-semibold transition-colors"
                    >
                      <FileUp size={14} /> Pulihkan Cadangan (.json)
                    </label>
                    <input
                      id="json-uploader"
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </div>

                  {/* Reset database */}
                  <button
                    onClick={() => {
                      if (confirm('Apakah Anda yakin ingin menghapus seluruh kemajuan belajar Anda? Data ulasan dan XP akan direset sepenuhnya.')) {
                        resetDatabase();
                        triggerMessage('Database berhasil direset ke pengaturan pabrik.');
                      }
                    }}
                    className="w-full py-2 text-[10px] text-tokyo-torii hover:underline transition-colors font-medium text-center"
                  >
                    Reset Semua Progress Belajar
                  </button>
                </div>
              </div>


            </div>
          </div>
        </>
      )}
    </div>
  );
}
