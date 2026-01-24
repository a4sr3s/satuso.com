import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  DollarSign,
  Users,
  Building2,
  Trash2,
  UserCircle,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Target,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { workboardsApi, organizationsApi } from '@/lib/api';
import type { Workboard, WorkboardEntityType, CreateWorkboardData } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { workboardTemplates, type WorkboardTemplate } from '@/utils/workboardTemplates';

const entityTypeIcons: Record<WorkboardEntityType, React.ElementType> = {
  deals: DollarSign,
  contacts: Users,
  companies: Building2,
};

const templateIcons: Record<string, React.ElementType> = {
  UserCircle,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Target,
  Users,
  FileSpreadsheet,
};

export default function WorkboardsPage() {
  const { t } = useTranslation(['workboards', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [repPickerTemplate, setRepPickerTemplate] = useState<WorkboardTemplate | null>(null);
  const [selectedRepName, setSelectedRepName] = useState('');
  const [blankFormData, setBlankFormData] = useState({
    name: '',
    description: '',
    entity_type: 'deals' as WorkboardEntityType,
  });
  const [showBlankForm, setShowBlankForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workboards'],
    queryFn: () => workboardsApi.list(),
  });

  const { data: membersData } = useQuery({
    queryKey: ['organization-members'],
    queryFn: () => organizationsApi.getMembers(),
    enabled: !!repPickerTemplate,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkboardData) => workboardsApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workboards'] });
      setShowTemplateGallery(false);
      setRepPickerTemplate(null);
      setShowBlankForm(false);
      toast.success(t('workboards:toast.created'));
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
      toast.success(t('workboards:toast.deleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const workboards = data?.data?.items || [];
  const members = membersData?.data || [];

  const handleTemplateSelect = (template: WorkboardTemplate) => {
    if (template.id === 'blank_report') {
      setShowBlankForm(true);
      return;
    }

    if (template.requiresRepSelection) {
      setRepPickerTemplate(template);
      setSelectedRepName('');
      return;
    }

    createFromTemplate(template);
  };

  const createFromTemplate = (template: WorkboardTemplate, repName?: string) => {
    const filters = [...template.filters];
    if (repName) {
      filters.push({ field: 'owner_name', operator: 'eq', value: repName });
    }

    const name = repName
      ? `${template.name} — ${repName}`
      : template.name;

    createMutation.mutate({
      name,
      description: template.description,
      entity_type: template.entity_type,
      columns: template.columns,
      filters,
      sort_column: template.sort_column,
      sort_direction: template.sort_direction,
    });
  };

  const handleRepConfirm = () => {
    if (!repPickerTemplate || !selectedRepName) return;
    createFromTemplate(repPickerTemplate, selectedRepName);
  };

  const handleBlankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: blankFormData.name,
      description: blankFormData.description || undefined,
      entity_type: blankFormData.entity_type,
    });
  };

  const TemplateCard = ({ template }: { template: WorkboardTemplate }) => {
    const Icon = templateIcons[template.icon] || FileSpreadsheet;

    return (
      <button
        onClick={() => handleTemplateSelect(template)}
        className={clsx(
          'text-left p-4 rounded-lg border border-border bg-surface',
          'hover:border-primary hover:shadow-sm transition-all',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
        )}
      >
        <div className="flex items-start gap-3">
          <div className={clsx(
            'p-2 rounded-lg shrink-0',
            template.entity_type === 'deals' && 'bg-green-100 text-green-600',
            template.entity_type === 'contacts' && 'bg-blue-100 text-blue-600',
            template.entity_type === 'companies' && 'bg-purple-100 text-purple-600',
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-text-primary text-sm">{template.name}</h3>
            <p className="text-xs text-text-muted mt-0.5">{template.description}</p>
          </div>
        </div>
      </button>
    );
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
                <h3 className="font-medium text-text-primary">{workboard.name}</h3>
                <p className="text-sm text-text-muted">
                  {t(`workboards:entityTypes.${workboard.entity_type}`)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(workboard.id);
                }}
                className="p-1.5 text-text-muted hover:text-error hover:bg-red-50 rounded"
                title={t('workboards:card.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {workboard.description && (
            <p className="mt-2 text-sm text-text-secondary line-clamp-2">
              {workboard.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <span>{t('workboards:card.columns', { count: workboard.columns.length })}</span>
            {workboard.filters.length > 0 && (
              <>
                <span>·</span>
                <span>{t('workboards:card.filters', { count: workboard.filters.length })}</span>
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
      {workboards.length === 0 ? (
        <>
          {/* Empty state: show template gallery directly */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Create a Report</h2>
            <p className="text-sm text-text-muted mb-4">Pick a template to get started, or create a blank report.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workboardTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Header with create button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Your Reports</h2>
            <Button onClick={() => setShowTemplateGallery(true)}>
              <Plus className="h-4 w-4" />
              Create Report
            </Button>
          </div>

          {/* Workboard cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workboards.map((workboard: Workboard) => (
              <WorkboardCard key={workboard.id} workboard={workboard} />
            ))}
          </div>
        </>
      )}

      {/* Template Gallery Modal */}
      <Modal
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        title="Create Report"
      >
        <p className="text-sm text-text-muted mb-4">Pick a template to get started.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workboardTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      </Modal>

      {/* Rep Picker Modal */}
      <Modal
        isOpen={!!repPickerTemplate}
        onClose={() => setRepPickerTemplate(null)}
        title={`${repPickerTemplate?.name || 'Select Rep'}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Select a rep to filter this report by.</p>
          <div>
            <label className="label">Rep</label>
            <select
              value={selectedRepName}
              onChange={(e) => setSelectedRepName(e.target.value)}
              className="input"
            >
              <option value="">Choose a rep...</option>
              {members.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRepPickerTemplate(null)}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button
              onClick={handleRepConfirm}
              disabled={!selectedRepName}
              isLoading={createMutation.isPending}
            >
              Create Report
            </Button>
          </div>
        </div>
      </Modal>

      {/* Blank Report Form Modal */}
      <Modal
        isOpen={showBlankForm}
        onClose={() => setShowBlankForm(false)}
        title="Blank Report"
      >
        <form onSubmit={handleBlankSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="My Report"
            value={blankFormData.name}
            onChange={(e) => setBlankFormData({ ...blankFormData, name: e.target.value })}
            required
          />
          <div>
            <label className="label">Description</label>
            <textarea
              value={blankFormData.description}
              onChange={(e) => setBlankFormData({ ...blankFormData, description: e.target.value })}
              className="input min-h-[80px]"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="label">Entity Type</label>
            <select
              value={blankFormData.entity_type}
              onChange={(e) => setBlankFormData({ ...blankFormData, entity_type: e.target.value as WorkboardEntityType })}
              className="input"
            >
              <option value="deals">{t('workboards:entityTypes.deals')}</option>
              <option value="contacts">{t('workboards:entityTypes.contacts')}</option>
              <option value="companies">{t('workboards:entityTypes.companies')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowBlankForm(false)}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Report
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('workboards:delete.title')}
        message={t('workboards:delete.message')}
        confirmLabel={t('common:buttons.delete')}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
