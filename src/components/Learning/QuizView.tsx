import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Volume2, ShieldAlert, Award, Zap, RefreshCw, X } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { useAudio } from '../../hooks/useAudio';
import confetti from 'canvas-confetti';

interface QuizViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

interface Question {
  type: 'kanji-to-meaning' | 'meaning-to-kanji' | 'reading-to-kanji' | 'onyomi-vs-kunyomi' | 'context-cloze';
  kanji: KanjiItem;
  prompt: string;
  japanesePrompt?: string; // For cloze
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export default function QuizView({ onBackToDashboard, selectedLevel }: QuizViewProps) {
  const { kanjiList, reviewCard, trackConfusion } = useKanjiStore();
  const audio = useAudio();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [combo, setCombo] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Text-To-Speech Synthesis helper
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // Gunakan delay 50ms untuk menghindari bug cancel() langsung pada iOS Safari
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85;
      
      // Pilih suara bahasa Jepang secara eksplisit (penting untuk perangkat iOS)
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
      if (jaVoice) {
        utterance.voice = jaVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  // Compile gamified questions
  useEffect(() => {
    let pool = kanjiList.filter(c => !c.isSuspended);
    if (selectedLevel !== 'ALL') {
      pool = pool.filter(c => c.level === selectedLevel);
    }

    if (pool.length < 4) {
      // Fall back to entire list in case level doesn't have enough cards
      pool = kanjiList;
    }

    if (pool.length < 4) {
      setQuizFinished(true);
      return;
    }

    // Generate 10 random questions
    const generatedQuestions: Question[] = [];
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    const qTypes: Question['type'][] = [
      'kanji-to-meaning',
      'meaning-to-kanji',
      'reading-to-kanji',
      'onyomi-vs-kunyomi',
      'context-cloze'
    ];

    const maxQuestions = Math.min(10, shuffledPool.length);

    for (let i = 0; i < maxQuestions; i++) {
      const kanji = shuffledPool[i];
      // Randomly pick a question type
      let type = qTypes[Math.floor(Math.random() * qTypes.length)];
      
      // If cloze is selected but no sentences exist, fallback to kanji-to-meaning
      if (type === 'context-cloze' && (!kanji.sentences || kanji.sentences.length === 0)) {
        type = 'kanji-to-meaning';
      }

      // Generate distractors
      const distractors = pool
        .filter(c => c.id !== kanji.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      let prompt = '';
      let japanesePrompt = '';
      let correctAnswer = '';
      let options: string[] = [];
      let explanation = '';

      switch (type) {
        case 'kanji-to-meaning':
          prompt = `Apakah arti dari Kanji berikut: "${kanji.character}"?`;
          correctAnswer = kanji.meaning;
          options = [...distractors.map(d => d.meaning), correctAnswer].sort(() => Math.random() - 0.5);
          explanation = `Kanji ${kanji.character} berarti "${kanji.meaning}".`;
          break;

        case 'meaning-to-kanji':
          prompt = `Kanji manakah yang berarti "${kanji.meaning}"?`;
          correctAnswer = kanji.character;
          options = [...distractors.map(d => d.character), correctAnswer].sort(() => Math.random() - 0.5);
          explanation = `Arti "${kanji.meaning}" diwakili oleh Kanji ${kanji.character}.`;
          break;

        case 'reading-to-kanji':
          const reading = kanji.onyomi[0] || kanji.kunyomi[0] || 'ひ';
          prompt = `Kanji manakah yang dibaca "${reading}"?`;
          correctAnswer = kanji.character;
          options = [...distractors.map(d => d.character), correctAnswer].sort(() => Math.random() - 0.5);
          explanation = `Kanji ${kanji.character} memiliki cara baca "${reading}".`;
          break;

        case 'onyomi-vs-kunyomi':
          const isOnyomi = Math.random() > 0.5;
          const chosenReading = isOnyomi 
            ? (kanji.onyomi[0] || 'ニチ') 
            : (kanji.kunyomi[0] || 'ひ');
          prompt = `Cara baca "${chosenReading}" pada Kanji "${kanji.character}" tergolong Onyomi atau Kunyomi?`;
          correctAnswer = isOnyomi ? 'Onyomi' : 'Kunyomi';
          options = ['Onyomi', 'Kunyomi'];
          explanation = `Untuk Kanji ${kanji.character}, "${chosenReading}" adalah bacaan ${correctAnswer}.`;
          break;

        case 'context-cloze':
          const sentence = kanji.sentences[Math.floor(Math.random() * kanji.sentences.length)];
          // Blank out the character
          japanesePrompt = sentence.japanese.replace(new RegExp(kanji.character, 'g'), '[ ... ]');
          prompt = `Pilihlah Kanji yang tepat untuk melengkapi kalimat berikut:\n"${sentence.indonesian}"`;
          correctAnswer = kanji.character;
          options = [...distractors.map(d => d.character), correctAnswer].sort(() => Math.random() - 0.5);
          explanation = `Kalimat lengkapnya: "${sentence.japanese}" (Karakter: ${kanji.character}).`;
          break;
      }

      generatedQuestions.push({
        type,
        kanji,
        prompt,
        japanesePrompt,
        options,
        correctAnswer,
        explanation
      });
    }

    setQuestions(generatedQuestions);
    setCurrentIdx(0);
    setLives(3);
    setScore(0);
    setXpGained(0);
    setCombo(0);
    setQuizFinished(false);
    setIsAnswered(false);
    setSelectedAnswer(null);
  }, [kanjiList, selectedLevel]);

  const activeQuestion = questions[currentIdx];

  // Answer submit check
  const handleAnswerSubmit = (option: string) => {
    if (isAnswered || !activeQuestion) return;

    setSelectedAnswer(option);
    setIsAnswered(true);

    const isCorrect = option === activeQuestion.correctAnswer;

    if (isCorrect) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(score + 1);

      // Play success synth and combo sound if chain grows
      if (newCombo >= 3) {
        audio.playCombo(newCombo);
      } else {
        audio.playSuccess();
      }

      // Calculate XP with combo bonus
      const earnedXP = 15 + Math.min(10, (newCombo - 1) * 3);
      setXpGained(xpGained + earnedXP);
      
      // Pronounce word if cloze
      if (activeQuestion.type === 'context-cloze') {
        speakText(activeQuestion.kanji.character);
      }
    } else {
      // Setback: broken combo, lose life
      setCombo(0);
      setLives(lives - 1);
      audio.playFailure();

      // Similar Kanji Confusion Pair Detector check
      // If they chose a character option, check visual similarity
      if (activeQuestion.options.includes(option) && activeQuestion.correctAnswer.length === 1 && option.length === 1) {
        const similarityPairs = [
          ['土', '士'], ['未', '末'], ['人', '入'], ['人', '八'], ['入', '八'],
          ['右', '左'], ['千', '干'], ['前', '後'], ['大', '太'], ['本', '木']
        ];
        const isConfused = similarityPairs.some(
          pair => pair.includes(activeQuestion.correctAnswer) && pair.includes(option)
        );

        if (isConfused) {
          // Log visual confusion patterns in Zustand
          trackConfusion(activeQuestion.correctAnswer, option);
        }
      }

      if (lives - 1 <= 0) {
        setQuizFinished(true);
      }
    }
  };

  const handleNext = () => {
    setIsAnswered(false);
    setSelectedAnswer(null);
    if (currentIdx + 1 < questions.length && lives > 0) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setQuizFinished(true);
      // Trigger massive confetti on perfect 3-star clear!
      if (lives === 3) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    }
  };

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

        {!quizFinished && questions.length > 0 && (
          <div className="flex items-center gap-4">
            {/* Lives Indicator */}
            <div className="flex items-center gap-0.5 text-tokyo-torii">
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart
                  key={i}
                  size={16}
                  fill={i < lives ? 'currentColor' : 'transparent'}
                  className={i >= lives ? 'text-gray-700' : 'animate-pulse'}
                />
              ))}
            </div>

