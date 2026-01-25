import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '@clerk/clerk-react';
import Card, { CardHeader } from '@/components/ui/Card';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { organizationsApi, billingApi } from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';

const JOB_FUNCTIONS = [
  { value: 'ae', label: 'Account Executive' },
  { value: 'se', label: 'Solutions Engineer' },
  { value: 'sa', label: 'Solutions Architect' },
  { value: 'csm', label: 'CSM' },
  { value: 'manager', label: 'Manager' },
  { value: 'executive', label: 'Executive' },
] as const;

const TABS = ['Profile', 'General', 'Billing', 'Integrations'] as const;
type Tab = typeof TABS[number];

const INTEGRATIONS = [
  {
    id: 'clay',
    name: 'Clay',
    descriptionKey: 'settings:integrationDescriptions.clay',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#FF6B35"/>
        <path d="M7 12h10M12 7v10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    categoryKey: 'settings:categories.dataEnrichment',
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    descriptionKey: 'settings:integrationDescriptions.apollo',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#5C5CFF"/>
        <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2"/>
        <circle cx="12" cy="12" r="2" fill="white"/>
      </svg>
    ),
    categoryKey: 'settings:categories.dataEnrichment',
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    descriptionKey: 'settings:integrationDescriptions.clearbit',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#3B82F6"/>
        <path d="M6 12l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    categoryKey: 'settings:categories.dataEnrichment',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    descriptionKey: 'settings:integrationDescriptions.zapier',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#FF4A00"/>
        <path d="M12 6v12M6 12h12M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    categoryKey: 'settings:categories.automation',
  },
  {
    id: 'slack',
    name: 'Slack',
    descriptionKey: 'settings:integrationDescriptions.slack',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#4A154B"/>
        <path d="M9 11a2 2 0 11-4 0 2 2 0 014 0zM9 11v3a2 2 0 01-2 2M9 11h3a2 2 0 012 2v0a2 2 0 01-2 2h-1" stroke="#E01E5A" strokeWidth="1.5"/>
        <path d="M15 13a2 2 0 104 0 2 2 0 00-4 0zM15 13v-3a2 2 0 012-2M15 13h-3a2 2 0 01-2-2v0a2 2 0 012-2h1" stroke="#36C5F0" strokeWidth="1.5"/>
      </svg>
    ),
    categoryKey: 'settings:categories.communication',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    descriptionKey: 'settings:integrationDescriptions.googleCalendar',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#4285F4"/>
        <rect x="6" y="6" width="12" height="12" rx="1" stroke="white" strokeWidth="1.5"/>
        <path d="M6 10h12" stroke="white" strokeWidth="1.5"/>
        <path d="M10 6v4M14 6v4" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),
    categoryKey: 'settings:categories.productivity',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    descriptionKey: 'settings:integrationDescriptions.gmail',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect width="24" height="24" rx="4" fill="#EA4335"/>
        <path d="M6 8l6 4 6-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="5" y="7" width="14" height="10" rx="1" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),
    categoryKey: 'settings:categories.productivity',
  },
];

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
  job_function: string | null;
}

function BillingTab() {
  const { status } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await billingApi.createPortalSession();
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Subscription"
        description="Manage your subscription and billing details."
      />
      <div className="px-4 pb-4 space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-text-primary">Standard Plan</p>
            <p className="text-xs text-text-muted mt-0.5">$29/month</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            status === 'active'
              ? 'bg-green-100 text-green-700'
              : status === 'past_due'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {status === 'active' ? 'Active' : status === 'past_due' ? 'Past Due' : status === 'canceled' ? 'Canceled' : 'Inactive'}
          </span>
        </div>
        <button
          onClick={handleManageBilling}
          disabled={loading}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? 'Opening portal...' : 'Manage Billing'}
        </button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common']);
  const [activeTab, setActiveTab] = useState<Tab>('Profile');
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  useEffect(() => {
    organizationsApi.getMembers()
      .then((res) => setMembers(res.data))
      .catch((err) => setMembersError(err.message || 'Failed to load team members'))
      .finally(() => setLoadingMembers(false));
  }, []);

  const handleRoleChange = async (memberId: string, jobFunction: string) => {
    const prev = members;
    setMembers((m) =>
      m.map((member) => member.id === memberId ? { ...member, job_function: jobFunction || null } : member)
    );
    try {
      await organizationsApi.updateMemberRole(memberId, jobFunction);
    } catch {
      setMembers(prev);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'Profile' && (
        <Card>
          <CardHeader
            title="Your Profile"
            description="Manage your personal account settings."
          />
          <div className="px-4 pb-4">
            <UserProfile
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none p-0',
                  navbar: 'hidden',
                  pageScrollBox: 'p-0',
                },
              }}
            />
          </div>
        </Card>
      )}

      {/* General Tab */}
      {activeTab === 'General' && (
        <div className="space-y-6">
          {/* Team */}
          <Card>
            <CardHeader
              title="Team"
              description="Manage your team members and their roles."
            />
            {loadingMembers ? (
              <div className="px-4 pb-4">
                <div className="animate-pulse space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                        <div className="h-3 w-48 bg-gray-100 rounded" />
                      </div>
                      <div className="h-8 w-40 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : membersError ? (
              <div className="px-4 pb-4">
                <p className="text-sm text-red-600">{membersError}</p>
              </div>
            ) : members.length === 0 ? (
              <div className="px-4 pb-4">
                <p className="text-sm text-text-muted">No team members found.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium shrink-0">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                        <p className="text-xs text-text-muted truncate">{member.email}</p>
                      </div>
                    </div>
                    <select
                      value={member.job_function || ''}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className="text-sm border border-border rounded-md px-2 py-1.5 bg-surface text-text-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M3%205l3%203%203-3%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
                    >
                      <option value="">No role</option>
                      {JOB_FUNCTIONS.map((jf) => (
                        <option key={jf.value} value={jf.value}>{jf.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Language */}
          <Card>
            <CardHeader
              title={t('settings:language.title')}
              description={t('settings:language.description')}
            />
            <LanguageSwitcher variant="settings" />
          </Card>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'Billing' && <BillingTab />}

      {/* Integrations Tab */}
      {activeTab === 'Integrations' && (
        <Card>
          <CardHeader
            title={t('settings:integrations.title')}
            description={t('settings:integrations.description')}
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
                        {t(integration.categoryKey)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{t(integration.descriptionKey)}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-text-muted bg-gray-100 px-3 py-1.5 rounded-full">
                  {t('settings:integrations.comingSoon')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
