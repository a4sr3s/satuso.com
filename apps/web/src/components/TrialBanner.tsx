import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useSubscription } from '@/hooks/useSubscription';

export default function TrialBanner() {
  const { isInTrial, trialDaysRemaining, isLoading } = useSubscription();

  // Don't show banner while loading
  if (isLoading) {
    return null;
  }

  // Don't show banner if user is not in trial (paid subscriber or grandfathered)
  if (!isInTrial) {
    return null;
  }

  // Determine urgency level based on days remaining
  const getUrgencyStyles = () => {
    if (trialDaysRemaining <= 3) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        button: 'bg-red-600 hover:bg-red-700 text-white',
      };
    }
    if (trialDaysRemaining <= 7) {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      };
    }
    return {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    };
  };

  const styles = getUrgencyStyles();

  const getMessage = () => {
    if (trialDaysRemaining === 0) {
      return 'Your trial ends today!';
    }
    if (trialDaysRemaining === 1) {
      return '1 day left in your free trial';
    }
    return `${trialDaysRemaining} days left in your free trial`;
  };

  return (
    <div className={clsx('px-4 py-2 border-b flex items-center justify-between', styles.bg, styles.border)}>
      <p className={clsx('text-sm font-medium', styles.text)}>
        {getMessage()}
      </p>
      <Link
        to="/subscribe"
        className={clsx('text-xs font-medium px-3 py-1.5 rounded-lg transition-colors', styles.button)}
      >
        Subscribe Now
      </Link>
    </div>
  );
}
