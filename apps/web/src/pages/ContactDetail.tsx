import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Building2, Linkedin, Edit, Plus, Trash2, Twitter, Github, Globe, MapPin } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { contactsApi, activitiesApi, companiesApi } from '@/lib/api';
import type { ActivityType } from '@/types';
import Button from '@/components/ui/Button';
import Card, { CardHeader } from '@/components/ui/Card';
import { StageBadge } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useState } from 'react';
import { EnrichButton, EnrichContactModal } from '@/components/EnrichModal';

function ensureUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEnrichModal, setShowEnrichModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', id],
    queryFn: () => contactsApi.get(id!),
    enabled: !!id,
  });

  const contact = data?.data;

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    title: string;
    linkedin_url: string;
    twitter_url: string;
    github_url: string;
    facebook_url: string;
    location: string;
    company_id: string | undefined;
  }>({
    name: '',
    email: '',
    phone: '',
    title: '',
    linkedin_url: '',
    twitter_url: '',
    github_url: '',
    facebook_url: '',
    location: '',
    company_id: '',
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

  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.list({ limit: '100' }),
    enabled: showEditModal,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => contactsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
      setShowEditModal(false);
      toast.success('Contact updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update contact');
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: activitiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
      setShowActivityModal(false);
      setActivityForm({ type: 'note', subject: '', content: '' });
      toast.success('Activity logged');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(id!),
    onSuccess: () => {
      toast.success('Contact deleted');
      navigate('/contacts');
    },
    onError: () => {
      toast.error('Failed to delete contact');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Contact not found</p>
        <Button variant="ghost" onClick={() => navigate('/contacts')} className="mt-4">
          Go back to contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/contacts')}
          className="p-2 hover:bg-surface rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-text-muted" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Avatar name={contact.name} size="lg" />
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{contact.name}</h1>
              <p className="text-text-secondary">
                {contact.title} {contact.company_name && `at ${contact.company_name}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EnrichButton onClick={() => setShowEnrichModal(true)} />
          <Button
            variant="secondary"
            onClick={() => {
              setFormData({
                name: contact.name,
                email: contact.email || '',
                phone: contact.phone || '',
                title: contact.title || '',
                linkedin_url: contact.linkedin_url || '',
                twitter_url: contact.twitter_url || '',
                github_url: contact.github_url || '',
                facebook_url: contact.facebook_url || '',
                location: contact.location || '',
                company_id: contact.company_id || '',
              });
              setShowEditModal(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button onClick={() => setShowActivityModal(true)}>
            <Plus className="h-4 w-4" />
            Log Activity
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader title="Contact Information" />
          <div className="space-y-4">
            {contact.email && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Email</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Phone</span>
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.company_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Company</span>
                <button
                  onClick={() => navigate(`/companies/${contact.company_id}`)}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Building2 className="h-4 w-4" />
                  {contact.company_name}
                </button>
              </div>
            )}
            {contact.linkedin_url && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">LinkedIn</span>
                <a
                  href={ensureUrl(contact.linkedin_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Linkedin className="h-4 w-4" />
                  Profile
                </a>
              </div>
            )}
            {contact.twitter_url && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Twitter</span>
                <a
                  href={ensureUrl(contact.twitter_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Twitter className="h-4 w-4" />
                  Profile
                </a>
              </div>
            )}
            {contact.github_url && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">GitHub</span>
                <a
                  href={ensureUrl(contact.github_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Github className="h-4 w-4" />
                  Profile
                </a>
              </div>
            )}
            {contact.facebook_url && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Facebook</span>
                <a
                  href={ensureUrl(contact.facebook_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  Profile
                </a>
              </div>
            )}
            {contact.location && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Location</span>
                <span className="flex items-center gap-2 text-sm text-text-primary">
                  <MapPin className="h-4 w-4 text-text-muted" />
                  {contact.location}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Last Contacted</span>
              <span className="text-sm text-text-primary">
                {contact.last_contacted_at
                  ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
                  : 'Never'}
              </span>
            </div>
          </div>
        </Card>

        {/* Activity Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Activity Timeline" />
            <div className="space-y-4">
              {(!contact.activities || contact.activities.length === 0) ? (
                <p className="text-sm text-text-muted text-center py-8">
                  No activities yet. Log your first interaction!
                </p>
              ) : (
                contact.activities.map((activity: any) => (
                  <div key={activity.id} className="flex gap-3 pb-4 border-b border-border-light last:border-0">
                    <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-text-muted uppercase">
                        {activity.type[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">
                          {activity.subject || activity.type}
                        </p>
                        <span className="text-xs text-text-muted">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {activity.content && (
                        <p className="text-sm text-text-secondary mt-1">{activity.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Related Deals */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              title="Related Deals"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/deals?new=true&contactId=${id}`)}
                >
                  <Plus className="h-4 w-4" />
                  Add Deal
                </Button>
              }
            />
            {(!contact.deals || contact.deals.length === 0) ? (
              <p className="text-sm text-text-muted text-center py-8">
                No deals associated with this contact.
              </p>
            ) : (
              <div className="space-y-3">
                {contact.deals.map((deal: any) => (
                  <button
                    key={deal.id}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{deal.name}</p>
                      <p className="text-xs text-text-muted">
                        ${deal.value?.toLocaleString()}
                        {deal.close_date && ` · Close: ${format(new Date(deal.close_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <StageBadge stage={deal.stage} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Contact"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(formData);
          }}
          className="space-y-4"
        >
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Job Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <Input
            label="LinkedIn URL"
            value={formData.linkedin_url}
            onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
            placeholder="https://linkedin.com/in/username"
          />
          <Input
            label="Twitter URL"
            value={formData.twitter_url}
            onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
            placeholder="https://twitter.com/username"
          />
          <Input
            label="GitHub URL"
            value={formData.github_url}
            onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
            placeholder="https://github.com/username"
          />
          <Input
            label="Facebook URL"
            value={formData.facebook_url}
            onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
            placeholder="https://facebook.com/username"
          />
          <Input
            label="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="City, State/Region, Country"
          />
          <div>
            <label className="label">Company</label>
            <select
              value={formData.company_id || ''}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value || undefined })}
              className="input"
            >
              <option value="">No company</option>
              {(companiesData?.data?.items || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Contact"
        message={`Are you sure you want to delete "${contact.name}"? This will not delete associated deals, but they will no longer be linked to this contact.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Log Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Log Activity"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createActivityMutation.mutate({
              ...activityForm,
              contact_id: id,
            });
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
          />
          <div>
            <label className="label">Notes</label>
            <textarea
              value={activityForm.content}
              onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
              className="input min-h-[100px]"
              placeholder="What happened during this interaction?"
            />
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

      {/* Enrich Modal */}
      <EnrichContactModal
        isOpen={showEnrichModal}
        onClose={() => setShowEnrichModal(false)}
        contact={{
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          linkedin_url: contact.linkedin_url,
          company_id: contact.company_id,
        }}
        companyName={contact.company_name}
        onApply={(updates) => {
          updateMutation.mutate(updates);
          toast.success('Contact enriched');
        }}
      />
    </div>
  );
}
