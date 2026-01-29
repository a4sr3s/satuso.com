import { useState, useEffect } from 'react';
import { useUser, useClerk, useOrganization, useOrganizationList } from '@clerk/clerk-react';
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
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { organizationsApi, billingApi, integrationsApi, type Integration } from '@/lib/api';
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
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, className: 'text-red-500' },
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

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <section>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Profile</h3>
            <p className="text-sm text-gray-500 mt-0.5">Your personal information visible to your team</p>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} isLoading={isSaving} size="sm">
              Save Changes
            </Button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="relative">
              <img
                src={user.imageUrl}
                alt={user.fullName || 'Profile'}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-gray-100"
              />
              <button
                onClick={() => openUserProfile()}
                className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
                title="Change photo"
              >
                <Camera className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="flex-1 space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700 flex-1">{primaryEmail}</span>
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  Primary
                </span>
                <button
                  onClick={() => openUserProfile()}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Preferences Section */}
      <section>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">Preferences</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customize your experience</p>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Globe className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Language</p>
              <p className="text-xs text-gray-500">Choose your preferred language</p>
            </div>
          </div>
          <div className="flex gap-2">
            {Object.values(LANGUAGES).map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as LanguageCode)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                  currentLang === lang.code
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Security Section */}
      <section>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">Security</h3>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account security</p>
        </div>

        <button
          onClick={() => openUserProfile()}
          className="w-full flex items-center justify-between py-3 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
              <Shield className="h-4 w-4 text-gray-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Password & Security</p>
              <p className="text-xs text-gray-500">Update password, enable 2FA</p>
            </div>
          </div>
          <span className="text-sm text-gray-400 group-hover:text-gray-600 transition-colors">Manage &rarr;</span>
        </button>
      </section>

      <hr className="border-gray-200" />

      {/* Account Actions */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <LogOut className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Sign out</p>
              <p className="text-xs text-gray-500">Sign out of your account on this device</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => signOut({ redirectUrl: '/' })}
          >
            Sign Out
          </Button>
        </div>
      </section>

    </div>
  );
}

