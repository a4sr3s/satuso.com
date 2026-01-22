import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Mail, Phone, Building2, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { contactsApi } from '@/lib/api';
import type { CreateContactData } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table, { ActionMenu } from '@/components/ui/Table';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ContactsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState<CreateContactData>({
    name: '',
    email: '',
    phone: '',
    title: '',
    status: 'active',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { search }],
    queryFn: () => contactsApi.list({ search, limit: '50' }),
  });

  const createMutation = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setShowNewModal(false);
      setFormData({ name: '', email: '', phone: '', title: '', status: 'active' } as CreateContactData);
      toast.success('Contact created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contactsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteId(null);
      toast.success('Contact deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const contacts = data?.data?.items || [];

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedContacts = [...contacts].sort((a: any, b: any) => {
    let aVal: any, bVal: any;

    switch (sortColumn) {
      case 'name':
        aVal = a.name?.toLowerCase() || '';
        bVal = b.name?.toLowerCase() || '';
        break;
      case 'company':
        aVal = a.company_name?.toLowerCase() || '';
        bVal = b.company_name?.toLowerCase() || '';
        break;
      case 'email':
        aVal = a.email?.toLowerCase() || '';
        bVal = b.email?.toLowerCase() || '';
        break;
      case 'status':
        aVal = a.status?.toLowerCase() || '';
        bVal = b.status?.toLowerCase() || '';
        break;
      case 'last_contacted':
        aVal = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
        bVal = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (contact: any) => (
        <div className="flex items-center gap-3">
          <Avatar name={contact.name} size="sm" />
          <div>
            <p className="font-medium text-text-primary">{contact.name}</p>
            {contact.title && (
              <p className="text-xs text-text-muted">{contact.title}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      render: (contact: any) => (
        <div className="flex items-center gap-2 text-text-secondary">
          <Building2 className="h-4 w-4" />
          {contact.company_name || '-'}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (contact: any) => (
        contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-text-secondary hover:text-primary"
          >
            <Mail className="h-4 w-4" />
            {contact.email}
          </a>
        ) : '-'
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (contact: any) => (
        contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-text-secondary hover:text-primary"
          >
            <Phone className="h-4 w-4" />
            {contact.phone}
          </a>
        ) : '-'
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (contact: any) => <StatusBadge status={contact.status} />,
    },
    {
      key: 'last_contacted',
      header: 'Last Contact',
      sortable: true,
      render: (contact: any) =>
        contact.last_contacted_at
          ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
          : 'Never',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">
          {contacts.length} contacts
        </p>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        <Button variant="secondary">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Table */}
      {contacts.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add your first contact to start building relationships."
          actionLabel="Add Contact"
          onAction={() => setShowNewModal(true)}
        />
      ) : (
        <Table
          data={sortedContacts}
          columns={columns}
          isLoading={isLoading}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(contact) => navigate(`/contacts/${contact.id}`)}
          actions={(contact) => (
            <ActionMenu
              items={[
                {
                  label: 'Edit',
                  icon: <Edit className="h-4 w-4" />,
                  onClick: () => navigate(`/contacts/${contact.id}`),
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => setDeleteId(contact.id),
                  variant: 'danger',
                },
              ]}
            />
          )}
        />
      )}

      {/* New Contact Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setSearchParams({});
        }}
        title="Add New Contact"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="John Smith"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Job Title"
            placeholder="VP of Sales"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNewModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Contact
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
