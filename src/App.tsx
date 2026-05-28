import React, { useState, useEffect } from 'react';
import { useKanjiStore } from './store/useKanjiStore';
import { useAuthStore } from './store/useAuthStore';
import DashboardView from './components/Dashboard/DashboardView';
import FlashcardView from './components/Learning/FlashcardView';
import QuizView from './components/Learning/QuizView';
import WritingView from './components/Learning/WritingView';
import SpeedView from './components/Learning/SpeedView';
import ConfusionView from './components/Learning/ConfusionView';
import KanjiListView from './components/Learning/KanjiListView';
import JLPTExamView from './components/Learning/JLPTExamView';
import LoginView from './components/Dashboard/LoginView';

export default function App() {
  const initializeDatabase = useKanjiStore(state => state.initializeDatabase);
  const incrementStudyTime = useKanjiStore(state => state.incrementStudyTime);
  const activeUsername = useKanjiStore(state => state.activeUsername);
  const switchUserProgress = useKanjiStore(state => state.switchUserProgress);
  
  const currentUser = useAuthStore(state => state.currentUser);
  const initializeAuth = useAuthStore(state => state.initializeAuth);
  
  const [activeView, setActiveView] = useState<'dashboard' | 'flashcard' | 'quiz' | 'writing' | 'speed' | 'confusion' | 'dictionary' | 'jlpt-exam'>('dashboard');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<'N5' | 'N4' | 'N3' | 'ALL'>('ALL');
  
  // Theme dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Initialize auth system on boot
  useEffect(() => {
    initializeAuth();
  }, []);

  // Initialize presets and sync active user progress
  useEffect(() => {
    if (currentUser) {
      // Pastikan progress yang dimuat cocok dengan user yang sedang login aktif
      if (activeUsername !== currentUser.username) {
        switchUserProgress(currentUser.username);
      } else {
        initializeDatabase();
      }
    }
  }, [currentUser, activeUsername]);

  // Sync Tailwind class-based dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Track study time in seconds
  useEffect(() => {
    const timer = setInterval(() => {
      // Hanya lacak waktu belajar jika pengguna aktif sedang login & tab aktif/focused
      if (currentUser && document.visibilityState === 'visible') {
        incrementStudyTime(1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentUser]);

  const handleStartMode = (mode: 'flashcard' | 'quiz' | 'writing' | 'speed' | 'confusion' | 'dictionary' | 'jlpt-exam', level: 'N5' | 'N4' | 'N3' | 'ALL') => {
    setSelectedLevelFilter(level);
    setActiveView(mode);
  };

  // 1. Proteksi Layar Login: Jika belum masuk sesi, tampilkan layar login premium
  if (!currentUser) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        darkMode ? 'bg-[#0b0f19] text-gray-100' : 'bg-[#f5f7fa] text-gray-800'
      }`}>
        <div className={`fixed inset-0 pointer-events-none transition-all duration-300 ${
          darkMode ? 'grid-bg opacity-35' : 'grid-bg-light opacity-25'
        }`} />
        <LoginView />
      </div>
    );
  }

  // 2. Tampilan Utama Aplikasi setelah sukses login
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-[#0b0f19] text-gray-100' : 'bg-[#f5f7fa] text-gray-800'
    }`}>
      {/* Decorative Grid Overlay background */}
      <div className={`fixed inset-0 pointer-events-none transition-all duration-300 ${
        darkMode ? 'grid-bg opacity-35' : 'grid-bg-light opacity-25'
      }`} />

      {/* Main Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Render active mounted view */}
        {activeView === 'dashboard' && (
          <DashboardView
            onStartMode={handleStartMode}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        )}

        {activeView === 'flashcard' && (
          <FlashcardView
            selectedLevel={selectedLevelFilter}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'quiz' && (
          <QuizView
            selectedLevel={selectedLevelFilter}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'writing' && (
          <WritingView
            selectedLevel={selectedLevelFilter}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'speed' && (
          <SpeedView
            selectedLevel={selectedLevelFilter}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'confusion' && (
          <ConfusionView
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'dictionary' && (
          <KanjiListView
            selectedLevel={selectedLevelFilter}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'jlpt-exam' && (
          <JLPTExamView
            selectedLevel={selectedLevelFilter}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}
      </div>
    </div>
  );
}
