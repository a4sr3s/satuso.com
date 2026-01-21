import { clsx } from 'clsx';
import { MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export default function Table<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  isLoading,
  emptyMessage = 'No data found',
  actions,
}: TableProps<T>) {
  const getCellValue = (item: T, column: Column<T>): React.ReactNode => {
    if (column.render) {
      return column.render(item);
    }
    return (item as Record<string, unknown>)[column.key] as React.ReactNode;
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-surface border-b border-border" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-white border-b border-border-light">
              <div className="flex items-center h-full px-4 gap-4">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-surface border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                className={clsx(
                  'px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide',
                  column.sortable && 'cursor-pointer hover:text-text-primary',
                  column.className
                )}
                onClick={() => column.sortable && onSort?.(column.key)}
              >
                <div className="flex items-center gap-1">
                  {column.header}
                  {column.sortable && sortColumn === column.key && (
                    sortDirection === 'asc' ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  )}
                </div>
              </th>
            ))}
            {actions && <th className="w-12" />}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="px-4 py-12 text-center text-text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                className={clsx(
                  'table-row',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx('px-4 py-3 text-sm', column.className)}
                  >
                    {getCellValue(item, column)}
                  </td>
                ))}
                {actions && (
                  <td className="px-2 py-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      {actions(item)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Dropdown menu for actions
interface DropdownMenuProps {
  items: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'danger';
  }[];
}

export function ActionMenu({ items }: DropdownMenuProps) {
  return (
    <div className="relative group">
      <button className="p-1 text-text-muted hover:text-text-primary hover:bg-surface rounded">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div className="absolute right-0 mt-1 w-48 bg-white border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface transition-colors',
              item.variant === 'danger' ? 'text-error hover:bg-red-50' : 'text-text-primary'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
