import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Table2,
  DollarSign,
  Users,
  Building2,
  Trash2,
  Copy,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { workboardsApi } from '@/lib/api';
import type { Workboard, WorkboardEntityType } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';

const entityTypeIcons: Record<WorkboardEntityType, React.ElementType> = {
  deals: DollarSign,
  contacts: Users,
  companies: Building2,
};

const entityTypeLabels: Record<WorkboardEntityType, string> = {
  deals: 'Deals',
  contacts: 'Contacts',
  companies: 'Companies',
};

export default function WorkboardsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entity_type: 'deals' as WorkboardEntityType,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['workboards'],
    queryFn: () => workboardsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: workboardsApi.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workboards'] });
      setShowNewModal(false);
      setFormData({ name: '', description: '', entity_type: 'deals' });
      toast.success('Workboard created');
      navigate(`/workboards/${response.data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: workboardsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workboards'] });
      setDeleteId(null);
      toast.success('Workboard deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: workboardsApi.duplicate,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workboards'] });
      toast.success('Workboard duplicated');
      navigate(`/workboards/${response.data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const workboards = data?.data?.items || [];
  const defaultWorkboards = workboards.filter((w: Workboard) => w.is_default);
  const userWorkboards = workboards.filter((w: Workboard) => !w.is_default);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      entity_type: formData.entity_type,
    });
  };

  const WorkboardCard = ({ workboard }: { workboard: Workboard }) => {
    const Icon = entityTypeIcons[workboard.entity_type];

    return (
      <Card
        className="group cursor-pointer hover:shadow-card transition-shadow"
        onClick={() => navigate(`/workboards/${workboard.id}`)}
      >
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={clsx(
                'p-2 rounded-lg',
                workboard.entity_type === 'deals' && 'bg-green-100 text-green-600',
                workboard.entity_type === 'contacts' && 'bg-blue-100 text-blue-600',
                workboard.entity_type === 'companies' && 'bg-purple-100 text-purple-600',
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-text-primary">{workboard.name}</h3>
                  {workboard.is_default && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  )}
                </div>
                <p className="text-sm text-text-muted">
                  {entityTypeLabels[workboard.entity_type]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateMutation.mutate(workboard.id);
                }}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface rounded"
                title="Duplicate"
              >
                <Copy className="h-4 w-4" />
              </button>
              {!workboard.is_default && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(workboard.id);
                  }}
                  className="p-1.5 text-text-muted hover:text-error hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {workboard.description && (
            <p className="mt-2 text-sm text-text-secondary line-clamp-2">
              {workboard.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <span>{workboard.columns.length} columns</span>
            {workboard.filters.length > 0 && (
              <>
                <span>·</span>
                <span>{workboard.filters.length} filters</span>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Workboards</h1>
            <p className="text-text-secondary">Loading...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div>
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded mt-2" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Workboards</h1>
          <p className="text-text-secondary">
            Programmable table views for your data
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          New Workboard
        </Button>
      </div>

      {workboards.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="No workboards yet"
          description="Create your first workboard to build custom views of your data"
          actionLabel="New Workboard"
          onAction={() => setShowNewModal(true)}
        />
      ) : (
        <>
          {/* Default Workboards */}
          {defaultWorkboards.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">
                Default Workboards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {defaultWorkboards.map((workboard: Workboard) => (
                  <WorkboardCard key={workboard.id} workboard={workboard} />
                ))}
              </div>
            </div>
          )}

          {/* User Workboards */}
          {userWorkboards.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">
                Your Workboards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userWorkboards.map((workboard: Workboard) => (
                  <WorkboardCard key={workboard.id} workboard={workboard} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Workboard Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Create New Workboard"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="My Workboard"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[80px]"
              placeholder="What is this workboard for?"
            />
          </div>
          <div>
            <label className="label">Entity Type</label>
            <select
              value={formData.entity_type}
              onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as WorkboardEntityType })}
              className="input"
            >
              <option value="deals">Deals</option>
              <option value="contacts">Contacts</option>
              <option value="companies">Companies</option>
            </select>
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
              Create Workboard
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Workboard"
        message="Are you sure you want to delete this workboard? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
