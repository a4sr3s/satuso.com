import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  Target,
  Building2,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dealsApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import SpinProgress from '@/components/ui/SpinProgress';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import { clsx } from 'clsx';
import type { DealStage } from '@/types';
import type { TFunction } from 'i18next';

const stages = [
  { id: 'lead', probability: 10, color: 'from-slate-500 to-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', textColor: 'text-slate-700' },
  { id: 'qualified', probability: 25, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
  { id: 'discovery', probability: 35, color: 'from-cyan-500 to-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', textColor: 'text-cyan-700' },
  { id: 'proposal', probability: 50, color: 'from-amber-500 to-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700' },
  { id: 'negotiation', probability: 75, color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700' },
];

interface DealCardProps {
  deal: any;
  onClick: () => void;
  t: TFunction;
}

function getCloseDateStatus(closeDate: string | null) {
  if (!closeDate) return null;
  const date = new Date(closeDate);
  const today = new Date();

  if (isPast(date) && date.toDateString() !== today.toDateString()) {
    return { status: 'overdue', label: 'Overdue', color: 'text-red-600 bg-red-50' };
  }
  if (isWithinInterval(date, { start: today, end: addDays(today, 7) })) {
    return { status: 'soon', label: format(date, 'MMM d'), color: 'text-amber-600 bg-amber-50' };
  }
  if (isWithinInterval(date, { start: today, end: addDays(today, 30) })) {
    return { status: 'upcoming', label: format(date, 'MMM d'), color: 'text-blue-600 bg-blue-50' };
  }
  return { status: 'future', label: format(date, 'MMM d'), color: 'text-text-muted bg-surface' };
}

function DealCard({ deal, onClick, t }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.5 : 1,
  };

  const closeDateInfo = getCloseDateStatus(deal.close_date);
  const isStale = deal.days_in_stage > 14;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={clsx(
        'group bg-white rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all duration-200',
        'border hover:border-gray-300 hover:shadow-md',
        isDragging ? 'shadow-xl scale-[1.02] border-primary ring-2 ring-primary/20' : 'border-gray-200',
        isStale && !isDragging && 'border-l-4 border-l-amber-400'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text-primary line-clamp-1 group-hover:text-primary transition-colors">
            {deal.name}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
            {deal.company_name ? (
              <>
                <Building2 className="h-3 w-3 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-muted truncate">{deal.company_name}</span>
              </>
            ) : (
              <span className="text-xs text-text-muted italic">{t('deals:card.noCompany')}</span>
            )}
          </div>
        </div>
        <SpinProgress
          situation={deal.spin_situation}
          problem={deal.spin_problem}
          implication={deal.spin_implication}
          needPayoff={deal.spin_need_payoff}
          size="sm"
        />
      </div>

      {/* Value */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold text-text-primary">
          ${(deal.value || 0).toLocaleString()}
        </span>
        {deal.contact_name && (
          <div className="flex items-center gap-1.5">
            <Avatar name={deal.contact_name} size="xs" />
            <span className="text-xs text-text-muted truncate max-w-[80px]">{deal.contact_name}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {closeDateInfo ? (
          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', closeDateInfo.color)}>
            {closeDateInfo.label}
          </span>
        ) : (
          <span className="text-xs text-text-muted">{t('deals:card.noCloseDate')}</span>
        )}

        <div className="flex items-center gap-2">
          {isStale && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3 w-3" />
              {deal.days_in_stage}d
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
}

function DealCardOverlay({ deal, t }: { deal: any; t: TFunction }) {
  return (
    <div className="bg-white border-2 border-primary rounded-xl p-4 shadow-2xl w-72 rotate-2">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text-primary line-clamp-1">{deal.name}</h4>
          <p className="text-xs text-text-muted mt-1">{deal.company_name || t('deals:card.noCompany')}</p>
        </div>
      </div>
      <span className="text-lg font-bold text-primary">
        ${(deal.value || 0).toLocaleString()}
      </span>
    </div>
  );
}

function PipelineColumn({ stage, deals, onDealClick, isOver, t }: { stage: typeof stages[0]; deals: any[]; onDealClick: (deal: any) => void; isOver?: boolean; t: TFunction }) {
  const { setNodeRef } = useDroppable({ id: stage.id });
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedValue = totalValue * (stage.probability / 100);
  const stageLabel = t(`deals:stages.${stage.id}`);

  return (
    <div className="flex-1 min-w-[300px] max-w-[340px]">
      {/* Column Header */}
      <div className={clsx('rounded-t-xl p-4 border border-b-0', stage.bgColor, stage.borderColor)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={clsx('w-2 h-2 rounded-full bg-gradient-to-r', stage.color)} />
            <h3 className={clsx('text-sm font-semibold', stage.textColor)}>{stageLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full bg-white/80', stage.textColor)}>
              {stage.probability}%
            </span>
            <span className="text-xs font-medium text-text-muted bg-white px-2 py-0.5 rounded-full">
              {deals.length}
            </span>
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-lg font-bold text-text-primary">${totalValue.toLocaleString()}</p>
            <p className="text-xs text-text-muted">
              ${weightedValue.toLocaleString()} {t('deals:card.weighted')}
            </p>
          </div>
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={clsx(
          'rounded-b-xl p-3 min-h-[450px] space-y-3 transition-all duration-200 border border-t-0',
          isOver
            ? 'bg-primary/5 border-primary border-dashed border-2 border-t-2'
            : 'bg-gray-50/50 border-gray-200'
        )}
      >
        <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} t={t} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center mb-3', stage.bgColor)}>
              <ArrowRight className={clsx('h-5 w-5', stage.textColor)} />
            </div>
            <p className="text-sm text-text-muted">{t('deals:card.dropHere')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

type StageInfo = { id: string; probability: number; color: string; bgColor: string; borderColor: string; textColor: string };

function PipelineMetrics({ pipeline, stageList, t }: { pipeline: any; stageList: StageInfo[]; t: TFunction }) {
  const allDeals = Object.values(pipeline).flat() as any[];
  const totalValue = allDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

  const weightedValue = stageList.reduce((sum: number, stage: StageInfo) => {
    const stageDeals = pipeline[stage.id] || [];
    const stageTotal = stageDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
    return sum + (stageTotal * stage.probability / 100);
  }, 0);

  const avgDealSize = allDeals.length > 0 ? totalValue / allDeals.length : 0;

  const metrics = [
    { label: t('deals:metrics.totalPipeline'), value: `$${totalValue.toLocaleString()}`, icon: DollarSign, color: 'text-text-primary' },
    { label: t('deals:metrics.weightedValue'), value: `$${Math.round(weightedValue).toLocaleString()}`, icon: Target, color: 'text-primary' },
    { label: t('deals:metrics.activeDeals'), value: allDeals.length.toString(), icon: TrendingUp, color: 'text-blue-600' },
    { label: t('deals:metrics.avgDealSize'), value: `$${Math.round(avgDealSize).toLocaleString()}`, icon: DollarSign, color: 'text-purple-600' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <metric.icon className={clsx('h-4 w-4', metric.color)} />
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{metric.label}</span>
          </div>
          <p className={clsx('text-2xl font-bold', metric.color)}>{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const { t } = useTranslation(['deals', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true');
  const [activeDeal, setActiveDeal] = useState<any>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<{
    name: string;
    value: string;
    stage: DealStage;
    close_date: string;
  }>({
    name: '',
    value: '',
    stage: 'lead',
    close_date: '',
  });
  const [listSortColumn, setListSortColumn] = useState<string>('value');
  const [listSortDirection, setListSortDirection] = useState<'asc' | 'desc'>('desc');

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleListSort = (column: string) => {
    if (listSortColumn === column) {
      setListSortDirection(listSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setListSortColumn(column);
      setListSortDirection('asc');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['deals', 'pipeline'],
    queryFn: () => dealsApi.pipeline(),
  });

  const createMutation = useMutation({
    mutationFn: dealsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setShowNewModal(false);
      setFormData({ name: '', value: '', stage: 'lead', close_date: '' });
      toast.success(t('deals:toast.created'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => dealsApi.move(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const pipeline = pipelineData?.data || {};

  // Build filtered pipeline based on search and selected stages
  const filteredPipeline: Record<string, any[]> = {};
  for (const stage of stages) {
    if (selectedStages.length > 0 && !selectedStages.includes(stage.id)) {
      filteredPipeline[stage.id] = [];
      continue;
    }
    const stageDeals = (pipeline[stage.id] || []).filter((deal: any) =>
      !search ||
      deal.name?.toLowerCase().includes(search.toLowerCase()) ||
      deal.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      deal.contact_name?.toLowerCase().includes(search.toLowerCase())
    );
    filteredPipeline[stage.id] = stageDeals;
  }

  const handleDragStart = (event: DragStartEvent) => {
    const deal = event.active.data.current?.deal;
    setActiveDeal(deal);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setActiveOverId(null);
      return;
    }

    const overId = over.id as string;
    const isColumn = stages.some(s => s.id === overId);

    if (isColumn) {
      setActiveOverId(overId);
    } else {
      for (const stage of stages) {
        const columnDeals = pipeline[stage.id] || [];
        if (columnDeals.some((d: any) => d.id === overId)) {
          setActiveOverId(stage.id);
          return;
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    setActiveOverId(null);

    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const deal = active.data.current?.deal;
    const overId = over.id as string;

    let newStageId: string | null = null;

    if (stages.some(s => s.id === overId)) {
      newStageId = overId;
    } else {
      for (const stage of stages) {
        const columnDeals = pipeline[stage.id] || [];
        if (columnDeals.some((d: any) => d.id === overId)) {
          newStageId = stage.id;
          break;
        }
      }
    }

    if (newStageId && deal && deal.stage !== newStageId) {
      queryClient.setQueryData(['deals', 'pipeline'], (old: any) => {
        if (!old?.data) return old;

        const newData = { ...old.data };

        if (newData[deal.stage]) {
          newData[deal.stage] = newData[deal.stage].filter((d: any) => d.id !== dealId);
        }

        if (!newData[newStageId]) {
          newData[newStageId] = [];
        }
        newData[newStageId] = [...newData[newStageId], { ...deal, stage: newStageId }];

        return { ...old, data: newData };
      });

      moveMutation.mutate({ id: dealId, stage: newStageId });
      const stageLabel = t(`deals:stages.${newStageId}`);
      toast.success(t('deals:toast.moved', { stage: stageLabel }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // BUG-009: Validate value > 0 and close_date is set
    const numericValue = formData.value ? parseFloat(formData.value) : 0;
    if (numericValue <= 0) {
      toast.error(t('deals:validation.valueRequired'));
      return;
    }
    if (!formData.close_date) {
      toast.error(t('deals:validation.closeDateRequired'));
      return;
    }

    createMutation.mutate({
      name: formData.name,
      value: numericValue,
      stage: formData.stage,
      close_date: formData.close_date,
    });
  };

  const toggleStageFilter = (stageId: string) => {
    setSelectedStages((prev) =>
      prev.includes(stageId)
        ? prev.filter((s) => s !== stageId)
        : [...prev, stageId]
    );
  };

  const allDeals = Object.values(pipeline).flat();
  const filteredAllDeals = Object.values(filteredPipeline).flat();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          {t('deals:newDeal')}
        </Button>
      </div>

      {/* Metrics - BUG-016 fix: pass filtered pipeline data */}
      {(allDeals as any[]).length > 0 && (
        <PipelineMetrics pipeline={filteredPipeline} stageList={stages} t={t} />
      )}

      {/* Filters & View Toggle */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder={t('deals:searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          {/* BUG-003: Stage filter dropdown */}
          <div className="relative" ref={filterRef}>
            <Button
              variant="secondary"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter className="h-4 w-4" />
              {t('common:buttons.filters')}
              {selectedStages.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                  {selectedStages.length}
                </span>
              )}
            </Button>
            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-2">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{t('deals:filters.filterByStage')}</p>
                </div>
                {stages.map((stage) => {
                  const isSelected = selectedStages.includes(stage.id);
                  return (
                    <button
                      key={stage.id}
                      onClick={() => toggleStageFilter(stage.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className={clsx(
                        'w-4 h-4 rounded border flex items-center justify-center',
                        isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-2 h-2 rounded-full bg-gradient-to-r', stage.color)} />
                        <span className="text-text-primary">{t(`deals:stages.${stage.id}`)}</span>
                      </div>
                      <span className="ml-auto text-xs text-text-muted">{stage.probability}%</span>
                    </button>
                  );
                })}
                {selectedStages.length > 0 && (
                  <div className="px-3 pt-2 mt-1 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedStages([])}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      {t('deals:filters.clearAll')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('kanban')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
              viewMode === 'kanban'
                ? 'bg-white shadow-sm text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            {t('deals:view.board')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
              viewMode === 'list'
                ? 'bg-white shadow-sm text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <List className="h-4 w-4" />
            {t('deals:view.list')}
          </button>
        </div>
      </div>

      {/* Pipeline Kanban / List View */}
      {(allDeals as any[]).length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title={t('deals:empty.title')}
          description={t('deals:empty.description')}
          actionLabel={t('deals:modal.createDeal')}
          onAction={() => setShowNewModal(true)}
        />
      ) : viewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
            {stages.map((stage) => {
              const stageDeals = filteredPipeline[stage.id] || [];
              return (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  onDealClick={(deal) => navigate(`/deals/${deal.id}`)}
                  isOver={activeOverId === stage.id}
                  t={t}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeDeal ? <DealCardOverlay deal={activeDeal} t={t} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  { key: 'name', label: t('deals:table.deal') },
                  { key: 'company', label: t('deals:table.company') },
                  { key: 'value', label: t('deals:table.value') },
                  { key: 'stage', label: t('deals:table.stage') },
                  { key: 'spin', label: t('deals:table.spin'), sortable: false },
                  { key: 'close_date', label: t('deals:table.closeDate') },
                  { key: 'days', label: t('deals:table.days') },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleListSort(col.key)}
                    className={clsx(
                      'text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide',
                      col.sortable !== false && 'cursor-pointer hover:text-text-primary'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && listSortColumn === col.key && (
                        listSortDirection === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(filteredAllDeals as any[])
                .sort((a: any, b: any) => {
                  let aVal: any, bVal: any;

                  switch (listSortColumn) {
                    case 'name':
                      aVal = a.name?.toLowerCase() || '';
                      bVal = b.name?.toLowerCase() || '';
                      break;
                    case 'company':
                      aVal = a.company_name?.toLowerCase() || '';
                      bVal = b.company_name?.toLowerCase() || '';
                      break;
                    case 'value':
                      aVal = a.value || 0;
                      bVal = b.value || 0;
                      break;
                    case 'stage':
                      const stageOrder = ['lead', 'qualified', 'discovery', 'proposal', 'negotiation'];
                      aVal = stageOrder.indexOf(a.stage);
                      bVal = stageOrder.indexOf(b.stage);
                      break;
                    case 'close_date':
                      aVal = a.close_date ? new Date(a.close_date).getTime() : 0;
                      bVal = b.close_date ? new Date(b.close_date).getTime() : 0;
                      break;
                    case 'days':
                      aVal = a.days_in_stage || 0;
                      bVal = b.days_in_stage || 0;
                      break;
                    default:
                      return 0;
                  }

                  if (aVal < bVal) return listSortDirection === 'asc' ? -1 : 1;
                  if (aVal > bVal) return listSortDirection === 'asc' ? 1 : -1;
                  return 0;
                })
                .map((deal: any) => {
                  const stageInfo = stages.find(s => s.id === deal.stage);
                  const closeDateInfo = getCloseDateStatus(deal.close_date);
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => navigate(`/deals/${deal.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{deal.name}</div>
                        {deal.contact_name && (
                          <div className="text-xs text-text-muted mt-0.5">{deal.contact_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">{deal.company_name || '\u2014'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary">${(deal.value || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        {stageInfo && (
                          <span className={clsx('inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full', stageInfo.bgColor, stageInfo.textColor)}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full bg-gradient-to-r', stageInfo.color)} />
                            {t(`deals:stages.${stageInfo.id}`)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SpinProgress
                          situation={deal.spin_situation}
                          problem={deal.spin_problem}
                          implication={deal.spin_implication}
                          needPayoff={deal.spin_need_payoff}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {closeDateInfo ? (
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', closeDateInfo.color)}>
                            {closeDateInfo.label}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-sm', deal.days_in_stage > 14 ? 'text-amber-600 font-medium' : 'text-text-muted')}>
                          {deal.days_in_stage}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Deal Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setSearchParams({});
        }}
        title={t('deals:modal.createTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('deals:modal.dealName')}
            placeholder={t('deals:modal.dealNamePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={t('deals:modal.value')}
            type="number"
            placeholder={t('deals:modal.valuePlaceholder')}
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">{t('deals:modal.stage')}</label>
            <select
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value as DealStage })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {t(`deals:stages.${stage.id}`)} ({t('deals:stages.probability', { percent: stage.probability })})
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('deals:modal.expectedCloseDate')}
            type="date"
            value={formData.close_date}
            onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNewModal(false)}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('deals:modal.createDeal')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
