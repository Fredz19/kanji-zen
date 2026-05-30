/**
 * Utilitas Text-To-Speech (TTS) Jepang KanjiZen
 * Menyediakan pengucapan suara berkualitas tinggi dengan fallback cerdas.
 * Menggunakan Google Translate TTS API (Online) sebagai jalur utama untuk kelancaran suara di HP,
 * dan SpeechSynthesis lokal sebagai fallback (Offline).
 */

export async function speakJapaneseText(text: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Bersihkan teks Jepang dari kurung pelengkap hiragana jika ada (contoh: "本（ほん）" -> "本")
  const cleanedText = text.replace(/（[^）]+）/g, '').trim();
  if (!cleanedText) return;

  try {
    // 1. Jalur Utama: Streaming Google Translate TTS API (Sangat jernih, alami, dan tidak perlu download data suara di HP)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(cleanedText)}`;
    const audio = new Audio(ttsUrl);
    
    // Mainkan langsung. Karena dipicu dari klik tombol pengguna, browser seluler (HP) akan mengizinkannya.
    await audio.play();
  } catch (e) {
    console.warn("Gagal memutar Google TTS (offline atau diblokir), menggunakan fallback SpeechSynthesis lokal:", e);
    // 2. Jalur Alternatif: Fallback ke SpeechSynthesis bawaan perangkat jika offline
    playLocalSpeechSynthesis(cleanedText);
  }
}

function playLocalSpeechSynthesis(text: string) {
  if (!window.speechSynthesis) return;

  // Hentikan suara lain yang sedang berjalan
  window.speechSynthesis.cancel();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85;

    // Cari suara Jepang dari pustaka bawaan perangkat
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  if (isIOS) {
    // Jeda 50ms khusus iOS Safari untuk menghindari bug pembersihan antrean
    setTimeout(speak, 50);
  } else {
    speak();
  }
}
