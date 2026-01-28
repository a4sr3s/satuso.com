import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Globe, Edit, Plus, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { companiesApi, contactsApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Card, { CardHeader } from '@/components/ui/Card';
import { StageBadge, StatusBadge } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import SpinProgress from '@/components/ui/SpinProgress';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { EnrichButton, EnrichCompanyModal, FindContactsModal } from '@/components/EnrichModal';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEnrichModal, setShowEnrichModal] = useState(false);
  const [showFindContactsModal, setShowFindContactsModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', title: '' });
  const [editForm, setEditForm] = useState({
    name: '',
    industry: '',
    employee_count: '',
    website: '',
    description: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', id],
    queryFn: () => companiesApi.get(id!),
    enabled: !!id,
  });

  const company = data?.data;

  const updateMutation = useMutation({
    mutationFn: (data: any) => companiesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', id] });
      setShowEditModal(false);
      toast.success('Company updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update company');
    },
  });

  const createContactMutation = useMutation({
    mutationFn: (data: any) => contactsApi.create({ ...data, company_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', id] });
      setShowAddContactModal(false);
      setContactForm({ name: '', email: '', phone: '', title: '' });
      toast.success('Contact created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => companiesApi.delete(id!),
    onSuccess: () => {
      toast.success('Company deleted');
      navigate('/companies');
    },
    onError: () => {
      toast.error('Failed to delete company');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Company not found</p>
        <Button variant="ghost" onClick={() => navigate('/companies')} className="mt-4">
          Go back to companies
        </Button>
      </div>
    );
  }

  const totalDealValue = company.deals?.reduce((sum: number, d: any) => sum + (d.value || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/companies')}
          className="p-2 hover:bg-surface rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-text-muted" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded" />
              ) : (
                <Building2 className="h-6 w-6 text-text-muted" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{company.name}</h1>
              <p className="text-text-secondary">
                {company.industry || 'Company'}
                {company.employee_count && ` · ${company.employee_count} employees`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowFindContactsModal(true)}
          >
            <Users className="h-4 w-4" />
            Find Contacts
          </Button>
          <EnrichButton onClick={() => setShowEnrichModal(true)} />
          <Button
            variant="secondary"
            onClick={() => {
              setEditForm({
                name: company.name || '',
                industry: company.industry || '',
                employee_count: company.employee_count?.toString() || '',
                website: company.website || '',
                description: company.description || '',
              });
              setShowEditModal(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button onClick={() => navigate(`/deals?new=true&companyId=${id}`)}>
            <Plus className="h-4 w-4" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide">Contacts</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {company.contacts?.length || 0}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide">Active Deals</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {company.deals?.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage)).length || 0}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide">Pipeline Value</p>
          <p className="text-2xl font-semibold text-primary mt-1">
            ${totalDealValue.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-semibold text-success mt-1">
            ${(company.total_revenue || 0).toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader title="Company Information" />
          <div className="space-y-4">
            {company.website && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Website</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  Visit
                </a>
              </div>
            )}
            {company.industry && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Industry</span>
                <span className="text-sm text-text-primary">{company.industry}</span>
              </div>
            )}
            {company.employee_count && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Employees</span>
                <span className="text-sm text-text-primary">{company.employee_count}</span>
              </div>
            )}
            {company.description && (
              <div className="pt-2 border-t border-border-light">
                <p className="text-sm text-text-secondary">{company.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader
            title="Contacts"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddContactModal(true)}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            }
          />
          {(!company.contacts || company.contacts.length === 0) ? (
            <p className="text-sm text-text-muted text-center py-8">
              No contacts yet
            </p>
          ) : (
            <div className="space-y-3">
              {company.contacts.map((contact: any) => (
                <button
                  key={contact.id}
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors text-left"
                >
                  <Avatar name={contact.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {contact.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {contact.title || contact.email}
                    </p>
                  </div>
                  <StatusBadge status={contact.status} />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Deals */}
        <Card>
          <CardHeader
            title="Deals"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/deals?new=true&companyId=${id}`)}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            }
          />
          {(!company.deals || company.deals.length === 0) ? (
            <p className="text-sm text-text-muted text-center py-8">
              No deals yet
            </p>
          ) : (
            <div className="space-y-3">
              {company.deals.map((deal: any) => (
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
                      ${deal.value?.toLocaleString()}
                      {deal.close_date && ` · ${format(new Date(deal.close_date), 'MMM d')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SpinProgress
                      situation={deal.spin_situation}
                      problem={deal.spin_problem}
                      implication={deal.spin_implication}
                      needPayoff={deal.spin_need_payoff}
                      size="sm"
                    />
                    <StageBadge stage={deal.stage} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Edit Company Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Company"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({
              name: editForm.name,
              industry: editForm.industry || undefined,
              employee_count: editForm.employee_count ? parseInt(editForm.employee_count) : undefined,
              website: editForm.website || undefined,
              description: editForm.description || undefined,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Company Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
          <Input
            label="Industry"
            value={editForm.industry}
            onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
            placeholder="Technology"
          />
          <Input
            label="Employee Count"
            type="number"
            value={editForm.employee_count}
            onChange={(e) => setEditForm({ ...editForm, employee_count: e.target.value })}
            placeholder="100"
          />
          <Input
            label="Website"
            value={editForm.website}
            onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
            placeholder="https://example.com"
          />
          <div>
            <label className="label">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="input min-h-[80px]"
              placeholder="Brief description of the company"
            />
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
        title="Delete Company"
        message={`Are you sure you want to delete "${company.name}"? This will not delete associated contacts or deals, but they will no longer be linked to this company.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        title="Add Contact"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createContactMutation.mutate(contactForm);
          }}
          className="space-y-4"
        >
          <Input
            label="Full Name"
            value={contactForm.name}
            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={contactForm.email}
            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={contactForm.phone}
            onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
          />
          <Input
            label="Job Title"
            value={contactForm.title}
            onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddContactModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createContactMutation.isPending}>
              Create Contact
            </Button>
          </div>
        </form>
      </Modal>

      {/* Enrich Modal */}
      <EnrichCompanyModal
        isOpen={showEnrichModal}
        onClose={() => setShowEnrichModal(false)}
        company={{
          id: company.id,
          name: company.name,
          website: company.website,
          industry: company.industry,
          employee_count: company.employee_count,
          description: company.description,
          linkedin_url: company.linkedin_url,
        }}
        onApply={(updates) => {
          updateMutation.mutate(updates);
        }}
      />

      {/* Find Contacts Modal */}
      <FindContactsModal
        isOpen={showFindContactsModal}
        onClose={() => setShowFindContactsModal(false)}
        company={{
          id: company.id,
          name: company.name,
          website: company.website,
        }}
        onContactsAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['companies', id] });
        }}
      />
    </div>
  );
}
