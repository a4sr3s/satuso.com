// Cache bust v4 - added find contacts at company
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Check, Loader2, AlertCircle, TrendingUp, Users, UserPlus, Briefcase, MapPin, Mail } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { integrationsApi, contactsApi, type EnrichedContactData, type EnrichedCompanyData, type FoundContact } from '@/lib/api';

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
      // Only send string values, filter out null/false/undefined
      const toStringOrUndefined = (val: unknown): string | undefined =>
        typeof val === 'string' && val.trim() ? val.trim() : undefined;

      const res = await integrationsApi.enrichContact({
        email: toStringOrUndefined(contact.email),
        linkedin_url: toStringOrUndefined(contact.linkedin_url),
        name: toStringOrUndefined(contact.name),
        company: toStringOrUndefined(companyName),
        phone: toStringOrUndefined(contact.phone),
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

      // Helper to check if a value is displayable (not boolean, not empty)
      const isValidValue = (value: unknown): boolean => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'boolean') return false; // Don't display booleans
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return true;
        if (Array.isArray(value)) return value.length > 0;
        return false;
      };

      const newFields: EnrichField[] = fieldConfig
        .filter(f => {
          const value = data[f.key as keyof EnrichedContactData];
          return isValidValue(value);
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
  const [websiteInput, setWebsiteInput] = useState('');

  const effectiveWebsite = company.website || websiteInput.trim() || undefined;

  const handleEnrich = async () => {
    setIsLoading(true);
    setError(null);

    // Require website or LinkedIn URL for reliable matching
    if (!effectiveWebsite && !company.linkedin_url) {
      setError('A website URL is required for company enrichment.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await integrationsApi.enrichCompany({
        website: effectiveWebsite,
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

      // Helper to check if a value is displayable (not boolean, not empty)
      const isValidValue = (value: unknown): boolean => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'boolean') return false; // Don't display booleans
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return true;
        if (Array.isArray(value)) return value.length > 0;
        return false;
      };

      const newFields: EnrichField[] = fieldConfig
        .filter(f => {
          const value = data[f.key];
          return isValidValue(value);
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

    // If user entered a website in the modal, save it too
    if (websiteInput.trim() && !company.website) {
      (updates as any).website = websiteInput.trim().includes('://') ? websiteInput.trim() : `https://${websiteInput.trim()}`;
    }

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
              Use People Data Labs to find additional information about this company.
            </p>
            {!company.website && !company.linkedin_url && (
              <div className="mt-4 max-w-sm mx-auto">
                <label className="block text-sm font-medium text-gray-700 text-left mb-1">
                  Website URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-left">
                  A website URL is required for accurate company matching.
                </p>
              </div>
            )}
            <Button onClick={handleEnrich} className="mt-4" disabled={!company.website && !company.linkedin_url && !websiteInput.trim()}>
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

// Find Contacts at Company Modal
interface FindContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: {
    id: string;
    name: string;
    website?: string | null;
  };
  onContactsAdded: () => void;
}

export function FindContactsModal({ isOpen, onClose, company, onContactsAdded }: FindContactsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<FoundContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const [addedCount, setAddedCount] = useState(0);

  const handleSearch = async () => {
    if (!company.website) {
      setError('This company needs a website URL to search for contacts. Add one in the company details first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setContacts([]);
    setSelected(new Set());
    setAddedCount(0);

    try {
      const res = await integrationsApi.searchCompanyContacts({
        website: company.website,
        company_name: company.name,
        limit: 5,
      });

      const data = res.data;
      if (!data || !data.contacts || data.contacts.length === 0) {
        setError('No contacts found at this company.');
        return;
      }

      setContacts(data.contacts);
      setCreditsUsed(data.credits_used);
      setTotalFound(data.total);
      // Select all by default
      setSelected(new Set(data.contacts.map((_: FoundContact, i: number) => i)));
    } catch (err: unknown) {
      let errorMsg = 'Failed to search for contacts';
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleContact = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddContacts = async () => {
    const toAdd = contacts.filter((_, i) => selected.has(i));
    if (toAdd.length === 0) return;

    setIsAdding(true);
    let added = 0;

    try {
      for (const contact of toAdd) {
        await contactsApi.create({
          name: contact.name,
          email: contact.email || undefined,
          phone: contact.phone || undefined,
          title: contact.title || undefined,
          company_id: company.id,
          linkedin_url: contact.linkedin_url || undefined,
          twitter_url: contact.twitter_url || undefined,
          github_url: contact.github_url || undefined,
          facebook_url: contact.facebook_url || undefined,
          location: contact.location || undefined,
          location_city: contact.location_city || undefined,
          location_region: contact.location_region || undefined,
          location_country: contact.location_country || undefined,
        });
        added++;
      }

      setAddedCount(added);
      onContactsAdded();
    } catch (err: unknown) {
      let errorMsg = 'Failed to add some contacts';
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setIsAdding(false);
    }
  };

  const getSeniorityLabel = (levels: string[]) => {
    const labelMap: Record<string, string> = {
      cxo: 'C-Level',
      vp: 'VP',
      director: 'Director',
      owner: 'Owner',
      partner: 'Partner',
      manager: 'Manager',
      senior: 'Senior',
    };
    const label = levels.find(l => labelMap[l]);
    return label ? labelMap[label] : null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find Key Contacts">
      <div className="space-y-4">
        {/* Initial state */}
        {contacts.length === 0 && !isLoading && !error && addedCount === 0 && (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Find Key People at {company.name}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Search for senior leaders and key contacts at this company using People Data Labs.
            </p>
            {!company.website && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-sm mx-auto">
                <p className="text-sm text-yellow-700">
                  A website URL is required. Please add one to the company details first.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3 max-w-sm mx-auto">
              Up to 5 contacts will be returned. Each contact found uses 1 API credit.
            </p>
            <Button onClick={handleSearch} className="mt-4" disabled={!company.website}>
              <Users className="h-4 w-4 mr-1.5" />
              Find Contacts
            </Button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Searching for key contacts...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Search Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
            {company.website && (
              <Button variant="secondary" onClick={handleSearch} className="mt-3">
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Success - added contacts */}
        {addedCount > 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {addedCount} {addedCount === 1 ? 'Contact' : 'Contacts'} Added
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Successfully added to {company.name}.
            </p>
            <Button variant="secondary" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )}

        {/* Results */}
        {contacts.length > 0 && addedCount === 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Found {contacts.length} key {contacts.length === 1 ? 'contact' : 'contacts'}
                {totalFound > contacts.length && ` of ${totalFound.toLocaleString()} total`}
              </p>
              <span className="text-xs text-gray-400">
                {creditsUsed} {creditsUsed === 1 ? 'credit' : 'credits'} used
              </span>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              {contacts.map((contact, index) => {
                const seniority = getSeniorityLabel(contact.job_title_levels);
                return (
                  <button
                    key={index}
                    onClick={() => toggleContact(index)}
                    className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                      selected.has(index) ? 'bg-primary/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selected.has(index) ? 'bg-primary text-white' : 'border border-gray-300'
                    }`}>
                      {selected.has(index) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                        {seniority && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 flex-shrink-0">
                            {seniority}
                          </span>
                        )}
                      </div>
                      {contact.title && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Briefcase className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-500 truncate">{contact.title}</p>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                        </div>
                      )}
                      {contact.location && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-400 truncate">{contact.location}</p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAddContacts}
                disabled={selected.size === 0 || isAdding}
                isLoading={isAdding}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add {selected.size} {selected.size === 1 ? 'Contact' : 'Contacts'}
              </Button>
            </div>
          </>
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
