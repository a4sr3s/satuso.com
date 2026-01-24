import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { aiApi } from '@/lib/api';

const TTS_ENABLED_KEY = 'ai-tts-enabled';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount
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
    if (chunks.length === 0) return;

    cancelledRef.current = false;
    setIsPlaying(true);

    let failedCount = 0;
    let lastError = '';
    try {
      // Pipeline: pre-fetch next chunk while current one plays
      let nextFetch: Promise<ArrayBuffer> | null = null;

      for (let i = 0; i < chunks.length; i++) {
        if (cancelledRef.current) break;

        try {
          // Use pre-fetched buffer or fetch current chunk
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
          failedCount++;
          lastError = err instanceof Error ? err.message : String(err);
          console.error('TTS chunk failed:', lastError);
          // Reset pre-fetch on error
          nextFetch = null;
          continue;
        }
      }
      if (failedCount > 0 && failedCount === chunks.length) {
        toast.error(`Voice unavailable: ${lastError || 'TTS service error'}`);
      }
    } finally {
      setIsPlaying(false);
    }
  }, [playAudioBuffer]);

  const playSingleChunk = useCallback(async (text: string) => {
    cancelledRef.current = false;
    setIsPlaying(true);

    try {
      const buffer = await aiApi.tts(text);
      if (!cancelledRef.current) {
        await playAudioBuffer(buffer);
      }
    } finally {
      setIsPlaying(false);
    }
  }, [playAudioBuffer]);

  return { isPlaying, isTTSEnabled, toggleTTS, playChunks, playSingleChunk, stopPlayback };
}
