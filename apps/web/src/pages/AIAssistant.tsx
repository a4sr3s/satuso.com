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
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
    localStorage.removeItem(STORAGE_KEY);
    stopPlayback();
    inputRef.current?.focus();
  };

  const chatMutation = useMutation({
    mutationFn: (contextMessages: ChatMessage[]) => aiApi.chat(contextMessages),
    onSuccess: (data) => {
      const responseText = data.data?.response || "I've processed your request.";
      const assistantMessage: DisplayMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: responseText,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Auto-play TTS if enabled
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
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Chat
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* TTS Toggle */}
          <button
            onClick={toggleTTS}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
              isTTSEnabled
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-surface text-text-muted border border-border hover:text-text-secondary'
            )}
            title={isTTSEnabled ? 'Disable voice responses' : 'Enable voice responses'}
          >
            {isTTSEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{isTTSEnabled ? 'Voice On' : 'Voice Off'}</span>
          </button>
          {messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={clearChat}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <Card padding="none" className="flex flex-col flex-1 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Ready to crush your quota?
              </h3>
              <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
                I'm your AI sales coach. Ask me what to prioritize, which deals need attention,
                or how to advance your biggest opportunities.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {suggestedQueries.map((query) => (
                  <button
                    key={query}
                    onClick={() => handleSuggestionClick(query)}
                    className="px-3 py-2 text-sm bg-surface text-text-secondary rounded-lg hover:bg-primary-light hover:text-primary transition-colors"
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
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[80%] rounded-lg px-4 py-3 relative group',
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-primary'
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <>
                      <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-text-primary prose-strong:text-text-primary">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      {/* Play button for assistant messages */}
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
                    </>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-text-muted" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading / Recording / Transcribing indicators */}
          {(chatMutation.isPending || isTranscribing) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="bg-surface rounded-lg px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                <span className="text-sm text-text-muted">
                  {isTranscribing ? 'Transcribing...' : 'Thinking...'}
                </span>
              </div>
            </div>
          )}

          {isRecording && (
            <div className="flex gap-3 justify-end">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-red-700">Listening...</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-text-muted" />
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
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? 'Recording...' : 'Ask about your CRM data...'}
              className="input flex-1"
              disabled={chatMutation.isPending || isRecording || isTranscribing}
              autoFocus
            />
            {/* Mic button */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={chatMutation.isPending || isTranscribing}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-surface text-text-muted hover:bg-surface hover:text-text-primary border border-border'
              )}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              <Mic className="h-4 w-4" />
            </button>
            {/* Send button */}
            <Button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending || isRecording || isTranscribing}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
