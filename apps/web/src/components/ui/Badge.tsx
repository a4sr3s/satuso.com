import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const stageConfig: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    lead: { labelKey: 'common:stages.lead', variant: 'default' },
    qualified: { labelKey: 'common:stages.qualified', variant: 'primary' },
    discovery: { labelKey: 'common:stages.discovery', variant: 'primary' },
    proposal: { labelKey: 'common:stages.proposal', variant: 'warning' },
    negotiation: { labelKey: 'common:stages.negotiation', variant: 'primary' },
    closed_won: { labelKey: 'common:stages.closedWon', variant: 'success' },
    closed_lost: { labelKey: 'common:stages.closedLost', variant: 'error' },
  };

  const config = stageConfig[stage] || { labelKey: stage, variant: 'default' as BadgeVariant };
  const label = stageConfig[stage] ? t(config.labelKey) : stage;

  return <Badge variant={config.variant}>{label}</Badge>;
}

// Priority badge for tasks
export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();

  const priorityConfig: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    low: { labelKey: 'common:priority.low', variant: 'default' },
    medium: { labelKey: 'common:priority.medium', variant: 'warning' },
    high: { labelKey: 'common:priority.high', variant: 'error' },
  };

  const config = priorityConfig[priority] || { labelKey: priority, variant: 'default' as BadgeVariant };
  const label = priorityConfig[priority] ? t(config.labelKey) : priority;

  return <Badge variant={config.variant}>{label}</Badge>;
}

