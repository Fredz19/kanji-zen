import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Clock, Award, ShieldAlert, CheckCircle, XCircle, ArrowRight, Play, RefreshCw, X, Eye, HelpCircle, Volume2 } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { useAudio } from '../../hooks/useAudio';
import confetti from 'canvas-confetti';

interface JLPTExamViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

interface ExamQuestion {
  id: number;
  type: 'reading' | 'orthography' | 'cloze';
  kanji: KanjiItem;
  promptSentence: string;
  japaneseDisplay: string; // The sentence shown to user
  correctAnswer: string;
  options: string[];
  explanation: string;
}

export default function JLPTExamView({ onBackToDashboard, selectedLevel }: JLPTExamViewProps) {
  const { kanjiList } = useKanjiStore();
  const audio = useAudio();

  const [examLevel, setExamLevel] = useState<'N5' | 'N4' | 'N3'>(selectedLevel === 'ALL' ? 'N5' : selectedLevel);
  const [examState, setExamState] = useState<'briefing' | 'testing' | 'reviewing'>('briefing');

  // Exam variables
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); // { questionId: answer }
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [timeUsed, setTimeUsed] = useState(0);

  // Timer Ref
  const timerRef = useRef<any>(null);

  // Text-To-Speech Synthesis helper
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  // Compile exam questions dynamically from active kanjiList
  const buildExamQuestions = (level: 'N5' | 'N4' | 'N3') => {
    let pool = kanjiList.filter(c => c.level === level && !c.isSuspended);
    if (pool.length < 10) {
      // Fallback in case list is somehow too short
      pool = kanjiList.filter(c => c.level === level);
    }
    if (pool.length < 5) {
      alert('Database kanji kurang untuk membuat paket ujian. Harap inisialisasi ulang database Anda.');
      return;
    }

    const generated: ExamQuestion[] = [];
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    // We will generate 20 questions
    // Category division: 7 Reading, 7 Orthography, 6 Cloze
    const targetCount = Math.min(20, shuffledPool.length);

    for (let i = 0; i < targetCount; i++) {
      const kanji = shuffledPool[i];
      let type: 'reading' | 'orthography' | 'cloze' = 'reading';
      if (i >= 7 && i < 14) type = 'orthography';
      else if (i >= 14) type = 'cloze';

      // Fallback if no sentences/vocab exist for the picked kanji
      if (type === 'cloze' && (!kanji.vocabulary || kanji.vocabulary.length === 0)) {
        type = 'reading';
      }

      // Distractors pool
      const distractors = pool.filter(c => c.id !== kanji.id).sort(() => Math.random() - 0.5);

      let promptSentence = '';
      let japaneseDisplay = '';
      let correctAnswer = '';
      let options: string[] = [];
      let explanation = '';

      if (type === 'reading') {
        // Kanji Reading (漢字読み)
        const vocab = kanji.vocabulary[0] || { word: kanji.character, reading: kanji.kunyomi[0] || 'ひ', meaning: kanji.meaning };
        const displayWord = vocab.word;
        correctAnswer = vocab.reading || kanji.kunyomi[0] || 'ひ';

        promptSentence = `Pilihlah bacaan Hiragana yang tepat untuk Kanji "${displayWord}" dalam konteks kalimat ini.`;
        
        // Find or build a sentence using this vocab/character
        const sentence = kanji.sentences[0];
        if (sentence) {
          japaneseDisplay = sentence.japanese;
        } else {
          japaneseDisplay = `この【${displayWord}】はどう読みますか？`;
        }

        // Distractors
        const dReadings = distractors.map(d => d.kunyomi[0] || d.onyomi[0] || 'ん').filter(r => r !== correctAnswer).slice(0, 3);
        while (dReadings.length < 3) {
          dReadings.push(dReadings.length === 0 ? 'あき' : dReadings.length === 1 ? 'はる' : 'なつ');
        }
        options = [...dReadings, correctAnswer].sort(() => Math.random() - 0.5);
        explanation = `Kata "${displayWord}" dibaca "${correctAnswer}" yang berarti "${vocab.meaning}".`;

      } else if (type === 'orthography') {
        // Orthography (表記)
        const vocab = kanji.vocabulary[0] || { word: kanji.character, reading: kanji.kunyomi[0] || 'ひ', meaning: kanji.meaning };
        const displayReading = vocab.reading || kanji.kunyomi[0] || 'ひ';
        correctAnswer = vocab.word;

        promptSentence = `Pilihlah karakter Kanji yang tepat untuk kata bercetak miring "${displayReading}" di bawah ini.`;
        
        const sentence = kanji.sentences[0];
        if (sentence) {
          // Replace target kanji word with hiragana parenthesis
          japaneseDisplay = sentence.japanese.replace(vocab.word, `【 ${displayReading} 】`);
        } else {
          japaneseDisplay = `【 ${displayReading} 】と書く漢字はどれですか？`;
        }

        const dWords = distractors.map(d => d.character).filter(w => w !== correctAnswer).slice(0, 3);
        options = [...dWords, correctAnswer].sort(() => Math.random() - 0.5);
        explanation = `Spelling Kanji yang benar untuk kata "${displayReading}" adalah "${correctAnswer}" (berarti "${vocab.meaning}").`;

      } else {
        // Contextual Cloze (文脈規定)
        const vocab = kanji.vocabulary[0] || { word: kanji.character, reading: kanji.kunyomi[0] || 'ひ', meaning: kanji.meaning };
        correctAnswer = kanji.character;

        promptSentence = `Pilihlah kosakata Kanji yang tepat untuk melengkapi bagian rumpang kalimat di bawah ini agar maknanya sesuai.`;
        
        const sentence = kanji.sentences[0];
        if (sentence) {
          // Blank out only the character
          japaneseDisplay = sentence.japanese.replace(new RegExp(kanji.character, 'g'), ' _____ ');
        } else {
          japaneseDisplay = `_____ は「${kanji.meaning}」を意味します。`;
        }

        const dChars = distractors.map(d => d.character).slice(0, 3);
        options = [...dChars, correctAnswer].sort(() => Math.random() - 0.5);
        explanation = `Kalimat lengkapnya: "${sentence ? sentence.japanese : `${kanji.character} = ${kanji.meaning}`}". Karakter yang tepat adalah "${kanji.character}" yang artinya "${kanji.meaning}".`;
      }

      generated.push({
        id: i + 1,
        type,
        kanji,
        promptSentence,
        japaneseDisplay,
        correctAnswer,
        options,
        explanation
      });
    }

    setQuestions(generated);
    setUserAnswers({});
    setCurrentIdx(0);
    setTimeLeft(900);
    setTimeUsed(0);
    setExamState('testing');
    audio.playSuccess();
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (examState !== 'testing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
      setTimeUsed(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examState]);

  const handleSelectAnswer = (option: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questions[currentIdx].id]: option
    }));
  };

  const handleNext = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleSubmitExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setExamState('reviewing');
    audio.playCombo(4); // Play epic trumpet/combo sound on submission

    // Calculate pass/fail score
    let correctCount = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const isPassed = correctCount >= 14; // Passing score 70% of 20 = 14
    if (isPassed) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.65 }
      });
    }
  };

  // Time formatter helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const scoreStats = () => {
    let correctCount = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });
    return {
      correct: correctCount,
      percentage: Math.round((correctCount / questions.length) * 100),
      isPassed: correctCount >= 14
    };
  };

  return (
    <div className="flex flex-col min-h-[85vh] py-4 px-3 sm:px-6 max-w-3xl mx-auto">
      
      {/* 1. BRIEFING MODE SCREEN */}
      {examState === 'briefing' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col justify-center items-center py-10"
        >
          <div className="w-full text-center p-8 rounded-3xl border border-gray-800 bg-tokyo-card/35 backdrop-blur-xl shadow-glass relative overflow-hidden space-y-6">
            {/* Grid overlay */}
            <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

            <div className="w-20 h-20 bg-tokyo-sakura/10 rounded-full border border-tokyo-sakura/30 flex items-center justify-center mx-auto text-tokyo-sakura text-4xl shadow-sakura">
              ⏱️
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-tokyo-darkText tracking-tight">Simulasi Ujian Formal JLPT N5-N4</h2>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                Uji kemampuan membaca kognitif dan pembendaharaan kosakata Kanji Anda di bawah tekanan waktu formal.
              </p>
            </div>

            {/* Exam Parameters Grid */}
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto text-xs py-4">
              <div className="p-3.5 rounded-2xl bg-gray-900/50 border border-gray-800 text-center">
                <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Jumlah Soal</span>
                <strong className="text-tokyo-darkText text-base">20 Soal</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-gray-900/50 border border-gray-800 text-center">
                <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Durasi Waktu</span>
                <strong className="text-tokyo-pond text-base">15 Menit</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-gray-900/50 border border-gray-800 text-center">
                <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Batas Kelulusan</span>
                <strong className="text-tokyo-bamboo text-base">70% (14 Benar)</strong>
              </div>
            </div>

            {/* Level Selector */}
            <div className="space-y-3 pt-2 max-w-xs mx-auto">
              <span className="text-[10px] uppercase text-gray-500 font-extrabold tracking-widest block">Pilihlah Level Ujian:</span>
              <div className="flex bg-gray-950 p-1.5 rounded-2xl border border-gray-800 gap-1.5">
                <button
                  onClick={() => setExamLevel('N5')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    examLevel === 'N5'
                      ? 'bg-tokyo-sakura text-tokyo-darkText shadow-sakura'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  JLPT N5
                </button>
                <button
                  onClick={() => setExamLevel('N4')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    examLevel === 'N4'
                      ? 'bg-tokyo-pond text-[#0b0f19] shadow-pond'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  JLPT N4
                </button>
                <button
                  onClick={() => setExamLevel('N3')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    examLevel === 'N3'
                      ? 'bg-tokyo-bamboo text-tokyo-darkText shadow-bamboo'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  JLPT N3
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 space-y-3 max-w-sm mx-auto">
              <button
                onClick={() => buildExamQuestions(examLevel)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-tokyo-sakura to-tokyo-torii text-tokyo-darkText font-bold shadow-lg hover:shadow-torii transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Play size={16} fill="currentColor" /> Mulai Ujian Sekarang
              </button>
              <button
                onClick={onBackToDashboard}
                className="w-full py-3 rounded-2xl border border-gray-800 bg-gray-900/40 text-gray-400 hover:text-gray-200 text-xs transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. TESTING MODE SCREEN */}
      {examState === 'testing' && questions.length > 0 && (
        <div className="flex-1 flex flex-col justify-between py-2">
          
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3.5 mb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-tokyo-sakura/15 text-tokyo-sakura border border-tokyo-sakura/30 text-[9px] font-extrabold uppercase shadow-sm">
                JLPT {examLevel} UJIAN MOCK
              </span>
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                Soal: <span className="text-tokyo-darkText font-mono font-black text-xs">{currentIdx + 1}</span> / {questions.length}
              </h4>
            </div>

            {/* Clock Timer */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black font-mono transition-colors ${
              timeLeft < 180 
                ? 'border-tokyo-torii bg-tokyo-torii/10 text-tokyo-torii animate-pulse' 
                : 'border-tokyo-pond/30 bg-tokyo-pond/5 text-tokyo-pond'
            }`}>
              <Clock size={14} className={timeLeft < 180 ? 'animate-bounce' : ''} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Question Box Container */}
          <div className="space-y-6">
            
            {/* Prompt sentence card */}
            <div className="text-center space-y-4">
              
              {/* Primary sentence visualizer */}
              <div className="p-6 rounded-3xl border border-gray-800/80 bg-gray-950/40 backdrop-blur-md relative py-10 shadow-inner">
                <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
                <span className="text-2xl font-kanji font-bold text-tokyo-darkText tracking-wide leading-relaxed text-center block select-none">
                  {questions[currentIdx].japaneseDisplay}
                </span>
                
                {/* Voice button */}
                <button
                  onClick={() => speakText(questions[currentIdx].kanji.character)}
                  className="absolute bottom-3 right-3 p-2 rounded-full border border-gray-800 text-gray-500 hover:text-tokyo-sakura bg-tokyo-card/30 transition-colors"
                  title="Mainkan Suara Pengucapan"
                >
                  <Volume2 size={13} />
                </button>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-gray-400 whitespace-pre-line px-2 leading-relaxed">
                ❓ {questions[currentIdx].promptSentence}
              </h3>
            </div>

            {/* Options Deck Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
              {questions[currentIdx].options.map((option, idx) => {
                const isSelected = userAnswers[questions[currentIdx].id] === option;
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectAnswer(option)}
                    className={`py-4 px-6 rounded-2xl border text-sm font-black text-left transition-all duration-300 flex items-center justify-between group ${
                      isSelected
                        ? 'border-tokyo-sakura bg-tokyo-sakura/10 text-tokyo-sakura shadow-sakura'
                        : 'border-gray-800 bg-gray-900/35 hover:border-gray-700 hover:bg-gray-850 text-gray-300'
                    }`}
                  >
                    <span className={questions[currentIdx].type === 'orthography' || questions[currentIdx].type === 'cloze' ? 'text-lg font-kanji' : ''}>
                      {option}
                    </span>
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black transition-all ${
                      isSelected ? 'border-tokyo-sakura bg-tokyo-sakura text-tokyo-darkText' : 'border-gray-700 text-transparent'
                    }`}>
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation and Bottom review grids */}
          <div className="mt-8 space-y-5">
            
            {/* Primary Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                disabled={currentIdx === 0}
                onClick={handlePrev}
                className="px-5 py-3 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-900/30 text-gray-400 hover:text-gray-200 text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                ← Sebelumnya
              </button>

              {currentIdx + 1 < questions.length ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-200 text-xs font-bold transition-all flex items-center gap-1"
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  onClick={handleSubmitExam}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-tokyo-sakura to-tokyo-torii text-tokyo-darkText font-black text-xs shadow-lg hover:shadow-torii transition-all flex items-center gap-1.5"
                >
                  Kumpulkan Ujian 🎓
                </button>
              )}
            </div>

            {/* Bottom Question navigation board grid */}
            <div className="pt-4 border-t border-gray-900">
              <span className="text-[9px] uppercase tracking-widest text-gray-500 font-extrabold block mb-2 px-1">Tinjauan Navigasi Lembar Jawaban:</span>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {questions.map((q, idx) => {
                  const isAnswered = !!userAnswers[q.id];
                  const isActive = currentIdx === idx;
                  
                  let cellStyle = 'border-gray-800 bg-gray-950/20 text-gray-500';
                  if (isActive) {
                    cellStyle = 'border-tokyo-sakura bg-tokyo-sakura/10 text-tokyo-sakura';
                  } else if (isAnswered) {
                    cellStyle = 'border-tokyo-pond/50 bg-tokyo-pond/5 text-tokyo-pond';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={`w-7 h-7 rounded-lg border text-[10px] font-black font-mono transition-all flex items-center justify-center ${cellStyle}`}
                    >
                      {q.id}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 3. REVIEWING / RESULTS MODE SCREEN */}
      {examState === 'reviewing' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 pb-12"
        >
          {/* Formal Scorecard Box */}
          {(() => {
            const stats = scoreStats();
            return (
              <div className="p-6 rounded-3xl border border-gray-800 bg-tokyo-card/35 backdrop-blur-xl relative overflow-hidden text-center space-y-4">
                <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

                {stats.isPassed ? (
                  <div className="w-16 h-16 bg-tokyo-bamboo/10 rounded-full border border-tokyo-bamboo/30 flex items-center justify-center mx-auto text-tokyo-bamboo text-3xl">
                    🎉
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-tokyo-torii/10 rounded-full border border-tokyo-torii/30 flex items-center justify-center mx-auto text-tokyo-torii text-3xl">
                    ❌
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold block">Hasil Simulasi Ujian</span>
                  <h2 className={`text-3xl font-black tracking-tighter ${stats.isPassed ? 'text-tokyo-bamboo' : 'text-tokyo-torii'}`}>
                    {stats.isPassed ? 'LULUS UJIAN! (PASSED)' : 'GAGAL UJIAN (FAILED)'}
                  </h2>
                </div>

                {/* Score breakdown bar */}
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto text-xs py-3 border-t border-b border-gray-900/60 my-2">
                  <div>
                    <span className="text-[9px] uppercase text-gray-500 font-bold block mb-1">Skor Akhir</span>
                    <strong className="text-tokyo-darkText text-base">{stats.correct} / {questions.length}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-gray-500 font-bold block mb-1">Persentase</span>
                    <strong className="text-tokyo-sakura text-base">{stats.percentage}%</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-gray-500 font-bold block mb-1">Durasi Waktu</span>
                    <strong className="text-tokyo-pond text-base">{formatTime(timeUsed)}</strong>
                  </div>
                </div>

                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  {stats.isPassed 
                    ? 'Luar biasa! Kemampuan kognitif Anda sudah sangat matang dan siap menghadapi ujian JLPT sesungguhnya. Pertahankan!'
                    : 'Jangan berkecil hati. Analisis lembar jawaban Anda di bawah untuk mengidentifikasi kanji/kosakata yang perlu dilatih ulang.'}
                </p>

                <div className="pt-2 flex gap-3 max-w-xs mx-auto">
                  <button
                    onClick={() => buildExamQuestions(examLevel)}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-tokyo-pond to-tokyo-sakura text-tokyo-darkText font-black text-xs shadow-lg transition-all"
                  >
                    Ulangi Ujian
                  </button>
                  <button
                    onClick={onBackToDashboard}
                    className="flex-1 py-3 rounded-2xl border border-gray-800 bg-gray-900/40 text-gray-400 font-bold text-xs hover:text-gray-200 transition-colors"
                  >
                    Dashboard
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Breakdown Sheet accordion list */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-gray-500 font-extrabold px-1">Pembahasan & Detail Lembar Jawaban:</h3>
            
            {questions.map((q) => {
              const isCorrect = userAnswers[q.id] === q.correctAnswer;
              const hasAnswered = !!userAnswers[q.id];

              return (
                <div
                  key={q.id}
                  className={`p-4.5 rounded-3xl border transition-all ${
                    isCorrect 
                      ? 'border-tokyo-bamboo/20 bg-tokyo-bamboo/5' 
                      : 'border-tokyo-torii/20 bg-tokyo-torii/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-gray-900/45 pb-2.5 mb-3">
                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        q.type === 'reading' ? 'bg-tokyo-sakura/10 text-tokyo-sakura' : q.type === 'orthography' ? 'bg-tokyo-pond/10 text-tokyo-pond' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        Soal {q.id} • {q.type === 'reading' ? 'Kanji Reading' : q.type === 'orthography' ? 'Orthography' : 'Contextual Cloze'}
                      </span>
                      <h4 className="text-xs text-gray-400 mt-2 font-medium leading-relaxed max-w-xl">
                        {q.promptSentence}
                      </h4>
                    </div>

                    {isCorrect ? (
                      <CheckCircle size={20} className="text-tokyo-bamboo shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={20} className="text-tokyo-torii shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Japanese text visualizer */}
                  <div
                    onClick={() => speakText(q.kanji.character)}
                    className="p-3.5 rounded-2xl bg-gray-950/40 border border-gray-900 font-kanji text-base font-bold text-tokyo-darkText tracking-wide cursor-pointer hover:bg-gray-950/80 transition-colors flex items-center justify-between"
                  >
                    <span>{q.japaneseDisplay}</span>
                    <Volume2 size={14} className="text-gray-500" />
                  </div>

                  {/* Answer results sheet */}
                  <div className="grid grid-cols-2 gap-3.5 mt-3 text-[11px] font-bold">
                    <div className="p-2.5 rounded-xl bg-gray-900/40 border border-gray-800">
                      <span className="text-[9px] uppercase text-gray-500 block mb-1">Jawaban Anda</span>
                      <span className={isCorrect ? 'text-tokyo-bamboo' : 'text-tokyo-torii font-mono font-black'}>
                        {userAnswers[q.id] ? userAnswers[q.id] : '— (Kosong)'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-900/40 border border-gray-800">
                      <span className="text-[9px] uppercase text-gray-500 block mb-1">Kunci Jawaban</span>
                      <span className="text-tokyo-bamboo font-mono font-black">
                        {q.correctAnswer}
                      </span>
                    </div>
                  </div>

                  {/* Mnemonic explanation */}
                  <div className="p-3 rounded-2xl bg-gray-950/20 border border-gray-900 text-[11px] text-gray-400 leading-relaxed mt-3">
                    <span className="font-bold text-tokyo-sakura block mb-0.5">Penjelasan Soal:</span>
                    {q.explanation}
                  </div>

                </div>
              );
            })}
          </div>

        </motion.div>
      )}

    </div>
  );
}
