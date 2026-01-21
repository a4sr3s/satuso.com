import { useState } from 'react';
import type { WorkboardEntityType, WorkboardFilter, FilterOperator } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface WorkboardFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: WorkboardEntityType;
  onAddFilter: (filter: WorkboardFilter) => void;
}

interface FieldOption {
  value: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: { value: string; label: string }[];
}

const dealFields: FieldOption[] = [
  { value: 'name', label: 'Deal Name', type: 'text' },
  { value: 'value', label: 'Value', type: 'number' },
  { value: 'stage', label: 'Stage', type: 'select', options: [
    { value: 'lead', label: 'Lead' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'closed_won', label: 'Closed Won' },
    { value: 'closed_lost', label: 'Closed Lost' },
  ]},
  { value: 'company_name', label: 'Company', type: 'text' },
  { value: 'owner_name', label: 'Owner', type: 'text' },
  { value: 'close_date', label: 'Close Date', type: 'date' },
  { value: 'days_in_stage', label: 'Days in Stage', type: 'number' },
  { value: 'spin_score', label: 'SPIN Score', type: 'number' },
  { value: 'last_activity_days', label: 'Days Since Activity', type: 'number' },
];

const contactFields: FieldOption[] = [
  { value: 'name', label: 'Contact Name', type: 'text' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'company_name', label: 'Company', type: 'text' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'lead', label: 'Lead' },
  ]},
  { value: 'owner_name', label: 'Owner', type: 'text' },
];

const companyFields: FieldOption[] = [
  { value: 'name', label: 'Company Name', type: 'text' },
  { value: 'industry', label: 'Industry', type: 'text' },
  { value: 'employee_count', label: 'Employee Count', type: 'number' },
  { value: 'owner_name', label: 'Owner', type: 'text' },
];

const fieldsByEntity: Record<WorkboardEntityType, FieldOption[]> = {
  deals: dealFields,
  contacts: contactFields,
  companies: companyFields,
};

const textOperators: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
];

const numberOperators: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Does not equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
];

const selectOperators: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Does not equal' },
  { value: 'in', label: 'Is one of' },
  { value: 'not_in', label: 'Is not one of' },
];

export default function WorkboardFilterModal({
  isOpen,
  onClose,
  entityType,
  onAddFilter,
}: WorkboardFilterModalProps) {
  const [field, setField] = useState('');
  const [operator, setOperator] = useState<FilterOperator>('eq');
  const [value, setValue] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  const fields = fieldsByEntity[entityType];
  const selectedField = fields.find((f) => f.value === field);

  const getOperators = () => {
    if (!selectedField) return textOperators;
    switch (selectedField.type) {
      case 'number':
        return numberOperators;
      case 'select':
        return selectOperators;
      case 'date':
        return numberOperators; // Dates can use comparison operators
      default:
        return textOperators;
    }
  };

  const handleFieldChange = (newField: string) => {
    setField(newField);
    setOperator('eq');
    setValue('');
    setSelectedValues([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let filterValue: any = value;
    if (selectedField?.type === 'number' || selectedField?.type === 'date') {
      filterValue = Number(value);
    }
    if (operator === 'in' || operator === 'not_in') {
      filterValue = selectedValues;
    }

    onAddFilter({
      field,
      operator,
      value: filterValue,
    });

    // Reset form
    setField('');
    setOperator('eq');
    setValue('');
    setSelectedValues([]);
  };

  const needsValue = operator !== 'is_null' && operator !== 'is_not_null';
  const isMultiSelect = operator === 'in' || operator === 'not_in';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Filter">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Field</label>
          <select
            value={field}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="input"
            required
          >
            <option value="">Select a field...</option>
            {fields.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {field && (
          <div>
            <label className="label">Operator</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as FilterOperator)}
              className="input"
            >
              {getOperators().map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {field && needsValue && (
          <div>
            <label className="label">Value</label>
            {selectedField?.type === 'select' && isMultiSelect ? (
              <div className="space-y-2">
                {selectedField.options?.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedValues([...selectedValues, opt.value]);
                        } else {
                          setSelectedValues(selectedValues.filter((v) => v !== opt.value));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            ) : selectedField?.type === 'select' ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="input"
                required
              >
                <option value="">Select...</option>
                {selectedField.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : selectedField?.type === 'date' ? (
              <Input
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            ) : selectedField?.type === 'number' ? (
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            ) : (
              <Input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
                required
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!field || (needsValue && !value && selectedValues.length === 0)}
          >
            Add Filter
          </Button>
        </div>
      </form>
    </Modal>
  );
}
