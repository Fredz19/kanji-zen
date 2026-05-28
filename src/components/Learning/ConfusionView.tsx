import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Play, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';
import { useKanjiStore } from '../../store/useKanjiStore';

interface ConfusionViewProps {
  onBackToDashboard: () => void;
}

interface SimilarityPair {
  id: string;
  kanjiA: string;
  meaningA: string;
  strokesA: string[];
  highlightIdxA: number[]; // Indices of strokes to highlight in A
  kanjiB: string;
  meaningB: string;
  strokesB: string[];
  highlightIdxB: number[]; // Indices of strokes to highlight in B
  explanation: string;
}

// Predefined visually similar Kanji pairs with stroke coordinates
const SIMILARITY_PAIRS: SimilarityPair[] = [
  {
    id: 'tsuchi-shi',
    kanjiA: '土',
    meaningA: 'Bumi, Tanah',
    strokesA: [
      'M30.75,51.25c2.61,0.56,5.32,0.3,7.94,0.02c11.75-1.37,23.34-2.88,32.06-3.41c2.62-0.11,5.2-0.19,7.76,0.34', // horizontal top
      'M51.25,20.75c1.25,1.25,1.5,2.75,1.5,4.25c0,12.5-0.25,38.25-0.25,48.5', // vertical center
      'M17.75,80c2.61,0.56,5.82,0.5,8.5,0.22c19.12-1.97,45.97-3.09,65-3.5c2.69-0.06,5.38,0.19,8,0.75' // LONG horizontal bottom
    ],
    highlightIdxA: [2], // Highlight long bottom stroke
    kanjiB: '士',
    meaningB: 'Ksatria, Prajurit',
    strokesB: [
      'M18.75,45c2.61,0.56,5.82,0.5,8.5,0.22c22.12-1.97,49.97-3.09,65-3.5c2.69-0.06,5.38,0.19,8,0.75', // LONG horizontal top
      'M51.25,15.75c1.25,1.25,1.5,2.75,1.5,4.25c0,18.5-0.25,52.25-0.25,62.5', // vertical center
      'M32.75,82.25c2.61,0.56,5.32,0.3,7.94,0.02c12.75-1.37,22.34-2.88,33.06-3.41c2.62-0.11,5.2-0.19,7.76,0.34' // short horizontal bottom
    ],
    highlightIdxB: [0], // Highlight long top stroke
    explanation: 'Perhatikan perbandingan panjang garis horizontal. Pada 土 (Tanah), garis horizontal bawah lebih panjang. Sedangkan pada 士 (Ksatria), garis horizontal atas yang lebih panjang.'
  },
  {
    id: 'mi-matsu',
    kanjiA: '未',
    meaningA: 'Belum, Tidak',
    strokesA: [
      'M33.75,34.25c1.5,0.38,3.25,0.41,4.75,0.27c8.5-0.77,18.38-2.14,24.75-2.52c1.5-0.07,3,0.06,4.5,0.25', // SHORT horizontal top
      'M18.75,54.25c2.61,0.56,5.82,0.5,8.5,0.22c22.12-1.97,45.97-3.09,65-3.5c2.69-0.06,5.38,0.19,8,0.75', // long horizontal second
      'M51.25,12.75c1.25,1.25,1.5,2.75,1.5,4.25c0,18.5-0.25,54.25-0.25,68.5', // vertical center
      'M51.25,48.25c-8.25,13.5-22.5,31.75-35.5,39.5', // slant down-left
      'M52.25,48.25c8.34,11.72,23.34,27.48,33.98,34.47c3.15,2.07,6.38,3.75,10.02,4.78' // slant down-right
    ],
    highlightIdxA: [0], // Highlight short top line
    kanjiB: '末',
    meaningB: 'Ujung, Akhir',
    strokesB: [
      'M18.75,32.25c2.61,0.56,5.82,0.5,8.5,0.22c22.12-1.97,45.97-3.09,65-3.5c2.69-0.06,5.38,0.19,8,0.75', // LONG horizontal top
      'M33.75,51.25c1.5,0.38,3.25,0.41,4.75,0.27c8.5-0.77,18.38-2.14,24.75-2.52c1.5-0.07,3,0.06,4.5,0.25', // short horizontal second
      'M51.25,12.75c1.25,1.25,1.5,2.75,1.5,4.25c0,18.5-0.25,54.25-0.25,68.5',
      'M51.25,48.25c-8.25,13.5-22.5,31.75-35.5,39.5',
      'M52.25,48.25c8.34,11.72,23.34,27.48,33.98,34.47c3.15,2.07,6.38,3.75,10.02,4.78'
    ],
    highlightIdxB: [0], // Highlight long top line
    explanation: 'Perhatikan letak garis horizontal terpanjang. Pada 未 (Belum/Not Yet), garis horizontal atas lebih pendek dari garis kedua. Sedangkan pada 末 (Ujung/End), garis horizontal atas yang lebih panjang dari garis kedua.'
  },
  {
    id: 'hito-iru',
    kanjiA: '人',
    meaningA: 'Orang, Manusia',
    strokesA: [
      'M52.01,17c0.12,1.26,0.22,3.26-0.24,5.07C48.88,33.5,36.56,60.65,14.5,76.5', // Slant left
      'M49.25,48.25c7.34,6.72,19.34,17.48,29.98,24.47c3.15,2.07,6.38,3.75,10.02,4.78' // Slant right attaches under left
    ],
    highlightIdxA: [0], // Stroke 1 slants down left from top
    kanjiB: '入',
    meaningB: 'Masuk, Memasukkan',
    strokesB: [
      'M50.5,18c0.12,1.26,0.12,2.8-0.34,4.5c-3.16,11.7-16.16,33.7-33.66,46.5', // Short slant left
      'M39.25,32.25c8.34,7.72,27.34,35.48,39.98,46.47c3.15,2.07,6.38,3.75,10.02,4.78' // Long slant right starts above left
    ],
    highlightIdxB: [1], // Stroke 2 starts higher and overlaps left stroke
    explanation: 'Perhatikan garis mana yang menyokong yang lain di bagian atas. Pada 人 (Orang), garis kiri menyokong garis kanan di bawahnya. Pada 入 (Masuk), garis kanan menyilang dan memotong garis kiri di bagian paling atas.'
  },
  {
    id: 'o-futo',
    kanjiA: '大',
    meaningA: 'Besar, Banyak',
    strokesA: [
      'M18.75,41.25c2.61,0.56,5.32,0.3,7.94,0.02c18.75-1.37,45.34-3.38,57.06-3.91c2.62-0.11,5.2-0.19,7.76,0.34', // horizontal bar
      'M51.25,16.75c1.25,1.25,1.5,2.75,1.5,4.25c0,18.5-0.25,45.25-24.25,62.5', // slant down-left
      'M52.25,40.25c8.34,11.72,24.34,29.48,34.98,36.47c3.15,2.07,6.38,3.75,10.02,4.78' // slant down-right
    ],
    highlightIdxA: [],
    kanjiB: '太',
    meaningB: 'Gemuk, Tebal',
    strokesB: [
      'M18.75,41.25c2.61,0.56,5.32,0.3,7.94,0.02c18.75-1.37,45.34-3.38,57.06-3.91c2.62-0.11,5.2-0.19,7.76,0.34',
      'M51.25,16.75c1.25,1.25,1.5,2.75,1.5,4.25c0,18.5-0.25,45.25-24.25,62.5',
      'M52.25,40.25c8.34,11.72,24.34,29.48,34.98,36.47c3.15,2.07,6.38,3.75,10.02,4.78',
      'M48.25,65.25c2.75,3.5,4.75,7.25,5.5,10.5' // EXTRA DOT STROKE
    ],
    highlightIdxB: [3], // Highlight the dot stroke
    explanation: 'Perbedaan utama ada pada titik tambahan. Pada 大 (Besar), tidak ada titik tambahan. Sedangkan pada 太 (Gemuk/Tebal), terdapat satu titik goresan kecil tambahan di bagian tengah bawah kaki.'
  }
];

