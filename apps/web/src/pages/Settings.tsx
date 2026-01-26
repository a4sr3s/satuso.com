import { useState, useEffect } from 'react';
import { useUser, useClerk, useOrganization } from '@clerk/clerk-react';
import {
  Camera,
  Mail,
  Shield,
  LogOut,
  Building2,
  UserPlus,
  Globe,
  Users,
  CreditCard,
  Puzzle,
  Check,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { organizationsApi, billingApi } from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';
import { LANGUAGES, type LanguageCode } from '@/i18n/config';
import { useLocaleStore } from '@/stores/locale';

const JOB_FUNCTIONS = [
  { value: 'ae', label: 'Account Executive' },
  { value: 'se', label: 'Solutions Engineer' },
  { value: 'sa', label: 'Solutions Architect' },
  { value: 'csm', label: 'CSM' },
  { value: 'manager', label: 'Manager' },
  { value: 'executive', label: 'Executive' },
] as const;

const TABS = [
  { id: 'account', label: 'Account', icon: Users },
  { id: 'workspace', label: 'Workspace', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
] as const;

type TabId = typeof TABS[number]['id'];

const INTEGRATIONS = [
  {
    id: 'clay',
    name: 'Clay',
    description: 'Enrich contacts and companies with Clay data',
    icon: <img src="/integrations/clay.png" alt="Clay" className="h-6 w-6 object-contain" />,
    category: 'Data Enrichment',
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    description: 'Import leads and sync contact data',
    icon: <img src="/integrations/apollo.jpeg" alt="Apollo.io" className="h-6 w-6 object-contain" />,
    category: 'Data Enrichment',
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    description: 'Real-time company and contact enrichment',
    icon: <img src="/integrations/clearbit.png" alt="Clearbit" className="h-6 w-6 object-contain" />,
    category: 'Data Enrichment',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5,000+ apps via automations',
    icon: <img src="/integrations/zapier.jpeg" alt="Zapier" className="h-6 w-6 object-contain" />,
    category: 'Automation',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get deal updates and notifications in Slack',
    icon: <img src="/integrations/slack.jpeg" alt="Slack" className="h-6 w-6 object-contain" />,
    category: 'Communication',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings and schedule follow-ups',
    icon: <img src="/integrations/google-calendar.png" alt="Google Calendar" className="h-6 w-6 object-contain" />,
    category: 'Productivity',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Track emails and log communications',
    icon: <img src="/integrations/gmail.png" alt="Gmail" className="h-6 w-6 object-contain" />,
    category: 'Productivity',
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

// Skeleton loader component for consistency
function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-48 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

function AccountTab() {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { language, setLanguage } = useLocaleStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const currentLang = LANGUAGES[language] ? language : 'en';

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
  }, [user]);

  if (!isLoaded || !user) {
    return <Card><div className="p-4"><SettingsSkeleton /></div></Card>;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update Clerk profile
      await user.update({ firstName, lastName });
      // Sync name to database
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
      await organizationsApi.updateProfile({ name: fullName });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = firstName !== (user.firstName || '') || lastName !== (user.lastName || '');
  const primaryEmail = user.primaryEmailAddress?.emailAddress;

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      await organizationsApi.deleteAccount();
      toast.success('Account deleted successfully');
      // Sign out and redirect
      await signOut({ redirectUrl: '/' });
    } catch (error) {
      toast.error('Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader
          title="Profile"
          description="Your personal information visible to your team."
        />
        <div className="px-4 pb-4 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user.imageUrl}
                alt={user.fullName || 'Profile'}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
              />
              <button
                onClick={() => openUserProfile()}
                className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full border border-border shadow-sm hover:bg-gray-50 transition-colors"
                title="Change photo"
              >
                <Camera className="h-3.5 w-3.5 text-text-muted" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{user.fullName || 'No name set'}</p>
              <p className="text-xs text-text-muted">Click camera to update photo</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter first name"
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter last name"
            />
          </div>

          {hasChanges && (
            <div className="flex justify-end">
              <Button onClick={handleSave} isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader
          title="Email"
          description="Your primary email for notifications and sign-in."
        />
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-primary">{primaryEmail}</span>
              <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                Primary
              </span>
            </div>
            <button
              onClick={() => openUserProfile()}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              Manage
            </button>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader
          title="Preferences"
          description="Customize your experience."
        />
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-primary">Language</span>
            </div>
            <div className="flex gap-2">
              {Object.values(LANGUAGES).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code as LanguageCode)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                    currentLang === lang.code
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-primary border-border hover:border-gray-300'
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                  {currentLang === lang.code && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Security & Account Actions */}
      <Card>
        <CardHeader
          title="Security"
          description="Manage your password and account access."
        />
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={() => openUserProfile()}
            className="w-full flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-primary">Password & Security</span>
            </div>
            <span className="text-xs text-text-muted">Manage →</span>
          </button>

          <div className="pt-3 mt-3 border-t border-border">
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="w-full flex items-center justify-between p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sign out</span>
              </div>
            </button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardHeader
          title="Danger Zone"
          description="Irreversible and destructive actions."
        />
        <div className="px-4 pb-4">
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800">Delete Account</h4>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 border-red-300 text-red-600 hover:bg-red-100"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This will permanently delete your account and all your data, including:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Your profile and settings</li>
                <li>All contacts, companies, and deals you created</li>
                <li>All tasks and activities</li>
                <li>Your organization (if you're the only member)</li>
              </ul>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  disabled={isDeleting}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  isLoading={isDeleting}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceTab() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { openOrganizationProfile } = useClerk();
  const [orgName, setOrgName] = useState('');
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
    }
  }, [organization]);

  useEffect(() => {
    organizationsApi.getMembers()
      .then((res) => setMembers(res.data))
      .catch((err) => setMembersError(err.message || 'Failed to load team members'))
      .finally(() => setLoadingMembers(false));
  }, []);

  const handleSaveOrg = async () => {
    if (!organization) return;
    setIsSavingOrg(true);
    try {
      await organization.update({ name: orgName });
      toast.success('Organization updated');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleRoleChange = async (memberId: string, jobFunction: string) => {
    const prev = members;
    setMembers((m) =>
      m.map((member) => member.id === memberId ? { ...member, job_function: jobFunction || null } : member)
    );
    try {
      await organizationsApi.updateMemberRole(memberId, jobFunction);
    } catch {
      setMembers(prev);
      toast.error('Failed to update role');
    }
  };

  if (!orgLoaded) {
    return <Card><div className="p-4"><SettingsSkeleton /></div></Card>;
  }

  if (!organization) {
    return (
      <Card>
        <CardHeader
          title="Workspace"
          description="You're not part of an organization."
        />
        <div className="px-4 pb-4">
          <p className="text-sm text-text-muted">
            Create or join an organization to collaborate with your team.
          </p>
        </div>
      </Card>
    );
  }

  const hasOrgChanges = orgName !== (organization.name || '');

  return (
    <div className="space-y-6">
      {/* Organization */}
      <Card>
        <CardHeader
          title="Organization"
          description="Your shared workspace settings."
        />
        <div className="px-4 pb-4 space-y-5">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              {organization.imageUrl ? (
                <img
                  src={organization.imageUrl}
                  alt={organization.name}
                  className="w-14 h-14 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
              )}
              <button
                onClick={() => openOrganizationProfile()}
                className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full border border-border shadow-sm hover:bg-gray-50 transition-colors"
                title="Change logo"
              >
                <Camera className="h-3 w-3 text-text-muted" />
              </button>
            </div>
            <div className="flex-1">
              <Input
                label="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
          </div>

          {hasOrgChanges && (
            <div className="flex justify-end">
              <Button onClick={handleSaveOrg} isLoading={isSavingOrg}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader
          title="Team Members"
          description="People in your organization."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openOrganizationProfile()}
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Invite
            </Button>
          }
        />
        {loadingMembers ? (
          <div className="px-4 pb-4">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-200 rounded-full" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-28 bg-gray-200 rounded" />
                      <div className="h-3 w-40 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="h-8 w-36 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : membersError ? (
          <div className="px-4 pb-4">
            <p className="text-sm text-red-600">{membersError}</p>
          </div>
        ) : members.length === 0 ? (
          <div className="px-4 pb-4 text-center py-8">
            <Users className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">No team members yet</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => openOrganizationProfile()}
            >
              Invite your first teammate
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                    <p className="text-xs text-text-muted truncate">{member.email}</p>
                  </div>
                </div>
                <select
                  value={member.job_function || ''}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select role</option>
                  {JOB_FUNCTIONS.map((jf) => (
                    <option key={jf.value} value={jf.value}>{jf.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BillingTab() {
  const { status, isInTrial, trialDaysRemaining } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await billingApi.createPortalSession();
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch {
      toast.error('Failed to open billing portal');
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await billingApi.createCheckoutSession();
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch {
      toast.error('Failed to start checkout');
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (isInTrial) {
      return {
        className: 'bg-blue-100 text-blue-700',
        label: `Trial - ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left`,
      };
    }
    if (status === 'active') {
      return { className: 'bg-green-100 text-green-700', label: 'Active' };
    }
    if (status === 'past_due') {
      return { className: 'bg-yellow-100 text-yellow-700', label: 'Past Due' };
    }
    if (status === 'canceled') {
      return { className: 'bg-gray-100 text-gray-600', label: 'Canceled' };
    }
    return { className: 'bg-gray-100 text-gray-600', label: 'Inactive' };
  };

  const badge = getStatusBadge();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Subscription"
          description="Your current plan and billing information."
        />
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Standard Plan</p>
                <p className="text-xs text-text-muted">$29 per user / month</p>
              </div>
            </div>
            <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full', badge.className)}>
              {badge.label}
            </span>
          </div>

          {isInTrial ? (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Your free trial ends in <strong>{trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}</strong>.
                  Subscribe now to continue using all features.
                </p>
              </div>
              <Button
                onClick={handleSubscribe}
                isLoading={loading}
                className="w-full"
              >
                Subscribe Now
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={handleManageBilling}
              isLoading={loading}
              className="w-full"
            >
              Manage Billing & Invoices
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function IntegrationsTab() {
  // Group integrations by category
  const categories = INTEGRATIONS.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, typeof INTEGRATIONS>);

  return (
    <div className="space-y-6">
      {Object.entries(categories).map(([category, integrations]) => (
        <Card key={category}>
          <CardHeader
            title={category}
            description={`Connect your ${category.toLowerCase()} tools.`}
          />
          <div className="divide-y divide-border">
            {integrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-border">
                    {integration.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{integration.name}</p>
                    <p className="text-xs text-text-muted">{integration.description}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-text-muted bg-gray-100 px-3 py-1.5 rounded-full">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('account');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl">
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'workspace' && <WorkspaceTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}
