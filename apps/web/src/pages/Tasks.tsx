import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  CheckCircle,
  Circle,
  Calendar,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { format, isToday, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { tasksApi } from '@/lib/api';
import type { TaskCounts, TaskPriority } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Tabs from '@/components/ui/Tabs';
import { PriorityBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

export default function TasksPage() {
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
  });

  const { data: countsData } = useQuery({
    queryKey: ['tasks', 'counts'],
    queryFn: () => tasksApi.counts(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', { filter: activeTab }],
    queryFn: () => tasksApi.list({ filter: activeTab, limit: '100' }),
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowNewModal(false);
      setFormData({ subject: '', content: '', due_date: '', priority: 'medium' as TaskPriority });
      toast.success('Task created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: tasksApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDeleteId(null);
      toast.success('Task deleted');
    },
  });

  const tasks = data?.data?.items || [];
  const counts: TaskCounts = countsData?.data || { pending: 0, today: 0, overdue: 0, this_week: 0, completed: 0 };

  const tabs = [
    { id: 'pending', label: 'Pending', count: counts.pending || 0 },
    { id: 'today', label: 'Today', count: counts.today || 0 },
    { id: 'overdue', label: 'Overdue', count: counts.overdue || 0 },
    { id: 'week', label: 'This Week', count: counts.this_week || 0 },
    { id: 'completed', label: 'Completed', count: counts.completed || 0 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      subject: formData.subject,
      content: formData.content || undefined,
      due_date: formData.due_date || undefined,
      priority: formData.priority,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Tasks</h1>
          <p className="text-text-secondary">
            {counts.pending || 0} pending tasks
            {counts.overdue > 0 && (
              <span className="text-error ml-2">· {counts.overdue} overdue</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Task List */}
      {tasks.length === 0 && !isLoading ? (
        <EmptyState
          icon={CheckCircle}
          title={activeTab === 'completed' ? 'No completed tasks' : 'No tasks'}
          description={
            activeTab === 'completed'
              ? "Tasks you complete will appear here."
              : "You're all caught up! Add a new task to stay organized."
          }
          actionLabel={activeTab !== 'completed' ? 'Add Task' : undefined}
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
                      {format(new Date(task.due_date), 'MMM d, yyyy')}
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
        title="Create New Task"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Task"
            placeholder="What needs to be done?"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            required
          />
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="input min-h-[80px]"
              placeholder="Add more details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
            <div>
              <label className="label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNewModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
