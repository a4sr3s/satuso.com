import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workboardsApi, dealsApi } from '@/lib/api';
import type {
  Workboard,
  WorkboardDataRow,
  WorkboardColumn,
  WorkboardFilter,
  SortDirection,
} from '@/types';
import WorkboardToolbar from './WorkboardToolbar';
import WorkboardTable from './WorkboardTable';
import WorkboardFilterBar from './WorkboardFilterBar';

interface WorkboardContainerProps {
  workboard: Workboard;
}

export default function WorkboardContainer({ workboard }: WorkboardContainerProps) {
  const queryClient = useQueryClient();

  // Local state for view modifications (not saved to server yet)
  const [columns, setColumns] = useState<WorkboardColumn[]>(workboard.columns);
  const [filters, setFilters] = useState<WorkboardFilter[]>(workboard.filters);
  const [sortColumn, setSortColumn] = useState<string | null>(workboard.sort_column);
  const [sortDirection, setSortDirection] = useState<SortDirection>(workboard.sort_direction || 'asc');
  const [page, setPage] = useState(1);

  // Check if there are unsaved changes
  const hasChanges =
    JSON.stringify(columns) !== JSON.stringify(workboard.columns) ||
    JSON.stringify(filters) !== JSON.stringify(workboard.filters) ||
    sortColumn !== workboard.sort_column ||
    sortDirection !== workboard.sort_direction;

  // Fetch data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workboard-data', workboard.id, page, sortColumn, sortDirection, filters],
    queryFn: () =>
      workboardsApi.getData(workboard.id, {
        page: String(page),
        limit: '50',
        ...(sortColumn && { sort_column: sortColumn }),
        ...(sortDirection && { sort_direction: sortDirection }),
        ...(filters.length > 0 && { filters: JSON.stringify(filters) }),
      }),
  });

  // Save workboard changes
  const saveMutation = useMutation({
    mutationFn: (data: { columns?: WorkboardColumn[]; filters?: WorkboardFilter[]; sort_column?: string; sort_direction?: SortDirection }) => workboardsApi.update(workboard.id, { ...data, sort_column: data.sort_column || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workboard', workboard.id] });
      toast.success('Workboard saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update deal (for inline editing)
  const updateDealMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      dealsApi.update(id, data),
    onSuccess: () => {
      refetch();
      toast.success('Updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  }, [sortColumn]);

  const handleSave = () => {
    saveMutation.mutate({
      columns,
      filters,
      sort_column: sortColumn || undefined,
      sort_direction: sortDirection,
    });
  };

  const handleAddFilter = (filter: WorkboardFilter) => {
    setFilters((prev) => [...prev, filter]);
    setPage(1);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters([]);
    setPage(1);
  };

  const handleColumnReorder = (newColumns: WorkboardColumn[]) => {
    setColumns(newColumns);
  };

  const handleCellEdit = (rowId: string, field: string, value: any) => {
    if (workboard.entity_type === 'deals') {
      updateDealMutation.mutate({ id: rowId, data: { [field]: value } });
    }
  };

  const rows = (data?.data?.items || []) as WorkboardDataRow[];
  const total = data?.data?.total || 0;
  const hasMore = data?.data?.hasMore || false;

  return (
    <div className="space-y-4">
      <WorkboardToolbar
        workboard={workboard}
        columns={columns}
        filters={filters}
        hasChanges={hasChanges}
        onSave={handleSave}
        onAddFilter={handleAddFilter}
        onColumnReorder={handleColumnReorder}
        isSaving={saveMutation.isPending}
      />

      {filters.length > 0 && (
        <WorkboardFilterBar
          filters={filters}
          onRemoveFilter={handleRemoveFilter}
          onClearFilters={handleClearFilters}
        />
      )}

      <WorkboardTable
        columns={columns}
        rows={rows}
        entityType={workboard.entity_type}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onCellEdit={handleCellEdit}
        isLoading={isLoading}
        page={page}
        total={total}
        hasMore={hasMore}
        onPageChange={setPage}
      />
    </div>
  );
}
