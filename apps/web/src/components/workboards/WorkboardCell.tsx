import { useState } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { WorkboardColumn, WorkboardDataRow, WorkboardEntityType } from '@/types';
import { StageBadge } from '@/components/ui/Badge';
import { SpinScoreBadge } from '@/components/ui/SpinProgress';

interface WorkboardCellProps {
  column: WorkboardColumn;
  row: WorkboardDataRow;
  entityType: WorkboardEntityType;
  onEdit: (value: any) => void;
}

export default function WorkboardCell({
  column,
  row,
  onEdit,
}: WorkboardCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const value = row[column.field];

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only allow editing raw fields (not formula fields)
    if (column.type === 'formula') return;
    // Only allow editing simple text/number fields
    if (!['name', 'value', 'description'].includes(column.field)) return;

    setEditValue(value?.toString() || '');
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEdit(column.format === 'currency' || column.format === 'number' ? Number(editValue) : editValue);
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  // Inline editing input
  if (isEditing) {
    return (
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type={column.format === 'currency' || column.format === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </td>
    );
  }

  // Render based on column type and format
  const renderValue = () => {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return <span className="text-text-muted">—</span>;
    }

    // Formula fields
    if (column.type === 'formula') {
      switch (column.formula) {
        case 'spin_score':
          return <SpinScoreBadge score={value} />;

        case 'days_in_stage':
          const days = Number(value);
          return (
            <span
              className={clsx(
                'text-sm',
                days > 14 ? 'text-error font-medium' : days > 7 ? 'text-warning' : 'text-text-primary'
              )}
            >
              {days} days
            </span>
          );

        case 'sla_breach':
          return value ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-error">
              <AlertTriangle className="h-3.5 w-3.5" />
              Breach
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle className="h-3.5 w-3.5" />
              OK
            </span>
          );

        case 'last_activity_days':
          const activityDays = Number(value);
          if (activityDays >= 999) {
            return <span className="text-text-muted">No activity</span>;
          }
          return (
            <span
              className={clsx(
                'text-sm',
                activityDays > 14 ? 'text-error font-medium' : activityDays > 7 ? 'text-warning' : 'text-text-primary'
              )}
            >
              {activityDays} days ago
            </span>
          );

        default:
          return <span className="text-sm">{String(value)}</span>;
      }
    }

    // Raw fields with format
    switch (column.format) {
      case 'currency':
        return (
          <span className="text-sm font-medium">
            ${Number(value).toLocaleString()}
          </span>
        );

      case 'date':
        if (!value) return <span className="text-text-muted">—</span>;
        try {
          return (
            <span className="text-sm">
              {format(new Date(value), 'MMM d, yyyy')}
            </span>
          );
        } catch {
          return <span className="text-sm">{String(value)}</span>;
        }

      case 'number':
        return <span className="text-sm">{Number(value).toLocaleString()}</span>;

      case 'boolean':
        return value ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-text-muted" />
        );

      default:
        break;
    }

    // Handle stage field
    if (column.field === 'stage') {
      return <StageBadge stage={value} />;
    }

    // Handle SPIN text fields (truncate)
    if (column.field.startsWith('spin_')) {
      const text = String(value);
      if (text.length > 50) {
        return (
          <span className="text-sm text-text-secondary" title={text}>
            {text.substring(0, 50)}...
          </span>
        );
      }
      return <span className="text-sm text-text-secondary">{text}</span>;
    }

    // Default text
    return (
      <span className="text-sm text-text-primary line-clamp-1">
        {String(value)}
      </span>
    );
  };

  return (
    <td
      className={clsx(
        'px-4 py-3',
        column.type === 'formula' && 'bg-blue-50/30'
      )}
      style={{ maxWidth: column.width || 200 }}
      onDoubleClick={handleDoubleClick}
    >
      {renderValue()}
    </td>
  );
}
