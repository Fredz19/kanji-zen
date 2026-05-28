export interface VocabItem {
  word: string;
  reading: string;
  meaning: string;
}

export interface SentenceItem {
  japanese: string;   // Japanese sentence with Kanji, e.g. "今日（きょう）は天気がいいです。"
  indonesian: string; // Indonesian translation
  audioText: string;  // Simple text to pass to Web Speech synthesis
}

export interface KanjiItem {
  id: string;
  character: string;
  meaning: string;
  onyomi: string[];
  kunyomi: string[];
  level: 'N5' | 'N4';
  strokeCount: number;
  frequency: number;
  mnemonic: string;
  vocabulary: VocabItem[];
  sentences: SentenceItem[];
  strokes: string[]; // SVG paths (KanjiVG)
  
  // SRS properties
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: number;
  lastStatus?: 'forgot' | 'hard' | 'good' | 'easy';
  mistakeCount: number;
  isLeech: boolean;
  isSuspended: boolean;
}

export const KANJI_PRESETS: Record<string, Partial<KanjiItem>> = {
  '一': {
    strokeCount: 1,
    mnemonic: 'Satu garis horizontal lurus melambangkan sebatang kayu.',
    strokes: [
      'M30,52.52c2.61,0.56,5.32,0.3,7.94,0.02c12.75-1.37,30.34-2.88,43.06-3.41c2.62-0.11,5.2-0.19,7.76,0.34'
    ],
    sentences: [
      {
        japanese: 'りんごを一つ（ひとつ）買いました。',
        indonesian: 'Saya membeli satu buah apel.',
        audioText: 'りんごをひとつかいました。'
      },
      {
        japanese: '一人（ひとり）で日本へ行きます。',
        indonesian: 'Pergi ke Jepang sendirian (satu orang).',
        audioText: 'ひとりでにほんへいきます。'
      }
    ]
  },
  '二': {
    strokeCount: 2,
    mnemonic: 'Dua buah garis sejajar melambangkan angka dua.',
    strokes: [
      'M33,35c1.5,0.38,3.25,0.41,4.75,0.27c8.5-0.77,22.38-2.64,30.75-3.02c1.5-0.07,3,0.06,4.5,0.25',
      'M19.75,76.53c2.72,0.92,5.92,0.57,8.75,0.33c16.38-1.38,40.75-2.61,54.5-3.13c2.72-0.1,5.43,0.06,8,0.76'
    ],
    sentences: [
      {
        japanese: '猫が二匹（にひき）います。',
        indonesian: 'Ada dua ekor kucing.',
        audioText: 'ねこがにひきいます。'
      },
      {
        japanese: '二人（ふたり）で映画を見ました。',
        indonesian: 'Kami berdua menonton film bersama.',
        audioText: 'ふたりでえいがをみました。'
      }
    ]
  },
  '三': {
    strokeCount: 3,
    mnemonic: 'Tiga garis horizontal melambangkan angka tiga.',
    strokes: [
      'M30.75,32.25c1.5,0.5,3.74,0.31,5.25,0.18c7.87-0.66,22.12-2.14,29.5-2.58c1.57-0.09,3.12,0.08,4.62,0.25',
      'M34.5,53.25c1.37,0.38,3.22,0.31,4.62,0.18c6.64-0.62,17.26-1.89,23.38-2.31c1.51-0.1,3.06-0.05,4.5,0.12',
      'M18,80.75c2.37,0.75,5.77,0.53,8.25,0.31c20.31-1.78,41.97-2.65,56.5-2.88c2.95-0.05,5.88,0.12,8.75,0.75'
    ],
    sentences: [
      {
        japanese: '三月（さんがつ）に桜が咲きます。',
        indonesian: 'Bunga sakura mekar di bulan Maret.',
        audioText: 'さんがつにさくらがさきます。'
      },
      {
        japanese: '三つ（みっつ）の部屋があります。',
        indonesian: 'Ada tiga ruangan di kamar.',
        audioText: 'みっつのへやがあります。'
      }
    ]
  },
  '四': {
    strokeCount: 5,
    mnemonic: 'Sebuah mulut (kotak) dengan kaki di dalamnya, melambangkan empat penjuru arah mata angin.',
    strokes: [
      'M22,35.25c0.88,0.88,1.4,2,1.4,3.25c0,11.38,0.25,32.88,0.25,45.25',
      'M24.25,37.25c12.25-1.5,41-3.75,49.25-4.5c3.27-0.3,5.25,1.25,4.75,4.25c-2,12-3.12,27-5,44.75',
      'M36.75,45c0.75,0.75,1.06,1.88,0.92,3.12c-0.92,8.38-3.17,21.5-6.67,27.12',
      'M55.75,42.5c0.82,0.82,1.13,2,1.12,3.25C56.75,59.38,62,69.5,69.75,75.25c1.86,1.38,2,0.75,1.25-2',
      'M24.75,81c11.5-0.75,37-2,48.25-2.5'
    ],
    sentences: [
      {
        japanese: '四つ（よっつ）の季節があります。',
        indonesian: 'Ada empat musim.',
        audioText: 'よっつのきせつがあります。'
      },
      {
        japanese: '四月（しがつ）から学校が始まります。',
        indonesian: 'Sekolah dimulai dari bulan April.',
        audioText: 'しがつからがっこうがはじまります。'
      }
    ]
  },
  '五': {
    strokeCount: 4,
    mnemonic: 'Lima buah jari yang saling terikat melambangkan angka lima.',
    strokes: [
      'M28.75,32.25c1.78,0.38,3.95,0.32,5.75,0.18c9.57-0.77,22.7-2.31,31.75-2.88c2.25-0.14,4.5,0.06,6.75,0.56',
      'M47.75,32.75c0.62,1,0.59,2.62,0.22,4c-3,11.25-8,27.75-12.72,36.5',
      'M23.75,51.75c1.88,0.5,4.3,0.38,6.25,0.22c12.33-1.02,29.3-3.02,40.25-3.8c2.19-0.16,4.38-0.08,6.5,0.22',
      'M17.75,82c2.61,0.56,5.82,0.5,8.5,0.22c19.12-1.97,41.97-3.09,61-3.5c2.69-0.06,5.38,0.19,8,0.75'
    ],
    sentences: [
      {
        japanese: '五日（いつか）に旅行へ行きます。',
        indonesian: 'Pergi jalan-jalan pada tanggal lima.',
        audioText: 'いつかにりょこうへいきます。'
      },
      {
        japanese: '五月（ごがつ）の風は気持ちいいです。',
        indonesian: 'Angin bulan Mei terasa sangat nyaman.',
        audioText: 'ごがつのかぜはきもちいいです。'
      }
    ]
  },
  '日': {
    strokeCount: 4,
    mnemonic: 'Matahari bulat di langit yang dibelah garis awan horizontal di tengahnya.',
    strokes: [
      'M28.25,31.25c0.88,0.88,1.25,2.12,1.25,3.25c0,11.5,0.25,32.5,0.25,48.25',
      'M30.25,33.25C42.5,31.75,69.5,29.5,77.5,29c3.27-0.2,5.25,1.25,4.75,4.25c-2.06,12.38-3,25.38-5,38.5',
      'M30.75,55.5c11.5-0.75,37.25-2.25,49.25-2.75',
      'M30.75,79.5c11.5-0.75,37.25-2.25,49.25-2.75'
    ],
    sentences: [
      {
        japanese: '日曜日（にちようび）は休みです。',
        indonesian: 'Hari Minggu adalah hari libur.',
        audioText: 'にちようびはやすみです。'
      },
      {
        japanese: '日本（にほん）のアニメが大好きです。',
        indonesian: 'Saya sangat menyukai anime Jepang.',
        audioText: 'にほんのアニメがだいすきです。'
      }
    ]
  },
  '月': {
    strokeCount: 4,
    mnemonic: 'Bulan sabit melengkung di langit malam dengan dua sapuan awan melintas.',
    strokes: [
      'M32.25,30c0.88,0.88,1,2.25,1,3.5c0,15-0.5,37.25-11,54.75',
      'M34.25,32C45,30.5,69.25,28.5,77.25,28c3.27-0.2,5.25,1.25,4.75,4.25C79,53,74.5,72.75,61.75,87c-2.5,2.78-4.5,0.5-5.5-2',
      'M34.75,51.5c10.5-0.75,35-2.25,45.25-2.75',
      'M34.75,70.5c10.5-0.75,35-2.25,45.25-2.75'
    ],
    sentences: [
      {
        japanese: '来月（らいげつ）から日本語を勉強します。',
        indonesian: 'Mulai bulan depan saya belajar bahasa Jepang.',
        audioText: 'らいげつからにほんごをべんきょうします。'
      },
      {
        japanese: '月曜日（げつようび）は仕事が忙しいです。',
        indonesian: 'Hari Senin pekerjaan sangat sibuk.',
        audioText: 'げつようびはしごとがいそがしいです。'
      }
    ]
  },
  '火': {
    strokeCount: 4,
    mnemonic: 'Sebuah api unggun berkobar dengan percikan bara api melayang di kiri kanan.',
    strokes: [
      'M30.75,40.75c2.75,4,5.75,10.25,6.5,13.5',
      'M69.25,35c0.02,3.31-0.45,7.74-2,10.75-2.5,4.88-5.5,9.5-9,13.5',
      'M49.25,20.25c1.25,1.25,1.5,2.75,1.5,4.25C50.75,44,38.25,69.75,16,81.5',
      'M49.25,51.25c7.34,6.72,21.34,22.48,31.98,29.47c3.15,2.07,6.38,3.75,10.02,4.78'
    ],
    sentences: [
      {
        japanese: '火曜日（かようび）に友達と会います。',
        indonesian: 'Bertemu dengan teman pada hari Selasa.',
        audioText: 'かようびにともだちとあいます。'
      },
      {
        japanese: '火（ひ）をつけてください。',
        indonesian: 'Tolong nyalakan apinya.',
        audioText: 'ひをつけてください。'
      }
    ]
  },
  '水': {
    strokeCount: 4,
    mnemonic: 'Tetesan air memercik di sungai mengalir deras.',
    strokes: [
      'M53.75,15.25c1.25,1.25,1.5,2.75,1.5,4.25c0,16.5-0.25,53.25-0.25,64c0,9.75-4.5,3.75-6.25,2.25',
      'M29.5,41.25c2.25,1.75,5.75,7.25,6.5,9.5',
      'M17,56.5C28.38,55.38,37.25,48,46.5,36.5',
      'M56.25,38.25c5.38,5.72,18.38,18.48,27.98,24.47c3.15,2.07,5.38,3.25,8.02,4.28'
    ],
    sentences: [
      {
        japanese: '水曜日（すいようび）にテストがあります。',
        indonesian: 'Ada ujian pada hari Rabu.',
        audioText: 'すいようびにてすとがあります。'
      },
      {
        japanese: '毎日、水（みず）を二リットル飲みます。',
        indonesian: 'Setiap hari minum dua liter air.',
        audioText: 'まいにちみずをにりっとるのみます。'
      }
    ]
  },
  '木': {
    strokeCount: 4,
    mnemonic: 'Pohon dengan batang lurus, dahan kokoh, dan akar menancap ke bumi.',
    strokes: [
      'M18.75,37.25c2.61,0.56,5.32,0.3,7.94,0.02c18.75-1.37,45.34-3.38,57.06-3.91c2.62-0.11,5.2-0.19,7.76,0.34',
      'M51.25,15.75c1.25,1.25,1.5,2.75,1.5,4.25c0,18.5-0.25,54.25-0.25,68.5',
      'M51.25,38.25c-8.25,13.5-22.5,31.75-35.5,39.5',
      'M52.25,38.25c8.34,11.72,23.34,27.48,33.98,34.47c3.15,2.07,6.38,3.75,10.02,4.78'
    ],
    sentences: [
      {
        japanese: '木曜日（もくようび）に日本へ行きます。',
        indonesian: 'Pergi ke Jepang pada hari Kamis.',
        audioText: 'もくようびににほんへいきます。'
      },
      {
        japanese: '木（き）の下で本を読みました。',
        indonesian: 'Membaca buku di bawah pohon.',
        audioText: 'きの下でほんをよみました。'
      }
    ]
  },
  '土': {
    strokeCount: 3,
    mnemonic: 'Tanah tempat tunas tanaman kecil ditanam di atas tanah.',
    strokes: [
      'M30.75,51.25c2.61,0.56,5.32,0.3,7.94,0.02c11.75-1.37,23.34-2.88,32.06-3.41c2.62-0.11,5.2-0.19,7.76,0.34',
      'M51.25,20.75c1.25,1.25,1.5,2.75,1.5,4.25c0,12.5-0.25,38.25-0.25,48.5',
      'M17.75,80c2.61,0.56,5.82,0.5,8.5,0.22c19.12-1.97,45.97-3.09,65-3.5c2.69-0.06,5.38,0.19,8,0.75'
    ],
    sentences: [
      {
        japanese: '土曜日（どようび）にデパートへ行きます。',
        indonesian: 'Pergi ke departemen store pada hari Sabtu.',
        audioText: 'どようびにでぱーとへいきます。'
      },
      {
        japanese: '土（つち）の中でジャガイモが育ちます。',
        indonesian: 'Kentang tumbuh di dalam tanah.',
        audioText: 'つちのなかでじゃがいもがそだちます。'
      }
    ]
  },
  '金': {
    strokeCount: 8,
    mnemonic: 'Kubah berharga melindungi timbunan logam mulia emas di bawah lapisan tanah.',
    strokes: [
      'M50.25,12.25c0.12,1.26,0.22,3.26-0.24,5.07C45.88,27.5,31.56,53.65,11.5,69.5',
      'M50.25,17.25c8.34,7.72,25.34,25.48,35.98,32.47c3.15,2.07,6.38,3.75,10.02,4.78',
      'M33.75,41.25c1.5,0.38,3.25,0.41,4.75,0.27c8.5-0.77,18.38-2.14,24.75-2.52c1.5-0.07,3,0.06,4.5,0.25',
      'M47.75,41.75c0.62,1,0.59,2.62,0.22,4c-1.5,5.25-3,11.75-4.72,16.5',
      'M30.75,54.75c2.75,4,4.75,8.25,5.5,11.5',
      'M69.25,48c0.02,3.31-0.45,7.74-2,10.75',
      'M22.75,68.25c1.5,0.38,3.25,0.41,4.75,0.27c15.5-1.27,38.38-2.64,52.75-3.02c1.5-0.07,3,0.06,4.5,0.25',
      'M13.75,85c2.61,0.56,5.82,0.5,8.5,0.22c22.12-1.97,51.97-3.09,72-3.5c2.69-0.06,5.38,0.19,8,0.75'
    ],
    sentences: [
      {
        japanese: '金曜日（きんようび）の夜は映画を見ます。',
        indonesian: 'Nonton film pada hari Jumat malam.',
        audioText: 'きんようびのよるはえいがをみます。'
      },
      {
        japanese: '財布にお金（おかね）がありません。',
        indonesian: 'Tidak ada uang di dalam dompet.',
        audioText: 'さいふにおかねがありません。'
      }
    ]
  },
  '人': {
    strokeCount: 2,
    mnemonic: 'Dua kaki melangkah lurus menyokong tubuh melambangkan seorang manusia.',
    strokes: [
      'M52.01,17c0.12,1.26,0.22,3.26-0.24,5.07C48.88,33.5,36.56,60.65,14.5,76.5',
      'M49.25,48.25c7.34,6.72,19.34,17.48,29.98,24.47c3.15,2.07,6.38,3.75,10.02,4.78'
    ],
    sentences: [
      {
        japanese: 'あの人（ひと）は誰ですか。',
        indonesian: 'Siapakah orang itu?',
        audioText: 'あのひとはだれですか。'
      },
      {
        japanese: 'インドネシア人（じん）です。',
        indonesian: 'Saya adalah orang Indonesia.',
        audioText: 'いんどねしあじんです。'
      }
    ]
  },
  '口': {
    strokeCount: 3,
    mnemonic: 'Sebuah kotak persegi terbuka melambangkan mulut.',
    strokes: [
      'M25.25,35.75c0.75,0.75,1.25,2.15,1.25,3.25c0,10.5,0.25,27.5,0.25,43',
      'M27.25,37.75c12-1.5,41.25-4,49.25-4.5c3.27-0.2,5.25,1.25,4.75,4.25c-2.06,12.38-3,25.38-5,38.5',
      'M27.75,79.5c11.5-0.75,37.25-2.25,49.25-2.75'
    ],
    sentences: [
      {
        japanese: '駅の入り口（いりぐち）はどこですか。',
        indonesian: 'Di manakah pintu masuk stasiun?',
        audioText: 'えきのいりぐちはどこですか。'
      },
      {
        japanese: '口（くち）を開けてください。',
        indonesian: 'Tolong buka mulut Anda.',
        audioText: 'くちをあけてください。'
      }
    ]
  },
  '手': {
    strokeCount: 4,
    mnemonic: 'Jari-jari tangan berselaput dengan satu lengan lurus ke bawah.',
    strokes: [
      'M72.25,18.75c0.05,0.61-0.12,1.38-0.5,1.88-3.75,4.88-12.75,10.25-26.75,14.62',
      'M28.75,37.25c2.61,0.56,5.32,0.3,7.94,0.02c14.75-1.37,32.34-2.88,44.06-3.41c2.62-0.11,5.2-0.19,7.76,0.34',
      'M20.75,58.25c2.61,0.56,5.32,0.3,7.94,0.02c19.75-1.37,47.34-3.38,60.06-3.91c2.62-0.11,5.2-0.19,7.76,0.34',
      'M51.25,38.75c1,1,1.25,2.5,1.25,4c0,21.5-0.25,40-0.25,45.5c0,7.75-4.5,2.75-6.25,1.25'
    ],
    sentences: [
      {
        japanese: '手（て）を洗ってください。',
        indonesian: 'Tolong cuci tangan Anda.',
        audioText: 'てをあらってください。'
      },
      {
        japanese: '彼は歌が下手（へた）です。',
        indonesian: 'Dia tidak pandai bernyanyi (lemah).',
        audioText: 'かれはうたがへたです。'
      }
    ]
  },
  '目': {
    strokeCount: 5,
    mnemonic: 'Sebuah bola mata persegi dengan dua alis pupil sejajar di tengahnya.',
    strokes: [
      'M28.25,26.25c0.88,0.88,1.25,2.12,1.25,3.25c0,13.5,0.25,44.5,0.25,60.25',
      'M30.25,28.25c12.25-1.5,39.5-3.75,47.5-4.25c3.27-0.2,5.25,1.25,4.75,4.25c-2.06,14.38-3,40.38-5,59.5',
      'M30.75,48.5c11.5-0.75,37.25-2.25,49.25-2.75',
      'M30.75,69.5c11.5-0.75,37.25-2.25,49.25-2.75',
      'M30.75,86.5c11.5-0.75,37.25-2.25,49.25-2.75'
    ],
    sentences: [
      {
        japanese: '目（め）を開けてください。',
        indonesian: 'Tolong buka mata Anda.',
        audioText: 'めをあけてください。'
      },
      {
        japanese: '目が疲（つか）れました。',
        indonesian: 'Mata saya lelah.',
        audioText: 'めがつかれました。'
      }
    ]
  },
  '見': {
    strokeCount: 7,
    mnemonic: 'Sebuah mata besar yang ditopang oleh kaki manusia melambangkan aktivitas melihat.',
    strokes: [
      'M28.25,18.25c0.88,0.88,1.25,2.12,1.25,3.25c0,8.5,0.25,22.5,0.25,32.25',
      'M30.25,20.25c10.25-1.5,33.5-3.75,41.5-4.25c3.27-0.2,5.25,1.25,4.75,4.25c-2.06,8.38-3,19.38-5,29.5',
      'M30.75,31.5c10.5-0.75,31.25-2.25,41.25-2.75',
      'M30.75,42.5c10.5-0.75,31.25-2.25,41.25-2.75',
      'M30.75,52.5c10.5-0.75,31.25-2.25,41.25-2.75',
      'M37.51,60c0.12,1.26,0.22,3.26-0.24,5.07c-3,10.5-12,24.5-22.77,31.5',
      'M55.25,58.25c7.34,6.72,10.34,22.48,10.98,28.47c0.76,7,5.38,6.25,12.02,2.78c5.15-2.7,9.75-5.5,12.75-7.5'
    ],
    sentences: [
      {
        japanese: '富士山（ふじさん）が見えました。',
        indonesian: 'Gunung Fuji sudah kelihatan.',
        audioText: 'ふじさんがみえました。'
      },
      {
        japanese: '一緒に映画を見（み）ましょう。',
        indonesian: 'Mari kita menonton film bersama.',
        audioText: 'いっしょにえいがをみましょう。'
      }
    ]
  },
  '行': {
    strokeCount: 6,
    mnemonic: 'Garis persimpangan jalan tempat pejalan kaki melangkah maju melambangkan pergi.',
    strokes: [
      'M32.25,20.75c0.05,0.61-0.12,1.38-0.5,1.88-3.75,4.88-10.75,11.25-21.75,16.62',
      'M34.75,37.25c0.05,0.61-0.12,1.38-0.5,1.88-4.75,5.88-14.75,15.25-24.75,20.62',
      'M26.25,55.75c0.75,0.75,1,2,1,3.25c0,10.5,0.25,25.5,0.25,33.5c0,7.75-3.5,3.75-5.25,2.25',
      'M48.25,18.75c2.61,0.56,4.32,0.3,6.94,0.02c11.75-1.37,21.34-2.88,29.06-3.41c2.62-0.11,4.2-0.19,6.76,0.34',
      'M49.25,44.75c2.61,0.56,4.32,0.3,6.94,0.02c11.75-1.37,20.34-2.88,28.06-3.41c2.62-0.11,4.2-0.19,6.76,0.34',
      'M62.25,45.75c1,1,1.25,2.5,1.25,4c0,21.5-0.25,32-0.25,37.5c0,7.75-4.5,2.75-6.25,1.25'
    ],
    sentences: [
      {
        japanese: '明日、銀行（ぎんこう）へ行きます。',
        indonesian: 'Besok saya pergi ke bank.',
        audioText: 'あしたぎんこうへいきます。'
      },
      {
        japanese: '一緒に日本へ行（い）きましょう。',
        indonesian: 'Mari kita pergi ke Jepang bersama-sama.',
        audioText: 'いっしょににほんへいきましょう。'
      }
    ]
  }
};

/**
 * Returns a detailed partial preset if it matches the character,
 * complementing the markdown data with stroke SVGs, mnemonics, and sentences.
 */
export function getPresetForKanji(kanji: string): Partial<KanjiItem> | null {
  return KANJI_PRESETS[kanji] || null;
}
