import { KanjiItem } from '../data/presets';
import { INITIAL_SRS_STATE } from './srs';

/**
 * Clean cell content by removing markdown bold/italic tags and trimming
 */
function cleanCell(cell: string): string {
  if (!cell) return '';
  return cell
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/<br\s*\/?>/gi, '\n') // Standardize HTML breaks to newlines temporarily
    .trim();
}

/**
 * Strips citation bracket strings like [cite_start] or [cite: 1] or [cite: handle]
 */
export function stripCitations(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[cite_start\]/gi, '')
    .replace(/\[cite:\s*[^\]]+\]/gi, '')
    .trim();
}

/**
 * Parse Onyomi or Kunyomi reading string into clean string array
 */
function parseReadings(cell: string): string[] {
  const clean = cleanCell(cell);
  if (!clean) return [];
  
  // Split on newlines, commas, Japanese commas, or spaces
  return clean
    .split(/[\n,、\s]+/)
    .map(r => r.trim())
    .filter(r => r.length > 0);
}

/**
 * Parse the Indonesian vocabulary cell into structured items
 * Example input: "[cite_start]一人(ひとり): Satu orang <br> 一つ(ひとつ): Satu buah [cite: 1]"
 */
export interface ParsedVocab {
  word: string;
  reading: string;
  meaning: string;
}

export function parseVocabulary(vocabCell: string): ParsedVocab[] {
  const citationFree = stripCitations(vocabCell);
  if (!citationFree) return [];

  // Split items by <br> or newlines
  const items = citationFree
    .split(/<br\s*\/?>|\n/gi)
    .map(item => item.trim())
    .filter(item => item.length > 0);

  const parsedItems: ParsedVocab[] = [];

  for (const item of items) {
    // Match "Word(Reading): Meaning" or "Word（Reading）: Meaning" or "Word（Reading） : Meaning"
    // Support half-width ( ) and Japanese full-width （ ） parentheses
    const regex = /^\s*([^\(（\s]+)\s*[\(（]([^\)）]+)[\)）]\s*:\s*(.+)\s*$/;
    const match = item.match(regex);

    if (match) {
      parsedItems.push({
        word: match[1].trim(),
        reading: match[2].trim(),
        meaning: match[3].trim()
      });
    } else {
      // Fallback if formatting differs slightly (e.g. no reading parentheses)
      const parts = item.split(':');
      if (parts.length >= 2) {
        parsedItems.push({
          word: parts[0].trim(),
          reading: '',
          meaning: parts.slice(1).join(':').trim()
        });
      } else if (item.length > 0) {
        // Fallback for simple words
        parsedItems.push({
          word: item,
          reading: '',
          meaning: ''
        });
      }
    }
  }

  return parsedItems;
}

/**
 * Main parser function: Converts a Markdown Table String into a KanjiItem array.
 */
export function parseKanjiMarkdown(markdown: string, level: 'N5' | 'N4' = 'N5'): KanjiItem[] {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const items: KanjiItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headers, or separator lines
    if (!trimmed.startsWith('|') || trimmed.includes('| :---') || trimmed.includes('No | Arti')) {
      continue;
    }

    // Split cell items by pipe (|)
    const cells = trimmed.split('|').map(c => c.trim());
    
    // Valid markdown table row starts and ends with | so split yields empty elements at indices 0 and length-1
    // Cells array should look like: ['', No, Arti, Kanji, Onyomi, Kunyomi, Kosakata, '']
    if (cells.length < 7) continue;

    const noStr = cleanCell(cells[1]);
    const meaning = cleanCell(cells[2]);
    const character = cleanCell(cells[3]);
    const onyomiStr = cells[4];
    const kunyomiStr = cells[5];
    const vocabStr = cells[6];

    // Ensure we actually parsed a Kanji character (usually length 1)
    if (!character || character.length > 3) continue;

    const onyomi = parseReadings(onyomiStr);
    const kunyomi = parseReadings(kunyomiStr);
    const vocabulary = parseVocabulary(vocabStr);

    // Approximate stroke count based on stroke estimations or local defaults (can be updated by preset database)
    const strokeCount = estimateStrokeCount(character);
    
    items.push({
      id: `${level.toLowerCase()}-${noStr || character}`,
      character,
      meaning,
      onyomi,
      kunyomi,
      level,
      strokeCount,
      frequency: Math.floor(Math.random() * 20) + 70, // Procedural mock frequency
      mnemonic: getProceduralMnemonic(character, meaning),
      vocabulary,
      sentences: [],
      strokes: [],
      // Initialize with default SRS state
      ...INITIAL_SRS_STATE
    });
  }

  return items;
}

