import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { aiApi } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    type: 'deal' | 'contact' | 'company' | 'dashboard' | 'deals' | 'contacts' | 'companies' | 'tasks' | 'workboards' | 'general';
    id?: string;
    name?: string;
    data?: any;
  };
}

const STORAGE_KEY = 'assistant-history';

const contextualPrompts: Record<string, string[]> = {
  deal: [
    "What should I focus on for this deal?",
    "What are the risks here?",
    "Help me prepare for the next call",
  ],
  deals: [
    "What should I prioritize this week?",
    "Which deals need attention?",
    "Show me my pipeline health",
  ],
  contact: [
    "What do I know about this person?",
    "Suggest talking points",
    "When should I follow up?",
  ],
  contacts: [
    "Who should I reach out to?",
    "Who haven't I contacted recently?",
  ],
  company: [
    "Summarize this account",
    "What opportunities exist here?",
  ],
  dashboard: [
    "What should I focus on today?",
    "Give me my morning briefing",
    "What's at risk in my pipeline?",
  ],
  tasks: [
    "Help me prioritize my tasks",
    "What's overdue?",
  ],
  general: [
    "What should I work on?",
    "Show me deals at risk",
    "Who needs follow-up?",
  ],
};

export default function AssistantPanel({ isOpen, onClose, context }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const queryMutation = useMutation({
    mutationFn: (query: string) => aiApi.query(query),
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.data?.response || "I couldn't process that. Try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || queryMutation.isPending) return;

    // Add context to the query if available
    let queryWithContext = input;
    if (context?.type === 'deal' && context?.name) {
      queryWithContext = `[Context: Looking at deal "${context.name}"${context.id ? ` (ID: ${context.id})` : ''}] ${input}`;
    } else if (context?.type === 'contact' && context?.name) {
      queryWithContext = `[Context: Looking at contact "${context.name}"] ${input}`;
    } else if (context?.type === 'company' && context?.name) {
      queryWithContext = `[Context: Looking at company "${context.name}"] ${input}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(queryWithContext);
    setInput('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: suggestion,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add context
    let queryWithContext = suggestion;
    if (context?.type === 'deal' && context?.name) {
      queryWithContext = `[Context: Looking at deal "${context.name}"${context.id ? ` (ID: ${context.id})` : ''}] ${suggestion}`;
    }

    queryMutation.mutate(queryWithContext);
  };

  // Get contextual suggestions based on current page
  const getSuggestions = () => {
    if (context?.type && contextualPrompts[context.type]) {
      return contextualPrompts[context.type];
    }
    return contextualPrompts.general;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          'fixed right-0 top-0 h-full w-full sm:w-96 bg-white border-l border-border shadow-xl z-50',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-text-muted" />
            <span className="font-medium text-text-primary">Assistant</span>
            {context?.name && (
              <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded">
                {context.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface rounded"
                title="Clear history"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 130px)' }}>
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary mb-4">
                {context?.name
                  ? `Ask me anything about ${context.name}`
                  : "Ask me anything about your pipeline"
                }
              </p>
              <div className="space-y-2">
                {getSuggestions().map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary bg-surface hover:bg-primary-light hover:text-primary rounded-lg transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[85%] rounded-lg px-3 py-2',
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-primary'
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {queryMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-surface rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="input flex-1 text-sm"
              disabled={queryMutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || queryMutation.isPending}
              className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="text-xs text-text-muted mt-2 text-center">
            <kbd className="px-1.5 py-0.5 bg-surface rounded text-xs">⌘J</kbd> to toggle
          </p>
        </div>
      </div>
    </>
  );
}
