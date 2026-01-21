import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WorkboardColumn, WorkboardDataRow, WorkboardEntityType, SortDirection } from '@/types';
import WorkboardColumnHeader from './WorkboardColumnHeader';
import WorkboardCell from './WorkboardCell';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Table2 } from 'lucide-react';

interface WorkboardTableProps {
  columns: WorkboardColumn[];
  rows: WorkboardDataRow[];
  entityType: WorkboardEntityType;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  onCellEdit: (rowId: string, field: string, value: any) => void;
  isLoading: boolean;
  page: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export default function WorkboardTable({
  columns,
  rows,
  entityType,
  sortColumn,
  sortDirection,
  onSort,
  onCellEdit,
  isLoading,
  page,
  total,
  hasMore,
  onPageChange,
}: WorkboardTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (row: WorkboardDataRow) => {
    const id = row.id;
    if (!id) return;

    switch (entityType) {
      case 'deals':
        navigate(`/deals/${id}`);
        break;
      case 'contacts':
        navigate(`/contacts/${id}`);
        break;
      case 'companies':
        navigate(`/companies/${id}`);
        break;
    }
  };

  if (isLoading && rows.length === 0) {
    return (
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <EmptyState
          icon={Table2}
          title="No data found"
          description="Try adjusting your filters or check back later"
        />
      </div>
    );
  }

  const startItem = (page - 1) * 50 + 1;
  const endItem = Math.min(page * 50, total);

  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface border-b border-border">
            <tr>
              {columns.map((column) => (
                <WorkboardColumnHeader
                  key={column.id}
                  column={column}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                className={clsx(
                  'border-b border-border-light hover:bg-surface-hover cursor-pointer transition-colors',
                  isLoading && 'opacity-50'
                )}
                onClick={() => handleRowClick(row)}
              >
                {columns.map((column) => (
                  <WorkboardCell
                    key={column.id}
                    column={column}
                    row={row}
                    entityType={entityType}
                    onEdit={(value) => onCellEdit(row.id, column.field, value)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface">
        <div className="text-sm text-text-muted">
          Showing {startItem}-{endItem} of {total}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-text-secondary px-2">Page {page}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
