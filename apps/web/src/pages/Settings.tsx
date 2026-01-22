import Card, { CardHeader } from '@/components/ui/Card';

const INTEGRATIONS = [
  {
    id: 'clay',
    name: 'Clay',
    description: 'Enrich contacts & automate prospecting workflows',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#FF6B35"/>
        <path d="M7 12h10M12 7v10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    category: 'Data Enrichment',
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    description: 'Sales intelligence & prospecting database',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#5C5CFF"/>
        <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2"/>
        <circle cx="12" cy="12" r="2" fill="white"/>
      </svg>
    ),
    category: 'Data Enrichment',
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    description: 'Real-time company & contact enrichment',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#3B82F6"/>
        <path d="M6 12l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    category: 'Data Enrichment',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect to 5,000+ apps with automated workflows',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#FF4A00"/>
        <path d="M12 6v12M6 12h12M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    category: 'Automation',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get deal alerts & updates in your channels',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#4A154B"/>
        <path d="M9 11a2 2 0 11-4 0 2 2 0 014 0zM9 11v3a2 2 0 01-2 2M9 11h3a2 2 0 012 2v0a2 2 0 01-2 2h-1" stroke="#E01E5A" strokeWidth="1.5"/>
        <path d="M15 13a2 2 0 104 0 2 2 0 00-4 0zM15 13v-3a2 2 0 012-2M15 13h-3a2 2 0 01-2-2v0a2 2 0 012-2h1" stroke="#36C5F0" strokeWidth="1.5"/>
      </svg>
    ),
    category: 'Communication',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings & schedule follow-ups',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#4285F4"/>
        <rect x="6" y="6" width="12" height="12" rx="1" stroke="white" strokeWidth="1.5"/>
        <path d="M6 10h12" stroke="white" strokeWidth="1.5"/>
        <path d="M10 6v4M14 6v4" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),
    category: 'Productivity',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Log emails & track conversations automatically',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#EA4335"/>
        <path d="M6 8l6 4 6-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="5" y="7" width="14" height="10" rx="1" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),
    category: 'Productivity',
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader
          title="Integrations"
          description="Connect your favorite tools to supercharge your sales workflow"
        />
        <div className="space-y-3">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.id} className="flex items-center justify-between p-4 bg-surface rounded-lg opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border border-border">
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{integration.name}</p>
                    <span className="text-[10px] font-medium text-text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                      {integration.category}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{integration.description}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-text-muted bg-gray-100 px-3 py-1.5 rounded-full">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
