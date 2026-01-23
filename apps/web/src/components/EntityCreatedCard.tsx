import { CheckCircle, ExternalLink, Building2, User, Handshake } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EntityCreatedCardProps {
  entityType: 'contact' | 'company' | 'deal';
  entity: {
    id: string;
    name: string;
    [key: string]: any;
  };
}

const entityIcons = {
  contact: User,
  company: Building2,
  deal: Handshake,
};

const entityLabels = {
  contact: 'Contact',
  company: 'Company',
  deal: 'Deal',
};

function getEntityUrl(entityType: string, id: string): string {
  switch (entityType) {
    case 'contact': return `/contacts/${id}`;
    case 'company': return `/companies/${id}`;
    case 'deal': return `/deals/${id}`;
    default: return '/';
  }
}

export default function EntityCreatedCard({ entityType, entity }: EntityCreatedCardProps) {
  const Icon = entityIcons[entityType];
  const url = getEntityUrl(entityType, entity.id);

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-800">
          {entityLabels[entityType]} Created
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-primary mb-2">
        <Icon className="h-3.5 w-3.5 text-text-muted" />
        <span className="font-medium">{entity.name}</span>
      </div>

      <Link
        to={url}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
      >
        View {entityLabels[entityType]}
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
