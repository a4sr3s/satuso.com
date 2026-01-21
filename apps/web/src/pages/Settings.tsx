import { useState, useEffect } from 'react';
import { useUser, UserProfile } from '@clerk/clerk-react';
import { organizationsApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card, { CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Tabs from '@/components/ui/Tabs';
import toast from 'react-hot-toast';
import { X, UserPlus, Mail, Crown, Shield, User, Trash2, Clock, CreditCard, Sparkles } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  plan: 'standard' | 'enterprise';
  user_limit: number | null;
  user_count: number;
  owner_id: string;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  invited_by_name: string;
}

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
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('profile');

  // Organization state
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState('');
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'rep'>('rep');
  const [inviting, setInviting] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'organization', label: 'Organization' },
    { id: 'team', label: 'Team' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'notifications', label: 'Notifications' },
  ];

  // Fetch organization data
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await organizationsApi.get();
        if (response.success && response.data) {
          setOrganization(response.data);
          setOrgName(response.data.name);
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      } finally {
        setLoadingOrg(false);
      }
    };
    fetchOrg();
  }, []);

  // Fetch team members and invites when team tab is active
  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeamData();
    }
  }, [activeTab]);

  const fetchTeamData = async () => {
    setLoadingTeam(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        organizationsApi.getMembers(),
        organizationsApi.getInvites(),
      ]);
      if (membersRes.success) {
        setMembers(membersRes.data || []);
      }
      if (invitesRes.success) {
        setPendingInvites(invitesRes.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleSaveOrgName = async () => {
    if (!orgName.trim()) return;
    try {
      await organizationsApi.update({ name: orgName });
      setOrganization(prev => prev ? { ...prev, name: orgName } : null);
      toast.success('Organization name updated');
    } catch (error) {
      toast.error('Failed to update organization name');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const response = await organizationsApi.invite(inviteEmail, inviteRole);
      if (response.success) {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('rep');
        fetchTeamData();
      }
    } catch (error: any) {
      if (error.message?.includes('USER_LIMIT_REACHED') || error.message?.includes('limit')) {
        toast.error('User limit reached. Upgrade to Enterprise for unlimited users.');
      } else {
        toast.error(error.message || 'Failed to send invitation');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await organizationsApi.cancelInvite(inviteId);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      toast.success('Invitation cancelled');
    } catch (error) {
      toast.error('Failed to cancel invitation');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    try {
      await organizationsApi.removeMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Team member removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove team member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-3 h-3" />;
      case 'manager': return <Shield className="w-3 h-3" />;
      default: return <User className="w-3 h-3" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-amber-100 text-amber-700';
      case 'manager': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="text-text-secondary">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <div className="max-w-2xl">
        {activeTab === 'profile' && (
          <div className="[&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-card]:border-border [&_.cl-card]:rounded-xl [&_.cl-navbar]:hidden [&_.cl-pageScrollBox]:p-0 [&_.cl-profilePage]:p-0">
            <UserProfile
              routing="path"
              path="/settings"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none border border-border rounded-xl',
                  navbar: 'hidden',
                  pageScrollBox: 'p-0',
                  page: 'p-0',
                  profilePage: 'p-0',
                  profileSection: 'border-border',
                  profileSectionTitle: 'text-text-primary',
                  profileSectionTitleText: 'text-text-primary font-medium',
                  profileSectionContent: 'text-text-secondary',
                  formButtonPrimary: 'bg-primary hover:bg-primary/90 text-white',
                  formFieldLabel: 'text-text-primary',
                  formFieldInput: 'border-border focus:ring-primary',
                  accordionTriggerButton: 'text-text-primary hover:bg-surface',
                  badge: 'bg-primary/10 text-primary',
                  avatarBox: 'border-2 border-border',
                },
              }}
            />
          </div>
        )}

        {activeTab === 'organization' && (
          <div className="space-y-6">
            {/* Organization Info */}
            <Card>
              <CardHeader
                title="Organization Details"
                description="Manage your organization settings"
              />
              {loadingOrg ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-10 bg-surface rounded"></div>
                  <div className="h-10 bg-surface rounded w-1/2"></div>
                </div>
              ) : organization ? (
                <div className="space-y-4">
                  <Input
                    label="Organization Name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSaveOrgName}>Save Changes</Button>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted">No organization found</p>
              )}
            </Card>

            {/* Plan & Usage */}
            <Card>
              <CardHeader title="Plan & Usage" />
              {loadingOrg ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-6 bg-surface rounded w-1/3"></div>
                  <div className="h-4 bg-surface rounded w-1/2"></div>
                </div>
              ) : organization ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${organization.plan === 'enterprise' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                      {organization.plan === 'enterprise' ? (
                        <Sparkles className={`w-5 h-5 ${organization.plan === 'enterprise' ? 'text-purple-600' : 'text-blue-600'}`} />
                      ) : (
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary capitalize">
                        {organization.plan} Plan
                      </p>
                      <p className="text-sm text-text-muted">
                        {organization.plan === 'standard' ? '$29/month' : 'Custom pricing'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-secondary">Team members</span>
                      <span className="text-sm font-medium text-text-primary">
                        {organization.user_count} / {organization.user_limit || '∞'}
                      </span>
                    </div>
                    {organization.user_limit && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            organization.user_count >= organization.user_limit
                              ? 'bg-red-500'
                              : organization.user_count >= organization.user_limit * 0.8
                                ? 'bg-amber-500'
                                : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min((organization.user_count / organization.user_limit) * 100, 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>

                  {organization.plan === 'standard' && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-100">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-text-primary">Upgrade to Enterprise</p>
                          <p className="text-sm text-text-secondary mt-1">
                            Get unlimited team members, priority support, and advanced features.
                          </p>
                          <Button size="sm" className="mt-3">
                            <a href="mailto:hello@satuso.com">Contact Sales</a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Team Members */}
            <Card>
              <CardHeader
                title="Team Members"
                description={organization ? `${organization.user_count} of ${organization.user_limit || '∞'} seats used` : 'Manage who has access to your CRM'}
                action={
                  <Button size="sm" onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Invite Member
                  </Button>
                }
              />
              {loadingTeam ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-surface rounded-lg">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} size="md" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{member.name}</p>
                          <p className="text-xs text-text-muted">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded capitalize ${getRoleBadgeColor(member.role)}`}>
                          {getRoleIcon(member.role)}
                          {member.role}
                        </span>
                        {member.email !== user?.primaryEmailAddress?.emailAddress && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <Card>
                <CardHeader
                  title="Pending Invitations"
                  description="Invitations waiting to be accepted"
                />
                <div className="space-y-3">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{invite.email}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires {new Date(invite.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded capitalize ${getRoleBadgeColor(invite.role)}`}>
                          {getRoleIcon(invite.role)}
                          {invite.role}
                        </span>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Available Integrations"
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
        )}

        {activeTab === 'notifications' && (
          <Card>
            <CardHeader title="Email Notifications" />
            <div className="space-y-4">
              {[
                { id: 'deals', label: 'Deal updates', description: 'When deals move stages or close' },
                { id: 'tasks', label: 'Task reminders', description: 'Daily digest of upcoming tasks' },
                { id: 'ai', label: 'AI insights', description: 'Weekly AI-powered recommendations' },
                { id: 'mentions', label: 'Mentions', description: 'When someone mentions you' },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'admin', label: 'Admin', icon: Crown, desc: 'Full access' },
                    { value: 'manager', label: 'Manager', icon: Shield, desc: 'Can manage team' },
                    { value: 'rep', label: 'Rep', icon: User, desc: 'Standard access' },
                  ].map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setInviteRole(role.value as any)}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        inviteRole === role.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-gray-300'
                      }`}
                    >
                      <role.icon className={`w-5 h-5 mx-auto mb-1 ${
                        inviteRole === role.value ? 'text-primary' : 'text-text-muted'
                      }`} />
                      <p className="text-sm font-medium text-text-primary">{role.label}</p>
                      <p className="text-xs text-text-muted">{role.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {organization && organization.user_limit && organization.user_count >= organization.user_limit && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    You've reached your team limit ({organization.user_limit} users).
                    Upgrade to Enterprise for unlimited team members.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