function WorkspaceTab() {
  const { user } = useUser();
  const { organization, isLoaded: orgLoaded, memberships, invitations } = useOrganization({
    memberships: { infinite: true },
    invitations: { infinite: true },
  });
  const { userMemberships, setActive, isLoaded: orgListLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { openCreateOrganization } = useClerk();
  const [orgName, setOrgName] = useState('');
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Job functions from our database (Satuso-specific roles)
  const [jobFunctions, setJobFunctions] = useState<Record<string, string | null>>({});
  const [loadingJobFunctions, setLoadingJobFunctions] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org:admin' | 'org:member'>('org:member');
  const [isInviting, setIsInviting] = useState(false);

  // Track which members are being updated
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  // Check if current user is admin
  const currentUserMembership = memberships?.data?.find(
    (m) => m.publicUserData?.userId === user?.id
  );
  const isAdmin = currentUserMembership?.role === 'org:admin';

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
    }
  }, [organization]);

  // Load job functions from our database
  useEffect(() => {
    organizationsApi.getMembers()
      .then((res) => {
        const jfMap: Record<string, string | null> = {};
        res.data.forEach((m: Member) => {
          jfMap[m.email] = m.job_function;
        });
        setJobFunctions(jfMap);
      })
      .catch((err) => console.error('Failed to load job functions:', err))
      .finally(() => setLoadingJobFunctions(false));
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

  // Update Clerk organization role (admin/member)
  const handleOrgRoleChange = async (membershipId: string, newRole: string) => {
    const membership = memberships?.data?.find((m) => m.id === membershipId);
    if (!membership) return;

    setUpdatingRole(membershipId);
    try {
      await membership.update({ role: newRole });
      await memberships?.revalidate?.();
      toast.success('Organization role updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  // Update Satuso job function (stored in our database)
  const handleJobFunctionChange = async (email: string, jobFunction: string) => {
    const prev = jobFunctions[email];
    setJobFunctions((jf) => ({ ...jf, [email]: jobFunction || null }));

    // Find the member ID from our database
    try {
      const res = await organizationsApi.getMembers();
      const member = res.data.find((m: Member) => m.email === email);
      if (member) {
        await organizationsApi.updateMemberRole(member.id, jobFunction);
      }
    } catch {
      setJobFunctions((jf) => ({ ...jf, [email]: prev }));
      toast.error('Failed to update job function');
    }
  };

  // Remove member from organization
  const handleRemoveMember = async (membershipId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this organization?`)) {
      return;
    }

    const membership = memberships?.data?.find((m) => m.id === membershipId);
    if (!membership) return;

    setRemovingMember(membershipId);
    try {
      await membership.destroy();
      await memberships?.revalidate?.();
      toast.success(`${memberName} has been removed`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  // Invite new member
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await organization.inviteMember({
        emailAddress: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      await invitations?.revalidate?.();
      setInviteEmail('');
      toast.success(`Invitation sent to ${inviteEmail}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  // Revoke invitation
  const handleRevokeInvite = async (invitationId: string, email: string) => {
    const invitation = invitations?.data?.find((i) => i.id === invitationId);
    if (!invitation) return;

    setRevokingInvite(invitationId);
    try {
      await invitation.revoke();
      await invitations?.revalidate?.();
      toast.success(`Invitation to ${email} revoked`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    } finally {
      setRevokingInvite(null);
    }
  };

  const handleSwitchToOrg = async (orgId: string) => {
    if (!setActive) return;
    setIsSwitching(true);
    try {
      await setActive({ organization: orgId });
      toast.success('Switched to organization');
    } catch {
      toast.error('Failed to switch organization');
    } finally {
      setIsSwitching(false);
    }
  };

  if (!orgLoaded || !orgListLoaded) {
    return <Card><div className="p-4"><SettingsSkeleton /></div></Card>;
  }

  // User has organizations but none is active - show them and let them switch
  const availableOrgs = userMemberships?.data || [];

  if (!organization) {
    return (
      <Card>
        <CardHeader
          title="Workspace"
          description={availableOrgs.length > 0
            ? "You have organizations available. Select one to manage your team."
            : "You're not part of an organization."
          }
        />
        <div className="px-4 pb-4 space-y-3">
          {availableOrgs.length > 0 ? (
            <>
              <p className="text-sm text-text-muted mb-4">
                Select an organization to switch to:
              </p>
              {availableOrgs.map((membership) => (
                <div
                  key={membership.organization.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-surface transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {membership.organization.imageUrl ? (
                      <img
                        src={membership.organization.imageUrl}
                        alt={membership.organization.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {membership.organization.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {membership.role === 'org:admin' ? 'Admin' : 'Member'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSwitchToOrg(membership.organization.id)}
                    isLoading={isSwitching}
                  >
                    Switch
                  </Button>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted">
                Create or join an organization to collaborate with your team.
              </p>
              <Button onClick={() => openCreateOrganization()}>
                <Building2 className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  const hasOrgChanges = orgName !== (organization.name || '');
  const pendingInvitations = invitations?.data?.filter((i) => i.status === 'pending') || [];

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
            </div>
            <div className="flex-1">
              <Input
                label="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter organization name"
                disabled={!isAdmin}
              />
              {!isAdmin && (
                <p className="text-xs text-text-muted mt-1">Only admins can change the organization name</p>
              )}
            </div>
          </div>

          {hasOrgChanges && isAdmin && (
            <div className="flex justify-end">
              <Button onClick={handleSaveOrg} isLoading={isSavingOrg}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Invite Members */}
      {isAdmin && (
        <Card>
          <CardHeader
            title="Invite Team Members"
            description="Send invitations to add people to your organization."
          />
          <div className="px-4 pb-4">
            <form onSubmit={handleInvite} className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'org:admin' | 'org:member')}
                className="text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="org:member">Member</option>
                <option value="org:admin">Admin</option>
              </select>
              <Button type="submit" isLoading={isInviting}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Invite
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader
            title="Pending Invitations"
            description="Invitations waiting to be accepted."
          />
          <div className="divide-y divide-border">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{invitation.emailAddress}</p>
                    <p className="text-xs text-text-muted">
                      {invitation.role === 'org:admin' ? 'Admin' : 'Member'} · Pending
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRevokeInvite(invitation.id, invitation.emailAddress)}
                    isLoading={revokingInvite === invitation.id}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader
          title="Team Members"
          description="Manage your organization's members, roles, and permissions."
        />
        {!memberships?.data ? (
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
        ) : memberships.data.length === 0 ? (
          <div className="px-4 pb-4 text-center py-8">
            <Users className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">No team members yet</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b border-border text-xs font-medium text-text-muted uppercase tracking-wide">
              <div className="col-span-4">Member</div>
              <div className="col-span-3">Organization Role</div>
              <div className="col-span-3">Job Function</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border">
              {memberships.data.map((membership) => {
                const memberEmail = membership.publicUserData?.identifier || '';
                const memberName = [membership.publicUserData?.firstName, membership.publicUserData?.lastName]
                  .filter(Boolean).join(' ') || memberEmail.split('@')[0];
                const isCurrentUser = membership.publicUserData?.userId === user?.id;
                const memberJobFunction = jobFunctions[memberEmail];

                return (
                  <div key={membership.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center px-4 py-3">
                    {/* Member info */}
                    <div className="sm:col-span-4 flex items-center gap-3 min-w-0">
                      {membership.publicUserData?.imageUrl ? (
                        <img
                          src={membership.publicUserData.imageUrl}
                          alt={memberName}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {memberName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {memberName}
                          {isCurrentUser && <span className="text-xs text-text-muted ml-1">(you)</span>}
                        </p>
                        <p className="text-xs text-text-muted truncate">{memberEmail}</p>
                      </div>
                    </div>

                    {/* Organization Role (Clerk) */}
                    <div className="sm:col-span-3">
                      <label className="text-xs text-text-muted sm:hidden mb-1 block">Org Role</label>
                      {isAdmin && !isCurrentUser ? (
                        <select
                          value={membership.role}
                          onChange={(e) => handleOrgRoleChange(membership.id, e.target.value)}
                          disabled={updatingRole === membership.id}
                          className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        >
                          <option value="org:admin">Admin</option>
                          <option value="org:member">Member</option>
                        </select>
                      ) : (
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                          membership.role === 'org:admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        )}>
                          {membership.role === 'org:admin' ? 'Admin' : 'Member'}
                        </span>
                      )}
                    </div>

                    {/* Job Function (Satuso) */}
                    <div className="sm:col-span-3">
                      <label className="text-xs text-text-muted sm:hidden mb-1 block">Job Function</label>
                      <select
                        value={memberJobFunction || ''}
                        onChange={(e) => handleJobFunctionChange(memberEmail, e.target.value)}
                        disabled={loadingJobFunctions}
                        className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value="">Select function</option>
                        {JOB_FUNCTIONS.map((jf) => (
                          <option key={jf.value} value={jf.value}>{jf.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="sm:col-span-2 flex justify-end">
                      {isAdmin && !isCurrentUser && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRemoveMember(membership.id, memberName)}
                          isLoading={removingMember === membership.id}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {memberships?.hasNextPage && (
              <div className="px-4 py-3 border-t border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => memberships?.fetchNext?.()}
                  className="w-full"
                >
                  Load more members
                </Button>
              </div>
            )}
          </>
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
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDL Configuration state
  const [pdlApiKey, setPdlApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Check if user is admin (only admins can manage integrations)
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Fetch integrations and check admin status
    const fetchData = async () => {
      try {
        const res = await integrationsApi.list();
        setIntegrations(res.data || []);
        setIsAdmin(true); // If the API call succeeds, user is admin
      } catch (err: any) {
        if (err.status === 403) {
          setIsAdmin(false);
          setError(null); // Don't show error for non-admins
        } else {
          setError(err.message || 'Failed to load integrations');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pdlIntegration = integrations.find(i => i.provider === 'peopledatalabs');
  const isPdlConnected = pdlIntegration?.has_api_key === 1 && pdlIntegration?.enabled === 1;

  const handleSavePdl = async () => {
    if (!pdlApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsSaving(true);
    try {
      await integrationsApi.upsert({
        provider: 'peopledatalabs',
        api_key: pdlApiKey,
        enabled: true,
      });
      toast.success('People Data Labs integration saved');
      // Refresh integrations
      const res = await integrationsApi.list();
      setIntegrations(res.data || []);
      setIsEditing(false);
      setPdlApiKey('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save integration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPdl = async () => {
    setIsTesting(true);
    try {
      const res = await integrationsApi.test('peopledatalabs');
      toast.success(res.data?.message || 'Connection successful');
    } catch (err: any) {
      toast.error(err.message || 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisablePdl = async () => {
    try {
      await integrationsApi.update('peopledatalabs', { enabled: false });
      toast.success('Integration disabled');
      const res = await integrationsApi.list();
      setIntegrations(res.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable integration');
    }
  };

  const handleEnablePdl = async () => {
    try {
      await integrationsApi.update('peopledatalabs', { enabled: true });
      toast.success('Integration enabled');
      const res = await integrationsApi.list();
      setIntegrations(res.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to enable integration');
    }
  };

  const handleDeletePdl = async () => {
    if (!confirm('Are you sure you want to remove this integration? This will delete your API key.')) {
      return;
    }
    try {
      await integrationsApi.delete('peopledatalabs');
      toast.success('Integration removed');
      const res = await integrationsApi.list();
      setIntegrations(res.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove integration');
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-48 bg-gray-200 rounded" />
            <div className="h-20 bg-gray-100 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader
          title="Integrations"
          description="Connect third-party services to enhance your CRM."
        />
        <div className="px-4 pb-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Admin Access Required</p>
                <p className="text-sm text-yellow-600 mt-1">
                  Only organization admins can manage integrations. Contact your admin to set up integrations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="Integrations" />
        <div className="px-4 pb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Enrichment Category */}
      <Card>
        <CardHeader
          title="Data Enrichment"
          description="Automatically enrich contact and company data with third-party services."
        />
        <div className="divide-y divide-border">
          {/* People Data Labs */}
          <div className="px-4 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-border p-1.5">
                  <img src="/logos/pdl.png" alt="People Data Labs" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">People Data Labs</p>
                    {isPdlConnected && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" />
                        Connected
                      </span>
                    )}
                    {pdlIntegration?.has_api_key === 1 && pdlIntegration?.enabled === 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Enrich contacts and companies with B2B data including job titles, company info, and more.
                  </p>
                  <a
                    href="https://www.peopledatalabs.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    Learn more <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {!pdlIntegration?.has_api_key && !isEditing && (
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Connect
                </Button>
              )}
            </div>

            {/* Configuration Form */}
            {(isEditing || (!isPdlConnected && pdlIntegration?.has_api_key)) && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={pdlApiKey}
                      onChange={(e) => setPdlApiKey(e.target.value)}
                      placeholder="Enter your People Data Labs API key"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Get your API key from the{' '}
                    <a
                      href="https://dashboard.peopledatalabs.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      People Data Labs dashboard
                    </a>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSavePdl}
                    isLoading={isSaving}
                    disabled={!pdlApiKey.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setPdlApiKey('');
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Connected State Actions */}
            {isPdlConnected && !isEditing && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleTestPdl}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  Update Key
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDisablePdl}
                >
                  Disable
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-red-600 hover:bg-red-50"
                  onClick={handleDeletePdl}
                >
                  Remove
                </Button>
              </div>
            )}

            {/* Disabled State Actions */}
            {pdlIntegration?.has_api_key === 1 && pdlIntegration?.enabled === 0 && !isEditing && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleEnablePdl}
                >
                  Enable
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  Update Key
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-red-600 hover:bg-red-50"
                  onClick={handleDeletePdl}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Other Integrations - Coming Soon */}
      <Card>
        <CardHeader
          title="More Integrations"
          description="Additional integrations coming soon."
        />
        <div className="divide-y divide-border">
          {INTEGRATIONS.filter(i => !['clay', 'clearbit', 'apollo'].includes(i.id)).map((integration) => (
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
    </div>
  );
}

function DangerZoneTab() {
  const { signOut } = useClerk();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || !deletePassword) return;

    setIsDeleting(true);
    try {
      await organizationsApi.deleteAccount(deletePassword);
      toast.success('Account deleted successfully');
      // Sign out and redirect
      await signOut({ redirectUrl: '/' });
    } catch (error: any) {
      console.error('Delete account error:', error);
      const message = error?.message || 'Failed to delete account';
      toast.error(message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Warning: Irreversible Actions</h3>
            <p className="text-sm text-red-600 mt-1">
              Actions on this page cannot be undone. Please proceed with caution.
            </p>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">Delete Account</h3>
          <p className="text-sm text-gray-500 mt-0.5">Permanently remove your account and all associated data</p>
        </div>

        <div className="flex items-center justify-between py-4 px-4 border border-red-200 bg-red-50/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Delete your account</p>
              <p className="text-xs text-gray-500">This will permanently delete all your data</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="border-red-300 text-red-600 hover:bg-red-100 hover:border-red-400"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete Account
          </Button>
        </div>
      </section>

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
                  Enter your password to confirm
                </label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  disabled={isDeleting}
                />
              </div>

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
                    setDeletePassword('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || !deletePassword || isDeleting}
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('account');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isDanger = tab.id === 'danger';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? isDanger ? 'text-red-600' : 'text-primary'
                  : isDanger ? 'text-red-400 hover:text-red-600' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <span className={clsx(
                  'absolute bottom-0 left-0 right-0 h-0.5 rounded-full',
                  isDanger ? 'bg-red-600' : 'bg-primary'
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="max-w-3xl">
        {activeTab === 'account' && (
          <Card>
            <div className="p-6">
              <AccountTab />
            </div>
          </Card>
        )}
        {activeTab === 'workspace' && <WorkspaceTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'danger' && (
          <Card>
            <div className="p-6">
              <DangerZoneTab />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