/**
 * Estimates stroke count procedurally as a fallback if not present in the preset bank
 */
function estimateStrokeCount(kanji: string): number {
  const commonStrokes: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 5, '五': 4, '六': 4, '七': 2, '八': 2, '九': 2, '十': 2,
    '百': 6, '千': 3, '万': 3, '円': 4, '日': 4, '週': 11, '月': 4, '年': 6, '時': 10, '間': 12,
    '分': 4, '前': 9, '後': 9, '今': 4, '先': 6, '来': 7, '半': 5, '毎': 6, '何': 7, '人': 2,
    '男': 7, '女': 3, '子': 3, '友': 4, '名': 6, '耳': 6, '手': 4, '足': 7, '目': 5, '口': 3,
    '父': 4, '母': 5, '火': 4, '水': 4, '木': 4, '土': 3, '金': 8, '川': 3, '花': 7, '気': 6,
    '生': 5, '魚': 11, '天': 4, '空': 8, '山': 3, '雨': 8, '電': 13, '本': 5, '車': 7, '語': 14,
    '店': 8, '駅': 14, '道': 12, '社': 7, '国': 8, '外': 5, '学': 8, '校': 10, '上': 3, '下': 3,
    '中': 4, '北': 5, '西': 6, '東': 8, '南': 9, '右': 5, '左': 5, '見': 7, '聞': 14, '書': 10,
    '読': 14, '話': 13, '買': 12, '行': 6, '出': 5, '入': 2, '休': 6, '食': 9, '飲': 12, '言': 7,
    '立': 5, '会': 6, '多': 6, '少': 4, '古': 5, '新': 13, '大': 3, '小': 3, '安': 6, '高': 10,
    '長': 8, '白': 5
  };
  return commonStrokes[kanji] || 8;
}

/**
 * Returns a simple Indonesian mnemonic visual association procedurally
 */
function getProceduralMnemonic(kanji: string, meaning: string): string {
  const mnemonics: Record<string, string> = {
    '一': 'Satu garis horizontal lurus.',
    '二': 'Dua garis sejajar melambangkan dua benda.',
    '三': 'Tiga garis horizontal melambangkan angka tiga.',
    '四': 'Sebuah kotak dengan dua tirai melambangkan empat sudut.',
    '五': 'Lima jari yang saling terikat.',
    '六': 'Seseorang dengan tangan terbuka lebar berdiri di atas dua kaki.',
    '七': 'Garis melengkung terbalik melambangkan angka tujuh beruntung.',
    '八': 'Dua garis membelah lebar ke bawah seperti gunung terbuka.',
    '九': 'Satu kait lengkung melambangkan angka sembilan.',
    '十': 'Tanda tambah melambangkan persilangan sempurna angka sepuluh.',
    '日': 'Kotak bersilang seperti matahari yang bersinar di siang hari.',
    '月': 'Kotak melengkung seperti bulan sabit dengan dua awan melintas.',
    '火': 'Api unggun berkobar dengan percikan bara di kiri kanan.',
    '水': 'Tetesan air memercik di sungai yang mengalir deras.',
    '木': 'Pohon dengan batang tegak, dahan, dan akar kokoh.',
    '土': 'Tanah subur dengan salib kecil tempat benih ditanam.',
    '金': 'Gunung emas bermahkota kubah logam berharga di bawah tanah.',
    '人': 'Dua kaki manusia menyokong beban tubuh untuk melangkah maju.',
    '口': 'Mulut terbuka lebar berbentuk kotak persegi.'
  };
  return mnemonics[kanji] || `Gabungan bentuk ${kanji} berasosiasi dengan konsep "${meaning}".`;
}
