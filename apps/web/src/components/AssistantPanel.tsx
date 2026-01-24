import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { EntityCreateResponse } from '@/types';
import EntityConfirmCard from './EntityConfirmCard';
import EntityCreatedCard from './EntityCreatedCard';
import EntityDeleteCard from './EntityDeleteCard';

interface ActionCard {
  type: 'confirm' | 'created' | 'delete_confirm' | 'deleted';
  entityType: 'contact' | 'company' | 'deal';
  fields?: Record<string, any>;
  resolvedRefs?: {
    companyId?: string;
    companyName?: string;
    contactId?: string;
    contactName?: string;
  };
  entity?: { id: string; name: string; details?: string; [key: string]: any };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionCard?: ActionCard;
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

const ENTITY_INTENT_REGEX = /^(create|add|new|delete|remove)\s/i;

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
    "Delete a deal",
  ],
  contact: [
    "What do I know about this person?",
    "Suggest talking points",
    "When should I follow up?",
  ],
  contacts: [
    "Who should I reach out to?",
    "Who haven't I contacted recently?",
    "Create a new contact",
  ],
  company: [
    "Summarize this account",
    "What opportunities exist here?",
  ],
  companies: [
    "Who should I reach out to?",
    "Add a new company",
  ],
  dashboard: [
    "What should I focus on today?",
    "Give me my morning briefing",
    "What's at risk in my pipeline?",
    "Create a new deal",
  ],
  tasks: [
    "Help me prioritize my tasks",
    "What's overdue?",
  ],
  general: [
    "What should I work on?",
    "Show me deals at risk",
    "Create a new contact",
    "Add a company",
    "New deal",
    "Delete a deal",
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
  const [entitySessionId, setEntitySessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
    setEntitySessionId(null);
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

  const entityMutation = useMutation({
    mutationFn: ({ message, sessionId }: { message: string; sessionId?: string }) =>
      aiApi.entityCreate(message, sessionId),
    onSuccess: (data) => {
      const response = data.data as EntityCreateResponse;
      handleEntityResponse(response);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Something went wrong with entity creation. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setEntitySessionId(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  function handleEntityResponse(response: EntityCreateResponse) {
    if (!response) return;

    switch (response.type) {
      case 'question': {
        setEntitySessionId(response.sessionId);
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || 'What else can you tell me?',
        };
        setMessages((prev) => [...prev, msg]);
        break;
      }
      case 'confirm': {
        setEntitySessionId(response.sessionId);
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || 'Ready to create:',
          actionCard: {
            type: 'confirm',
            entityType: response.entityType!,
            fields: response.fields,
            resolvedRefs: response.resolvedRefs,
          },
        };
        setMessages((prev) => [...prev, msg]);
        break;
      }
      case 'created': {
        setEntitySessionId(null);
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `${response.entityType?.charAt(0).toUpperCase()}${response.entityType?.slice(1)} created successfully!`,
          actionCard: {
            type: 'created',
            entityType: response.entityType!,
            entity: response.entity as any,
          },
        };
        setMessages((prev) => [...prev, msg]);

        // Invalidate relevant queries
        if (response.entityType === 'contact') {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        } else if (response.entityType === 'company') {
          queryClient.invalidateQueries({ queryKey: ['companies'] });
        } else if (response.entityType === 'deal') {
          queryClient.invalidateQueries({ queryKey: ['deals'] });
          queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        }
        break;
      }
      case 'delete_confirm': {
        setEntitySessionId(response.sessionId);
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || 'Are you sure you want to delete this?',
          actionCard: {
            type: 'delete_confirm',
            entityType: response.entityType!,
            entity: response.entity as any,
          },
        };
        setMessages((prev) => [...prev, msg]);
        break;
      }
      case 'deleted': {
        setEntitySessionId(null);
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || `${response.entityType?.charAt(0).toUpperCase()}${response.entityType?.slice(1)} deleted successfully.`,
        };
        setMessages((prev) => [...prev, msg]);

        // Invalidate relevant queries
        if (response.entityType === 'contact') {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        } else if (response.entityType === 'company') {
          queryClient.invalidateQueries({ queryKey: ['companies'] });
        } else if (response.entityType === 'deal') {
          queryClient.invalidateQueries({ queryKey: ['deals'] });
          queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        }
        break;
      }
      case 'cancelled': {
        setEntitySessionId(null);
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || 'Cancelled.',
        };
        setMessages((prev) => [...prev, msg]);
        break;
      }
      case 'error': {
        if (!response.sessionId) {
          setEntitySessionId(null);
        }
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message || 'An error occurred.',
        };
        setMessages((prev) => [...prev, msg]);
        break;
      }
    }
  }

  const handleConfirm = () => {
    if (!entitySessionId) return;
    entityMutation.mutate({ message: '__CONFIRM__', sessionId: entitySessionId });
  };

  const handleCancel = () => {
    if (!entitySessionId) return;
    entityMutation.mutate({ message: '__CANCEL__', sessionId: entitySessionId });
  };

  const handleDeleteConfirm = () => {
    if (!entitySessionId) return;
    entityMutation.mutate({ message: '__DELETE_CONFIRM__', sessionId: entitySessionId });
  };

  const handleDeleteCancel = () => {
    if (!entitySessionId) return;
    entityMutation.mutate({ message: '__CANCEL__', sessionId: entitySessionId });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || queryMutation.isPending || entityMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);

    const trimmedInput = input.trim();
    setInput('');

    // Route to entity-create if we have an active session or detect entity intent
    if (entitySessionId || ENTITY_INTENT_REGEX.test(trimmedInput)) {
      entityMutation.mutate({
        message: trimmedInput,
        sessionId: entitySessionId || undefined,
      });
      return;
    }

    // Otherwise, route to coaching query
    let queryWithContext = trimmedInput;
    if (context?.type === 'deal' && context?.name) {
      queryWithContext = `[Context: Looking at deal "${context.name}"${context.id ? ` (ID: ${context.id})` : ''}] ${trimmedInput}`;
    } else if (context?.type === 'contact' && context?.name) {
      queryWithContext = `[Context: Looking at contact "${context.name}"] ${trimmedInput}`;
    } else if (context?.type === 'company' && context?.name) {
      queryWithContext = `[Context: Looking at company "${context.name}"] ${trimmedInput}`;
    }
    queryMutation.mutate(queryWithContext);
  };

  const handleSuggestionClick = (suggestion: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: suggestion,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Check if suggestion is an entity intent (create/delete)
    if (ENTITY_INTENT_REGEX.test(suggestion)) {
      entityMutation.mutate({ message: suggestion });
      return;
    }

    // Add context for coaching queries
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

  const isPending = queryMutation.isPending || entityMutation.isPending;

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
            {entitySessionId && (
              <span className="text-xs text-primary bg-primary-light px-2 py-0.5 rounded">
                Creating...
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
              <div key={message.id}>
                <div
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

                {/* Render action cards */}
                {message.actionCard && message.actionCard.type === 'confirm' && (
                  <div className="mt-2 ml-0">
                    <EntityConfirmCard
                      entityType={message.actionCard.entityType}
                      fields={message.actionCard.fields || {}}
                      resolvedRefs={message.actionCard.resolvedRefs}
                      onConfirm={handleConfirm}
                      onCancel={handleCancel}
                      isLoading={entityMutation.isPending}
                    />
                  </div>
                )}

                {message.actionCard && message.actionCard.type === 'created' && message.actionCard.entity && (
                  <div className="mt-2 ml-0">
                    <EntityCreatedCard
                      entityType={message.actionCard.entityType}
                      entity={message.actionCard.entity}
                    />
                  </div>
                )}

                {message.actionCard && message.actionCard.type === 'delete_confirm' && message.actionCard.entity && (
                  <div className="mt-2 ml-0">
                    <EntityDeleteCard
                      entityType={message.actionCard.entityType}
                      entity={message.actionCard.entity}
                      onConfirm={handleDeleteConfirm}
                      onCancel={handleDeleteCancel}
                      isLoading={entityMutation.isPending}
                    />
                  </div>
                )}
              </div>
            ))
          )}
          {isPending && (
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
              placeholder={entitySessionId ? "Answer the question..." : "Ask anything..."}
              className="input flex-1 text-sm"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || isPending}
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
