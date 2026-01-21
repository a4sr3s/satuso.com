import { clsx } from 'clsx';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { WorkboardColumn, SortDirection } from '@/types';

interface WorkboardColumnHeaderProps {
  column: WorkboardColumn;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
}

export default function WorkboardColumnHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: WorkboardColumnHeaderProps) {
  const isSorted = sortColumn === column.field;

  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-hover transition-colors',
        column.type === 'formula' && 'bg-blue-50/50'
      )}
      style={{ width: column.width || 'auto', minWidth: column.width || 100 }}
      onClick={() => onSort(column.field)}
    >
      <div className="flex items-center gap-1">
        <span>{column.label}</span>
        {column.type === 'formula' && (
          <span className="text-[10px] text-blue-500 font-normal lowercase">fx</span>
        )}
        <span className="ml-auto">
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
          )}
        </span>
      </div>
    </th>
  );
}
