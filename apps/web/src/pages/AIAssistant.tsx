import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  ArrowUp,
  Sparkles,
  Loader2,
  Trash2,
  AudioLines,
  Volume2,
  VolumeX,
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

  const { isTTSEnabled, toggleTTS, playChunks, stopPlayback } = useAudioPlayback();

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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="h-10 w-10 text-primary mx-auto mb-5 opacity-70" />
                <h3 className="text-xl font-medium text-text-primary mb-2">
                  Ready to crush your quota?
                </h3>
                <p className="text-base text-text-secondary mb-8 max-w-md mx-auto leading-relaxed">
                  I'm your AI sales coach. Ask me what to prioritize, which deals need attention,
                  or how to advance your biggest opportunities.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                  {suggestedQueries.map((query) => (
                    <button
                      key={query}
                      onClick={() => handleSuggestionClick(query)}
                      className="px-3.5 py-2 text-sm bg-surface text-text-secondary rounded-full border border-border hover:border-primary hover:text-primary transition-all"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="bg-surface text-text-primary rounded-2xl px-4 py-2.5 max-w-[80%]">
                        <p className="text-[15px] leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="ai-prose">
                      {streamingId === message.id ? (
                        <StreamingText
                          content={message.content}
                          onComplete={() => setStreamingId(null)}
                        />
                      ) : (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading / Transcribing indicator */}
            {(chatMutation.isPending || isTranscribing) && (
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {isTranscribing ? 'Transcribing...' : 'Thinking...'}
                </span>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex justify-end">
                <div className="bg-red-50 border border-red-200 rounded-full px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-600">Listening...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error display */}
        {recorderError && (
          <div className="max-w-3xl mx-auto px-4 py-2 text-sm text-red-600">
            {recorderError}
          </div>
        )}

        {/* Input bar */}
        <div className="p-4 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-3xl mx-auto border border-border rounded-2xl px-3 py-1.5 bg-white shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? 'Recording...' : 'Ask anything...'}
              className="flex-1 px-2 py-2 text-[15px] text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none"
              disabled={chatMutation.isPending || isRecording || isTranscribing}
              autoFocus
            />
            {/* Voice button */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={chatMutation.isPending || isTranscribing}
              className={clsx(
                'p-2 rounded-full transition-all',
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              )}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              <AudioLines className="h-5 w-5" />
            </button>
            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending || isRecording || isTranscribing}
              className={clsx(
                'p-2 rounded-full transition-all',
                input.trim() && !chatMutation.isPending
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'text-text-muted cursor-not-allowed'
              )}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
