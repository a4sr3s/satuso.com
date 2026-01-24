import { useState, useRef, useCallback, useEffect } from 'react';

const TTS_ENABLED_KEY = 'ai-tts-enabled';
const TTS_VOICE_KEY = 'ai-tts-voice';

interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  isTTSEnabled: boolean;
  toggleTTS: () => void;
  playChunks: (chunks: string[]) => Promise<void>;
  playSingleChunk: (text: string) => Promise<void>;
  stopPlayback: () => void;
}

export function useAudioPlayback(): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(() => {
    return localStorage.getItem(TTS_ENABLED_KEY) === 'true';
  });
  const cancelledRef = useRef(false);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Find a good English voice on load
  useEffect(() => {
    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) return;

      const savedVoiceName = localStorage.getItem(TTS_VOICE_KEY);
      if (savedVoiceName) {
        const saved = voices.find(v => v.name === savedVoiceName);
        if (saved) {
          preferredVoiceRef.current = saved;
          return;
        }
      }

      // Prefer natural/premium English voices
      const preferred = voices.find(v =>
        v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel'))
      ) || voices.find(v =>
        v.lang.startsWith('en') && v.localService
      ) || voices.find(v =>
        v.lang.startsWith('en')
      );

      if (preferred) {
        preferredVoiceRef.current = preferred;
        localStorage.setItem(TTS_VOICE_KEY, preferred.name);
      }
    };

    pickVoice();
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  }, []);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  const toggleTTS = useCallback(() => {
    setIsTTSEnabled(prev => {
      const next = !prev;
      localStorage.setItem(TTS_ENABLED_KEY, String(next));
      return next;
    });
  }, []);

  const stopPlayback = useCallback(() => {
    cancelledRef.current = true;
    speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1; // Slightly faster for natural conversation pace
      utterance.pitch = 1.0;

      if (preferredVoiceRef.current) {
        utterance.voice = preferredVoiceRef.current;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve(); // Not a real error — user interrupted
        } else {
          reject(new Error(`Speech synthesis error: ${e.error}`));
        }
      };

      speechSynthesis.speak(utterance);
    });
  }, []);

  const playChunks = useCallback(async (chunks: string[]) => {
    if (chunks.length === 0) return;

    cancelledRef.current = false;
    setIsPlaying(true);

    try {
      for (const chunk of chunks) {
        if (cancelledRef.current) break;
        await speakText(chunk);
      }
    } finally {
      setIsPlaying(false);
    }
  }, [speakText]);

  const playSingleChunk = useCallback(async (text: string) => {
    cancelledRef.current = false;
    setIsPlaying(true);

    try {
      await speakText(text);
    } finally {
      setIsPlaying(false);
    }
  }, [speakText]);

  return { isPlaying, isTTSEnabled, toggleTTS, playChunks, playSingleChunk, stopPlayback };
}
