// Cache bust v3 - improved PDL integration
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Check, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { integrationsApi, type EnrichedContactData, type EnrichedCompanyData } from '@/lib/api';

interface EnrichField {
  key: string;
  label: string;
  current: string | number | string[] | null | undefined;
  enriched: string | number | string[] | null | undefined;
  selected: boolean;
}

interface EnrichContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    linkedin_url?: string | null;
    company_id?: string | null;
  };
  companyName?: string | null;
  onApply: (updates: Partial<EnrichedContactData>) => void;
}

interface EnrichCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: {
    id: string;
    name: string;
    website?: string | null;
    industry?: string | null;
    employee_count?: number | null;
    description?: string | null;
    linkedin_url?: string | null;
  };
  onApply: (updates: Partial<EnrichedCompanyData>) => void;
}

// Confidence badge component
function ConfidenceBadge({ likelihood }: { likelihood?: number }) {
  if (!likelihood) return null;

  const getColor = () => {
    if (likelihood >= 8) return 'bg-green-100 text-green-700';
    if (likelihood >= 5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-orange-100 text-orange-700';
  };

  const getLabel = () => {
    if (likelihood >= 8) return 'High confidence';
    if (likelihood >= 5) return 'Medium confidence';
    return 'Low confidence';
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getColor()}`}>
      <TrendingUp className="h-3 w-3" />
      {getLabel()} ({likelihood}/10)
    </div>
  );
}

// Check if enrichment is available for the org
export function useEnrichmentStatus() {
  return useQuery({
    queryKey: ['enrichment-status'],
    queryFn: () => integrationsApi.getEnrichmentStatus(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Enrich button component
export function EnrichButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { data: statusData, isLoading: statusLoading } = useEnrichmentStatus();
  const isAvailable = statusData?.data?.available;

  if (statusLoading) {
    return null; // Don't show button while checking status
  }

  if (!isAvailable) {
    return null; // Don't show button if enrichment is not configured
  }

  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      Enrich
    </Button>
  );
}

// Contact Enrich Modal
export function EnrichContactModal({ isOpen, onClose, contact, companyName, onApply }: EnrichContactModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<EnrichField[]>([]);
  const [enrichedData, setEnrichedData] = useState<EnrichedContactData | null>(null);
  const [likelihood, setLikelihood] = useState<number | undefined>();
  const [matchedFields, setMatchedFields] = useState<string[] | undefined>();

  const handleEnrich = async () => {
    setIsLoading(true);
    setError(null);

    // Check if we have required data for enrichment
    const hasIdentifier = contact.email || contact.linkedin_url;
    const hasNameAndCompany = contact.name && companyName;

    if (!hasIdentifier && !hasNameAndCompany) {
      setError('This contact needs an email address, LinkedIn URL, or name with company to enrich.');
      setIsLoading(false);
      return;
    }

    try {
      // Send more data points for better matching
      const res = await integrationsApi.enrichContact({
        email: contact.email || undefined,
        linkedin_url: contact.linkedin_url || undefined,
        name: contact.name,
        company: companyName || undefined,
        phone: contact.phone || undefined,
      });

      const data = res.data?.enriched;
      if (!data) {
        setError('No enrichment data returned');
        return;
      }

      setEnrichedData(data);
      setLikelihood(res.data?.likelihood);
      setMatchedFields(res.data?.matched);

      // Build field comparison list with expanded fields
      // Note: Only include flat fields, not complex arrays like experience/education
      type FlatContactFields = 'name' | 'first_name' | 'last_name' | 'email' | 'work_email' | 'personal_email' |
        'phone' | 'mobile_phone' | 'linkedin_url' | 'twitter_url' | 'github_url' | 'facebook_url' |
        'title' | 'job_title_role' | 'company_name' | 'company_website' | 'company_industry' |
        'company_size' | 'company_employee_count' | 'job_start_date' | 'inferred_salary' |
        'location' | 'location_locality' | 'location_region' | 'location_country' | 'birth_year' | 'industry';

      const fieldConfig: { key: FlatContactFields; label: string; currentKey?: keyof typeof contact }[] = [
        { key: 'name', label: 'Name', currentKey: 'name' },
        { key: 'email', label: 'Email', currentKey: 'email' },
        { key: 'phone', label: 'Phone', currentKey: 'phone' },
        { key: 'title', label: 'Job Title', currentKey: 'title' },
        { key: 'linkedin_url', label: 'LinkedIn', currentKey: 'linkedin_url' },
        // Additional fields from enrichment
        { key: 'twitter_url', label: 'Twitter' },
        { key: 'github_url', label: 'GitHub' },
        { key: 'facebook_url', label: 'Facebook' },
        { key: 'location', label: 'Location' },
        { key: 'company_name', label: 'Company' },
        { key: 'company_industry', label: 'Industry' },
        { key: 'inferred_salary', label: 'Salary Range' },
        { key: 'work_email', label: 'Work Email' },
        { key: 'mobile_phone', label: 'Mobile Phone' },
      ];

      const newFields: EnrichField[] = fieldConfig
        .filter(f => {
          const value = data[f.key as keyof EnrichedContactData];
          return value !== undefined && value !== null && value !== '';
        })
        .map(f => ({
          key: f.key,
          label: f.label,
          current: f.currentKey ? (contact[f.currentKey] as string | number | null | undefined) : undefined,
          enriched: data[f.key as keyof EnrichedContactData] as string | number | string[] | null | undefined,
          // Auto-select if current is empty
          selected: f.currentKey ? !contact[f.currentKey] : true,
        }));

      setFields(newFields);
    } catch (err: unknown) {
      // Handle various error formats - force to string
      let errorMsg = 'Failed to enrich contact';
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMsg = String(err.message);
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!enrichedData) return;

    const updates: Partial<EnrichedContactData> = {};
    fields.forEach(field => {
      if (field.selected && field.enriched !== undefined) {
        (updates as any)[field.key] = field.enriched;
      }
    });

    onApply(updates);
    onClose();
  };

  const toggleField = (key: string) => {
    setFields(prev =>
      prev.map(f => f.key === key ? { ...f, selected: !f.selected } : f)
    );
  };

  const hasSelectedFields = fields.some(f => f.selected);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enrich Contact">
      <div className="space-y-4">
        {!enrichedData && !isLoading && !error && (
          <div className="text-center py-6">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Enrich Contact Data</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Use People Data Labs to find additional information about this contact based on their email or LinkedIn profile.
            </p>
            <Button onClick={handleEnrich} className="mt-4">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Find Data
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Searching for data...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Enrichment Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleEnrich} className="mt-3">
              Try Again
            </Button>
          </div>
        )}

        {enrichedData && fields.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Select which fields you want to update.
              </p>
              <ConfidenceBadge likelihood={likelihood} />
            </div>

            {matchedFields && matchedFields.length > 0 && (
              <p className="text-xs text-gray-500">
                Matched on: {matchedFields.join(', ')}
              </p>
            )}

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              {fields.map(field => (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    field.selected ? 'bg-primary/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    field.selected ? 'bg-primary text-white' : 'border border-gray-300'
                  }`}>
                    {field.selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{field.label}</p>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className="text-gray-400 truncate">
                        {field.current || '(empty)'}
                      </span>
                      <span className="text-gray-300">&rarr;</span>
                      <span className="text-primary font-medium truncate">
                        {Array.isArray(field.enriched) ? field.enriched.join(', ') : String(field.enriched)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!hasSelectedFields}>
                Apply Selected ({fields.filter(f => f.selected).length})
              </Button>
            </div>
          </>
        )}

        {enrichedData && fields.length === 0 && (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No new data found for this contact.</p>
            <Button variant="secondary" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Company Enrich Modal
export function EnrichCompanyModal({ isOpen, onClose, company, onApply }: EnrichCompanyModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<EnrichField[]>([]);
  const [enrichedData, setEnrichedData] = useState<EnrichedCompanyData | null>(null);
  const [likelihood, setLikelihood] = useState<number | undefined>();
  const [matchedFields, setMatchedFields] = useState<string[] | undefined>();

  const handleEnrich = async () => {
    setIsLoading(true);
    setError(null);

    // Check if we have required data - don't guess domains
    if (!company.website && !company.name && !company.linkedin_url) {
      setError('This company needs a website, name, or LinkedIn URL to enrich.');
      setIsLoading(false);
      return;
    }

    try {
      // Send actual data - no guessing
      const res = await integrationsApi.enrichCompany({
        website: company.website || undefined,
        name: company.name,
        linkedin_url: company.linkedin_url || undefined,
      });

      const data = res.data?.enriched;
      if (!data) {
        setError('No enrichment data returned');
        return;
      }

      setEnrichedData(data);
      setLikelihood(res.data?.likelihood);
      setMatchedFields(res.data?.matched);

      // Build field comparison list with expanded fields
      const fieldConfig: { key: keyof EnrichedCompanyData; label: string; currentKey?: keyof typeof company }[] = [
        { key: 'name', label: 'Company Name', currentKey: 'name' },
        { key: 'website', label: 'Website', currentKey: 'website' },
        { key: 'industry', label: 'Industry', currentKey: 'industry' },
        { key: 'employee_count', label: 'Employee Count', currentKey: 'employee_count' },
        { key: 'description', label: 'Description', currentKey: 'description' },
        // Additional fields from enrichment
        { key: 'headline', label: 'Tagline' },
        { key: 'linkedin_url', label: 'LinkedIn', currentKey: 'linkedin_url' },
        { key: 'twitter_url', label: 'Twitter' },
        { key: 'founded', label: 'Year Founded' },
        { key: 'type', label: 'Company Type' },
        { key: 'size', label: 'Size Category' },
        { key: 'inferred_revenue', label: 'Est. Revenue' },
        { key: 'location', label: 'Headquarters' },
        { key: 'total_funding_raised', label: 'Total Funding' },
        { key: 'latest_funding_stage', label: 'Funding Stage' },
        { key: 'ticker', label: 'Stock Ticker' },
      ];

      const newFields: EnrichField[] = fieldConfig
        .filter(f => {
          const value = data[f.key];
          return value !== undefined && value !== null && value !== '';
        })
        .map(f => ({
          key: f.key,
          label: f.label,
          current: f.currentKey ? (company[f.currentKey] as string | number | null | undefined) : undefined,
          enriched: data[f.key],
          // Auto-select if current is empty
          selected: f.currentKey ? !company[f.currentKey] : true,
        }));

      setFields(newFields);
    } catch (err: unknown) {
      // Handle various error formats - force to string
      let errorMsg = 'Failed to enrich company';
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMsg = String(err.message);
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!enrichedData) return;

    const updates: Partial<EnrichedCompanyData> = {};
    fields.forEach(field => {
      if (field.selected && field.enriched !== undefined) {
        (updates as any)[field.key] = field.enriched;
      }
    });

    onApply(updates);
    onClose();
  };

  const toggleField = (key: string) => {
    setFields(prev =>
      prev.map(f => f.key === key ? { ...f, selected: !f.selected } : f)
    );
  };

  const hasSelectedFields = fields.some(f => f.selected);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enrich Company">
      <div className="space-y-4">
        {!enrichedData && !isLoading && !error && (
          <div className="text-center py-6">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Enrich Company Data</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Use People Data Labs to find additional information about this company based on their domain or name.
            </p>
            <Button onClick={handleEnrich} className="mt-4">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Find Data
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Searching for data...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Enrichment Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleEnrich} className="mt-3">
              Try Again
            </Button>
          </div>
        )}

        {enrichedData && fields.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Select which fields you want to update.
              </p>
              <ConfidenceBadge likelihood={likelihood} />
            </div>

            {matchedFields && matchedFields.length > 0 && (
              <p className="text-xs text-gray-500">
                Matched on: {matchedFields.join(', ')}
              </p>
            )}

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              {fields.map(field => (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    field.selected ? 'bg-primary/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    field.selected ? 'bg-primary text-white' : 'border border-gray-300'
                  }`}>
                    {field.selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{field.label}</p>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className="text-gray-400 truncate max-w-[150px]">
                        {field.current || '(empty)'}
                      </span>
                      <span className="text-gray-300">&rarr;</span>
                      <span className="text-primary font-medium truncate max-w-[150px]">
                        {formatEnrichedValue(field.enriched)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!hasSelectedFields}>
                Apply Selected ({fields.filter(f => f.selected).length})
              </Button>
            </div>
          </>
        )}

        {enrichedData && fields.length === 0 && (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No new data found for this company.</p>
            <Button variant="secondary" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Helper to format enriched values for display
function formatEnrichedValue(value: string | number | string[] | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') {
    // Format large numbers with commas
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return value.toLocaleString();
    return String(value);
  }
  return String(value);
}
