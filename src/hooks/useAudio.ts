import { useCallback } from 'react';

// Singleton shared AudioContext untuk menghindari penumpukan instansi aktif di browser (terutama di HP)
let globalAudioCtx: AudioContext | null = null;

const getSharedAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  
  if (!globalAudioCtx) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      globalAudioCtx = new AudioCtx();
    } catch (e) {
      console.warn('Web Audio API is not supported in this browser.');
      return null;
    }
  }
  
  // Lanjutkan AudioContext jika sedang tersuspensi (sering terjadi di HP sebelum ada interaksi)
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(e => console.warn('Gagal melanjutkan AudioContext:', e));
  }
  
  return globalAudioCtx;
};

// Fungsi bypass otomatis Autoplay Policy di HP (iOS & Android)
// Berfungsi membuka blokir audio efek dan text-to-speech pada sentuhan/klik pertama pengguna
const unlockAudioAndSpeech = () => {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      cleanupListeners();
    }).catch(e => console.warn('Gagal membuka kunci AudioContext:', e));
  } else if (ctx) {
    cleanupListeners();
  }

  // Buka kunci Speech Synthesis (Text-To-Speech) pada perangkat seluler (terutama iOS Safari)
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
    } catch (e) {
      console.warn('Gagal memicu ucapan kosong untuk Speech Synthesis:', e);
    }
  }
};

const cleanupListeners = () => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('click', unlockAudioAndSpeech);
  window.removeEventListener('touchstart', unlockAudioAndSpeech);
};

// Pasang pendengar peristiwa global pada dokumen untuk melepaskan batasan autoplay HP
if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudioAndSpeech, { passive: true });
  window.addEventListener('touchstart', unlockAudioAndSpeech, { passive: true });
}

export function useAudio() {
  /**
   * Play a clean, pleasant double chime (sine wave) for correct answers
   */
  const playSuccess = useCallback(() => {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // First tone (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone (E5) - starts 80ms later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  }, []);

  /**
   * Play a low buzz sound for forgotten/incorrect answers
   */
  const playFailure = useCallback(() => {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Low frequency sawtooth/triangle wave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now); // Deep tone
    osc.frequency.linearRampToValueAtTime(90, now + 0.35); // Sliders down
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  }, []);

  /**
   * Play an ascending multi-tone arpeggio for high combos
   */
  const playCombo = useCallback((comboCount: number = 1) => {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = 261.63; // C4
    const scale = [1, 1.125, 1.25, 1.333, 1.5, 1.667, 1.875, 2.0]; // Major scale multipliers
    
    // Play 3 tones cascading upward rapidly based on combo level
    const notesToPlay = 3;
    const noteDelay = 0.07; // 70ms separation

    for (let i = 0; i < notesToPlay; i++) {
      const noteIdx = (comboCount + i) % scale.length;
      const freq = baseFreq * scale[noteIdx] * (1 + Math.floor((comboCount + i) / scale.length) * 0.5);
      
      const time = now + (i * noteDelay);
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.25);
    }
  }, []);

  /**
   * Play an epic game fanfare for Level-Up screens
   */
  const playLevelUp = useCallback(() => {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // An arpeggiated C-major arpeggio: C4, E4, G4, C5, E5, G5, C6
    const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const delay = 0.08; // 80ms delay between notes

    chord.forEach((freq, index) => {
      const time = now + (index * delay);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Alternate waveforms for richer synth sound
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.15, time + 0.04);
      
      // Final note rings out longer
      const duration = index === chord.length - 1 ? 0.8 : 0.3;
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + duration);
    });
  }, []);

  return {
    playSuccess,
    playFailure,
    playCombo,
    playLevelUp
  };
}
