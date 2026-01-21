import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { workboardsApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import WorkboardContainer from '@/components/workboards/WorkboardContainer';

export default function WorkboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: workboardData, isLoading: loadingWorkboard } = useQuery({
    queryKey: ['workboard', id],
    queryFn: () => workboardsApi.get(id!),
    enabled: !!id,
  });

  if (loadingWorkboard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/workboards')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="bg-white border border-border rounded-lg p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const workboard = workboardData?.data;

  if (!workboard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/workboards')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Workboard Not Found</h1>
          </div>
        </div>
        <div className="bg-white border border-border rounded-lg p-8 text-center">
          <p className="text-text-secondary">This workboard does not exist or you don't have access to it.</p>
          <Button className="mt-4" onClick={() => navigate('/workboards')}>
            Back to Workboards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/workboards')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{workboard.name}</h1>
          {workboard.description && (
            <p className="text-text-secondary">{workboard.description}</p>
          )}
        </div>
      </div>

      {/* Workboard Content */}
      <WorkboardContainer workboard={workboard} />
    </div>
  );
}
