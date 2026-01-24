import { useState, useRef, useCallback, useEffect } from 'react';
import { aiApi } from '@/lib/api';

const TTS_ENABLED_KEY = 'ai-tts-enabled';
const TTS_RATE_LIMITED_KEY = 'ai-tts-rate-limited';

interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  isTTSEnabled: boolean;
  isRateLimited: boolean;
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
  const [isRateLimited, setIsRateLimited] = useState(() => {
    const stored = localStorage.getItem(TTS_RATE_LIMITED_KEY);
    if (!stored) return false;
    // Rate limit resets daily — check if stored date is today
    const limitDate = new Date(stored);
    const now = new Date();
    return limitDate.toDateString() === now.toDateString();
  });
  const cancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Clear rate limit flag at midnight (or on new day load)
  useEffect(() => {
    const stored = localStorage.getItem(TTS_RATE_LIMITED_KEY);
    if (stored) {
      const limitDate = new Date(stored);
      const now = new Date();
      if (limitDate.toDateString() !== now.toDateString()) {
        localStorage.removeItem(TTS_RATE_LIMITED_KEY);
        setIsRateLimited(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const markRateLimited = useCallback(() => {
    localStorage.setItem(TTS_RATE_LIMITED_KEY, new Date().toISOString());
    setIsRateLimited(true);
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setIsPlaying(false);
  }, []);

  const playAudioBuffer = useCallback((buffer: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current = objectUrlsRef.current.filter(u => u !== url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current = objectUrlsRef.current.filter(u => u !== url);
        reject(new Error('Audio playback failed'));
      };

      audio.play().catch(reject);
    });
  }, []);

  const playChunks = useCallback(async (chunks: string[]) => {
    if (chunks.length === 0 || isRateLimited) return;

    cancelledRef.current = false;
    setIsPlaying(true);

    try {
      // Pipeline: pre-fetch next chunk while current one plays
      let nextFetch: Promise<ArrayBuffer> | null = null;

      for (let i = 0; i < chunks.length; i++) {
        if (cancelledRef.current) break;

        try {
          const buffer = nextFetch
            ? await nextFetch
            : await aiApi.tts(chunks[i]);

          if (cancelledRef.current) break;
          if (buffer.byteLength < 100) {
            throw new Error('Empty audio response');
          }

          // Pre-fetch next chunk while this one plays
          nextFetch = (i + 1 < chunks.length && !cancelledRef.current)
            ? aiApi.tts(chunks[i + 1])
            : null;

          await playAudioBuffer(buffer);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Check for rate limit (429)
          if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('Rate limit')) {
            markRateLimited();
            break;
          }
          console.error('TTS chunk failed:', msg);
          nextFetch = null;
          continue;
        }
      }
    } finally {
      setIsPlaying(false);
    }
  }, [playAudioBuffer, isRateLimited, markRateLimited]);

  const playSingleChunk = useCallback(async (text: string) => {
    if (isRateLimited) return;

    cancelledRef.current = false;
    setIsPlaying(true);

    try {
      const buffer = await aiApi.tts(text);
      if (!cancelledRef.current) {
        await playAudioBuffer(buffer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('Rate limit')) {
        markRateLimited();
      }
    } finally {
      setIsPlaying(false);
    }
  }, [playAudioBuffer, isRateLimited, markRateLimited]);

  return { isPlaying, isTTSEnabled, isRateLimited, toggleTTS, playChunks, playSingleChunk, stopPlayback };
}
