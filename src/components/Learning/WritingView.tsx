import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Play, Trash2, CheckCircle, Volume2, HelpCircle, AlertTriangle } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { useAudio } from '../../hooks/useAudio';

interface WritingViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

interface Coord {
  x: number;
  y: number;
}

// Extract starting coordinates of an SVG path (e.g. M30,52.52 -> {x: 30, y: 52.52})
function getStartCoords(pathStr: string): Coord | null {
  if (!pathStr) return null;
  const match = pathStr.match(/M\s*([\d\.-]+)\s*,\s*([\d\.-]+)/i);
  if (match) {
    return {
      x: parseFloat(match[1]),
      y: parseFloat(match[2])
    };
  }
  return null;
}

export default function WritingView({ onBackToDashboard, selectedLevel }: WritingViewProps) {
  const reviewCard = useKanjiStore(state => state.reviewCard);
  const updateKanjiStrokes = useKanjiStore(state => state.updateKanjiStrokes);
  const dailyQuests = useKanjiStore(state => state.dailyQuests);
  const audio = useAudio();

  // Category state (SelectedLevel, N5, N4, or Leech)
  const [category, setCategory] = useState<'ALL' | 'N5' | 'N4' | 'LEECH'>(
    selectedLevel === 'ALL' ? 'ALL' : (selectedLevel as any)
  );

  const [queue, setQueue] = useState<KanjiItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [evaluationStage, setEvaluationStage] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  
  // Dynamic fetch state
  const [loadingStrokes, setLoadingStrokes] = useState(false);
  
  // Stroke animation playback state
  const [animatingStrokeIdx, setAnimatingStrokeIdx] = useState<number>(-1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Load strokes on demand for the active card if they are empty
  useEffect(() => {
    const activeCard = queue[currentIdx];
    if (!activeCard || sessionCompleted) return;

    if (!activeCard.strokes || activeCard.strokes.length === 0) {
      setLoadingStrokes(true);
      const codePoint = activeCard.character.codePointAt(0);
      if (codePoint) {
        const hex = codePoint.toString(16).toLowerCase().padStart(5, '0');
        const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;

        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error('Fail to fetch SVG');
            return res.text();
          })
          .then(svgText => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const paths = Array.from(doc.querySelectorAll('path'))
              .map(path => path.getAttribute('d') || '')
              .filter(d => d.length > 0);

            if (paths.length > 0) {
              // Update state locally and in store
              updateKanjiStrokes(activeCard.character, paths);
              
              // Also update in our local queue
              setQueue(prevQueue => {
                const newQueue = [...prevQueue];
                if (newQueue[currentIdx]) {
                  newQueue[currentIdx] = {
                    ...newQueue[currentIdx],
                    strokes: paths
                  };
                }
                return newQueue;
              });
            }
          })
          .catch(err => {
            console.error('Error fetching strokes from KanjiVG:', err);
          })
          .finally(() => {
            setLoadingStrokes(false);
          });
      }
    }
  }, [currentIdx, queue.length, sessionCompleted]);

  // Drawing Canvas references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Load kanji queue once on Category or Level changes
  // Reading kanjiList dynamically from store state to avoid stuck bug on reviewCard updates!
  useEffect(() => {
    const list = useKanjiStore.getState().kanjiList;
    let pool = list.filter(c => !c.isSuspended);

    if (category === 'N5') {
      pool = pool.filter(c => c.level === 'N5');
    } else if (category === 'N4') {
      pool = pool.filter(c => c.level === 'N4');
    } else if (category === 'LEECH') {
      pool = pool.filter(c => c.isLeech || c.mistakeCount > 0);
    }

    // Prioritize leech/weak kanji first if studying writing!
    let combined = [];
    if (category !== 'LEECH') {
      const leeches = pool.filter(c => c.isLeech);
      const standard = pool.filter(c => !c.isLeech);
      combined = [...leeches, ...standard];
    } else {
      combined = pool;
    }

    const sessionQueue = combined.slice(0, 10);

    setQueue(sessionQueue);
    setCurrentIdx(0);
    setEvaluationStage(false);
    setIsAnimating(false);
    setAnimatingStrokeIdx(-1);
    setSessionCompleted(sessionQueue.length === 0);
  }, [category, selectedLevel]);

  const activeCard = queue[currentIdx];

  // Set up canvas context
  useEffect(() => {
    if (!activeCard || evaluationStage || sessionCompleted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Support high DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.strokeStyle = '#f3f4f6'; // Light grey brush for dark mode
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctxRef.current = ctx;
    clearCanvas();
  }, [activeCard, evaluationStage, sessionCompleted]);

  // Handle drawing events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    if (!coords || !ctxRef.current) return;

    ctxRef.current.beginPath();
    ctxRef.current.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !ctxRef.current) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    ctxRef.current.lineTo(coords.x, coords.y);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    ctxRef.current?.closePath();
    setIsDrawing(false);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Coord | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
  };

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

  // Play stroke sequence animations (if stroke data exists)
  const runStrokeAnimation = () => {
    if (!activeCard || isAnimating || !activeCard.strokes || activeCard.strokes.length === 0) return;

    setIsAnimating(true);
    setAnimatingStrokeIdx(0);
  };

  // Animate strokes incrementally using standard timer intervals
  useEffect(() => {
    if (!isAnimating || !activeCard || !activeCard.strokes) return;

    if (animatingStrokeIdx >= activeCard.strokes.length) {
      setIsAnimating(false);
      return;
    }

    const timer = setTimeout(() => {
      setAnimatingStrokeIdx(prev => prev + 1);
    }, 850); // Pause between each stroke

    return () => clearTimeout(timer);
  }, [isAnimating, animatingStrokeIdx, activeCard]);

  // Proceed with self-assessment review
  const handleAssessment = (correct: boolean) => {
    if (!activeCard) return;

    if (correct) {
      audio.playSuccess();
      reviewCard(activeCard.id, 'good');

      // Manual check to tick daily quests for writing
      const storeState = useKanjiStore.getState();
      const updatedQuests = storeState.dailyQuests.map(q => {
        if (q.type === 'writing' && !q.completed) {
          const nextVal = Math.min(q.target, q.current + 1);
          return { ...q, current: nextVal, completed: nextVal >= q.target };
        }
        return q;
      });
      useKanjiStore.setState({ dailyQuests: updatedQuests });

    } else {
      audio.playFailure();
      reviewCard(activeCard.id, 'forgot');
    }

    // Advance queue
    if (currentIdx + 1 < queue.length) {
      setCurrentIdx(currentIdx + 1);
      setEvaluationStage(false);
      setIsAnimating(false);
      setAnimatingStrokeIdx(-1);
    } else {
      setSessionCompleted(true);
    }
  };

  const triggerCheck = () => {
    setEvaluationStage(true);
    speakText(activeCard.character);
    // Auto-trigger SVG playback if strokes exist
    if (activeCard.strokes && activeCard.strokes.length > 0) {
      setTimeout(() => {
        runStrokeAnimation();
      }, 300);
    }
  };

  const hasStrokes = activeCard?.strokes && activeCard.strokes.length > 0;

  return (
    <div className="flex flex-col items-center justify-between min-h-[80vh] py-6 px-4">
      {/* Session progress header */}
      <div className="w-full max-w-xl flex items-center justify-between border-b border-gray-800 pb-3">
        <button
          onClick={onBackToDashboard}
          className="text-xs uppercase tracking-wider text-gray-400 hover:text-tokyo-torii transition-colors font-medium border border-gray-800 px-3 py-1.5 rounded-full bg-tokyo-card/30"
        >
          ← Dashboard
        </button>

        {!sessionCompleted && queue.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium">
              Kanji: <strong className="text-tokyo-sakura">{currentIdx + 1}</strong> / {queue.length}
            </span>
            {activeCard?.isLeech && (
              <span className="px-2 py-0.5 text-[8px] font-bold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                LEECH RECOVERY
              </span>
            )}
          </div>
        )}
      </div>

      {/* Category selector */}
      <div className="w-full max-w-xl flex bg-gray-950/60 p-1.5 rounded-2xl border border-gray-800/80 text-xs justify-between gap-1.5 mt-2 shadow-inner">
        {(['ALL', 'N5', 'N4', 'LEECH'] as const).map(cat => {
          let label = 'Semua';
          if (cat === 'N5') label = 'Kanji N5';
          if (cat === 'N4') label = 'Kanji N4';
          if (cat === 'LEECH') label = 'Leech 🚨';

          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-1 py-1.5 rounded-xl font-extrabold text-[10px] sm:text-xs transition-all duration-300 ${
                category === cat
                  ? 'bg-tokyo-sakura text-tokyo-darkText shadow-sakura'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-tokyo-card/10'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-xl mt-4">
        <AnimatePresence mode="wait">
          {sessionCompleted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center p-8 rounded-3xl border border-gray-800 bg-tokyo-card/50 backdrop-blur-lg shadow-glass glow-pulse-sakura"
            >
              <div className="w-20 h-20 bg-tokyo-sakura/10 rounded-full flex items-center justify-center mx-auto mb-6 text-tokyo-sakura text-4xl">
                ✍️
              </div>
              <h2 className="text-2xl font-bold text-tokyo-darkText mb-3">Latihan Selesai! 🎉</h2>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-8">
                Luar biasa! Kamu telah melatih motorik menulis kanji JLPT terpilih hari ini. Memori motorik otot tangan terbukti sangat membantu retensi ingatan jangka panjang.
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
              <div className="w-full space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold text-tokyo-darkText">
                    Latihlah Goresan Kanji: "{activeCard.character}"
                  </h3>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-1">
                    Arti: <span className="text-tokyo-sakura">{activeCard.meaning}</span> {loadingStrokes ? ' | ⏳ Memuat Goresan...' : hasStrokes ? `| Goresan: ${activeCard.strokes.length}` : ''}
                  </p>
                </div>

                {/* Primary Canvas Drawing Grid Box */}
                <div className="relative w-80 h-80 mx-auto rounded-3xl border border-gray-800 bg-gray-950/40 backdrop-blur-md shadow-glass flex items-center justify-center overflow-hidden">
                  
                  {/* Calligraphy Guide lines overlay (crosshair style) */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-full h-[0.5px] border-b border-dashed border-gray-800" />
                    <div className="h-full w-[0.5px] border-l border-dashed border-gray-800" />
                    {/* Circle guide */}
                    <div className="absolute w-48 h-48 rounded-full border border-dashed border-gray-800/35" />
                  </div>

                  {/* 20% Opacity Background Template (Only in trace stage) */}
                  {!evaluationStage && showGuide && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
                      {hasStrokes ? (
                        <svg viewBox="0 0 109 109" className="w-[180px] h-[180px]">
                          {activeCard.strokes.map((path, idx) => (
                            <path
                              key={idx}
                              d={path}
                              stroke="#f3f4f6"
                              strokeWidth="3.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ))}
                        </svg>
                      ) : (
                        <div className="text-[130px] font-kanji text-gray-400 select-none leading-none pt-4 text-center">
                          {activeCard.character}
                        </div>
                      )}
                    </div>
                  )}

                  {/* HTML5 drawing canvas */}
                  {!evaluationStage && (
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="absolute inset-0 z-10 w-full h-full cursor-crosshair touch-none"
                    />
                  )}

                  {/* Correct Animated Overlay Panel (Only in Evaluation Stage) */}
                  {evaluationStage && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                      {hasStrokes ? (
                        <svg viewBox="0 0 109 109" className="w-[180px] h-[180px]">
                          {/* Static light guide backdrop */}
                          <g opacity="0.1">
                            {activeCard.strokes.map((path, idx) => (
                              <path
                                key={idx}
                                d={path}
                                stroke="#f3f4f6"
                                strokeWidth="3.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            ))}
                          </g>

                          {/* Animated stroke overlays drawn sequentially */}
                          {activeCard.strokes.map((path, idx) => {
                            const isStrokeVisible = idx <= animatingStrokeIdx;
                            if (!isStrokeVisible) return null;

                            return (
                              <motion.path
                                key={idx}
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                d={path}
                                stroke={idx === animatingStrokeIdx ? '#00f2fe' /* pond cyan actively animated */ : '#f687b3' /* sakura pink completed */}
                                strokeWidth="4.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            );
                          })}

                          {/* Starting Coordinate circles and index numbers */}
                          {activeCard.strokes.map((path, idx) => {
                            const coords = getStartCoords(path);
                            if (!coords || idx > animatingStrokeIdx) return null;

                            return (
                              <g key={idx}>
                                <circle
                                  cx={coords.x}
                                  cy={coords.y}
                                  r="4.5"
                                  fill="#00f2fe"
                                  className="shadow-pond"
                                />
                                <text
                                  x={coords.x}
                                  y={coords.y + 1.5}
                                  fontSize="4"
                                  textAnchor="middle"
                                  fill="#0b0f19"
                                  fontWeight="bold"
                                >
                                  {idx + 1}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      ) : (
                        <div className="text-[130px] font-kanji text-tokyo-sakura select-none leading-none pt-4 text-center animate-pulse drop-shadow-lg">
                          {activeCard.character}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Indonesian Mnemonics drawer */}
                <div className="p-3.5 rounded-2xl bg-tokyo-card/30 border border-gray-800 max-w-sm mx-auto text-[11px] leading-relaxed text-gray-400">
                  <span className="font-bold text-tokyo-sakura block mb-1">💡 Asosiasi Memori</span>
                  {activeCard.mnemonic || `Bayangkan struktur karakter "${activeCard.character}" di atas untuk merekatkan memori visual Anda.`}
                </div>

                {/* Controls Decks */}
                <div className="flex flex-col gap-3 max-w-sm mx-auto">
                  {!evaluationStage ? (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={clearCanvas}
                        className="py-3 rounded-2xl border border-gray-800 hover:border-tokyo-torii hover:bg-tokyo-torii/5 text-gray-400 hover:text-tokyo-torii font-bold text-xs flex items-center justify-center gap-1.5 transition-colors duration-300"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                      <button
                        onClick={() => setShowGuide(!showGuide)}
                        className={`py-3 rounded-2xl border text-xs font-bold transition-all duration-300 ${
                          showGuide
                            ? 'border-tokyo-sakura text-tokyo-sakura bg-tokyo-sakura/5'
                            : 'border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        Template: {showGuide ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={triggerCheck}
                        className="py-3 rounded-2xl bg-gradient-to-r from-tokyo-pond to-tokyo-sakura text-tokyo-darkText font-bold text-xs shadow-lg hover:shadow-pond transition-all duration-300 flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={14} fill="currentColor" /> Periksa
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 text-center"
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] text-gray-500 uppercase tracking-widest font-semibold border-t border-b border-gray-800/40 py-2.5">
                        <span>Bandingkan goresanmu dengan template!</span>
                        {hasStrokes && (
                          <button
                            onClick={runStrokeAnimation}
                            disabled={isAnimating}
                            className="flex items-center gap-1 text-tokyo-pond hover:underline disabled:opacity-40"
                          >
                            <Play size={10} fill="currentColor" /> Putar Animasi
                          </button>
                        )}
                      </div>

                      {/* Self-Assessment rating panel */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleAssessment(false)}
                          className="py-3.5 rounded-2xl bg-tokyo-torii/10 hover:bg-tokyo-torii/25 text-tokyo-torii border border-tokyo-torii/25 hover:border-tokyo-torii/50 font-bold text-xs transition-colors duration-300"
                        >
                          😭 Coba Lagi (Gagal)
                        </button>
                        <button
                          onClick={() => handleAssessment(true)}
                          className="py-3.5 rounded-2xl bg-tokyo-bamboo/10 hover:bg-tokyo-bamboo/25 text-tokyo-bamboo border border-tokyo-bamboo/25 hover:border-tokyo-bamboo/50 font-bold text-xs transition-colors duration-300"
                        >
                          🙂 Saya Benar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
