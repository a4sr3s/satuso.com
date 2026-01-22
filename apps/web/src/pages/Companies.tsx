import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Globe, Users, Trash2, Edit, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { companiesApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table, { ActionMenu } from '@/components/ui/Table';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    industry: '',
    employee_count: '',
    website: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search }],
    queryFn: () => companiesApi.list({ search, limit: '50' }),
  });

  const createMutation = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowNewModal(false);
      setFormData({ name: '', domain: '', industry: '', employee_count: '', website: '' });
      toast.success('Company created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: companiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteId(null);
      toast.success('Company deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const companies = data?.data?.items || [];

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedCompanies = [...companies].sort((a: any, b: any) => {
    let aVal: any, bVal: any;

    switch (sortColumn) {
      case 'name':
        aVal = a.name?.toLowerCase() || '';
        bVal = b.name?.toLowerCase() || '';
        break;
      case 'industry':
        aVal = a.industry?.toLowerCase() || '';
        bVal = b.industry?.toLowerCase() || '';
        break;
      case 'contacts':
        aVal = a.contact_count || 0;
        bVal = b.contact_count || 0;
        break;
      case 'deals':
        aVal = a.deal_count || 0;
        bVal = b.deal_count || 0;
        break;
      case 'revenue':
        aVal = a.total_revenue || 0;
        bVal = b.total_revenue || 0;
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
      header: 'Company',
      sortable: true,
      render: (company: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface rounded-lg flex items-center justify-center">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-8 h-8 rounded" />
            ) : (
              <Building2 className="h-5 w-5 text-text-muted" />
            )}
          </div>
          <div>
            <p className="font-medium text-text-primary">{company.name}</p>
            {company.domain && (
              <p className="text-xs text-text-muted">{company.domain}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industry',
      sortable: true,
      render: (company: any) => company.industry || '-',
    },
    {
      key: 'contacts',
      header: 'Contacts',
      sortable: true,
      render: (company: any) => (
        <div className="flex items-center gap-2 text-text-secondary">
          <Users className="h-4 w-4" />
          {company.contact_count || 0}
        </div>
      ),
    },
    {
      key: 'deals',
      header: 'Deals',
      sortable: true,
      render: (company: any) => company.deal_count || 0,
    },
    {
      key: 'revenue',
      header: 'Total Revenue',
      sortable: true,
      render: (company: any) => (
        <span className="text-success font-medium">
          ${(company.total_revenue || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'website',
      header: 'Website',
      render: (company: any) =>
        company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <Globe className="h-4 w-4" />
            Visit
          </a>
        ) : (
          '-'
        ),
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      domain: formData.domain || undefined,
      industry: formData.industry || undefined,
      employee_count: formData.employee_count ? parseInt(formData.employee_count) : undefined,
      website: formData.website || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">
          {companies.length} companies
        </p>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search companies..."
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
      {companies.length === 0 && !isLoading ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add your first company to start tracking accounts."
          actionLabel="Add Company"
          onAction={() => setShowNewModal(true)}
        />
      ) : (
        <Table
          data={sortedCompanies}
          columns={columns}
          isLoading={isLoading}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(company) => navigate(`/companies/${company.id}`)}
          actions={(company) => (
            <ActionMenu
              items={[
                {
                  label: 'Edit',
                  icon: <Edit className="h-4 w-4" />,
                  onClick: () => navigate(`/companies/${company.id}`),
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => setDeleteId(company.id),
                  variant: 'danger',
                },
              ]}
            />
          )}
        />
      )}

      {/* New Company Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setSearchParams({});
        }}
        title="Add New Company"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Company Name"
            placeholder="Acme Corporation"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Domain"
            placeholder="acme.com"
            value={formData.domain}
            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
          />
          <Input
            label="Industry"
            placeholder="Technology"
            value={formData.industry}
            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
          />
          <Input
            label="Employee Count"
            type="number"
            placeholder="100"
            value={formData.employee_count}
            onChange={(e) => setFormData({ ...formData, employee_count: e.target.value })}
          />
          <Input
            label="Website"
            type="url"
            placeholder="https://acme.com"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
              Create Company
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Company"
        message="Are you sure you want to delete this company? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