export default function ConfusionView({ onBackToDashboard }: ConfusionViewProps) {
  const audio = useAudio();
  const { trackConfusion } = useKanjiStore();

  const [activePairIdx, setActivePairIdx] = useState(0);
  const [drillStage, setDrillStage] = useState(false);
  const [drillPrompt, setDrillPrompt] = useState<{ meaning: string; correctKanji: string } | null>(null);
  const [drillAnswered, setDrillAnswered] = useState(false);
  const [selectedDrillOption, setSelectedDrillOption] = useState<string | null>(null);
  const [drillSuccess, setDrillSuccess] = useState<boolean | null>(null);

  const activePair = SIMILARITY_PAIRS[activePairIdx];

  const handlePairChange = (idx: number) => {
    setActivePairIdx(idx);
    setDrillStage(false);
    setDrillAnswered(false);
    setDrillSuccess(null);
    setSelectedDrillOption(null);
  };

  // Launch similarity drill matching mini-game
  const startDrill = () => {
    const pickA = Math.random() > 0.5;
    setDrillPrompt({
      meaning: pickA ? activePair.meaningA : activePair.meaningB,
      correctKanji: pickA ? activePair.kanjiA : activePair.kanjiB
    });
    setDrillStage(true);
    setDrillAnswered(false);
    setDrillSuccess(null);
    setSelectedDrillOption(null);
  };

  const handleDrillAnswer = (kanji: string) => {
    if (drillAnswered || !drillPrompt) return;

    setSelectedDrillOption(kanji);
    setDrillAnswered(true);

    const isCorrect = kanji === drillPrompt.correctKanji;
    setDrillSuccess(isCorrect);

    if (isCorrect) {
      audio.playSuccess();
    } else {
      audio.playFailure();
      // Log failure confusion counts
      trackConfusion(activePair.kanjiA, activePair.kanjiB);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[80vh] py-6 px-4">
      {/* Session progress header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <button
          onClick={onBackToDashboard}
          className="text-xs uppercase tracking-wider text-gray-400 hover:text-tokyo-torii transition-colors font-medium border border-gray-800 px-3 py-1.5 rounded-full bg-tokyo-card/30"
        >
          ← Dashboard
        </button>

        <span className="text-[10px] font-bold tracking-widest text-tokyo-torii uppercase">
          ⚔️ Detektor Kanji Kembar
        </span>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6 flex-1 justify-center">
        
        {/* Horizontal scroll selector tabs for confusion pairs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin select-none">
          {SIMILARITY_PAIRS.map((pair, idx) => (
            <button
              key={pair.id}
              onClick={() => handlePairChange(idx)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold shrink-0 border transition-all duration-300 ${
                activePairIdx === idx
                  ? 'border-tokyo-torii bg-tokyo-torii/15 text-tokyo-darkText'
                  : 'border-gray-800 bg-gray-900/30 text-gray-400 hover:text-gray-200'
              }`}
            >
              {pair.kanjiA} vs {pair.kanjiB}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {!drillStage ? (
            /* VISUAL CONTRAST ANALYSIS STAGE */
            <motion.div
              key={`analysis-${activePair.id}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 w-full"
            >
              {/* Side-by-side SVG highlight frames */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Kanji A card */}
                <div className="p-5 rounded-3xl border border-gray-800 bg-tokyo-card/45 backdrop-blur-md shadow-glass flex flex-col items-center justify-between min-h-[220px]">
                  <span className="text-[10px] text-tokyo-sakura font-bold uppercase tracking-wider mb-2">
                    {activePair.meaningA}
                  </span>
                  
                  <div className="w-32 h-32 flex items-center justify-center">
                    <svg viewBox="0 0 109 109" className="w-full h-full">
                      {activePair.strokesA.map((path, idx) => {
                        const isHighlighted = activePair.highlightIdxA.includes(idx);
                        return (
                          <path
                            key={idx}
                            d={path}
                            stroke={isHighlighted ? '#ff4a5a' /* RED glowing highlighted conflict stroke */ : '#f3f4f6' /* Standard slate */}
                            strokeWidth={isHighlighted ? '6' : '3.5'}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={isHighlighted ? 'glow-pulse-torii' : ''}
                          />
                        );
                      })}
                    </svg>
                  </div>
                  
                  <span className="text-2xl font-kanji font-bold text-tokyo-darkText mt-3">{activePair.kanjiA}</span>
                </div>

                {/* Kanji B card */}
                <div className="p-5 rounded-3xl border border-gray-800 bg-tokyo-card/45 backdrop-blur-md shadow-glass flex flex-col items-center justify-between min-h-[220px]">
                  <span className="text-[10px] text-tokyo-pond font-bold uppercase tracking-wider mb-2">
                    {activePair.meaningB}
                  </span>

                  <div className="w-32 h-32 flex items-center justify-center">
                    <svg viewBox="0 0 109 109" className="w-full h-full">
                      {activePair.strokesB.map((path, idx) => {
                        const isHighlighted = activePair.highlightIdxB.includes(idx);
                        return (
                          <path
                            key={idx}
                            d={path}
                            stroke={isHighlighted ? '#ff4a5a' /* RED glowing highlighted conflict stroke */ : '#f3f4f6' /* Standard slate */}
                            strokeWidth={isHighlighted ? '6' : '3.5'}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={isHighlighted ? 'glow-pulse-torii' : ''}
                          />
                        );
                      })}
                    </svg>
                  </div>

                  <span className="text-2xl font-kanji font-bold text-tokyo-darkText mt-3">{activePair.kanjiB}</span>
                </div>

              </div>

              {/* Mnemonic analysis explanation block */}
              <div className="p-5 rounded-3xl border border-tokyo-torii/25 bg-tokyo-torii/5 leading-relaxed text-xs text-gray-300">
                <span className="font-bold text-tokyo-torii block mb-1">🔍 Kunci Pembeda Kognitif:</span>
                {activePair.explanation}
              </div>

              {/* Start drill matcher game */}
              <button
                onClick={startDrill}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-tokyo-torii to-tokyo-sakura text-tokyo-darkText font-black tracking-wide shadow-lg hover:shadow-torii transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Play size={16} fill="currentColor" />
                UJI PEMBEDALAN SEKARANG ⚔️
              </button>

            </motion.div>
          ) : (
            /* CONTRAST MATCHING DRILL GAME STAGE */
            drillPrompt && (
              <motion.div
                key={`drill-${activePair.id}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6 w-full text-center"
              >
                <div className="p-6 rounded-3xl border border-gray-800 bg-tokyo-card/30 backdrop-blur-md relative overflow-hidden py-10">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block mb-2">Tebaklah Kanji yang Tepat</span>
                  <h3 className="text-2xl font-black text-tokyo-darkText">"{drillPrompt.meaning}"</h3>
                </div>

                {/* Binary choices grid */}
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                  {[activePair.kanjiA, activePair.kanjiB].map((kanji, idx) => {
                    const isSelected = selectedDrillOption === kanji;
                    const isCorrect = kanji === drillPrompt.correctKanji;

                    let cardStyle = 'border-gray-800 bg-gray-900/35 hover:border-gray-700 hover:bg-gray-850/45 text-tokyo-darkText';

                    if (drillAnswered) {
                      if (isCorrect) {
                        cardStyle = 'border-tokyo-bamboo bg-tokyo-bamboo/15 text-tokyo-bamboo shadow-bamboo';
                      } else if (isSelected) {
                        cardStyle = 'border-tokyo-torii bg-tokyo-torii/15 text-tokyo-torii shadow-torii animate-shake';
                      } else {
                        cardStyle = 'border-gray-900 bg-gray-950/20 text-gray-500 opacity-60 pointer-events-none';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={drillAnswered}
                        onClick={() => handleDrillAnswer(kanji)}
                        className={`p-6 py-10 rounded-3xl border text-5xl font-kanji font-bold flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 ${cardStyle}`}
                      >
                        {kanji}
                        {drillAnswered && isCorrect && (
                          <span className="text-[10px] text-tokyo-bamboo uppercase tracking-widest font-bold mt-3 flex items-center gap-1">
                            <CheckCircle size={10} fill="currentColor" /> Benar
                          </span>
                        )}
                        {drillAnswered && isSelected && !isCorrect && (
                          <span className="text-[10px] text-tokyo-torii uppercase tracking-widest font-bold mt-3 flex items-center gap-1">
                            <XCircle size={10} fill="currentColor" /> Salah
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Drill feedback summary */}
                <AnimatePresence>
                  {drillAnswered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 max-w-sm mx-auto"
                    >
                      <div className="p-3.5 rounded-2xl bg-gray-950/40 border border-gray-800 text-[11px] text-gray-400 leading-relaxed">
                        <strong className="text-tokyo-sakura block mb-1">Catatan Kognitif:</strong>
                        {activePair.explanation}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={startDrill}
                          className="flex-1 py-3 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/80 text-gray-300 font-semibold transition-colors text-xs flex items-center justify-center gap-1"
                        >
                          <RefreshCw size={12} /> Coba Lagi
                        </button>
                        <button
                          onClick={() => setDrillStage(false)}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-tokyo-torii to-tokyo-sakura text-tokyo-darkText font-bold text-xs"
                        >
                          Tinjau Visual →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
