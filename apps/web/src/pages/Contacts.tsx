import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Mail, Phone, Building2, Trash2, Edit, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { contactsApi, companiesApi } from '@/lib/api';
import type { CreateContactData } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table, { ActionMenu } from '@/components/ui/Table';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { useLocale } from '@/hooks/useLocale';

export default function ContactsPage() {
  const { t } = useTranslation(['contacts', 'common']);
  const { formatRelativeDate } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const companyIdFromUrl = searchParams.get('companyId');

  const [formData, setFormData] = useState<CreateContactData>({
    name: '',
    email: '',
    phone: '',
    title: '',
    company_id: companyIdFromUrl || '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.list({ limit: '100' }),
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
      setFormData({ name: '', email: '', phone: '', title: '', company_id: '' });
      toast.success(t('contacts:toast.created'));
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
      toast.success(t('contacts:toast.deleted'));
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
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedIds.size === sortedContacts.length && sortedContacts.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(new Set(sortedContacts.map((c: any) => c.id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
      render: (contact: any) => (
        <input
          type="checkbox"
          checked={selectedIds.has(contact.id)}
          onChange={(e) => {
            e.stopPropagation();
            const newSet = new Set(selectedIds);
            if (e.target.checked) {
              newSet.add(contact.id);
            } else {
              newSet.delete(contact.id);
            }
            setSelectedIds(newSet);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
    },
    {
      key: 'name',
      header: t('contacts:table.name'),
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
      header: t('contacts:table.company'),
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
      header: t('contacts:table.email'),
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
      header: t('contacts:table.phone'),
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
      key: 'last_contacted',
      header: t('contacts:table.lastContact'),
      sortable: true,
      render: (contact: any) =>
        contact.last_contacted_at
          ? formatRelativeDate(contact.last_contacted_at)
          : t('common:time.never'),
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
          {t('contacts:count', { count: contacts.length })}
        </p>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          {t('contacts:addContact')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder={t('contacts:searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              const ids = Array.from(selectedIds);
              for (const id of ids) {
                await deleteMutation.mutateAsync(id);
              }
              setSelectedIds(new Set());
            }}
          >
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      {contacts.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title={t('contacts:empty.title')}
          description={t('contacts:empty.description')}
          actionLabel={t('contacts:addContact')}
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
                  label: t('common:buttons.edit'),
                  icon: <Edit className="h-4 w-4" />,
                  onClick: () => navigate(`/contacts/${contact.id}`),
                },
                {
                  label: t('common:buttons.delete'),
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
        title={t('contacts:modal.addTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('contacts:modal.fullName')}
            placeholder={t('contacts:modal.fullNamePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={t('contacts:modal.email')}
            type="email"
            placeholder={t('contacts:modal.emailPlaceholder')}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label={t('contacts:modal.phone')}
            type="tel"
            placeholder={t('contacts:modal.phonePlaceholder')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label={t('contacts:modal.jobTitle')}
            placeholder={t('contacts:modal.jobTitlePlaceholder')}
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <div>
            <label className="label">{t('contacts:modal.company') || 'Company'}</label>
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
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNewModal(false)}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('contacts:modal.createContact')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('contacts:delete.title')}
        message={t('contacts:delete.message')}
        confirmLabel={t('common:buttons.delete')}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
