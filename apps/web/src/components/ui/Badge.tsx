import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  primary: 'bg-blue-100 text-blue-700',
};

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={clsx('badge', variants[variant], className)}>
      {children}
    </span>
  );
}

// Stage badge for deals
export function StageBadge({ stage }: { stage: string }) {
  const stageConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    lead: { label: 'Lead', variant: 'default' },
    qualified: { label: 'Qualified', variant: 'primary' },
    proposal: { label: 'Proposal', variant: 'warning' },
    negotiation: { label: 'Negotiation', variant: 'primary' },
    closed_won: { label: 'Closed Won', variant: 'success' },
    closed_lost: { label: 'Closed Lost', variant: 'error' },
  };

  const config = stageConfig[stage] || { label: stage, variant: 'default' };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Priority badge for tasks
export function PriorityBadge({ priority }: { priority: string }) {
  const priorityConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    low: { label: 'Low', variant: 'default' },
    medium: { label: 'Medium', variant: 'warning' },
    high: { label: 'High', variant: 'error' },
  };

  const config = priorityConfig[priority] || { label: priority, variant: 'default' };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Status badge for contacts
export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    active: { label: 'Active', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'default' },
    lead: { label: 'Lead', variant: 'primary' },
  };

  const config = statusConfig[status] || { label: status, variant: 'default' };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
