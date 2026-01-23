import { Check, X, Building2, User, Handshake } from 'lucide-react';

interface EntityConfirmCardProps {
  entityType: 'contact' | 'company' | 'deal';
  fields: Record<string, any>;
  resolvedRefs?: {
    companyId?: string;
    companyName?: string;
    contactId?: string;
    contactName?: string;
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

const fieldLabels: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  title: 'Title',
  domain: 'Domain',
  industry: 'Industry',
  employee_count: 'Employees',
  website: 'Website',
  description: 'Description',
  value: 'Value',
  stage: 'Stage',
  close_date: 'Close Date',
};

function formatFieldValue(key: string, value: any): string {
  if (value === null || value === undefined) return '';
  if (key === 'value' && typeof value === 'number') {
    return `$${value.toLocaleString()}`;
  }
  if (key === 'stage') {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  return String(value);
}

export default function EntityConfirmCard({
  entityType,
  fields,
  resolvedRefs,
  onConfirm,
  onCancel,
  isLoading,
}: EntityConfirmCardProps) {
  const Icon = entityIcons[entityType];

  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-text-primary">
          Create {entityLabels[entityType]}
        </span>
      </div>

      <div className="space-y-1 mb-3">
        {Object.entries(fields).map(([key, value]) => {
          if (!value || key === 'companyRef' || key === 'contactRef') return null;
          return (
            <div key={key} className="flex items-baseline gap-2 text-xs">
              <span className="text-text-muted min-w-[70px]">
                {fieldLabels[key] || key}:
              </span>
              <span className="text-text-primary font-medium">
                {formatFieldValue(key, value)}
              </span>
            </div>
          );
        })}

        {resolvedRefs?.companyName && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-text-muted min-w-[70px]">Company:</span>
            <span className="text-text-primary font-medium">
              {resolvedRefs.companyName}
            </span>
          </div>
        )}

        {resolvedRefs?.contactName && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-text-muted min-w-[70px]">Contact:</span>
            <span className="text-text-primary font-medium">
              {resolvedRefs.contactName}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded transition-colors disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          Create
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
