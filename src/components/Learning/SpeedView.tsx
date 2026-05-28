import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Zap, Trophy, Play, Home, AlertCircle, RefreshCw } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { useAudio } from '../../hooks/useAudio';

interface SpeedViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

interface SpeedHighScore {
  score: number;
  date: string;
}

export default function SpeedView({ onBackToDashboard, selectedLevel }: SpeedViewProps) {
  const { kanjiList } = useKanjiStore();
  const audio = useAudio();

  const [activeCard, setActiveCard] = useState<KanjiItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [combo, setCombo] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [highScores, setHighScores] = useState<SpeedHighScore[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const timerRef = useRef<any>(null);

  // Load high scores from local storage
  useEffect(() => {
    const stored = localStorage.getItem('kanjizen-speed-highscores');
    if (stored) {
      setHighScores(JSON.parse(stored));
    }
  }, []);

  // Question generator
  const generateQuestion = () => {
    let pool = kanjiList.filter(c => !c.isSuspended);
    if (selectedLevel !== 'ALL') {
      pool = pool.filter(c => c.level === selectedLevel);
    }

    if (pool.length < 4) {
      pool = kanjiList; // Fallback
    }

    if (pool.length < 4) return;

    // Pick random target
    const target = pool[Math.floor(Math.random() * pool.length)];
    const distractors = pool
      .filter(c => c.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const generatedOptions = [...distractors.map(d => d.meaning), target.meaning].sort(() => Math.random() - 0.5);

    setActiveCard(target);
    setOptions(generatedOptions);
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(60);
    setCombo(0);
    setXpEarned(0);
    setGameOver(false);
    setGameStarted(true);
    setFeedback(null);
    generateQuestion();
    audio.playCombo(1);

    // Set countdown timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameOver(true);
    setGameStarted(false);
    audio.playLevelUp();

    // Reward accumulated XP
    const finalXP = Math.floor(score * 8);
    setXpEarned(finalXP);
    if (finalXP > 0) {
      // Award XP directly into global store
      const storeState = useKanjiStore.getState();
      storeState.reviewCard('dummy', 'good'); // trigger quest reviews
      useKanjiStore.setState({ xp: storeState.xp + finalXP });
    }

    // Save high score
    const newScoreEntry: SpeedHighScore = {
      score,
      date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    };

    const updatedScores = [...highScores, newScoreEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Keep top 5

    setHighScores(updatedScores);
    localStorage.setItem('kanjizen-speed-highscores', JSON.stringify(updatedScores));
  };

  const handleAnswer = (option: string) => {
    if (gameOver || !activeCard || feedback) return;

    const isCorrect = option === activeCard.meaning;

    if (isCorrect) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setScore(prev => prev + 1);
      setFeedback('correct');
      
      // Chime combo feedback
      if (nextCombo >= 3) {
        audio.playCombo(nextCombo);
      } else {
        audio.playSuccess();
      }

      // Add time bonus
      setTimeLeft(prev => Math.min(60, prev + 2));

      // Trigger next question shortly
      setTimeout(() => {
        setFeedback(null);
        generateQuestion();
      }, 350);
    } else {
      setCombo(0);
      setFeedback('wrong');
      audio.playFailure();

      // Deduct time penalty
      setTimeLeft(prev => Math.max(0, prev - 3));

      // Shake screen feedback
      setTimeout(() => {
        setFeedback(null);
        generateQuestion();
      }, 450);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-between min-h-[80vh] py-6 px-4">
      {/* Session progress header */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <button
          onClick={onBackToDashboard}
          className="text-xs uppercase tracking-wider text-gray-400 hover:text-tokyo-torii transition-colors font-medium border border-gray-800 px-3 py-1.5 rounded-full bg-tokyo-card/30"
        >
          ← Dashboard
        </button>

        <div className="flex items-center gap-1.5 text-tokyo-gold">
          <Trophy size={14} />
          <span className="text-[10px] font-bold tracking-widest uppercase">Tantangan Kilat</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-xl">
        <AnimatePresence mode="wait">
          {!gameStarted && !gameOver ? (
            /* LOBBY START PAGE */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center p-8 rounded-3xl border border-gray-800 bg-tokyo-card/50 backdrop-blur-lg shadow-glass"
            >
              <div className="w-16 h-16 bg-tokyo-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 text-tokyo-gold text-3xl fire-glow">
                <Zap />
              </div>
              <h2 className="text-2xl font-bold text-tokyo-darkText mb-2">Tantangan Kilat 60 Detik</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-6">
                Uji Kecepatan Asosiasi Memori Kanji
              </p>

              <div className="p-4 rounded-2xl bg-gray-950/40 border border-gray-800 text-[11px] text-gray-400 leading-relaxed text-left space-y-2 mb-8 max-w-sm mx-auto">
                <span className="font-bold text-tokyo-sakura block">Aturan Game:</span>
                <p>• Selesaikan sebanyak mungkin Kanji dalam <strong>60 detik</strong>.</p>
                <p>• Jawaban Benar menambahkan <strong>+2 detik</strong> dan menaikkan Combo.</p>
                <p>• Jawaban Salah memotong <strong>-3 detik</strong> dari sisa waktu.</p>
                <p>• Di akhir, dapatkan bonus <strong>8 XP per skor</strong> yang didapatkan!</p>
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-tokyo-gold to-tokyo-sakura text-tokyo-darkText font-black tracking-wide shadow-lg hover:shadow-sakura transition-all duration-300 transform active:scale-95"
              >
                MULAI GAME ⏱️
              </button>

              {/* High Scores Leaderboard */}
              {highScores.length > 0 && (
                <div className="mt-8 border-t border-gray-800/60 pt-6 text-left max-w-xs mx-auto">
                  <span className="text-[10px] uppercase text-gray-500 tracking-wider block mb-3 font-semibold text-center">🏆 Skor Tertinggi Anda</span>
                  <div className="space-y-1.5">
                    {highScores.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-gray-800/35 border border-gray-800 text-xs">
                        <span className="font-bold text-gray-400">Peringkat {i + 1}</span>
                        <span className="font-black text-tokyo-gold">{h.score} Skor</span>
                        <span className="text-[10px] text-gray-500">{h.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : gameOver ? (
            /* GAME OVER END PAGE */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center p-8 rounded-3xl border border-gray-800 bg-tokyo-card/50 backdrop-blur-lg shadow-glass glow-pulse-sakura"
            >
              <div className="w-16 h-16 bg-tokyo-torii/10 rounded-full flex items-center justify-center mx-auto mb-6 text-tokyo-torii text-3xl">
                ⏱️
              </div>
              <h2 className="text-2xl font-bold text-tokyo-darkText mb-2">Waktu Habis!</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-6">
                Skor Anda: <strong className="text-tokyo-sakura text-sm">{score}</strong> Kanji | XP Diberikan: +{xpEarned}
              </p>

              <p className="text-sm text-gray-400 max-w-sm mx-auto mb-8 leading-relaxed">
                Kamu menjawab {score} Kanji dengan tepat dalam tempo waktu tinggi. Latihan berpacu waktu ini memaksa memori untuk recall secara instan!
              </p>

              <div className="space-y-3">
                <button
                  onClick={startGame}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-tokyo-gold to-tokyo-sakura text-tokyo-darkText font-bold shadow-lg hover:shadow-sakura transition-all duration-300 transform active:scale-[0.98]"
                >
                  Main Lagi ⏱️
                </button>
                <button
                  onClick={onBackToDashboard}
                  className="w-full py-3 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/80 text-gray-300 font-semibold transition-colors text-sm"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            </motion.div>
          ) : (
            /* ACTIVE SPEED BLITZ PLAYING PAGE */
            activeCard && (
              <motion.div
                key={activeCard.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full space-y-6"
              >
                {/* Header time & stats tracker bar */}
                <div className="flex items-center justify-between px-3">
                  {/* Timer meter */}
                  <div className="flex items-center gap-1.5 text-tokyo-sakura font-bold text-sm">
                    <Timer size={16} className="animate-spin-slow" />
                    <span>{timeLeft}s</span>
                  </div>

                  {/* Combo & Score tracker */}
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="text-gray-400">Skor: <strong className="text-tokyo-sakura text-sm">{score}</strong></span>
                    {combo >= 3 && (
                      <span className="px-2 py-0.5 rounded bg-tokyo-gold/15 text-tokyo-gold border border-tokyo-gold/30">
                        {combo} Combo
                      </span>
                    )}
                  </div>
                </div>

                {/* Big Center Kanji card */}
                <motion.div
                  className={`w-64 h-64 rounded-3xl border mx-auto flex items-center justify-center bg-gray-950/40 backdrop-blur-md shadow-glass relative ${
                    feedback === 'correct'
                      ? 'border-tokyo-bamboo/40 shadow-bamboo'
                      : feedback === 'wrong'
                      ? 'border-tokyo-torii/40 shadow-torii animate-shake'
                      : 'border-gray-800'
                  }`}
                  animate={feedback === 'wrong' ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {/* Design grids overlay */}
                  <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
                  
                  <span className="text-8xl font-kanji font-bold text-tokyo-darkText select-none">
                    {activeCard.character}
                  </span>
                </motion.div>

                {/* Speed MCQ selection deck */}
                <div className="grid grid-cols-2 gap-3 px-2">
                  {options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      className="py-3.5 px-4 rounded-2xl border border-gray-850 hover:border-tokyo-sakura bg-gray-900/35 hover:bg-tokyo-sakura/5 text-xs font-bold text-tokyo-darkText shadow-sm transition-all duration-200 transform active:scale-95 text-center flex items-center justify-center"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