            {/* Combos Indicator */}
            {combo >= 2 && (
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-tokyo-gold/15 text-tokyo-gold border border-tokyo-gold/30 flex items-center gap-1">
                <Zap size={10} fill="currentColor" /> {combo}x COMBO
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-xl">
        <AnimatePresence mode="wait">
          {quizFinished ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full text-center p-8 rounded-3xl border border-gray-800 bg-tokyo-card/50 backdrop-blur-lg shadow-glass glow-pulse-sakura"
            >
              <div className="w-20 h-20 bg-tokyo-sakura/10 rounded-full flex items-center justify-center mx-auto mb-6 text-tokyo-sakura text-4xl">
                🏆
              </div>
              <h2 className="text-2xl font-bold text-tokyo-darkText mb-2">Kuis Selesai!</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-6">
                Skor Anda: <strong className="text-tokyo-sakura text-sm">{score}</strong> / {questions.length} | XP: +{xpGained}
              </p>

              {/* Star grading */}
              <div className="flex items-center justify-center gap-2 text-2xl text-tokyo-gold mb-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`transition-transform duration-500 ${
                      i < lives ? 'scale-110 rotate-12 filter drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]' : 'opacity-20'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>

              <p className="text-sm text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                {lives === 3
                  ? 'SEMPURNA! Kamu menyelesaikan kuis tanpa melakukan kesalahan sama sekali. Kemampuan membaca kognitifmu sangat luar biasa! 👑'
                  : lives > 0
                  ? 'Kuis berhasil diselesaikan! Tinjau catatan kesalahanmu untuk menaklukkan ulasan kuis berikutnya dengan lebih baik.'
                  : 'Sayang sekali nyawamu habis! Jangan menyerah. Kanji membutuhkan pengulangan berkelanjutan agar melekat di memori jangka panjang.'}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Force rebuild questions
                    setQuizFinished(false);
                    setQuestions([]);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-tokyo-pond to-tokyo-sakura text-tokyo-darkText font-bold shadow-lg transition-all duration-300 transform active:scale-[0.98]"
                >
                  Ulangi Kuis
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
            activeQuestion && (
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-6"
              >
                {/* Question Type Banner */}
                <div className="text-center space-y-3">
                  <span className="px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-tokyo-pond/15 text-tokyo-pond border border-tokyo-pond/35">
                    {activeQuestion.type === 'kanji-to-meaning' && 'Terjemahkan Kanji'}
                    {activeQuestion.type === 'meaning-to-kanji' && 'Pilih Karakter'}
                    {activeQuestion.type === 'reading-to-kanji' && 'Uji Cara Baca'}
                    {activeQuestion.type === 'onyomi-vs-kunyomi' && 'Onyomi vs Kunyomi'}
                    {activeQuestion.type === 'context-cloze' && 'Tebak Kalimat (Cloze)'}
                  </span>
                  
                  {/* Cloze Japanese Sentence Container */}
                  {activeQuestion.type === 'context-cloze' && activeQuestion.japanesePrompt && (
                    <div className="p-5 rounded-2xl border border-tokyo-pond/25 bg-tokyo-pond/5 flex flex-col items-center justify-center relative py-8">
                      {/* Grid design */}
                      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
                      <span className="text-xl font-kanji font-bold text-tokyo-darkText text-center leading-relaxed tracking-wider">
                        {activeQuestion.japanesePrompt}
                      </span>
                    </div>
                  )}

                  {/* Standard Kanji visualizer */}
                  {activeQuestion.type !== 'context-cloze' && activeQuestion.type !== 'meaning-to-kanji' && (
                    <div className="w-24 h-24 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto shadow-md">
                      <span className="text-4xl font-kanji font-bold text-tokyo-darkText">
                        {activeQuestion.kanji.character}
                      </span>
                    </div>
                  )}

                  <h3 className="text-base font-bold text-tokyo-darkText leading-relaxed px-4 text-center whitespace-pre-line">
                    {activeQuestion.prompt}
                  </h3>
                </div>

                {/* Multiple choice decks */}
                <div className="grid grid-cols-1 gap-2.5 px-2">
                  {activeQuestion.options.map((option, idx) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrectOption = option === activeQuestion.correctAnswer;
                    
                    let btnStyle = 'border-gray-800 bg-gray-900/35 hover:border-gray-700 hover:bg-gray-800/40 text-gray-300';
                    
                    if (isAnswered) {
                      if (isCorrectOption) {
                        btnStyle = 'border-tokyo-bamboo bg-tokyo-bamboo/15 text-tokyo-bamboo';
                      } else if (isSelected) {
                        btnStyle = 'border-tokyo-torii bg-tokyo-torii/15 text-tokyo-torii';
                      } else {
                        btnStyle = 'border-gray-900 bg-gray-950/20 text-gray-500 opacity-60 pointer-events-none';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={isAnswered}
                        onClick={() => handleAnswerSubmit(option)}
                        className={`w-full py-3.5 px-5 rounded-2xl border text-xs font-bold text-left transition-all duration-300 flex items-center justify-between group ${btnStyle}`}
                      >
                        <span className={activeQuestion.type === 'meaning-to-kanji' || activeQuestion.type === 'reading-to-kanji' ? 'text-lg font-kanji' : ''}>
                          {option}
                        </span>
                        
                        {isAnswered && isCorrectOption && (
                          <span className="w-5 h-5 rounded-full bg-tokyo-bamboo/20 text-tokyo-bamboo flex items-center justify-center text-[10px]">✓</span>
                        )}
                        {isAnswered && isSelected && !isCorrectOption && (
                          <span className="w-5 h-5 rounded-full bg-tokyo-torii/20 text-tokyo-torii flex items-center justify-center text-[10px]"><X size={10} /></span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Card */}
                <AnimatePresence>
                  {isAnswered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 py-3 rounded-2xl border border-gray-800 bg-gray-950/40 text-[11px] text-gray-400 leading-relaxed max-w-lg mx-auto"
                    >
                      <span className="font-bold text-tokyo-sakura block mb-1">Penjelasan Singkat:</span>
                      {activeQuestion.explanation}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom Deck Navigation */}
                {isAnswered && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleNext}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-tokyo-pond to-tokyo-sakura text-tokyo-darkText font-bold text-center flex items-center justify-center gap-1.5 transition-all duration-300"
                  >
                    Selanjutnya →
                  </motion.button>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
