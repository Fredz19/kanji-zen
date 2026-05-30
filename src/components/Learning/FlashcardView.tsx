import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, HelpCircle, ArrowRight, Keyboard, RefreshCw, Layers, BookOpen, AlertCircle } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { useAudio } from '../../hooks/useAudio';
import { TOPIC_CATEGORIES, getKanjiTopicId } from '../../utils/topics';

interface FlashcardViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

const TOPIC_COLOR_MAPS: Record<string, {
  bg: string;
  hoverBg: string;
  text: string;
  border: string;
  shadow: string;
  glow: string;
}> = {
  ALL: {
    bg: 'bg-tokyo-sakura/10',
    hoverBg: 'hover:bg-tokyo-sakura/20 hover:border-tokyo-sakura/50',
    text: 'text-tokyo-sakura',
    border: 'border-tokyo-sakura/20',
    shadow: 'hover:shadow-sakura',
    glow: 'group-hover:shadow-sakura'
  },
  numbers: {
    bg: 'bg-tokyo-gold/10',
    hoverBg: 'hover:bg-tokyo-gold/20 hover:border-tokyo-gold/50',
    text: 'text-tokyo-gold',
    border: 'border-tokyo-gold/20',
    shadow: 'hover:shadow-gold',
    glow: 'group-hover:shadow-gold'
  },
  time: {
    bg: 'bg-tokyo-pond/10',
    hoverBg: 'hover:bg-tokyo-pond/20 hover:border-tokyo-pond/50',
    text: 'text-tokyo-pond',
    border: 'border-tokyo-pond/20',
    shadow: 'hover:shadow-pond',
    glow: 'group-hover:shadow-pond'
  },
  nature: {
    bg: 'bg-tokyo-bamboo/10',
    hoverBg: 'hover:bg-tokyo-bamboo/20 hover:border-tokyo-bamboo/50',
    text: 'text-tokyo-bamboo',
    border: 'border-tokyo-bamboo/20',
    shadow: 'hover:shadow-bamboo',
    glow: 'group-hover:shadow-bamboo'
  },
  people: {
    bg: 'bg-tokyo-sakura/10',
    hoverBg: 'hover:bg-tokyo-sakura/20 hover:border-tokyo-sakura/50',
    text: 'text-tokyo-sakura',
    border: 'border-tokyo-sakura/20',
    shadow: 'hover:shadow-sakura',
    glow: 'group-hover:shadow-sakura'
  },
  directions: {
    bg: 'bg-tokyo-torii/10',
    hoverBg: 'hover:bg-tokyo-torii/20 hover:border-tokyo-torii/50',
    text: 'text-tokyo-torii',
    border: 'border-tokyo-torii/20',
    shadow: 'hover:shadow-torii',
    glow: 'group-hover:shadow-torii'
  },
  actions: {
    bg: 'bg-tokyo-fuji/10',
    hoverBg: 'hover:bg-tokyo-fuji/20 hover:border-tokyo-fuji/50',
    text: 'text-tokyo-fuji',
    border: 'border-tokyo-fuji/20',
    shadow: 'hover:shadow-fuji',
    glow: 'group-hover:shadow-fuji'
  },
  adjectives: {
    bg: 'bg-amber-500/10',
    hoverBg: 'hover:bg-amber-500/20 hover:border-amber-500/50',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    shadow: 'hover:shadow-amber',
    glow: 'group-hover:shadow-amber'
  },
  places: {
    bg: 'bg-blue-500/10',
    hoverBg: 'hover:bg-blue-500/20 hover:border-blue-500/50',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    shadow: 'hover:shadow-blue',
    glow: 'group-hover:shadow-blue'
  }
};

