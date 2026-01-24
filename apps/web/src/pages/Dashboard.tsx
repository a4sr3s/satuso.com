import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { dashboardApi, aiApi, tasksApi } from '@/lib/api';
import MetricCard from '@/components/ui/MetricCard';
import Card, { CardHeader } from '@/components/ui/Card';
import ForecastChart from '@/components/dashboard/ForecastChart';
import { StageBadge } from '@/components/ui/Badge';
import SpinProgress from '@/components/ui/SpinProgress';
import { useLocale } from '@/hooks/useLocale';

export default function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { formatRelativeDate } = useLocale();
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

  const { data: taskCounts } = useQuery({
    queryKey: ['tasks', 'counts'],
    queryFn: () => tasksApi.counts(),
  });

  const { data: forecast } = useQuery({
    queryKey: ['dashboard', 'forecast'],
    queryFn: () => dashboardApi.forecast(),
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

  const getActivityText = (type: string) => {
    switch (type) {
      case 'call':
        return t('dashboard:activity.loggedCall');
      case 'email':
        return t('dashboard:activity.sentEmail');
      case 'meeting':
        return t('dashboard:activity.scheduledMeeting');
      case 'note':
        return t('dashboard:activity.addedNote');
      case 'task':
        return t('dashboard:activity.createdTask');
      default:
        return t('dashboard:activity.hadActivity');
    }
  };

  const cleanInsightText = (text: string) => {
    return text.replace(/\[([^\]]+)\]/g, (_, match) => match.replace(/_/g, ' '));
  };

  const metricsData = metrics?.data;
  const forecastData = forecast?.data;
  const activityData = activity?.data || [];
  const pipelineData = pipeline?.data || [];
  const atRiskData = atRisk?.data || [];
  const insightsData = insights?.data || [];

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('dashboard:metrics.revenueThisMonth')}
          value={metricsData?.totalRevenue?.value || 0}
          change={metricsData?.totalRevenue?.change}
          changeDirection={metricsData?.totalRevenue?.changeDirection}
          sparklineData={metricsData?.totalRevenue?.sparklineData}
          format="currency"
        />
        <MetricCard
          title={t('dashboard:metrics.activeDeals')}
          value={metricsData?.activeDeals?.value || 0}
          change={metricsData?.activeDeals?.change}
          changeDirection={metricsData?.activeDeals?.changeDirection}
        />
        <MetricCard
          title={t('dashboard:metrics.conversionRate')}
          value={metricsData?.conversionRate?.value || 0}
          change={metricsData?.conversionRate?.change}
          changeDirection={metricsData?.conversionRate?.changeDirection}
          format="percent"
        />
        <MetricCard
          title={t('dashboard:metrics.tasksDueToday')}
          value={metricsData?.tasksDueToday?.value || 0}
        />
        {(taskCounts?.data?.overdue ?? 0) > 0 && (
          <div className="col-span-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">
                {taskCounts!.data!.overdue} overdue {taskCounts!.data!.overdue === 1 ? 'task' : 'tasks'}
              </p>
              <p className="text-xs text-red-600">Review and update your pending tasks</p>
            </div>
            <button onClick={() => navigate('/tasks')} className="ml-auto text-sm text-red-700 hover:underline font-medium">
              View Tasks
            </button>
          </div>
        )}
      </div>

      {/* Forecast Section */}
      {forecastData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="Closing Next Month"
              value={forecastData.summary.nextMonth.weightedValue}
              format="currency"
            />
            <MetricCard
              title="Closing Next Quarter"
              value={forecastData.summary.nextQuarter.weightedValue}
              format="currency"
            />
          </div>
          {forecastData.chart.data.length > 0 && (
            <ForecastChart data={forecastData.chart} />
          )}
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={t('dashboard:activity.title')}
              action={
                <button
                  onClick={() => navigate('/tasks')}
                  className="text-sm text-primary hover:underline"
                >
                  {t('common:buttons.viewAll')}
                </button>
              }
            />
            <div className="space-y-4">
              {activityData.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  {t('dashboard:activity.noActivity')}
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
                          {getActivityText(item.type)}
                          {item.deal_name && (
                            <>
                              {' '}{t('dashboard:activity.for')}{' '}
                              <span className="font-medium text-primary">{item.deal_name}</span>
                            </>
                          )}
                        </p>
                        {item.subject && (
                          <p className="text-sm text-text-secondary truncate">{item.subject}</p>
                        )}
                        <p className="text-xs text-text-muted mt-0.5">
                          {item.created_at
                            ? formatRelativeDate(item.created_at)
                            : t('common:time.recently')}
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
            title={t('dashboard:insights.title')}
            action={
              <Lightbulb className="h-4 w-4 text-text-muted" />
            }
          />
          <div className="space-y-3">
            {insightsData.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                {t('dashboard:insights.noInsights')}
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
                      <p className="text-sm font-medium text-text-primary">{cleanInsightText(insight.title)}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{cleanInsightText(insight.description)}</p>
                      {insight.deal_id && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                          <span>{t('dashboard:insights.viewDeal')}</span>
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
            title={t('dashboard:pipeline.title')}
            action={
              <button
                onClick={() => navigate('/deals')}
                className="text-sm text-primary hover:underline"
              >
                {t('dashboard:pipeline.viewPipeline')}
              </button>
            }
          />
          <div className="space-y-3">
            {pipelineData.map((stage: any) => (
              <div key={stage.stage} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StageBadge stage={stage.stage} />
                  <span className="text-sm text-text-secondary">
                    {stage.count} {t('dashboard:pipeline.deals')}
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
            title={t('dashboard:atRisk.title')}
            action={
              <span className="text-xs text-warning bg-yellow-50 px-2 py-1 rounded">
                {atRiskData.length} {t('dashboard:atRisk.atRisk')}
              </span>
            }
          />
          <div className="space-y-3">
            {atRiskData.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                {t('dashboard:atRisk.allOnTrack')}
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
