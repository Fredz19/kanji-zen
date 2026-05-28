export interface TopicCategory {
  id: string;
  name: string;
  emoji: string;
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  { id: 'numbers', name: 'Angka & Jumlah', emoji: '🔢' },
  { id: 'time', name: 'Waktu & Kalender', emoji: '⏰' },
  { id: 'nature', name: 'Alam & Elemen', emoji: '🌿' },
  { id: 'people', name: 'Manusia & Keluarga', emoji: '👥' },
  { id: 'directions', name: 'Arah & Posisi', emoji: '📍' },
  { id: 'actions', name: 'Kata Kerja / Aktivitas', emoji: '🏃' },
  { id: 'adjectives', name: 'Sifat & Warna', emoji: '🎨' },
  { id: 'places', name: 'Tempat & Lingkungan', emoji: '🏫' }
];

const TOPIC_MAPS: Record<string, string[]> = {
  numbers: [
    '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '円',
    '多', '少', '半', '度', '第', '番', '倍', '算', '数', '計', '両', '等', '分'
  ],
  time: [
    '日', '月', '年', '時', '間', '分', '週', '今', '先', '来', '毎', '朝', '昼', '夜',
    '夕', '春', '夏', '秋', '冬', '前', '後', '曜', '昨', '去', '始', '終', '昔', '期',
    '秒', '頃', '早', '明', '昼休み', '夕方', '夜中'
  ],
  nature: [
    '山', '川', '田', '水', '火', '木', '土', '金', '石', '花', '雨', '雪', '天', '空',
    '気', '風', '電', '光', '海', '波', '港', '池', '地', '森', '林', '雲', '汽', '景', '油'
  ],
  people: [
    '人', '子', '男', '女', '父', '母', '友', '名', '目', '耳', '手', '足', '口', '心',
    '体', '身', '首', '指', '毛', '歯', '声', '兄', '弟', '姉', '妹', '祖', '夫', '妻',
    '主', '己', '自', '者', '員', '達', '民', '親', '族', '児'
  ],
  directions: [
    '上', '下', '中', '外', '左', '右', '東', '西', '南', '北', '横', '側', '近', '遠',
    '角', '端', '辺', '向', '方'
  ],
  actions: [
    '見', '聞', '書', '読', '話', '買', '行', '来', '出', '入', '休', '食', '飲', '言',
    '立', '会', '生', '死', '作', '使', '働', '住', '借', '帰', '待', '思', '急', '教',
    '旅', '始', '終', '乗', '引', '動', '走', '送', '運', '結', '練', '覚', '試', '答',
    '進', '返', '閉', '開', '止', '歩', '切', '別', '合', '洗', '消', '焼', '降', '登',
    '発', '直', '知', '調', '談', '転', '勉', '強', '学', '研', '究', '写', '映', '画',
    '留', '病', '発', '祝', '答'
  ],
  adjectives: [
    '古', '新', '大', '小', '安', '高', '長', '白', '赤', '青', '黒', '色', '好', '悪',
    '暖', '涼', '寒', '暑', '温', '冷', '深', '浅', '軽', '重', '短', '暗', '明', '美',
    '若', '老', '便', '利', '不', '有', '無', '真', '正', '弱', '強', '忙', '痛', '楽',
    '苦', '辛', '甘', '薬', '服', '茶', '草', '肉', '味', '品'
  ],
  places: [
    '国', '都', '県', '市', '町', '村', '区', '所', '屋', '室', '家', '店', '駅', '道',
    '社', '校', '院', '工', '堂', '寺', '建', '物', '門', '船'
  ]
};

/**
 * Mengembalikan ID topik untuk karakter kanji tertentu
 */
export function getKanjiTopicId(character: string): string {
  for (const [topicId, kanjis] of Object.entries(TOPIC_MAPS)) {
    if (kanjis.includes(character)) {
      return topicId;
    }
  }
  
  // Fallback: Jika tidak terpetakan, tebak berdasarkan kemiripan atau default ke actions/places
  if ('行く見る聞く話す書く読む買う食う飲む会う'.includes(character)) {
    return 'actions';
  }
  return 'places'; // Default fallback
}

/**
 * Mengembalikan objek kategori topik lengkap
 */
export function getKanjiTopic(character: string): TopicCategory {
  const topicId = getKanjiTopicId(character);
  return TOPIC_CATEGORIES.find(c => c.id === topicId) || TOPIC_CATEGORIES[0];
}
