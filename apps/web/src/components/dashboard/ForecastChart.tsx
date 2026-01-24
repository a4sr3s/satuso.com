import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Card, { CardHeader } from '@/components/ui/Card';
import type { ForecastData } from '@/types';

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface ForecastChartProps {
  data: ForecastData['chart'];
}

export default function ForecastChart({ data }: ForecastChartProps) {
  return (
    <Card>
      <CardHeader title="Revenue Forecast" />
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={60} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const owner = data.owners.find(o => `owner_${o.id}` === name);
                return [formatDollar(value), owner?.name || name];
              }}
              labelFormatter={(label: string) => `Month: ${label}`}
            />
            <Legend
              formatter={(value: string) => {
                const owner = data.owners.find(o => `owner_${o.id}` === value);
                return owner?.name || value;
              }}
            />
            {data.owners.map((owner, i) => (
              <Bar
                key={owner.id}
                dataKey={`owner_${owner.id}`}
                stackId="revenue"
                fill={COLORS[i % COLORS.length]}
                name={`owner_${owner.id}`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
