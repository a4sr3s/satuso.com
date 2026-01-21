import { useState } from 'react';
import { Save, Filter, Columns } from 'lucide-react';
import type { Workboard, WorkboardColumn, WorkboardFilter } from '@/types';
import Button from '@/components/ui/Button';
import WorkboardFilterModal from './WorkboardFilterModal';
import WorkboardColumnConfig from './WorkboardColumnConfig';

interface WorkboardToolbarProps {
  workboard: Workboard;
  columns: WorkboardColumn[];
  filters: WorkboardFilter[];
  hasChanges: boolean;
  onSave: () => void;
  onAddFilter: (filter: WorkboardFilter) => void;
  onColumnReorder: (columns: WorkboardColumn[]) => void;
  isSaving: boolean;
}

export default function WorkboardToolbar({
  workboard,
  columns,
  filters,
  hasChanges,
  onSave,
  onAddFilter,
  onColumnReorder,
  isSaving,
}: WorkboardToolbarProps) {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  return (
    <div className="flex items-center justify-between bg-white border border-border rounded-lg px-4 py-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilterModal(true)}
        >
          <Filter className="h-4 w-4" />
          Filters
          {filters.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-white rounded-full">
              {filters.length}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowColumnConfig(true)}
        >
          <Columns className="h-4 w-4" />
          Columns
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {hasChanges && (
          <span className="text-sm text-text-muted">Unsaved changes</span>
        )}
        <Button
          variant={hasChanges ? 'primary' : 'secondary'}
          size="sm"
          onClick={onSave}
          disabled={!hasChanges || isSaving || workboard.is_default}
          isLoading={isSaving}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      <WorkboardFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        entityType={workboard.entity_type}
        onAddFilter={(filter) => {
          onAddFilter(filter);
          setShowFilterModal(false);
        }}
      />

      <WorkboardColumnConfig
        isOpen={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        columns={columns}
        entityType={workboard.entity_type}
        onSave={(newColumns) => {
          onColumnReorder(newColumns);
          setShowColumnConfig(false);
        }}
      />
    </div>
  );
}
