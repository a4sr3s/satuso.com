import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { WorkboardColumn, WorkboardEntityType, FormulaFieldType } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface WorkboardColumnConfigProps {
  isOpen: boolean;
  onClose: () => void;
  columns: WorkboardColumn[];
  entityType: WorkboardEntityType;
  onSave: (columns: WorkboardColumn[]) => void;
}

interface AvailableColumn {
  field: string;
  label: string;
  type: 'raw' | 'formula';
  formula?: FormulaFieldType;
  format?: 'text' | 'currency' | 'date' | 'number';
}

const dealColumns: AvailableColumn[] = [
  { field: 'name', label: 'Deal Name', type: 'raw' },
  { field: 'company_name', label: 'Company', type: 'raw' },
  { field: 'contact_name', label: 'Contact', type: 'raw' },
  { field: 'value', label: 'Value', type: 'raw', format: 'currency' },
  { field: 'stage', label: 'Stage', type: 'raw' },
  { field: 'close_date', label: 'Close Date', type: 'raw', format: 'date' },
  { field: 'owner_name', label: 'Owner', type: 'raw' },
  { field: 'spin_situation', label: 'Situation', type: 'raw' },
  { field: 'spin_problem', label: 'Problem', type: 'raw' },
  { field: 'spin_implication', label: 'Implication', type: 'raw' },
  { field: 'spin_need_payoff', label: 'Need-Payoff', type: 'raw' },
  { field: 'created_at', label: 'Created', type: 'raw', format: 'date' },
  // Formula fields
  { field: 'spin_score', label: 'SPIN Score', type: 'formula', formula: 'spin_score' },
  { field: 'days_in_stage', label: 'Days in Stage', type: 'formula', formula: 'days_in_stage' },
  { field: 'sla_breach', label: 'SLA Breach', type: 'formula', formula: 'sla_breach' },
  { field: 'last_activity_days', label: 'Days Since Activity', type: 'formula', formula: 'last_activity_days' },
];

const contactColumns: AvailableColumn[] = [
  { field: 'name', label: 'Name', type: 'raw' },
  { field: 'email', label: 'Email', type: 'raw' },
  { field: 'phone', label: 'Phone', type: 'raw' },
  { field: 'title', label: 'Title', type: 'raw' },
  { field: 'company_name', label: 'Company', type: 'raw' },
  { field: 'status', label: 'Status', type: 'raw' },
  { field: 'owner_name', label: 'Owner', type: 'raw' },
  { field: 'created_at', label: 'Created', type: 'raw', format: 'date' },
  { field: 'last_activity_days', label: 'Days Since Activity', type: 'formula', formula: 'last_activity_days' },
];

const companyColumns: AvailableColumn[] = [
  { field: 'name', label: 'Name', type: 'raw' },
  { field: 'domain', label: 'Domain', type: 'raw' },
  { field: 'industry', label: 'Industry', type: 'raw' },
  { field: 'employee_count', label: 'Employees', type: 'raw', format: 'number' },
  { field: 'owner_name', label: 'Owner', type: 'raw' },
  { field: 'contact_count', label: 'Contacts', type: 'raw', format: 'number' },
  { field: 'deal_count', label: 'Deals', type: 'raw', format: 'number' },
  { field: 'total_revenue', label: 'Total Revenue', type: 'raw', format: 'currency' },
  { field: 'created_at', label: 'Created', type: 'raw', format: 'date' },
  { field: 'last_activity_days', label: 'Days Since Activity', type: 'formula', formula: 'last_activity_days' },
];

const columnsByEntity: Record<WorkboardEntityType, AvailableColumn[]> = {
  deals: dealColumns,
  contacts: contactColumns,
  companies: companyColumns,
};

export default function WorkboardColumnConfig({
  isOpen,
  onClose,
  columns,
  entityType,
  onSave,
}: WorkboardColumnConfigProps) {
  const [localColumns, setLocalColumns] = useState<WorkboardColumn[]>(columns);
  const availableColumns = columnsByEntity[entityType];

  // Get columns that are not currently in the workboard
  const unusedColumns = availableColumns.filter(
    (ac) => !localColumns.some((lc) => lc.field === ac.field)
  );

  const handleAddColumn = (col: AvailableColumn) => {
    const newColumn: WorkboardColumn = {
      id: col.field,
      field: col.field,
      label: col.label,
      type: col.type,
      formula: col.formula,
      format: col.format,
      width: 150,
    };
    setLocalColumns([...localColumns, newColumn]);
  };

  const handleRemoveColumn = (index: number) => {
    setLocalColumns(localColumns.filter((_, i) => i !== index));
  };

  const handleMoveColumn = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= localColumns.length) return;

    const newColumns = [...localColumns];
    [newColumns[fromIndex], newColumns[toIndex]] = [newColumns[toIndex], newColumns[fromIndex]];
    setLocalColumns(newColumns);
  };

  const handleSave = () => {
    onSave(localColumns);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Columns" size="lg">
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-text-primary mb-2">Active Columns</h4>
          <p className="text-xs text-text-muted mb-3">Drag to reorder or click the arrows</p>
          <div className="space-y-1 max-h-64 overflow-y-auto border border-border rounded-lg p-2">
            {localColumns.map((col, index) => (
              <div
                key={col.id}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 bg-surface rounded-lg',
                  col.type === 'formula' && 'border-l-2 border-blue-400'
                )}
              >
                <GripVertical className="h-4 w-4 text-text-muted cursor-grab" />
                <span className="flex-1 text-sm">{col.label}</span>
                {col.type === 'formula' && (
                  <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                    fx
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveColumn(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveColumn(index, 'down')}
                    disabled={index === localColumns.length - 1}
                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveColumn(index)}
                    className="p-1 text-text-muted hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {localColumns.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">
                No columns added yet
              </p>
            )}
          </div>
        </div>

        {unusedColumns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-2">Available Columns</h4>
            <div className="flex flex-wrap gap-2">
              {unusedColumns.map((col) => (
                <button
                  key={col.field}
                  onClick={() => handleAddColumn(col)}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md border border-border hover:border-primary hover:bg-primary-light transition-colors',
                    col.type === 'formula' && 'bg-blue-50/50'
                  )}
                >
                  <Plus className="h-3 w-3" />
                  {col.label}
                  {col.type === 'formula' && (
                    <span className="text-[10px] text-blue-500">fx</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
