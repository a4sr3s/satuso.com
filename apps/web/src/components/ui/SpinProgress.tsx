import { clsx } from 'clsx';

// SpinScoreBadge - Compact badge showing SPIN score with color coding
interface SpinScoreBadgeProps {
  score: number;
  showLabel?: boolean;
}

export function SpinScoreBadge({ score, showLabel = false }: SpinScoreBadgeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 75) return 'bg-green-100 text-green-700 border-green-200';
    if (s >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (s >= 25) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 75) return 'Complete';
    if (s >= 50) return 'Good';
    if (s >= 25) return 'Partial';
    return 'Needs Work';
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
        getScoreColor(score)
      )}
      title={`SPIN Score: ${score}/100 - ${getScoreLabel(score)}`}
    >
      <span>{score}</span>
      {showLabel && <span className="opacity-75">/ 100</span>}
    </span>
  );
}

interface SpinProgressProps {
  situation?: string | null;
  problem?: string | null;
  implication?: string | null;
  needPayoff?: string | null;
  size?: 'sm' | 'md';
  showLabels?: boolean;
}

type SpinStatus = 'empty' | 'partial' | 'complete';

function getStatus(value?: string | null): SpinStatus {
  if (!value) return 'empty';
  if (value.length < 50) return 'partial';
  return 'complete';
}

export default function SpinProgress({
  situation,
  problem,
  implication,
  needPayoff,
  size = 'md',
  showLabels = false,
}: SpinProgressProps) {
  const statuses = [
    { key: 'S', label: 'Situation', status: getStatus(situation) },
    { key: 'P', label: 'Problem', status: getStatus(problem) },
    { key: 'I', label: 'Implication', status: getStatus(implication) },
    { key: 'N', label: 'Need-Payoff', status: getStatus(needPayoff) },
  ];

  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
  };

  const getDotStyle = (status: SpinStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-primary';
      case 'partial':
        return 'bg-white border-2 border-primary';
      case 'empty':
      default:
        return 'bg-gray-200';
    }
  };

  return (
    <div className="flex items-center gap-1.5" title="SPIN Discovery Progress (Situation, Problem, Implication, Need-Payoff)">
      {statuses.map((item) => (
        <div key={item.key} className="flex flex-col items-center">
          <div
            className={clsx(
              'rounded-full',
              dotSizes[size],
              getDotStyle(item.status)
            )}
            title={`${item.label}: ${item.status === 'complete' ? 'Complete' : item.status === 'partial' ? 'In Progress' : 'Not Started'}`}
          />
          {showLabels && (
            <span className="text-[10px] text-text-muted mt-0.5">{item.key}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Detailed SPIN panel for deal detail view
interface SpinPanelProps {
  situation?: string | null;
  problem?: string | null;
  implication?: string | null;
  needPayoff?: string | null;
  onEdit?: (field: 'situation' | 'problem' | 'implication' | 'needPayoff') => void;
  suggestions?: {
    situation?: { question: string; reason: string }[];
    problem?: { question: string; reason: string }[];
    implication?: { question: string; reason: string }[];
    needPayoff?: { question: string; reason: string }[];
  };
}

export function SpinPanel({ situation, problem, implication, needPayoff, onEdit, suggestions }: SpinPanelProps) {
  const sections = [
    { key: 'situation', label: 'Situation', value: situation, description: 'Facts about the customer\'s current state' },
    { key: 'problem', label: 'Problem', value: problem, description: 'Difficulties or issues the customer experiences' },
    { key: 'implication', label: 'Implication', value: implication, description: 'Consequences of the problems' },
    { key: 'needPayoff', label: 'Need-Payoff', value: needPayoff, description: 'Value from solving problems' },
  ] as const;

  const completedCount = [situation, problem, implication, needPayoff].filter(v => v && v.length >= 50).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">SPIN Discovery</h3>
          <span className="text-xs text-text-muted">
            ({completedCount}/4 complete)
          </span>
        </div>
        <SpinProgress
          situation={situation}
          problem={problem}
          implication={implication}
          needPayoff={needPayoff}
        />
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const status = getStatus(section.value);
          const sectionSuggestions = suggestions?.[section.key];

          return (
            <div
              key={section.key}
              onClick={() => onEdit?.(section.key)}
              className={clsx(
                "p-3 bg-surface rounded-lg border border-border-light",
                onEdit && "cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded',
                    status === 'complete' ? 'bg-primary text-white' :
                    status === 'partial' ? 'bg-primary/20 text-primary' :
                    'bg-gray-200 text-text-muted'
                  )}>
                    {section.label[0]}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{section.label}</span>
                </div>
                <span className={clsx(
                  'text-xs',
                  status === 'complete' ? 'text-success' :
                  status === 'partial' ? 'text-warning' :
                  'text-text-muted'
                )}>
                  {status === 'complete' ? 'Done' :
                   status === 'partial' ? 'Partial' :
                   'Open'}
                </span>
              </div>

              {section.value ? (
                <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">
                  {section.value}
                </p>
              ) : (
                <p className="text-xs text-text-muted mt-1">{section.description}</p>
              )}

              {sectionSuggestions && sectionSuggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-light">
                  <p className="text-xs text-primary font-medium mb-1">Suggested questions:</p>
                  {sectionSuggestions.slice(0, 2).map((suggestion, idx) => (
                    <p key={idx} className="text-xs text-text-secondary">
                      "{suggestion.question}"
                    </p>
                  ))}
                </div>
              )}

              {onEdit && (
                <button
                  onClick={() => onEdit(section.key)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  {section.value ? 'Edit' : 'Add'} {section.label.toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
