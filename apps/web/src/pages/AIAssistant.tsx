import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  User,
  Loader2,
  ArrowRight,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { aiApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'ai-chat-history';

const suggestedQueries = [
  "What should I focus on this week?",
  "Which deals are at risk and why?",
  "Coach me on my top 3 deals",
  "What's blocking my pipeline?",
  "Who should I call today?",
  "Review my SPIN discovery gaps",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load from localStorage on initial render
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

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  };

  const { data: insights } = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => aiApi.insights(),
  });

  const queryMutation = useMutation({
    mutationFn: (query: string) => aiApi.query(query),
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.data?.response || "I've processed your request.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      // Refocus input after response
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process that request. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      // Refocus input after error
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(input);
    setInput('');
  };

  const handleSuggestionClick = (query: string) => {
    setInput(query);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };
    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(query);
  };

  const insightsData = insights?.data || [];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'risk':
        return AlertTriangle;
      case 'opportunity':
        return TrendingUp;
      default:
        return Lightbulb;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Sales Coach
          </h1>
          <p className="text-text-secondary">
            Your personal sales strategist - ask for advice, priorities, and deal coaching
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Chat
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card padding="none" className="flex flex-col h-[600px]">
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
                    or how to advance your biggest opportunities. Let's WIN.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedQueries.slice(0, 3).map((query) => (
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
                        'max-w-[80%] rounded-lg px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-surface text-text-primary'
                      )}
                    >
                      {message.role === 'user' ? (
                        <p className="text-sm">{message.content}</p>
                      ) : (
                        <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-text-primary prose-strong:text-text-primary">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
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
              {queryMutation.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-surface rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about your CRM data..."
                  className="input flex-1"
                  disabled={queryMutation.isPending}
                  autoFocus
                />
                <Button type="submit" disabled={!input.trim() || queryMutation.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Insights */}
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-4">AI Insights</h3>
            <div className="space-y-3">
              {insightsData.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">
                  No insights yet
                </p>
              ) : (
                insightsData.slice(0, 4).map((insight: any, index: number) => {
                  const Icon = getInsightIcon(insight.type);
                  return (
                    <div
                      key={index}
                      className="p-3 bg-surface rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <Icon
                          className={clsx(
                            'h-4 w-4 flex-shrink-0 mt-0.5',
                            insight.type === 'risk' ? 'text-warning' : 'text-primary'
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {insight.title}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Suggested Queries */}
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Try asking</h3>
            <div className="space-y-2">
              {suggestedQueries.map((query) => (
                <button
                  key={query}
                  onClick={() => handleSuggestionClick(query)}
                  className="w-full flex items-center justify-between p-2 text-left text-sm text-text-secondary hover:bg-surface rounded-lg transition-colors"
                >
                  <span className="line-clamp-1">{query}</span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
