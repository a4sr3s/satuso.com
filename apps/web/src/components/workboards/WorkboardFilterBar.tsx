import { X } from 'lucide-react';
import type { WorkboardFilter, FilterOperator } from '@/types';

interface WorkboardFilterBarProps {
  filters: WorkboardFilter[];
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
}

const operatorLabels: Record<FilterOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'contains',
  not_contains: 'not contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_null: 'is empty',
  is_not_null: 'is not empty',
  in: 'is one of',
  not_in: 'is not one of',
};

function formatFilterValue(filter: WorkboardFilter): string {
  if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
    return '';
  }
  if (Array.isArray(filter.value)) {
    return filter.value.join(', ');
  }
  return String(filter.value);
}

export default function WorkboardFilterBar({
  filters,
  onRemoveFilter,
  onClearFilters,
}: WorkboardFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-text-muted">Filters:</span>
      {filters.map((filter, index) => (
        <div
          key={index}
          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary text-sm rounded-md"
        >
          <span className="font-medium">{filter.field}</span>
          <span className="text-primary/70">{operatorLabels[filter.operator]}</span>
          {formatFilterValue(filter) && (
            <span className="font-medium">{formatFilterValue(filter)}</span>
          )}
          <button
            onClick={() => onRemoveFilter(index)}
            className="ml-1 p-0.5 hover:bg-primary/10 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearFilters}
          className="text-sm text-text-muted hover:text-text-primary"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
