import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  User,
  Loader2,
  Trash2,
  Mic,
  Volume2,
  VolumeX,
  Play,
  Square,
} from 'lucide-react';
import { clsx } from 'clsx';
import { aiApi } from '@/lib/api';
import type { ChatMessage } from '@/types';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { chunkText } from '@/utils/textChunker';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** Component that renders text with a typing/streaming effect */
function StreamingText({ content, onComplete }: { content: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    indexRef.current = 0;
    completedRef.current = false;
    setDisplayed('');

    const interval = setInterval(() => {
      // Variable speed: faster for spaces/punctuation, slightly slower for content
      const charsPerTick = 4;
      indexRef.current += charsPerTick;

      if (indexRef.current >= content.length) {
        setDisplayed(content);
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      } else {
        setDisplayed(content.slice(0, indexRef.current));
      }
    }, 12);

    return () => clearInterval(interval);
  }, [content, onComplete]);

  return (
    <div className="ai-prose">
      <ReactMarkdown>{displayed}</ReactMarkdown>
      {displayed.length < content.length && (
        <span className="inline-block w-[2px] h-4 bg-text-primary animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

const STORAGE_KEY = 'ai-voice-chat-history';
const MAX_STORED_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 10;

const suggestedQueries = [
  "What should I focus on this week?",
  "Which deals are at risk and why?",
  "Coach me on my top 3 deals",
  "What's blocking my pipeline?",
  "Who should I call today?",
  "Review my SPIN discovery gaps",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isPlaying, isTTSEnabled, toggleTTS, playChunks, stopPlayback } = useAudioPlayback();

  // Ref to hold the send function for the VAD auto-stop callback
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  // Handle auto-stop from VAD (voice activity detection)
  const handleVoiceAutoStop = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const result = await aiApi.stt(blob);
      if (result.text && result.text.trim()) {
        sendMessageRef.current(result.text);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I couldn't transcribe that audio. Please try again or type your message.",
      }]);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const { isRecording, error: recorderError, startRecording, stopRecording } = useVoiceRecorder({
    onAutoStop: handleVoiceAutoStop,
    silenceTimeout: 1500,
  });

  // Save messages to localStorage whenever they change
  useEffect(() => {
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    setStreamingId(null);
    localStorage.removeItem(STORAGE_KEY);
    stopPlayback();
    inputRef.current?.focus();
  };

  const chatMutation = useMutation({
    mutationFn: (contextMessages: ChatMessage[]) => aiApi.chat(contextMessages),
    onSuccess: (data) => {
      const responseText = data.data?.response || "I've processed your request.";
      const msgId = Date.now().toString();
      const assistantMessage: DisplayMessage = {
        id: msgId,
        role: 'assistant',
        content: responseText,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingId(msgId);

      // Auto-play TTS if enabled (starts after streaming completes via onComplete)
      if (isTTSEnabled) {
        const chunks = chunkText(responseText);
        if (chunks.length > 0) {
          playChunks(chunks);
        }
      }

      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => {
      const errorMessage: DisplayMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process that request. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      const context = updated.slice(-MAX_CONTEXT_MESSAGES).map(m => ({
        role: m.role,
        content: m.content,
      }));
      chatMutation.mutate(context);
      return updated;
    });
  }, [chatMutation]);

  // Keep ref in sync for VAD callback
  sendMessageRef.current = sendMessage;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    sendMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (query: string) => {
    sendMessage(query);
  };

  // Voice recording handlers
  const handleMicClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        setIsTranscribing(true);
        try {
          const result = await aiApi.stt(blob);
          if (result.text && result.text.trim()) {
            sendMessage(result.text);
          }
        } catch {
          // Show error as assistant message
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: "I couldn't transcribe that audio. Please try again or type your message.",
          }]);
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      await startRecording();
    }
  };

  // Play a specific message's audio
  const handlePlayMessage = (content: string) => {
    if (isPlaying) {
      stopPlayback();
    } else {
      const chunks = chunkText(content);
      if (chunks.length > 0) {
        playChunks(chunks);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h1 className="text-lg font-medium text-text-primary flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Chat
        </h1>
        <div className="flex items-center gap-1.5">
          {/* TTS Toggle */}
          <button
            onClick={toggleTTS}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isTTSEnabled
                ? 'text-primary bg-primary/10'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface'
            )}
            title={isTTSEnabled ? 'Disable voice responses' : 'Enable voice responses'}
          >
            {isTTSEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4 opacity-80" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Ready to crush your quota?
              </h3>
              <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto leading-relaxed">
                I'm your AI sales coach. Ask me what to prioritize, which deals need attention,
                or how to advance your biggest opportunities.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {suggestedQueries.map((query) => (
                  <button
                    key={query}
                    onClick={() => handleSuggestionClick(query)}
                    className="px-3 py-2 text-sm bg-surface text-text-secondary rounded-lg border border-border hover:border-primary hover:text-primary transition-all"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[85%] relative group',
                    message.role === 'user'
                      ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5'
                      : 'text-text-primary'
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="text-[14px] leading-relaxed">{message.content}</p>
                  ) : (
                    <>
                      {streamingId === message.id ? (
                        <StreamingText
                          content={message.content}
                          onComplete={() => setStreamingId(null)}
                        />
                      ) : (
                        <div className="ai-prose">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      )}
                      {/* Play button for assistant messages */}
                      {streamingId !== message.id && (
                        <button
                          onClick={() => handlePlayMessage(message.content)}
                          className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white border border-border rounded-full shadow-sm hover:bg-surface"
                          title={isPlaying ? 'Stop playback' : 'Play message'}
                        >
                          {isPlaying ? (
                            <Square className="h-3 w-3 text-text-muted" />
                          ) : (
                            <Play className="h-3 w-3 text-text-muted" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-3.5 w-3.5 text-text-muted" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading / Recording / Transcribing indicators */}
          {(chatMutation.isPending || isTranscribing) && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                <span className="text-sm text-text-muted">
                  {isTranscribing ? 'Transcribing...' : 'Thinking...'}
                </span>
              </div>
            </div>
          )}

          {isRecording && (
            <div className="flex gap-3 justify-end">
              <div className="bg-red-50 border border-red-200 rounded-2xl rounded-br-md px-4 py-2.5 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-red-600">Listening...</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="h-3.5 w-3.5 text-text-muted" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {recorderError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">
            {recorderError}
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-border p-4 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-3xl mx-auto">
            <div className="flex-1 relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRecording ? 'Recording...' : 'Ask about your pipeline, deals, or strategy...'}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                disabled={chatMutation.isPending || isRecording || isTranscribing}
                autoFocus
              />
            </div>
            {/* Mic button */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={chatMutation.isPending || isTranscribing}
              className={clsx(
                'p-2.5 rounded-xl transition-all',
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              )}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              <Mic className="h-4 w-4" />
            </button>
            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending || isRecording || isTranscribing}
              className={clsx(
                'p-2.5 rounded-xl transition-all',
                input.trim() && !chatMutation.isPending
                  ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                  : 'text-text-muted bg-surface cursor-not-allowed'
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
