import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { dashboardApi, aiApi } from '@/lib/api';
import MetricCard from '@/components/ui/MetricCard';
import Card, { CardHeader } from '@/components/ui/Card';
import { StageBadge } from '@/components/ui/Badge';
import SpinProgress from '@/components/ui/SpinProgress';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: metrics } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => dashboardApi.metrics(),
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardApi.activity(10),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['dashboard', 'pipeline'],
    queryFn: () => dashboardApi.pipeline(),
  });

  const { data: atRisk } = useQuery({
    queryKey: ['dashboard', 'at-risk'],
    queryFn: () => dashboardApi.atRisk(),
  });

  const { data: insights } = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => aiApi.insights(),
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return Phone;
      case 'email':
        return Mail;
      case 'meeting':
        return Calendar;
      default:
        return FileText;
    }
  };

  const metricsData = metrics?.data;
  const activityData = activity?.data || [];
  const pipelineData = pipeline?.data || [];
  const atRiskData = atRisk?.data || [];
  const insightsData = insights?.data || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary">Welcome back! Here's your sales overview.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Revenue (This Month)"
          value={metricsData?.totalRevenue?.value || 0}
          change={metricsData?.totalRevenue?.change}
          changeDirection={metricsData?.totalRevenue?.changeDirection}
          sparklineData={metricsData?.totalRevenue?.sparklineData}
          format="currency"
        />
        <MetricCard
          title="Active Deals"
          value={metricsData?.activeDeals?.value || 0}
          change={metricsData?.activeDeals?.change}
          changeDirection={metricsData?.activeDeals?.changeDirection}
        />
        <MetricCard
          title="Conversion Rate"
          value={metricsData?.conversionRate?.value || 0}
          change={metricsData?.conversionRate?.change}
          changeDirection={metricsData?.conversionRate?.changeDirection}
          format="percent"
        />
        <MetricCard
          title="Tasks Due Today"
          value={metricsData?.tasksDueToday?.value || 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent Activity"
              action={
                <button
                  onClick={() => navigate('/tasks')}
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </button>
              }
            />
            <div className="space-y-4">
              {activityData.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No recent activity
                </p>
              ) : (
                activityData.slice(0, 6).map((item: any) => {
                  const Icon = getActivityIcon(item.type);
                  const isClickable = !!item.deal_id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => item.deal_id && navigate(`/deals/${item.deal_id}`)}
                      disabled={!isClickable}
                      className={`w-full flex items-start gap-3 text-left p-2 -mx-2 rounded-lg transition-colors ${
                        isClickable ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary">
                          <span className="font-medium">{item.owner_name || 'Someone'}</span>
                          {' '}
                          {item.type === 'call' && 'logged a call'}
                          {item.type === 'email' && 'sent an email'}
                          {item.type === 'meeting' && 'scheduled a meeting'}
                          {item.type === 'note' && 'added a note'}
                          {item.type === 'task' && 'created a task'}
                          {!item.type && 'had activity'}
                          {item.deal_name && (
                            <>
                              {' for '}
                              <span className="font-medium text-primary">{item.deal_name}</span>
                            </>
                          )}
                        </p>
                        {item.subject && (
                          <p className="text-sm text-text-secondary truncate">{item.subject}</p>
                        )}
                        <p className="text-xs text-text-muted mt-0.5">
                          {item.created_at
                            ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                            : 'Recently'}
                        </p>
                      </div>
                      {isClickable && (
                        <ArrowRight className="h-4 w-4 text-text-muted flex-shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Insights */}
        <Card>
          <CardHeader
            title="Insights"
            action={
              <Lightbulb className="h-4 w-4 text-text-muted" />
            }
          />
          <div className="space-y-3">
            {insightsData.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No insights yet
              </p>
            ) : (
              insightsData.slice(0, 3).map((insight: any, index: number) => (
                <button
                  key={index}
                  onClick={() => insight.deal_id && navigate(`/deals/${insight.deal_id}`)}
                  className="w-full p-3 bg-surface rounded-lg border border-border-light hover:border-primary hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-start gap-2">
                    {insight.type === 'risk' ? (
                      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                    ) : (
                      <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{insight.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{insight.description}</p>
                      {insight.deal_id && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                          <span>View deal</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Summary */}
        <Card>
          <CardHeader
            title="Pipeline Summary"
            action={
              <button
                onClick={() => navigate('/deals')}
                className="text-sm text-primary hover:underline"
              >
                View pipeline
              </button>
            }
          />
          <div className="space-y-3">
            {pipelineData.map((stage: any) => (
              <div key={stage.stage} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StageBadge stage={stage.stage} />
                  <span className="text-sm text-text-secondary">
                    {stage.count} deals
                  </span>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  ${(stage.totalValue || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* At Risk Deals */}
        <Card>
          <CardHeader
            title="Deals Needing Attention"
            action={
              <span className="text-xs text-warning bg-yellow-50 px-2 py-1 rounded">
                {atRiskData.length} at risk
              </span>
            }
          />
          <div className="space-y-3">
            {atRiskData.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                All deals are on track!
              </p>
            ) : (
              atRiskData.slice(0, 4).map((deal: any) => (
                <button
                  key={deal.id}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                  className="w-full flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {deal.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {deal.company_name} · ${deal.value?.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SpinProgress
                      situation={deal.spin_situation}
                      problem={deal.spin_problem}
                      implication={deal.spin_implication}
                      needPayoff={deal.spin_need_payoff}
                      size="sm"
                    />
                    {deal.days_in_stage > 14 && (
                      <span className="text-xs text-warning">
                        {deal.days_in_stage}d
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
