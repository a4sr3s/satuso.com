import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';
import type { ForecastData } from '@/types';

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface ForecastChartProps {
  data: ForecastData;
}

export default function ForecastChart({ data }: ForecastChartProps) {
  const { summary, chart } = data;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Revenue Forecast</h3>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-text-muted">Next Month</p>
            <p className="text-sm font-semibold text-text-primary">{formatDollar(summary.nextMonth.weightedValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">This Quarter</p>
            <p className="text-sm font-semibold text-text-primary">{formatDollar(summary.thisQuarter.weightedValue)}</p>
          </div>
        </div>
      </div>
      {chart.data.length > 0 && (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={chart.data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={55} />
              <Tooltip
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border border-border-light rounded-lg shadow-lg px-3 py-2">
                      <p className="text-xs font-medium text-text-secondary mb-1">{label}</p>
                      {payload.map((entry: any) => {
                        const owner = chart.owners.find(o => `owner_${o.id}` === entry.dataKey);
                        return (
                          <div key={entry.dataKey} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                            <span className="text-xs text-text-primary">{owner?.name}</span>
                            <span className="text-xs font-semibold text-text-primary ml-auto pl-3">{formatDollar(entry.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const owner = chart.owners.find(o => `owner_${o.id}` === value);
                  return owner?.name || value;
                }}
                wrapperStyle={{ fontSize: 12 }}
              />
              {chart.owners.map((owner, i) => (
                <Bar
                  key={owner.id}
                  dataKey={`owner_${owner.id}`}
                  stackId="revenue"
                  fill={COLORS[i % COLORS.length]}
                  name={`owner_${owner.id}`}
                  radius={i === chart.owners.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
