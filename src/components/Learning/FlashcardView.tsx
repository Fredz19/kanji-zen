import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, HelpCircle, Check, ArrowRight, Keyboard, RefreshCw } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { useAudio } from '../../hooks/useAudio';

interface FlashcardViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

export default function FlashcardView({ onBackToDashboard, selectedLevel }: FlashcardViewProps) {
  const reviewCard = useKanjiStore(state => state.reviewCard);
  const audio = useAudio();

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

  // Compile active queue of cards due for review, or new ones if none are due
  useEffect(() => {
    const list = useKanjiStore.getState().kanjiList;
    const now = Date.now();
    let filtered = list.filter(c => !c.isSuspended);

    if (selectedLevel !== 'ALL') {
      filtered = filtered.filter(c => c.level === selectedLevel);
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
  }, [selectedLevel]);

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
      if (sessionCompleted) return;

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
  }, [isFlipped, activeCard, currentIdx, reviewQueue, sessionCompleted]);

  return (
    <div className="flex flex-col items-center justify-between min-h-[80vh] py-6 px-4">
      {/* Session progress header */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4">
        <button
          onClick={onBackToDashboard}
          className="text-xs uppercase tracking-wider text-gray-400 hover:text-tokyo-torii transition-colors font-medium border border-gray-800 px-3 py-1.5 rounded-full bg-tokyo-card/30 backdrop-blur-md"
        >
          ← Dashboard
        </button>
        
        {!sessionCompleted && reviewQueue.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium">
              Ulasan: <strong className="text-tokyo-sakura">{currentIdx + 1}</strong> / {reviewQueue.length}
            </span>
            <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-tokyo-sakura to-tokyo-pond transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / reviewQueue.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-xl">
        <AnimatePresence mode="wait">
          {sessionCompleted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full text-center p-8 rounded-3xl border border-tokyo-bamboo/20 bg-tokyo-card/50 backdrop-blur-lg shadow-glass glow-pulse-bamboo"
            >
              <div className="w-20 h-20 bg-tokyo-bamboo/10 rounded-full flex items-center justify-center mx-auto mb-6 text-tokyo-bamboo text-4xl">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-tokyo-darkText mb-3">Sesi Selesai! 🎉</h2>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-8">
                Luar biasa! Kamu telah menyelesaikan semua ulasan kartu saat ini. Otakmu sedang mengonsolidasikan informasi memori baru.
              </p>
              <button
                onClick={onBackToDashboard}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-tokyo-sakura to-tokyo-torii text-tokyo-darkText font-bold shadow-lg hover:shadow-torii transition-all duration-300 transform active:scale-[0.98]"
              >
                Kembali ke Dashboard
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
                        <span className="px-2.5 py-0.5 text-[10px] rounded-md bg-gray-800 border border-gray-700 text-gray-300">
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
                      <span className="text-[100px] font-kanji font-bold text-tokyo-darkText selection:bg-transparent">
                        {activeCard.character}
                      </span>
                      <p className="text-xs text-gray-500 tracking-widest mt-2 uppercase font-medium">
                        Ketuk kartu untuk membalik
                      </p>
                    </div>

                    {/* Bottom Hints */}
                    <div className="relative z-10 flex items-center justify-between border-t border-gray-800/60 pt-4">
                      <div className="text-left">
                        <span className="text-[10px] uppercase text-gray-500 tracking-wider block">Arti</span>
                        <span className="text-sm font-semibold text-tokyo-sakura truncate max-w-[200px] block">
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
                          <span className="text-3xl font-kanji font-bold text-tokyo-darkText">{activeCard.character}</span>
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
                            {activeCard.onyomi.length > 0 ? activeCard.onyomi.join(', ') : '-'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-900/65 border border-gray-800">
                          <span className="text-[10px] uppercase text-tokyo-pond tracking-wider block mb-1 font-semibold">Kunyomi</span>
                          <span className="text-sm font-medium text-tokyo-darkText">
                            {activeCard.kunyomi.length > 0 ? activeCard.kunyomi.join(', ') : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Mnemonic Block */}
                      <div className="p-3.5 rounded-2xl bg-tokyo-sakura/5 border border-tokyo-sakura/20 mb-4">
                        <span className="text-[10px] uppercase text-tokyo-sakura tracking-wider block mb-1 font-semibold">💡 Jembatan Keledai</span>
                        <p className="text-xs text-gray-300 leading-relaxed font-normal">
                          {activeCard.mnemonic}
                        </p>
                      </div>

                      {/* Vocabulary (Indonesia citation-free) */}
                      {activeCard.vocabulary.length > 0 && (
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

      {/* SRS Deck and keyboard shortcuts panel */}
      <div className="w-full max-w-xl mt-6 flex flex-col gap-4">
        {isFlipped && !sessionCompleted && (
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

        {!isFlipped && !sessionCompleted && (
          <motion.button
            onClick={handleFlip}
            className="w-full py-4 rounded-2xl border border-tokyo-sakura/30 hover:border-tokyo-sakura/60 bg-tokyo-sakura/10 hover:bg-tokyo-sakura/20 text-tokyo-sakura font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-all duration-300 group"
          >
            Buka Arti & Ulas <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>
        )}

        {/* Keyboard shortcut display bar */}
        {!sessionCompleted && (
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
        )}
      </div>
    </div>
  );
}
