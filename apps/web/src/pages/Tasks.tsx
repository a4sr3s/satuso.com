import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  CheckCircle,
  Circle,
  Calendar,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { isToday, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { tasksApi, dealsApi } from '@/lib/api';
import type { TaskCounts, TaskPriority } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Tabs from '@/components/ui/Tabs';
import { PriorityBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { useLocale } from '@/hooks/useLocale';

export default function TasksPage() {
  const { t } = useTranslation(['tasks', 'common']);
  const { formatDate } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('pending');
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    subject: '',
    content: '',
    due_date: '',
    priority: 'medium' as TaskPriority,
    deal_id: '',
  });
  const [quickAddText, setQuickAddText] = useState('');

  const { data: countsData } = useQuery({
    queryKey: ['tasks', 'counts'],
    queryFn: () => tasksApi.counts(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', { filter: activeTab }],
    queryFn: () => tasksApi.list({ filter: activeTab, limit: '100' }),
  });

  const { data: dealsData } = useQuery({
    queryKey: ['deals', 'list-for-tasks'],
    queryFn: () => dealsApi.list({ limit: '100' }),
    enabled: showNewModal,
  });

  const deals = dealsData?.data?.items || [];

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowNewModal(false);
      setFormData({ subject: '', content: '', due_date: '', priority: 'medium' as TaskPriority, deal_id: '' });
      setQuickAddText('');
      toast.success(t('tasks:toast.created'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: tasksApi.toggle,
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      const task = tasks.find((t: any) => t.id === taskId);
      toast.success(task?.completed ? 'Task reopened' : 'Task completed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDeleteId(null);
      toast.success(t('tasks:toast.deleted'));
    },
  });

  const tasks = data?.data?.items || [];
  const counts: TaskCounts = countsData?.data || { pending: 0, today: 0, overdue: 0, this_week: 0, completed: 0 };

  const tabs = [
    { id: 'pending', label: t('tasks:tabs.pending'), count: counts.pending || 0 },
    { id: 'today', label: t('tasks:tabs.today'), count: counts.today || 0 },
    { id: 'overdue', label: t('tasks:tabs.overdue'), count: counts.overdue || 0 },
    { id: 'week', label: t('tasks:tabs.thisWeek'), count: counts.this_week || 0 },
    { id: 'completed', label: t('tasks:tabs.completed'), count: counts.completed || 0 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      subject: formData.subject,
      content: formData.content || undefined,
      due_date: formData.due_date || undefined,
      priority: formData.priority,
      deal_id: formData.deal_id || undefined,
    });
  };

  const getDueDateStyle = (dueDate: string | null, completed: boolean) => {
    if (completed || !dueDate) return 'text-text-muted';
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-error';
    if (isToday(date)) return 'text-warning';
    return 'text-text-muted';
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-text-secondary text-sm">
            {t('tasks:pending', { count: counts.pending || 0 })}
          </p>
          {counts.overdue > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              <AlertCircle className="h-3 w-3" />
              {counts.overdue} overdue
            </span>
          )}
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          {t('tasks:addTask')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Quick Add */}
      {activeTab !== 'completed' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (quickAddText.trim()) {
              createMutation.mutate({ subject: quickAddText.trim(), priority: 'medium' });
            }
          }}
          className="flex items-center gap-2 p-3 bg-white border border-border rounded-lg"
        >
          <Plus className="h-4 w-4 text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            placeholder="Quick add task... (press Enter)"
            className="flex-1 text-sm outline-none placeholder:text-text-muted"
          />
          {quickAddText && (
            <Button type="submit" size="sm" isLoading={createMutation.isPending}>
              Add
            </Button>
          )}
        </form>
      )}

      {/* Task List */}
      {tasks.length === 0 && !isLoading ? (
        <EmptyState
          icon={CheckCircle}
          title={activeTab === 'completed' ? t('tasks:empty.noCompletedTasks') : t('tasks:empty.noTasks')}
          description={
            activeTab === 'completed'
              ? t('tasks:empty.completedDescription')
              : t('tasks:empty.pendingDescription')
          }
          actionLabel={activeTab !== 'completed' ? t('tasks:addTask') : undefined}
          onAction={activeTab !== 'completed' ? () => setShowNewModal(true) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any) => (
            <div
              key={task.id}
              className={clsx(
                'flex items-start gap-3 p-4 bg-white border border-border rounded-lg hover:shadow-card transition-shadow',
                task.completed && 'opacity-60'
              )}
            >
              <button
                onClick={() => toggleMutation.mutate(task.id)}
                className="mt-0.5 flex-shrink-0"
              >
                {task.completed ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <Circle className="h-5 w-5 text-text-muted hover:text-primary" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={clsx(
                      'text-sm font-medium',
                      task.completed ? 'text-text-muted line-through' : 'text-text-primary'
                    )}
                  >
                    {task.subject}
                  </p>
                  <PriorityBadge priority={task.priority} />
                </div>
                {task.content && (
                  <p className="text-sm text-text-secondary mt-1 line-clamp-1">
                    {task.content}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs">
                  {task.due_date && (
                    <span className={clsx('flex items-center gap-1', getDueDateStyle(task.due_date, task.completed))}>
                      <Calendar className="h-3 w-3" />
                      {formatDate(task.due_date, 'PP')}
                      {isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !task.completed && (
                        <AlertCircle className="h-3 w-3 text-error" />
                      )}
                    </span>
                  )}
                  {task.deal_name && (
                    <button
                      onClick={() => navigate(`/deals/${task.deal_id}`)}
                      className="text-primary hover:underline"
                    >
                      {task.deal_name}
                    </button>
                  )}
                  {task.contact_name && (
                    <button
                      onClick={() => navigate(`/contacts/${task.contact_id}`)}
                      className="text-primary hover:underline"
                    >
                      {task.contact_name}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDeleteId(task.id)}
                className="p-1 text-text-muted hover:text-error transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Task Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setSearchParams({});
        }}
        title={t('tasks:modal.createTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('tasks:modal.task')}
            placeholder={t('tasks:modal.taskPlaceholder')}
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            required
          />
          <div>
            <label className="label">{t('tasks:modal.description')}</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="input min-h-[80px]"
              placeholder={t('tasks:modal.descriptionPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('tasks:modal.dueDate')}
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
            <div>
              <label className="label">{t('tasks:modal.priority')}</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="input"
              >
                <option value="low">{t('common:priority.low')}</option>
                <option value="medium">{t('common:priority.medium')}</option>
                <option value="high">{t('common:priority.high')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Deal</label>
            <select
              value={formData.deal_id}
              onChange={(e) => setFormData({ ...formData, deal_id: e.target.value })}
              className="input"
            >
              <option value="">No deal</option>
              {deals.map((deal: any) => (
                <option key={deal.id} value={deal.id}>
                  {deal.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNewModal(false)}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('tasks:modal.createTask')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('tasks:delete.title')}
        message={`Are you sure you want to delete "${tasks.find((t: any) => t.id === deleteId)?.subject || 'this task'}"?`}
        confirmLabel={t('common:buttons.delete')}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
