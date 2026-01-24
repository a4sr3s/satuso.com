import { Trash2, X, Building2, User, Handshake, AlertTriangle } from 'lucide-react';

interface EntityDeleteCardProps {
  entityType: 'contact' | 'company' | 'deal';
  entity: {
    id: string;
    name: string;
    details?: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const entityIcons = {
  contact: User,
  company: Building2,
  deal: Handshake,
};

const entityLabels = {
  contact: 'Contact',
  company: 'Company',
  deal: 'Deal',
};

export default function EntityDeleteCard({
  entityType,
  entity,
  onConfirm,
  onCancel,
  isLoading,
}: EntityDeleteCardProps) {
  const Icon = entityIcons[entityType];

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-medium text-red-800">
          Delete {entityLabels[entityType]}?
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-primary mb-1">
        <Icon className="h-3.5 w-3.5 text-text-muted" />
        <span className="font-medium">{entity.name}</span>
      </div>

      {entity.details && (
        <p className="text-xs text-text-muted mb-3 ml-5">{entity.details}</p>
      )}

      <p className="text-xs text-red-700 mb-3">This action cannot be undone.</p>

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-text-secondary bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
