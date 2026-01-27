import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  Building2,
  User,
  Edit,
  Plus,
  Sparkles,
  Phone,
  Mail,
  FileText,
  Users,
  UserPlus,
  X,
  Wrench,
  Crown,
  HeadphonesIcon,
  CheckCircle,
  Circle,
  ListTodo,
  Trash2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { dealsApi, activitiesApi, aiApi, companiesApi, contactsApi, tasksApi } from '@/lib/api';
import type { ActivityType, DealTeamMember, DealTeamRole, TaskPriority } from '@/types';
import Button from '@/components/ui/Button';
import Card, { CardHeader } from '@/components/ui/Card';
import { StageBadge, PriorityBadge } from '@/components/ui/Badge';
import { SpinPanel } from '@/components/ui/SpinProgress';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';

const stages = ['lead', 'qualified', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const roleLabels: Record<DealTeamRole, string> = {
  owner: 'Owner',
  technical: 'Technical (SE/SA)',
  executive_sponsor: 'Executive Sponsor',
  support: 'Support',
};

const roleIcons: Record<DealTeamRole, React.ElementType> = {
  owner: Crown,
  technical: Wrench,
  executive_sponsor: User,
  support: HeadphonesIcon,
};

const roleToJobFunctions: Record<DealTeamRole, string> = {
  owner: 'ae',
  technical: 'se,sa',
  executive_sponsor: 'manager,executive',
  support: 'csm',
};

const jobFunctionLabels: Record<string, string> = {
  ae: 'Account Executive',
  se: 'Solutions Engineer',
  sa: 'Solutions Architect',
  csm: 'CSM',
  manager: 'Manager',
  executive: 'Executive',
};

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showSpinModal, setShowSpinModal] = useState<string | null>(null);
  const [spinText, setSpinText] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAssignSEModal, setShowAssignSEModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingStageMove, setPendingStageMove] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<DealTeamRole>('owner');
  const [confirmStageMove, setConfirmStageMove] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    value: '',
    close_date: '',
    stage: '',
    company_id: '',
  });
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    subject: '',
    content: '',
    due_date: '',
    priority: 'medium' as TaskPriority,
  });
  const [activityForm, setActivityForm] = useState<{
    type: ActivityType;
    subject: string;
    content: string;
  }>({
    type: 'note',
    subject: '',
    content: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['deals', id],
    queryFn: () => dealsApi.get(id!),
    enabled: !!id,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['ai', 'spin-suggestions', id],
    queryFn: () => aiApi.spinSuggestions(id),
    enabled: !!id,
  });

  const { data: teamData } = useQuery({
    queryKey: ['deals', id, 'team'],
    queryFn: () => dealsApi.getTeam(id!),
    enabled: !!id,
  });

  const { data: availableUsersData } = useQuery({
    queryKey: ['deals', id, 'team', 'available', selectedRole],
    queryFn: () => dealsApi.getAvailableUsers(id!, {
      role: selectedRole,
      job_function: roleToJobFunctions[selectedRole],
    }),
    enabled: !!id && (showTeamModal || showAssignSEModal),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.list(),
    enabled: showEditModal,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { company_id: editForm.company_id }],
    queryFn: () => contactsApi.list(editForm.company_id ? { company_id: editForm.company_id } : {}),
    enabled: showEditModal,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { deal_id: id }],
    queryFn: () => tasksApi.list({ deal_id: id!, limit: '50' }),
    enabled: !!id,
  });

  const deal = data?.data;
  const spinSuggestions = suggestions?.data;
  const team = teamData?.data || [];
  const availableUsers = availableUsersData?.data || [];
  const companies = companiesData?.data?.items || [];
  const contacts = contactsData?.data?.items || [];
  const dealTasks = tasksData?.data?.items || [];

  const updateMutation = useMutation({
    mutationFn: (data: any) => dealsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
      setShowSpinModal(null);
      setSpinText('');
      toast.success('Deal updated');
    },
  });

  const moveMutation = useMutation({
    mutationFn: (stage: string) => dealsApi.move(id!, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
      queryClient.invalidateQueries({ queryKey: ['deals', 'pipeline'] });
      toast.success('Deal stage updated');
      setPendingStageMove(null);
    },
  });

  const addTeamMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: DealTeamRole }) =>
      dealsApi.addTeamMember(id!, { user_id: userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id, 'team'] });
      queryClient.invalidateQueries({ queryKey: ['deals', id, 'team', 'available'] });
      toast.success('Team member added');
      setShowTeamModal(false);
      if (showAssignSEModal) {
        setShowAssignSEModal(false);
        // Complete the pending stage move
        if (pendingStageMove) {
          moveMutation.mutate(pendingStageMove);
        }
      }
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: (memberId: string) => dealsApi.removeTeamMember(id!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id, 'team'] });
      queryClient.invalidateQueries({ queryKey: ['deals', id, 'team', 'available'] });
      toast.success('Team member removed');
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: activitiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
      setShowActivityModal(false);
      setActivityForm({ type: 'note', subject: '', content: '' });
      toast.success('Activity logged');
    },
  });

  const extractSpinMutation = useMutation({
    mutationFn: () => aiApi.extractSpin(activityForm.content, id),
    onSuccess: (data) => {
      if (data.data) {
        const insights = data.data;
        const hasInsights =
          insights.situation?.length ||
          insights.problem?.length ||
          insights.implication?.length ||
          insights.needPayoff?.length;

        if (hasInsights) {
          toast.success('SPIN insights extracted!');
          queryClient.invalidateQueries({ queryKey: ['deals', id] });
        }
      }
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', { deal_id: id }] });
      setShowTaskModal(false);
      setTaskForm({ subject: '', content: '', due_date: '', priority: 'medium' });
      toast.success('Task created');
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: tasksApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', { deal_id: id }] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => dealsApi.delete(id!),
    onSuccess: () => {
      toast.success('Deal deleted');
      navigate('/deals');
    },
    onError: () => {
      toast.error('Failed to delete deal');
    },
  });

  const addContactMutation = useMutation({
    mutationFn: (contactId: string) => dealsApi.addContact(id!, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: string) => dealsApi.removeContact(id!, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Deal not found</p>
        <Button variant="ghost" onClick={() => navigate('/deals')} className="mt-4">
          Go back to deals
        </Button>
      </div>
    );
  }

  const currentStageIndex = stages.indexOf(deal.stage);
  const isClosed = ['closed_won', 'closed_lost'].includes(deal.stage);
  const hasTechnicalResource = team.some((m: DealTeamMember) => m.role === 'technical');

  const handleStageMove = (newStage: string) => {
    // If moving to discovery and no SE assigned, prompt to assign one
    if (newStage === 'discovery' && !hasTechnicalResource) {
      setPendingStageMove(newStage);
      setSelectedRole('technical');
      setShowAssignSEModal(true);
      return;
    }

    // Check if skipping more than 1 stage forward or moving backward
    const newStageIndex = stages.indexOf(newStage);
    const isSkippingForward = newStageIndex > currentStageIndex + 1;
    const isMovingBackward = newStageIndex < currentStageIndex;

    if (isSkippingForward || isMovingBackward) {
      setConfirmStageMove(newStage);
    } else {
      moveMutation.mutate(newStage);
    }
  };

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

  const handleSaveSpin = () => {
    const fieldMap: Record<string, string> = {
      situation: 'spinSituation',
      problem: 'spinProblem',
      implication: 'spinImplication',
      needPayoff: 'spinNeedPayoff',
    };

    if (showSpinModal && spinText) {
      updateMutation.mutate({ [fieldMap[showSpinModal]]: spinText });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/deals')}
          className="p-2 hover:bg-surface rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-text-muted" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">{deal.name}</h1>
            <StageBadge stage={deal.stage} />
          </div>
          <p className="text-text-secondary">
            {deal.company_name || 'No company'}
            {deal.contacts && deal.contacts.length > 0 && ` · ${deal.contacts.map((c: any) => c.name).join(', ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowActivityModal(true)}>
            <Plus className="h-4 w-4" />
            Log Activity
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEditForm({
                name: deal.name || '',
                value: deal.value?.toString() || '',
                close_date: deal.close_date || '',
                stage: deal.stage || '',
                company_id: deal.company_id || '',
              });
              setSelectedContactIds(deal.contacts?.map((c: any) => c.id) || []);
              setShowEditModal(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stage Progress */}
      {!isClosed && (
        <div className="flex items-center gap-2">
          {stages.slice(0, 5).map((stage, index) => {
            const isActive = index === currentStageIndex;
            const isCompleted = index < currentStageIndex;

            return (
              <button
                key={stage}
                onClick={() => handleStageMove(stage)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : isCompleted
                    ? 'bg-green-100 text-green-800'
                    : 'bg-surface text-text-muted hover:bg-gray-200'
                }`}
              >
                {stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')}
              </button>
            );
          })}
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => handleStageMove('closed_won')}
              className="px-4 py-2 text-sm font-medium bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
            >
              Won
            </button>
            <button
              onClick={() => handleStageMove('closed_lost')}
              className="px-4 py-2 text-sm font-medium bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
            >
              Lost
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Deal Info + Team */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Deal Information" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Value</span>
              <span className="text-lg font-semibold text-primary flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {(deal.value || 0).toLocaleString()}
              </span>
            </div>
            {deal.close_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Close Date</span>
                <span className="text-sm text-text-primary flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-text-muted" />
                  {format(new Date(deal.close_date), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {deal.company_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Company</span>
                <button
                  onClick={() => navigate(`/companies/${deal.company_id}`)}
                  className="text-sm text-primary hover:underline flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  {deal.company_name}
                </button>
              </div>
            )}
            {deal.contacts && deal.contacts.length > 0 && (
              <div className="flex items-start justify-between">
                <span className="text-sm text-text-secondary">Contacts</span>
                <div className="flex flex-col items-end gap-1">
                  {deal.contacts.map((contact: any) => (
                    <button
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="text-sm text-primary hover:underline flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      {contact.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Days in Stage</span>
              <span className={`text-sm ${deal.days_in_stage > 14 ? 'text-warning' : 'text-text-primary'}`}>
                {deal.days_in_stage || 0} {(deal.days_in_stage || 0) === 1 ? 'day' : 'days'}
              </span>
            </div>
            {deal.ai_score && (
              <div className="pt-3 border-t border-border-light">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-text-primary">AI Win Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${deal.ai_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-primary">{deal.ai_score}%</span>
                </div>
                {deal.ai_score_reason && (
                  <p className="text-xs text-text-muted mt-1">{deal.ai_score_reason}</p>
                )}
              </div>
            )}
          </div>
        </Card>

          {/* Deal Team */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">Deal Team</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowTeamModal(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {team.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                No team members assigned.
              </p>
            ) : (
              <div className="space-y-2">
                {team.map((member: DealTeamMember) => {
                  const RoleIcon = roleIcons[member.role];
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 bg-surface rounded-lg group"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={member.user_name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{member.user_name}</p>
                          <div className="flex items-center gap-1">
                            <RoleIcon className="h-3 w-3 text-text-muted" />
                            <span className="text-xs text-text-muted">
                              {roleLabels[member.role]}
                              {member.job_function && ` · ${jobFunctionLabels[member.job_function] || member.job_function}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeTeamMemberMutation.mutate(member.id)}
                        className="p-1 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* SPIN Discovery */}
        <Card>
          <SpinPanel
            situation={deal.spin_situation}
            problem={deal.spin_problem}
            implication={deal.spin_implication}
            needPayoff={deal.spin_need_payoff}
            suggestions={spinSuggestions}
            onEdit={(field) => {
              setShowSpinModal(field);
              const fieldMap = {
                situation: 'spin_situation',
                problem: 'spin_problem',
                implication: 'spin_implication',
                needPayoff: 'spin_need_payoff',
              } as const;
              const dealField = fieldMap[field];
              setSpinText(deal[dealField] || '');
            }}
          />
        </Card>

        {/* Right Column: Activity Timeline + Tasks */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Activity Timeline" />
            <div className="space-y-4">
              {(!deal.activities || deal.activities.length === 0) ? (
                <p className="text-sm text-text-muted text-center py-8">
                  No activities yet. Log your first interaction!
                </p>
              ) : (
                deal.activities.slice(0, 10).map((activity: any) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-text-primary">
                            {activity.subject || activity.type}
                          </p>
                          <span className="text-xs text-text-muted">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {activity.content && (
                          <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                            {activity.content}
                          </p>
                        )}
                        {activity.spin_tags && (() => {
                          try {
                            const tags = JSON.parse(activity.spin_tags);
                            return (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map((tag: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded"
                                  >
                                    {tag.category?.[0]?.toUpperCase()}: {tag.text?.slice(0, 20)}...
                                  </span>
                                ))}
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Tasks */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">Tasks</h3>
                {dealTasks.length > 0 && (
                  <span className="text-xs text-text-muted">
                    ({dealTasks.filter((t: any) => !t.completed).length} pending)
                  </span>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowTaskModal(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {dealTasks.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                No tasks yet.
              </p>
            ) : (
              <div className="space-y-2">
                {dealTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-2 p-2 rounded-lg hover:bg-surface transition-colors ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <button
                      onClick={() => toggleTaskMutation.mutate(task.id)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 text-text-muted hover:text-primary" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${task.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                          {task.subject}
                        </span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      {task.due_date && (
                        <span className="text-xs text-text-muted flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Team Member Modal */}
      <Modal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        title="Add Team Member"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as DealTeamRole)}
              className="input"
            >
              <option value="owner">Owner (AE)</option>
              <option value="technical">Technical (SE/SA)</option>
              <option value="executive_sponsor">Executive Sponsor</option>
              <option value="support">Support</option>
            </select>
          </div>

          <div>
            <label className="label">Select User</label>
            {availableUsers.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No available users for this role.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addTeamMemberMutation.mutate({ userId: user.id, role: selectedRole })}
                    className="w-full flex items-center gap-3 p-3 bg-surface hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <Avatar name={user.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="text-xs text-text-muted">
                        {user.job_function && (
                          <span className="text-blue-600 font-medium">{jobFunctionLabels[user.job_function] || user.job_function}</span>
                        )}
                        {user.job_function && ' · '}
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowTeamModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign SE Modal (prompted when moving to Discovery) */}
      <Modal
        isOpen={showAssignSEModal}
        onClose={() => {
          setShowAssignSEModal(false);
          setPendingStageMove(null);
        }}
        title="Assign Technical Resource"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
            <Wrench className="h-5 w-5 text-cyan-600" />
            <div>
              <p className="text-sm font-medium text-cyan-800">Moving to Discovery</p>
              <p className="text-xs text-cyan-600">
                Assign a Solutions Engineer or Architect to support technical validation.
              </p>
            </div>
          </div>

          {availableUsers.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">
              No available technical resources.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => addTeamMemberMutation.mutate({ userId: user.id, role: 'technical' })}
                  className="w-full flex items-center gap-3 p-3 bg-surface hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  <Avatar name={user.name} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{user.name}</p>
                    <p className="text-xs text-text-muted">
                      {user.job_function && (
                        <span className="text-blue-600 font-medium">{jobFunctionLabels[user.job_function] || user.job_function}</span>
                      )}
                      {user.job_function && ' · '}
                      {user.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border-light">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAssignSEModal(false);
                if (pendingStageMove) {
                  moveMutation.mutate(pendingStageMove);
                }
              }}
            >
              Skip for now
            </Button>
            <Button variant="secondary" onClick={() => {
              setShowAssignSEModal(false);
              setPendingStageMove(null);
            }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Log Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Log Activity"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activityForm.subject.trim() || !activityForm.content.trim()) {
              toast.error('Please fill in all required fields');
              return;
            }
            await createActivityMutation.mutateAsync({
              ...activityForm,
              deal_id: id,
            });
            // Extract SPIN insights from content
            if (activityForm.content.length > 50) {
              extractSpinMutation.mutate();
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Type</label>
            <select
              value={activityForm.type}
              onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })}
              className="input"
            >
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </select>
          </div>
          <Input
            label="Subject"
            value={activityForm.subject}
            onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
            placeholder="Brief description"
            required
          />
          <div>
            <label className="label">Notes</label>
            <textarea
              value={activityForm.content}
              onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
              className="input min-h-[120px]"
              placeholder="What happened? AI will automatically extract SPIN insights from your notes."
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Sparkles className="h-3 w-3" />
            AI will analyze your notes and extract SPIN selling insights automatically.
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowActivityModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createActivityMutation.isPending}>
              Log Activity
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit SPIN Modal */}
      <Modal
        isOpen={!!showSpinModal}
        onClose={() => {
          setShowSpinModal(null);
          setSpinText('');
        }}
        title={`Edit ${showSpinModal?.charAt(0).toUpperCase()}${showSpinModal?.slice(1) || ''}`}
      >
        <div className="space-y-4">
          <textarea
            value={spinText}
            onChange={(e) => setSpinText(e.target.value)}
            className="input min-h-[150px]"
            placeholder={`Enter ${showSpinModal} insights...`}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowSpinModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSpin} isLoading={updateMutation.isPending}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Deal Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Deal"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // Update deal info
            await updateMutation.mutateAsync({
              name: editForm.name,
              value: editForm.value ? parseFloat(editForm.value) : undefined,
              close_date: editForm.close_date || undefined,
              stage: editForm.stage || undefined,
              company_id: editForm.company_id || undefined,
            });

            // Sync contacts - determine what to add and remove
            const currentContactIds = deal.contacts?.map((c: any) => c.id) || [];
            const contactsToAdd = selectedContactIds.filter(id => !currentContactIds.includes(id));
            const contactsToRemove = currentContactIds.filter((id: string) => !selectedContactIds.includes(id));

            // Add new contacts
            for (const contactId of contactsToAdd) {
              await addContactMutation.mutateAsync(contactId);
            }

            // Remove contacts
            for (const contactId of contactsToRemove) {
              await removeContactMutation.mutateAsync(contactId);
            }

            setShowEditModal(false);
          }}
          className="space-y-4"
        >
          <Input
            label="Deal Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
          <Input
            label="Value"
            type="number"
            value={editForm.value}
            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
            placeholder="50000"
          />
          <div>
            <label className="label">Stage</label>
            <select
              value={editForm.stage}
              onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
              className="input"
            >
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Company</label>
            <select
              value={editForm.company_id}
              onChange={(e) => {
                setEditForm({ ...editForm, company_id: e.target.value });
                // Clear selected contacts when company changes
                setSelectedContactIds([]);
              }}
              className="input"
            >
              <option value="">No company</option>
              {companies.map((company: any) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              Contacts
              {!editForm.company_id && (
                <span className="text-xs text-text-muted font-normal ml-2">
                  (Select a company first)
                </span>
              )}
            </label>
            {editForm.company_id ? (
              contacts.length === 0 ? (
                <p className="text-sm text-text-muted py-2">
                  No contacts found for this company.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-border-light rounded-lg p-2">
                  {contacts.map((contact: any) => {
                    const isSelected = selectedContactIds.includes(contact.id);
                    return (
                      <label
                        key={contact.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary-light' : 'hover:bg-surface'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedContactIds([...selectedContactIds, contact.id]);
                            } else {
                              setSelectedContactIds(selectedContactIds.filter(id => id !== contact.id));
                            }
                          }}
                          className="rounded border-border-light text-primary focus:ring-primary"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">{contact.name}</p>
                          {contact.email && (
                            <p className="text-xs text-text-muted">{contact.email}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )
            ) : (
              <p className="text-sm text-text-muted py-2 border border-border-light rounded-lg p-2">
                Select a company to see available contacts.
              </p>
            )}
          </div>
          <Input
            label="Expected Close Date"
            type="date"
            value={editForm.close_date}
            onChange={(e) => setEditForm({ ...editForm, close_date: e.target.value })}
          />
          <div className="flex justify-between pt-4 border-t border-border-light">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setShowDeleteConfirm(true);
              }}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-error transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Create Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Add Task"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTaskMutation.mutate({
              subject: taskForm.subject,
              content: taskForm.content || undefined,
              due_date: taskForm.due_date || undefined,
              priority: taskForm.priority,
              deal_id: id,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Task"
            placeholder="What needs to be done?"
            value={taskForm.subject}
            onChange={(e) => setTaskForm({ ...taskForm, subject: e.target.value })}
            required
          />
          <div>
            <label className="label">Description</label>
            <textarea
              value={taskForm.content}
              onChange={(e) => setTaskForm({ ...taskForm, content: e.target.value })}
              className="input min-h-[80px]"
              placeholder="Optional details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={taskForm.due_date}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
            />
            <div>
              <label className="label">Priority</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
                className="input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createTaskMutation.isPending}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stage Move Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmStageMove}
        onClose={() => setConfirmStageMove(null)}
        onConfirm={() => {
          if (confirmStageMove) {
            moveMutation.mutate(confirmStageMove);
            setConfirmStageMove(null);
          }
        }}
        title="Confirm Stage Change"
        message={`Are you sure you want to move this deal from ${deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1).replace('_', ' ')} to ${confirmStageMove ? confirmStageMove.charAt(0).toUpperCase() + confirmStageMove.slice(1).replace('_', ' ') : ''}?`}
        confirmLabel="Move"
        isLoading={moveMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteMutation.mutate();
        }}
        title="Delete Deal"
        message={`Are you sure you want to delete "${deal.name}"? This action cannot be undone and will remove all associated activities and team assignments.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
