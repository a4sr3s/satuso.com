import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import Card from '@/components/ui/Card';
import type { ForecastData } from '@/types';

// Refined color palette for better visual appeal
const COLORS = [
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ef4444', // red
];

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface ForecastChartProps {
  data: ForecastData;
  title: string;
  quarterLabel: string;
}

export default function ForecastChart({ data, title, quarterLabel }: ForecastChartProps) {
  const { summary, chart } = data;

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted mt-0.5">{quarterLabel}</p>
        </div>
        <div className="text-right bg-surface px-4 py-2 rounded-lg">
          <p className="text-xl font-bold text-primary">{formatDollar(summary.thisQuarter.weightedValue)}</p>
          <p className="text-xs text-text-muted">{summary.thisQuarter.dealCount} deals</p>
        </div>
      </div>
      {chart.data.length > 0 ? (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatDollar}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                width={55}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const total = payload.reduce((sum, entry: any) => sum + (entry.value || 0), 0);
                  return (
                    <div className="bg-white border border-border-light rounded-xl shadow-xl px-4 py-3 min-w-[160px]">
                      <p className="text-sm font-semibold text-text-primary mb-2">{label}</p>
                      <div className="space-y-1.5">
                        {payload.map((entry: any) => {
                          const owner = chart.owners.find(o => `owner_${o.id}` === entry.dataKey);
                          return (
                            <div key={entry.dataKey} className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: entry.fill }}
                              />
                              <span className="text-xs text-text-secondary flex-1">{owner?.name}</span>
                              <span className="text-xs font-semibold text-text-primary">
                                {formatDollar(entry.value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {payload.length > 1 && (
                        <div className="border-t border-border-light mt-2 pt-2 flex justify-between">
                          <span className="text-xs font-medium text-text-secondary">Total</span>
                          <span className="text-xs font-bold text-text-primary">{formatDollar(total)}</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const owner = chart.owners.find(o => `owner_${o.id}` === value);
                  return <span className="text-xs text-text-secondary">{owner?.name || value}</span>;
                }}
                wrapperStyle={{ paddingTop: 16 }}
                iconType="square"
                iconSize={10}
              />
              {chart.owners.map((owner, i) => (
                <Bar
                  key={owner.id}
                  dataKey={`owner_${owner.id}`}
                  stackId="revenue"
                  fill={COLORS[i % COLORS.length]}
                  name={`owner_${owner.id}`}
                  radius={i === chart.owners.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-text-muted text-sm">
          No deals scheduled for this quarter
        </div>
      )}
    </Card>
  );
}