export default function FlashcardView({ onBackToDashboard, selectedLevel }: FlashcardViewProps) {
  const reviewCard = useKanjiStore(state => state.reviewCard);
  const kanjiList = useKanjiStore(state => state.kanjiList);
  const audio = useAudio();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<KanjiItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  
  // Speed metrics tracking
  const startTimeRef = useRef<number>(0);
  const [cardRevealTime, setCardRevealTime] = useState<number>(0);

  // Text-To-Speech Synthesis helper
  const speakJapanese = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85; // Natural pace
    window.speechSynthesis.speak(utterance);
  };

  const now = Date.now();

  // Dynamic statistics calculator for categories
  const getCategoryStats = (catId: string) => {
    let filtered = kanjiList.filter(c => !c.isSuspended);
    if (selectedLevel !== 'ALL') {
      filtered = filtered.filter(c => c.level === selectedLevel);
    }
    if (catId !== 'ALL') {
      filtered = filtered.filter(c => getKanjiTopicId(c.character) === catId);
    }

    const total = filtered.length;
    const due = filtered.filter(c => c.nextReviewDate <= now).length;
    const learned = filtered.filter(c => c.repetitions > 0).length;

    return { total, due, learned };
  };

  // Compile active queue of cards based on Selected Level & Category
  useEffect(() => {
    if (selectedCategory === null) return;

    let filtered = kanjiList.filter(c => !c.isSuspended);

    if (selectedLevel !== 'ALL') {
      filtered = filtered.filter(c => c.level === selectedLevel);
    }

    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(c => getKanjiTopicId(c.character) === selectedCategory);
    }

    // Filter due cards (due date is in past or today)
    let due = filtered.filter(c => c.nextReviewDate <= now);

    // If no cards are due, provide a "Study New Cards" batch of unreviewed items
    if (due.length === 0) {
      due = filtered.filter(c => c.repetitions === 0).slice(0, 10);
    }

    // If still empty, fall back to showing all for practice
    if (due.length === 0) {
      due = filtered.slice(0, 10);
    }

    // Shuffle the queue to avoid clustering identical radicals (interleaving study principle)
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    
    setReviewQueue(shuffled);
    setCurrentIdx(0);
    setIsFlipped(false);
    setSessionCompleted(shuffled.length === 0);
    
    // Start timing first card
    startTimeRef.current = Date.now();
  }, [selectedLevel, selectedCategory, kanjiList]);

  // Handle card timing resets
  useEffect(() => {
    if (reviewQueue.length > 0 && currentIdx < reviewQueue.length) {
      startTimeRef.current = Date.now();
      setIsFlipped(false);
    }
  }, [currentIdx, reviewQueue]);

  const activeCard = reviewQueue[currentIdx];

  // Flip action handler
  const handleFlip = () => {
    if (!isFlipped) {
      // Calculate delay before reveal
      const elapsed = Date.now() - startTimeRef.current;
      setCardRevealTime(elapsed);
      // Auto-pronounce big Kanji character on first reveal
      if (activeCard) {
        speakJapanese(activeCard.character);
      }
    }
    setIsFlipped(!isFlipped);
  };

  // SRS answer submit handler
  const handleSRSSelection = (status: 'forgot' | 'hard' | 'good' | 'easy') => {
    if (!activeCard) return;

    // Trigger game Audio Synthesizer
    if (status === 'forgot') {
      audio.playFailure();
    } else {
      audio.playSuccess();
    }

    // Register review in database
    reviewCard(activeCard.id, status, cardRevealTime);

    // Proceed to next card or complete session
    if (currentIdx + 1 < reviewQueue.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setSessionCompleted(true);
    }
  };

  // Bind keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sessionCompleted || selectedCategory === null) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === '1') handleSRSSelection('forgot');
        if (e.key === '2') handleSRSSelection('hard');
        if (e.key === '3') handleSRSSelection('good');
        if (e.key === '4') handleSRSSelection('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, activeCard, currentIdx, reviewQueue, sessionCompleted, selectedCategory]);

  // CATEGORY LIST DATA including "Semua"
  const allCategoriesList = [
    { id: 'ALL', name: 'Semua Kategori', emoji: '📚' },
    ...TOPIC_CATEGORIES
  ];

  return (
    <div className="flex flex-col items-center justify-between min-h-[80vh] py-6 px-4">
      
      {/* Session progress / Category selector header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <button
          onClick={selectedCategory === null ? onBackToDashboard : () => setSelectedCategory(null)}
          className="text-xs uppercase tracking-wider text-gray-400 hover:text-tokyo-sakura transition-colors font-semibold border border-gray-800 px-4 py-2 rounded-full bg-tokyo-card/30 backdrop-blur-md hover:border-gray-700 shadow-sm"
        >
          {selectedCategory === null ? '← Dashboard' : '← Ganti Kategori'}
        </button>

        {selectedCategory !== null && !sessionCompleted && reviewQueue.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-semibold">
              Kategori:{' '}
              <strong className="text-tokyo-darkText font-semibold">
                {allCategoriesList.find(c => c.id === selectedCategory)?.name}
              </strong>
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400 font-medium">
              Ulasan: <strong className="text-tokyo-sakura">{currentIdx + 1}</strong> / {reviewQueue.length}
            </span>
            <div className="w-20 sm:w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-tokyo-sakura to-tokyo-pond transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / reviewQueue.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* RENDER CATEGORY PICKER */}
      {selectedCategory === null ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl text-center space-y-6 flex-1 flex flex-col justify-center"
        >
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-tokyo-sakura/10 text-tokyo-sakura flex items-center justify-center mx-auto text-xl shadow-sakura border border-tokyo-sakura/20 mb-2">
              <Layers />
            </div>
            <h2 className="text-2xl font-extrabold text-tokyo-darkText tracking-tight">
              Pilih Kategori Belajar Kanji
            </h2>
            <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
              Pilih kategori di bawah untuk berlatih flashcards secara spesifik. Sistem Spaced Repetition (SRS) akan memprioritaskan kanji yang sudah jatuh tempo!
            </p>
            <div className="inline-block px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-[10px] uppercase tracking-wider font-extrabold text-tokyo-sakura mt-2">
              Tingkat JLPT: <span className="text-tokyo-darkText font-mono">{selectedLevel === 'ALL' ? 'Semua Tingkat' : selectedLevel}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-4">
            {allCategoriesList.map(category => {
              const stats = getCategoryStats(category.id);
              const colorConfig = TOPIC_COLOR_MAPS[category.id] || TOPIC_COLOR_MAPS.places;
              const isEmpty = stats.total === 0;

              return (
                <button
                  key={category.id}
                  disabled={isEmpty}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`group relative p-4 rounded-3xl border text-left bg-tokyo-card/30 backdrop-blur-md transition-all duration-300 flex flex-col justify-between h-36 ${
                    isEmpty 
                      ? 'opacity-40 cursor-not-allowed border-gray-900 bg-gray-950/5' 
                      : `${colorConfig.border} ${colorConfig.hoverBg} ${colorConfig.shadow} hover:-translate-y-1`
                  }`}
                >
                  {/* Decorative faint grid in button */}
                  <div className="absolute inset-0 grid-bg opacity-5 rounded-3xl pointer-events-none" />

                  {/* Top line: Emoji and Due Badge */}
                  <div className="relative z-10 w-full flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-2xl ${colorConfig.bg} flex items-center justify-center text-lg border border-white/5`}>
                      {category.emoji}
                    </div>
                    {stats.due > 0 && !isEmpty && (
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-tokyo-torii/15 text-tokyo-torii border border-tokyo-torii/30 animate-pulse">
                        {stats.due} Ulasan
                      </span>
                    )}
                  </div>

                  {/* Bottom line: Title and counts */}
                  <div className="relative z-10 mt-4 space-y-1">
                    <span className="text-xs font-bold text-tokyo-darkText block group-hover:text-white transition-colors truncate">
                      {category.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wide">
                      {isEmpty ? (
                        <span>Kosong</span>
                      ) : (
                        <>
                          <span>Total: <strong className="text-gray-400">{stats.total}</strong></span>
                          <span>•</span>
                          <span className="text-tokyo-bamboo/80">Lulus: {stats.learned}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* RENDER SESSION / FLASHCARDS */
        <div className="flex-1 flex items-center justify-center w-full max-w-xl">
          <AnimatePresence mode="wait">
            {sessionCompleted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full text-center p-8 rounded-3xl border border-tokyo-bamboo/20 bg-tokyo-card/50 backdrop-blur-lg shadow-glass glow-pulse-bamboo"
              >
                <div className="w-20 h-20 bg-tokyo-bamboo/10 rounded-full flex items-center justify-center mx-auto mb-6 text-tokyo-bamboo text-4xl border border-tokyo-bamboo/20">
                  ✓
                </div>
                <h2 className="text-2xl font-bold text-tokyo-darkText mb-3">Sesi Selesai! 🎉</h2>
                <p className="text-sm text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                  Luar biasa! Semua ulasan untuk kategori{' '}
                  <strong className="text-tokyo-sakura font-semibold">
                    {allCategoriesList.find(c => c.id === selectedCategory)?.name}
                  </strong>{' '}
                  telah diselesaikan. Memori Anda kini semakin diperkuat!
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSessionCompleted(false);
                    }}
                    className="flex-1 py-3.5 rounded-2xl border border-gray-800 hover:border-gray-700 text-tokyo-darkText font-bold bg-tokyo-card/40 hover:bg-tokyo-card/85 transition-all active:scale-[0.98]"
                  >
                    Ganti Kategori Lain
                  </button>
                  <button
                    onClick={onBackToDashboard}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-tokyo-sakura to-tokyo-torii text-tokyo-darkText font-bold shadow-lg hover:shadow-torii transition-all transform active:scale-[0.98]"
                  >
                    Dashboard
                  </button>
                </div>
              </motion.div>
            ) : reviewQueue.length === 0 ? (
              /* EMPTY CATEGORY JLPT LEVEL FALLBACK */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full text-center p-8 rounded-3xl border border-tokyo-torii/20 bg-tokyo-card/50 backdrop-blur-lg shadow-glass flex flex-col justify-center items-center"
              >
                <div className="w-16 h-16 bg-tokyo-torii/10 rounded-2xl flex items-center justify-center mb-5 text-tokyo-torii text-3xl border border-tokyo-torii/20">
                  <AlertCircle />
                </div>
                <h3 className="text-xl font-bold text-tokyo-darkText mb-2">Kanji Tidak Ditemukan</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mb-6 leading-relaxed">
                  Tidak ada Kanji untuk kategori <strong className="text-tokyo-torii">{allCategoriesList.find(c => c.id === selectedCategory)?.name}</strong> di tingkat <strong className="text-tokyo-torii">{selectedLevel === 'ALL' ? 'Semua Tingkat' : selectedLevel}</strong>.
                </p>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-6 py-3 rounded-2xl bg-tokyo-card border border-gray-800 hover:border-tokyo-sakura text-tokyo-sakura font-bold transition-all text-xs flex items-center gap-1.5"
                >
                  ← Pilih Kategori Lain
                </button>
              </motion.div>
            ) : (
              activeCard && (
                <div className="w-full perspective-1000 h-[480px]">
                  <motion.div
                    key={activeCard.id}
                    className="w-full h-full transform-style-3d relative cursor-pointer"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    onClick={handleFlip}
                  >
                    {/* FRONT FACE */}
                    <div className="absolute inset-0 backface-hidden w-full h-full p-6 rounded-3xl border border-gray-800 bg-tokyo-card/45 backdrop-blur-xl shadow-glass flex flex-col justify-between overflow-hidden">
                      {/* Grid texture overlay */}
                      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

                      {/* Card Top badges */}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-tokyo-torii/15 text-tokyo-torii border border-tokyo-torii/30 shadow-torii">
                          {activeCard.level}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 text-[10px] rounded-md bg-gray-800 border border-gray-700 text-gray-300 font-semibold">
                            {activeCard.strokeCount} Goresan
                          </span>
                          <div className="flex gap-0.5 text-tokyo-gold">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <span key={i} className="text-sm">★</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Big Center Kanji */}
                      <div className="relative z-10 text-center flex flex-col items-center justify-center py-8">
                        <span className="text-[100px] font-kanji font-bold text-tokyo-darkText selection:bg-transparent leading-none">
                          {activeCard.character}
                        </span>
                        <p className="text-xs text-gray-500 tracking-widest mt-4 uppercase font-bold">
                          Ketuk kartu untuk membalik
                        </p>
                      </div>

                      {/* Bottom Hints */}
                      <div className="relative z-10 flex items-center justify-between border-t border-gray-800/60 pt-4">
                        <div className="text-left">
                          <span className="text-[10px] uppercase text-gray-500 tracking-wider block font-bold">Arti</span>
                          <span className="text-sm font-bold text-tokyo-sakura truncate max-w-[200px] block">
                            {activeCard.meaning}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-800/80 flex items-center justify-center text-gray-400 hover:text-tokyo-pond hover:bg-tokyo-pond/10 transition-colors">
                          <HelpCircle size={18} />
                        </div>
                      </div>
                    </div>

                    {/* BACK FACE */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full p-6 rounded-3xl border border-tokyo-sakura/20 bg-tokyo-card/65 backdrop-blur-2xl shadow-glass flex flex-col justify-between overflow-y-auto">
                      {/* Card content top */}
                      <div>
                        {/* Badge indicator */}
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-3xl font-kanji font-bold text-tokyo-darkText leading-none">{activeCard.character}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speakJapanese(activeCard.character);
                              }}
                              className="p-1 rounded-full text-gray-400 hover:text-tokyo-sakura hover:bg-tokyo-sakura/10 transition-colors"
                            >
                              <Volume2 size={16} />
                            </button>
                          </div>
                          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-tokyo-pond to-tokyo-sakura tracking-wide">
                            {activeCard.meaning}
                          </span>
                        </div>

                        {/* Readings Block */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="p-3 rounded-2xl bg-gray-900/65 border border-gray-800">
                            <span className="text-[10px] uppercase text-tokyo-sakura tracking-wider block mb-1 font-semibold">Onyomi</span>
                            <span className="text-sm font-medium text-tokyo-darkText">
                              {activeCard.onyomi && activeCard.onyomi.length > 0 ? activeCard.onyomi.join(', ') : '-'}
                            </span>
                          </div>
                          <div className="p-3 rounded-2xl bg-gray-900/65 border border-gray-800">
                            <span className="text-[10px] uppercase text-tokyo-pond tracking-wider block mb-1 font-semibold">Kunyomi</span>
                            <span className="text-sm font-medium text-tokyo-darkText">
                              {activeCard.kunyomi && activeCard.kunyomi.length > 0 ? activeCard.kunyomi.join(', ') : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Mnemonic Block */}
                        {activeCard.mnemonic && (
                          <div className="p-3.5 rounded-2xl bg-tokyo-sakura/5 border border-tokyo-sakura/20 mb-4">
                            <span className="text-[10px] uppercase text-tokyo-sakura tracking-wider block mb-1 font-semibold">💡 Jembatan Keledai</span>
                            <p className="text-xs text-gray-300 leading-relaxed font-normal">
                              {activeCard.mnemonic}
                            </p>
                          </div>
                        )}

                        {/* Vocabulary */}
                        {activeCard.vocabulary && activeCard.vocabulary.length > 0 && (
                          <div className="mb-4">
                            <span className="text-[10px] uppercase text-gray-500 tracking-wider block mb-2 font-semibold">Kosakata Penting</span>
                            <div className="space-y-1.5">
                              {activeCard.vocabulary.slice(0, 3).map((v, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between p-2 rounded-xl bg-gray-800/35 border border-gray-800 text-xs hover:bg-gray-800/60 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakJapanese(v.word);
                                  }}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-tokyo-darkText font-medium text-sm">{v.word}</strong>
                                    {v.reading && (
                                      <span className="text-gray-400 text-[10px]">（{v.reading}）</span>
                                    )}
                                  </div>
                                  <span className="text-tokyo-sakura text-right font-medium max-w-[200px] truncate">{v.meaning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Context Sentences */}
                        {activeCard.sentences && activeCard.sentences.length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase text-gray-500 tracking-wider block mb-2 font-semibold">Contoh Kalimat Konteks</span>
                            <div className="space-y-2">
                              {activeCard.sentences.slice(0, 2).map((s, i) => (
                                <div
                                  key={i}
                                  className="p-2.5 rounded-xl bg-tokyo-pond/5 border border-tokyo-pond/15 text-[11px] leading-relaxed cursor-pointer hover:bg-tokyo-pond/10 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakJapanese(s.audioText);
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-1 mb-1">
                                    <span className="text-tokyo-darkText font-medium font-kanji text-xs leading-normal">{s.japanese}</span>
                                    <Volume2 size={13} className="text-tokyo-pond shrink-0 mt-0.5" />
                                  </div>
                                  <p className="text-gray-400 italic font-normal leading-normal">{s.indonesian}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom Flip Action */}
                      <div className="border-t border-gray-800 pt-3 mt-4 text-center">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5">
                          <RefreshCw size={10} className="animate-spin-slow" /> Ketuk untuk membalik kembali
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SRS Deck and keyboard shortcuts panel */}
      {selectedCategory !== null && reviewQueue.length > 0 && !sessionCompleted && (
        <div className="w-full max-w-xl mt-6 flex flex-col gap-4">
          {isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-4 gap-2.5"
            >
              <button
                onClick={() => handleSRSSelection('forgot')}
                className="py-3 rounded-2xl bg-tokyo-torii/10 hover:bg-tokyo-torii/25 text-tokyo-torii border border-tokyo-torii/25 hover:border-tokyo-torii/50 hover:shadow-torii flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group"
              >
                <span className="text-lg">😭</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Lupa</span>
                <kbd className="absolute bottom-1 right-2 text-[8px] opacity-35 bg-gray-900 px-1 rounded border border-gray-700">1</kbd>
              </button>

              <button
                onClick={() => handleSRSSelection('hard')}
                className="py-3 rounded-2xl bg-tokyo-gold/10 hover:bg-tokyo-gold/25 text-tokyo-gold border border-tokyo-gold/25 hover:border-tokyo-gold/50 flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group"
              >
                <span className="text-lg">😕</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Sulit</span>
                <kbd className="absolute bottom-1 right-2 text-[8px] opacity-35 bg-gray-900 px-1 rounded border border-gray-700">2</kbd>
              </button>

              <button
                onClick={() => handleSRSSelection('good')}
                className="py-3 rounded-2xl bg-tokyo-pond/10 hover:bg-tokyo-pond/25 text-tokyo-pond border border-tokyo-pond/25 hover:border-tokyo-pond/50 hover:shadow-pond flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group"
              >
                <span className="text-lg">🙂</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Bagus</span>
                <kbd className="absolute bottom-1 right-2 text-[8px] opacity-35 bg-gray-900 px-1 rounded border border-gray-700">3</kbd>
              </button>

              <button
                onClick={() => handleSRSSelection('easy')}
                className="py-3 rounded-2xl bg-tokyo-bamboo/10 hover:bg-tokyo-bamboo/25 text-tokyo-bamboo border border-tokyo-bamboo/25 hover:border-tokyo-bamboo/50 hover:shadow-bamboo flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group"
              >
                <span className="text-lg">🔥</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Mudah</span>
                <kbd className="absolute bottom-1 right-2 text-[8px] opacity-35 bg-gray-900 px-1 rounded border border-gray-700">4</kbd>
              </button>
            </motion.div>
          )}

          {!isFlipped && (
            <motion.button
              onClick={handleFlip}
              className="w-full py-4 rounded-2xl border border-tokyo-sakura/30 hover:border-tokyo-sakura/60 bg-tokyo-sakura/10 hover:bg-tokyo-sakura/20 text-tokyo-sakura font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-all duration-300 group"
            >
              Buka Arti & Ulas <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          )}

          {/* Keyboard shortcut display bar */}
          <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500 uppercase tracking-widest font-semibold pt-2 border-t border-gray-800/40">
            <span className="flex items-center gap-1.5">
              <Keyboard size={12} className="text-gray-600" />
              <kbd className="bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-gray-300">Space</kbd> untuk Balik
            </span>
            {isFlipped && (
              <span className="flex items-center gap-1.5">
                <kbd className="bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-gray-300">1</kbd>–
                <kbd className="bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-gray-300">4</kbd> untuk Ulas
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
