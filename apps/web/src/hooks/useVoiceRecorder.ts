import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecorderOptions {
  silenceThreshold?: number;   // 0-255 amplitude level below which is "silence"
  silenceTimeout?: number;     // ms of continuous silence before auto-stop
  minRecordingDuration?: number; // ms before VAD kicks in
  maxRecordingDuration?: number; // ms max recording
  onAutoStop?: (blob: Blob) => void; // called when VAD auto-stops
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

const DEFAULT_OPTIONS: Required<Omit<UseVoiceRecorderOptions, 'onAutoStop'>> = {
  silenceThreshold: 25,      // low amplitude threshold (0-255 scale)
  silenceTimeout: 1500,      // 1.5s of silence to auto-stop
  minRecordingDuration: 800, // wait at least 800ms before VAD activates
  maxRecordingDuration: 30000, // 30s max
};

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const {
    silenceThreshold = DEFAULT_OPTIONS.silenceThreshold,
    silenceTimeout = DEFAULT_OPTIONS.silenceTimeout,
    minRecordingDuration = DEFAULT_OPTIONS.minRecordingDuration,
    maxRecordingDuration = DEFAULT_OPTIONS.maxRecordingDuration,
    onAutoStop,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxTimeoutRef = useRef<number | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const autoStopTriggeredRef = useRef(false);

  // Determine supported MIME type
  const getMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm';
    }
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4';
    }
    return '';
  };

  const cleanupAudio = useCallback(() => {
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    cleanupAudio();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, [cleanupAudio]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Voice Activity Detection loop
  const startVAD = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        if (!analyserRef.current || autoStopTriggeredRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        const elapsed = Date.now() - recordingStartRef.current;

        // Only start checking for silence after minimum recording duration
        if (elapsed > minRecordingDuration) {
          if (average < silenceThreshold) {
            // Below threshold — start/continue silence timer
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= silenceTimeout) {
              // Silence exceeded timeout — auto-stop
              autoStopTriggeredRef.current = true;
              if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
              }
              return;
            }
          } else {
            // Sound detected — reset silence timer
            silenceStartRef.current = null;
          }
        }

        vadFrameRef.current = requestAnimationFrame(checkAudio);
      };

      vadFrameRef.current = requestAnimationFrame(checkAudio);
    } catch {
      // VAD setup failed — recording still works, just no auto-stop
      console.warn('VAD setup failed, recording without voice detection');
    }
  }, [silenceThreshold, silenceTimeout, minRecordingDuration]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    autoStopTriggeredRef.current = false;
    silenceStartRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });

        if (autoStopTriggeredRef.current && onAutoStop) {
          // VAD triggered the stop — notify via callback
          onAutoStop(blob);
        } else if (resolveRef.current) {
          // Manual stop — resolve the promise
          resolveRef.current(blob);
          resolveRef.current = null;
        }
        cleanup();
      };

      recorder.onerror = () => {
        setError('Recording failed');
        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }
        cleanup();
      };

      recordingStartRef.current = Date.now();
      recorder.start();
      setIsRecording(true);

      // Start Voice Activity Detection
      startVAD(stream);

      // Hard max timeout
      maxTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          autoStopTriggeredRef.current = true;
          mediaRecorderRef.current.stop();
        }
      }, maxRecordingDuration);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      setError(message);
      cleanup();
    }
  }, [cleanup, startVAD, maxRecordingDuration, onAutoStop]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        resolve(null);
        return;
      }
      autoStopTriggeredRef.current = false; // manual stop
      resolveRef.current = resolve;
      mediaRecorderRef.current.stop();
    });
  }, []);

  return { isRecording, error, startRecording, stopRecording };
}
