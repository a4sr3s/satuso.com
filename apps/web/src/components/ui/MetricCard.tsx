import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeDirection?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  format?: 'number' | 'currency' | 'percent';
  info?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changeDirection = 'neutral',
  sparklineData,
  format = 'number',
  info,
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          notation: val >= 1000000 ? 'compact' : 'standard',
          maximumFractionDigits: val >= 1000 ? 0 : 2,
        }).format(val);
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-US', {
          notation: val >= 10000 ? 'compact' : 'standard',
          maximumFractionDigits: 2,
        }).format(val);
    }
  };

  const getTrendIcon = () => {
    switch (changeDirection) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    switch (changeDirection) {
      case 'up':
        return 'text-success bg-green-50';
      case 'down':
        return 'text-error bg-red-50';
      default:
        return 'text-text-muted bg-gray-50';
    }
  };

  const chartData = sparklineData?.map((val, idx) => ({ value: val, idx })) || [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{title}</span>
        {info && (
          <button className="text-text-muted hover:text-text-secondary">
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-metric-lg text-text-primary">{formatValue(value)}</div>
          {change !== undefined && (
            <div className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium mt-1', getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(change).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="w-20 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={changeDirection === 'down' ? '#EF4444' : '#10B981'}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
