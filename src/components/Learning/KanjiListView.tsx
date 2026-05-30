import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, Filter, Volume2, HelpCircle, X, Check, Award, Layers, Clock, Zap } from 'lucide-react';
import { KanjiItem } from '../../data/presets';
import { useKanjiStore } from '../../store/useKanjiStore';
import { TOPIC_CATEGORIES, getKanjiTopicId } from '../../utils/topics';

interface KanjiListViewProps {
  onBackToDashboard: () => void;
  selectedLevel: 'N5' | 'N4' | 'N3' | 'ALL';
}

export default function KanjiListView({ onBackToDashboard, selectedLevel }: KanjiListViewProps) {
  const { kanjiList, updateKanjiStrokes } = useKanjiStore();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'N5' | 'N4' | 'N3'>(selectedLevel);
  const [masteryFilter, setMasteryFilter] = useState<'ALL' | 'NEW' | 'LEARNING' | 'MASTERED'>('ALL');
  
  // Selected Kanji details modal
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [loadingStrokes, setLoadingStrokes] = useState(false);
  const [animatingStrokeIdx, setAnimatingStrokeIdx] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Sync level filter if selectedLevel prop changes
  useEffect(() => {
    setLevelFilter(selectedLevel);
  }, [selectedLevel]);

  // Audio Speech Synthesis helper
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

  // Fetch strokes for detail modal if empty
  useEffect(() => {
    if (!selectedKanji) {
      setIsAnimating(false);
      setAnimatingStrokeIdx(-1);
      return;
    }

    if (!selectedKanji.strokes || selectedKanji.strokes.length === 0) {
      setLoadingStrokes(true);
      const codePoint = selectedKanji.character.codePointAt(0);
      if (codePoint) {
        const hex = codePoint.toString(16).toLowerCase().padStart(5, '0');
        const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;

        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error();
            return res.text();
          })
          .then(svgText => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const paths = Array.from(doc.querySelectorAll('path'))
              .map(p => p.getAttribute('d') || '')
              .filter(d => d.length > 0);

            if (paths.length > 0) {
              updateKanjiStrokes(selectedKanji.character, paths);
              setSelectedKanji(prev => prev ? { ...prev, strokes: paths } : null);
            }
          })
          .catch(() => console.log('Offline or KanjiVG fetch failed'))
          .finally(() => setLoadingStrokes(false));
      }
    }
  }, [selectedKanji?.character]);

  // Animate strokes incrementally
  useEffect(() => {
    if (!isAnimating || !selectedKanji || !selectedKanji.strokes) return;

    if (animatingStrokeIdx >= selectedKanji.strokes.length) {
      setIsAnimating(false);
      return;
    }

    const timer = setTimeout(() => {
      setAnimatingStrokeIdx(prev => prev + 1);
    }, 800);

    return () => clearTimeout(timer);
  }, [isAnimating, animatingStrokeIdx, selectedKanji]);

  const triggerStrokeAnimation = () => {
    if (!selectedKanji || isAnimating || !selectedKanji.strokes || selectedKanji.strokes.length === 0) return;
    setIsAnimating(true);
    setAnimatingStrokeIdx(0);
  };

  // Filter lists based on inputs
  const filteredKanji = kanjiList.filter(kanji => {
    // 1. Kategori Topik
    if (activeCategory !== 'all') {
      const topicId = getKanjiTopicId(kanji.character);
      if (topicId !== activeCategory) return false;
    }

    // 2. Level N5 / N4
    if (levelFilter !== 'ALL' && kanji.level !== levelFilter) return false;

    // 3. Status SRS Mastery
    if (masteryFilter !== 'ALL') {
      const rep = kanji.repetitions;
      if (masteryFilter === 'NEW' && rep !== 0) return false;
      if (masteryFilter === 'LEARNING' && (rep === 0 || rep >= 3)) return false;
      if (masteryFilter === 'MASTERED' && rep < 3) return false;
    }

    // 4. Query Pencarian
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      const matchChar = kanji.character.includes(query);
      const matchMeaning = kanji.meaning.toLowerCase().includes(query);
      const matchOnyomi = kanji.onyomi.some(o => o.includes(query));
      const matchKunyomi = kanji.kunyomi.some(k => k.includes(query));
      return matchChar || matchMeaning || matchOnyomi || matchKunyomi;
    }

    return true;
  });

  const getMasteryColor = (rep: number) => {
    if (rep >= 3) return 'border-tokyo-bamboo/40 bg-tokyo-bamboo/5 text-tokyo-bamboo';
    if (rep > 0) return 'border-tokyo-pond/40 bg-tokyo-pond/5 text-tokyo-pond';
    return 'border-gray-800 bg-gray-950/20 text-gray-400';
  };

  const getMasteryBadge = (rep: number) => {
    if (rep >= 3) return 'Mastered';
    if (rep > 0) return 'Belajar';
    return 'Baru';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header navigasi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <button
            onClick={onBackToDashboard}
            className="text-xs uppercase tracking-wider text-gray-400 hover:text-tokyo-torii transition-colors font-medium border border-gray-800 px-3.5 py-1.5 rounded-full bg-tokyo-card/30 mb-3 flex items-center gap-1.5"
          >
            ← Dashboard
          </button>
          <h1 className="text-3xl font-extrabold text-tokyo-darkText tracking-tight flex items-center gap-2">
            Kamus Kanji Zen <span className="text-sm font-normal text-gray-500 font-kanji">漢字辞書</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Penjelajah detail visual, bacaan, dan progress ingatan 668 Kanji N5, N4 & N3.
          </p>
        </div>

        {/* Level Filters */}
        <div className="flex bg-gray-900/85 p-1 rounded-full border border-gray-800 text-xs shrink-0 self-start md:self-center">
          {(['ALL', 'N5', 'N4', 'N3'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-4 py-2 rounded-full font-bold transition-all duration-300 ${
                levelFilter === lvl
                  ? 'bg-tokyo-sakura text-tokyo-darkText shadow-sakura'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {lvl === 'ALL' ? 'Semua Level' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Input Pencarian & Penyaring Mastery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search Bar */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Cari kanji, arti, onyomi, atau kunyomi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-tokyo-card/25 border border-gray-800 rounded-2xl focus:border-tokyo-sakura/50 focus:outline-none text-sm text-tokyo-darkText transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-tokyo-sakura"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mastery Filter Selector */}
        <div className="flex bg-gray-900/85 p-1 rounded-2xl border border-gray-800 text-xs items-center justify-between">
          <span className="pl-3.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Progress:</span>
          <div className="flex gap-0.5">
            {(['ALL', 'NEW', 'LEARNING', 'MASTERED'] as const).map(m => {
              let label = 'Semua';
              if (m === 'NEW') label = 'Baru';
              if (m === 'LEARNING') label = 'Belajar';
              if (m === 'MASTERED') label = 'Master';

              return (
                <button
                  key={m}
                  onClick={() => setMasteryFilter(m)}
                  className={`px-3 py-2 rounded-xl font-bold text-[10px] sm:text-xs transition-all duration-300 ${
                    masteryFilter === m
                      ? 'bg-tokyo-pond text-[#0b0f19] font-black'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Slider Menu */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin border-b border-gray-900">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-xl border text-xs font-bold shrink-0 transition-all ${
            activeCategory === 'all'
              ? 'bg-tokyo-sakura/10 border-tokyo-sakura text-tokyo-sakura font-extrabold shadow-sm'
              : 'border-gray-800 bg-tokyo-card/15 text-gray-400 hover:border-gray-700'
          }`}
        >
          📂 Semua Topik
        </button>
        {TOPIC_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl border text-xs font-bold shrink-0 transition-all ${
              activeCategory === cat.id
                ? 'bg-tokyo-sakura/10 border-tokyo-sakura text-tokyo-sakura font-extrabold shadow-sm'
                : 'border-gray-800 bg-tokyo-card/15 text-gray-400 hover:border-gray-700'
            }`}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      {/* Hasil Jumlah Penemuan */}
      <div className="text-xs text-gray-500 font-semibold flex items-center justify-between px-1">
        <span>Menampilkan {filteredKanji.length} Kanji dari total {kanjiList.length} database.</span>
      </div>

      {/* Grid of Kanji list */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3.5">
        {filteredKanji.map(kanji => {
          const mColor = getMasteryColor(kanji.repetitions);
          const badge = getMasteryBadge(kanji.repetitions);

          return (
            <motion.div
              key={kanji.id}
              layout
              onClick={() => {
                // Clone card details into active view
                setSelectedKanji(kanji);
              }}
              whileHover={{ y: -3, scale: 1.02 }}
              className={`p-4 rounded-3xl border ${mColor} cursor-pointer transition-all duration-300 relative group flex flex-col items-center justify-between text-center min-h-[140px]`}
            >
              {/* Level indicator top-left */}
              <span className="absolute top-2.5 left-3 text-[8px] font-bold px-1.5 py-0.5 rounded bg-gray-900/60 text-gray-400 uppercase">
                {kanji.level}
              </span>

              {/* Mastery Indicator top-right */}
              <span className={`absolute top-2.5 right-3 text-[8px] font-bold px-1.5 py-0.5 rounded ${
                kanji.repetitions >= 3 ? 'bg-tokyo-bamboo/20 text-tokyo-bamboo' : kanji.repetitions > 0 ? 'bg-tokyo-pond/20 text-tokyo-pond' : 'bg-gray-900/50 text-gray-500'
              }`}>
                {badge}
              </span>

              {/* Character */}
              <span className="text-4xl font-kanji font-bold text-tokyo-darkText tracking-tight block py-4 group-hover:text-tokyo-sakura transition-colors select-none">
                {kanji.character}
              </span>

              {/* Meaning */}
              <div className="w-full">
                <span className="text-xs font-bold text-tokyo-darkText truncate block max-w-full">
                  {kanji.meaning}
                </span>
                {kanji.kunyomi.length > 0 && (
                  <span className="text-[9px] text-gray-500 block truncate max-w-full font-medium mt-0.5 font-kanji">
                    {kanji.kunyomi[0]}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Fallback empty view */}
      {filteredKanji.length === 0 && (
        <div className="py-16 text-center border border-dashed border-gray-800 rounded-3xl bg-tokyo-card/5">
          <HelpCircle size={36} className="text-gray-600 mx-auto mb-3 animate-bounce" />
          <h3 className="text-sm font-bold text-gray-400">Tidak ada Kanji yang cocok</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 leading-relaxed">
            Coba ubah kata kunci pencarian Anda atau hapus filter kategori untuk menemukan data.
          </p>
        </div>
      )}

      {/* STUNNING KANJI DETAIL MODAL */}
      <AnimatePresence>
        {selectedKanji && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gray-950/75 backdrop-blur-md">
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-3xl rounded-3xl border border-tokyo-sakura/20 bg-tokyo-card/90 backdrop-blur-2xl shadow-2xl relative overflow-hidden flex flex-col"
            >
              {/* Top border glowing */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-tokyo-sakura via-tokyo-pond to-tokyo-bamboo" />
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedKanji(null)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-gray-950/40 text-gray-400 hover:text-tokyo-sakura border border-gray-800 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>

              {/* Content Panel */}
              <div className="p-6 md:p-8 overflow-y-auto max-h-[85vh] grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* LEFT BLOCK: Big visual representation */}
                <div className="md:col-span-5 flex flex-col items-center justify-between gap-4 border-b md:border-b-0 md:border-r border-gray-800/60 pb-6 md:pb-0 md:pr-6">
                  
                  <div className="text-center w-full">
                    <span className="px-3 py-1 rounded bg-tokyo-torii/15 text-tokyo-torii border border-tokyo-torii/30 text-[10px] font-extrabold uppercase shadow-sm">
                      Level {selectedKanji.level}
                    </span>
                    <h2 className="text-3xl font-extrabold text-tokyo-darkText tracking-tight block mt-3 font-mono">
                      {selectedKanji.meaning}
                    </h2>
                  </div>

                  {/* Canvas Tracing Graphic Box */}
                  <div className="relative w-48 h-48 rounded-2xl border border-gray-800/80 bg-gray-950/60 flex items-center justify-center overflow-hidden">
                    {/* Calligraphy guideline overlays */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-full h-[0.5px] border-b border-dashed border-gray-800/40" />
                      <div className="h-full w-[0.5px] border-l border-dashed border-gray-800/40" />
                    </div>

                    {/* SVG stroke overlay */}
                    {loadingStrokes ? (
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-1.5">
                        <Clock size={16} className="animate-spin text-tokyo-pond" />
                        Memuat goresan...
                      </div>
                    ) : selectedKanji.strokes && selectedKanji.strokes.length > 0 ? (
                      <svg viewBox="0 0 109 109" className="w-[150px] h-[150px] z-10 pointer-events-none">
                        {/* Static guide backdrop */}
                        <g opacity="0.1">
                          {selectedKanji.strokes.map((path, idx) => (
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

                        {/* Animated overlay */}
                        {selectedKanji.strokes.map((path, idx) => {
                          const isStrokeVisible = idx <= animatingStrokeIdx;
                          if (!isStrokeVisible) return null;

                          return (
                            <motion.path
                              key={idx}
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              d={path}
                              stroke={idx === animatingStrokeIdx ? '#00f2fe' : '#f687b3'}
                              strokeWidth="4.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          );
                        })}

                        {/* Order numbers overlay */}
                        {selectedKanji.strokes.map((path, idx) => {
                          const coords = selectedKanji.strokes[idx] ? getStartCoords(path) : null;
                          if (!coords || idx > animatingStrokeIdx) return null;

                          return (
                            <g key={idx}>
                              <circle cx={coords.x} cy={coords.y} r="4.2" fill="#00f2fe" />
                              <text
                                x={coords.x}
                                y={coords.y + 1.5}
                                fontSize="3.8"
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
                      <span className="text-[100px] font-kanji font-bold text-tokyo-darkText tracking-tighter leading-none select-none pt-2 block">
                        {selectedKanji.character}
                      </span>
                    )}
                  </div>

                  {/* Play Actions */}
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => speakText(selectedKanji.character)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/80 text-gray-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Volume2 size={14} /> Suara
                    </button>
                    {selectedKanji.strokes && selectedKanji.strokes.length > 0 && (
                      <button
                        onClick={triggerStrokeAnimation}
                        disabled={isAnimating || loadingStrokes}
                        className="flex-1 py-2.5 rounded-xl bg-tokyo-sakura/10 hover:bg-tokyo-sakura/20 text-tokyo-sakura border border-tokyo-sakura/30 font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-40"
                      >
                        ✍️ Putar Goresan
                      </button>
                    )}
                  </div>

                  {/* Level Mastery Card Detail */}
                  <div className={`p-3 rounded-2xl border text-center w-full text-[10px] font-bold ${
                    selectedKanji.repetitions >= 3 ? 'border-tokyo-bamboo/20 bg-tokyo-bamboo/5 text-tokyo-bamboo' : selectedKanji.repetitions > 0 ? 'border-tokyo-pond/20 bg-tokyo-pond/5 text-tokyo-pond' : 'border-gray-800 bg-gray-900/10 text-gray-500'
                  }`}>
                    Progress SRS: <strong className="text-tokyo-darkText leading-none font-mono capitalize">{getMasteryBadge(selectedKanji.repetitions)}</strong> ({selectedKanji.repetitions} ulasan sukses)
                  </div>
                </div>

                {/* RIGHT BLOCK: Readings, vocab, sentences */}
                <div className="md:col-span-7 space-y-4">
                  {/* Big Character badge info */}
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-kanji font-bold text-tokyo-sakura bg-tokyo-sakura/10 w-14 h-14 rounded-2xl flex items-center justify-center border border-tokyo-sakura/30 shadow-sakura">
                      {selectedKanji.character}
                    </span>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold block">Goresan & Frekuensi</span>
                      <span className="text-xs font-bold text-tokyo-darkText block mt-0.5">
                        {selectedKanji.strokeCount} Goresan | Peringkat Frekuensi: {selectedKanji.frequency}%
                      </span>
                    </div>
                  </div>

                  {/* Onyomi vs Kunyomi Block */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3 rounded-2xl bg-gray-900/60 border border-gray-800/80">
                      <span className="text-[9px] uppercase text-tokyo-sakura tracking-wider block mb-1 font-bold">Onyomi (Tionghoa)</span>
                      <span className="text-xs font-semibold text-tokyo-darkText">
                        {selectedKanji.onyomi.length > 0 ? selectedKanji.onyomi.join(', ') : '-'}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-gray-900/60 border border-gray-800/80">
                      <span className="text-[9px] uppercase text-tokyo-pond tracking-wider block mb-1 font-bold">Kunyomi (Jepang)</span>
                      <span className="text-xs font-semibold text-tokyo-darkText">
                        {selectedKanji.kunyomi.length > 0 ? selectedKanji.kunyomi.join(', ') : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Memory Mnemonic */}
                  <div className="p-4 rounded-2xl bg-tokyo-sakura/5 border border-tokyo-sakura/25">
                    <span className="text-[9px] uppercase text-tokyo-sakura tracking-wider block mb-1.5 font-bold flex items-center gap-1">
                      💡 Jembatan Keledai Memori
                    </span>
                    <p className="text-xs text-gray-300 leading-relaxed font-normal">
                      {selectedKanji.mnemonic || `Bayangkan bentuk ${selectedKanji.character} berselaras dengan arti konsep "${selectedKanji.meaning}".`}
                    </p>
                  </div>

                  {/* Vocabulary Important */}
                  {selectedKanji.vocabulary && selectedKanji.vocabulary.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase text-gray-500 tracking-wider block font-bold">Kosakata Esensial</span>
                      <div className="grid grid-cols-1 gap-2">
                        {selectedKanji.vocabulary.slice(0, 3).map((v, i) => (
                          <div
                            key={i}
                            onClick={() => speakText(v.word)}
                            className="flex items-center justify-between p-3 rounded-xl bg-gray-950/20 hover:bg-gray-800/25 border border-gray-800/80 text-xs transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <strong className="text-tokyo-darkText font-medium text-sm">{v.word}</strong>
                              {v.reading && (
                                <span className="text-gray-400 text-[10px]">（{v.reading}）</span>
                              )}
                            </div>
                            <span className="text-tokyo-sakura font-bold">{v.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Context Sentence examples */}
                  {selectedKanji.sentences && selectedKanji.sentences.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase text-gray-500 tracking-wider block font-bold">Contoh Kalimat Konteks</span>
                      <div className="grid grid-cols-1 gap-2">
                        {selectedKanji.sentences.slice(0, 2).map((s, i) => (
                          <div
                            key={i}
                            onClick={() => speakText(s.audioText)}
                            className="p-3 rounded-xl bg-tokyo-pond/5 hover:bg-tokyo-pond/10 border border-tokyo-pond/20 text-xs transition-colors cursor-pointer flex flex-col gap-1"
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-tokyo-darkText font-medium font-kanji leading-normal text-sm">{s.japanese}</span>
                              <Volume2 size={13} className="text-tokyo-pond shrink-0 mt-0.5" />
                            </div>
                            <span className="text-gray-400 italic text-[11px] font-normal leading-normal">{s.indonesian}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helpers starting coordinate coordinates extraction
interface Coord {
  x: number;
  y: number;
}
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
