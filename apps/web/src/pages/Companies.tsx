import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Globe, Users, Trash2, Edit, Building2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { companiesApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table, { ActionMenu } from '@/components/ui/Table';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';

function getCompanyColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-cyan-100 text-cyan-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function CompaniesPage() {
  const { t } = useTranslation(['companies', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    industry: '',
    employee_count: '',
    website: '',
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleIndustryFilter = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((i) => i !== industry) : [...prev, industry]
    );
  };

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
      toast.success(t('companies:toast.created'));
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
      toast.success(t('companies:toast.deleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const allCompanies = data?.data?.items || [];
  const industries = [...new Set(allCompanies.map((c: any) => c.industry).filter(Boolean))].sort() as string[];
  const companies = selectedIndustries.length > 0
    ? allCompanies.filter((c: any) => selectedIndustries.includes(c.industry))
    : allCompanies;

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
      header: t('companies:table.company'),
      sortable: true,
      render: (company: any) => (
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm',
            company.logo_url ? '' : getCompanyColor(company.name || '')
          )}>
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-8 h-8 rounded" />
            ) : (
              (company.name || '?').charAt(0).toUpperCase()
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
      header: t('companies:table.industry'),
      sortable: true,
      render: (company: any) => company.industry || '-',
    },
    {
      key: 'contacts',
      header: t('companies:table.contacts'),
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
      header: t('companies:table.deals'),
      sortable: true,
      render: (company: any) => company.deal_count || 0,
    },
    {
      key: 'revenue',
      header: t('companies:table.totalRevenue'),
      sortable: true,
      render: (company: any) => (
        <span className="text-success font-medium">
          ${(company.total_revenue || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'website',
      header: t('companies:table.website'),
      render: (company: any) => {
        const url = company.website || (company.domain ? `https://${company.domain}` : null);
        return url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 text-primary hover:underline">
            <Globe className="h-4 w-4" />
            {t('common:buttons.visit')}
          </a>
        ) : '-';
      },
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
          {t('companies:count', { count: companies.length })}
        </p>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          {t('companies:addCompany')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder={t('companies:searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        <div className="relative" ref={filterRef}>
          <Button
            variant="secondary"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Filter className="h-4 w-4" />
            {t('common:buttons.filters')}
            {selectedIndustries.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                {selectedIndustries.length}
              </span>
            )}
          </Button>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-2">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Filter by Industry</p>
              </div>
              {industries.length === 0 ? (
                <p className="px-3 py-3 text-sm text-text-muted">No industries found</p>
              ) : (
                industries.map((industry) => {
                  const isSelected = selectedIndustries.includes(industry);
                  return (
                    <button
                      key={industry}
                      onClick={() => toggleIndustryFilter(industry)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-text-primary">{industry}</span>
                    </button>
                  );
                })
              )}
              {selectedIndustries.length > 0 && (
                <div className="px-3 pt-2 mt-1 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedIndustries([])}
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {companies.length === 0 && !isLoading ? (
        <EmptyState
          icon={Building2}
          title={t('companies:empty.title')}
          description={t('companies:empty.description')}
          actionLabel={t('companies:addCompany')}
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
                  label: t('common:buttons.edit'),
                  icon: <Edit className="h-4 w-4" />,
                  onClick: () => navigate(`/companies/${company.id}`),
                },
                {
                  label: t('common:buttons.delete'),
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
        title={t('companies:modal.addTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('companies:modal.companyName')}
            placeholder={t('companies:modal.companyNamePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={t('companies:modal.domain')}
            placeholder={t('companies:modal.domainPlaceholder')}
            value={formData.domain}
            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
          />
          <Input
            label={t('companies:modal.industry')}
            placeholder={t('companies:modal.industryPlaceholder')}
            value={formData.industry}
            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
          />
          <Input
            label={t('companies:modal.employeeCount')}
            type="number"
            placeholder={t('companies:modal.employeeCountPlaceholder')}
            value={formData.employee_count}
            onChange={(e) => setFormData({ ...formData, employee_count: e.target.value })}
          />
          <Input
            label={t('companies:modal.website')}
            type="url"
            placeholder={t('companies:modal.websitePlaceholder')}
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNewModal(false)}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('companies:modal.createCompany')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('companies:delete.title')}
        message={t('companies:delete.message')}
        confirmLabel={t('common:buttons.delete')}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
