import type { WorkboardColumn, WorkboardFilter, WorkboardEntityType } from '@/types';

export interface WorkboardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  entity_type: WorkboardEntityType;
  columns: WorkboardColumn[];
  filters: WorkboardFilter[];
  sort_column?: string;
  sort_direction?: 'asc' | 'desc';
  requiresRepSelection?: boolean;
}

export const workboardTemplates: WorkboardTemplate[] = [
  {
    id: 'pipeline_by_rep',
    name: 'Pipeline by Rep',
    description: 'All open deals for a specific rep',
    icon: 'UserCircle',
    entity_type: 'deals',
    requiresRepSelection: true,
    columns: [
      { id: 'col_name', field: 'name', label: 'Name', type: 'raw', format: 'text', width: 200 },
      { id: 'col_company', field: 'company_name', label: 'Company', type: 'raw', format: 'text', width: 150 },
      { id: 'col_value', field: 'value', label: 'Value', type: 'raw', format: 'currency', width: 120 },
      { id: 'col_stage', field: 'stage', label: 'Stage', type: 'raw', format: 'text', width: 130 },
      { id: 'col_prob', field: 'probability', label: 'Probability', type: 'raw', format: 'number', width: 100 },
      { id: 'col_close', field: 'close_date', label: 'Close Date', type: 'raw', format: 'date', width: 120 },
    ],
    filters: [
      { field: 'stage', operator: 'not_in', value: ['closed_won', 'closed_lost'] },
      // owner_name filter is added dynamically when rep is selected
    ],
    sort_column: 'close_date',
    sort_direction: 'asc',
  },
  {
    id: 'all_open_pipeline',
    name: 'All Open Pipeline',
    description: 'Full pipeline overview across all reps',
    icon: 'BarChart3',
    entity_type: 'deals',
    columns: [
      { id: 'col_name', field: 'name', label: 'Name', type: 'raw', format: 'text', width: 200 },
      { id: 'col_company', field: 'company_name', label: 'Company', type: 'raw', format: 'text', width: 150 },
      { id: 'col_value', field: 'value', label: 'Value', type: 'raw', format: 'currency', width: 120 },
      { id: 'col_stage', field: 'stage', label: 'Stage', type: 'raw', format: 'text', width: 130 },
      { id: 'col_owner', field: 'owner_name', label: 'Owner', type: 'raw', format: 'text', width: 130 },
      { id: 'col_close', field: 'close_date', label: 'Close Date', type: 'raw', format: 'date', width: 120 },
      { id: 'col_days', field: 'days_in_stage', label: 'Days in Stage', type: 'formula', formula: 'days_in_stage', format: 'number', width: 110 },
    ],
    filters: [
      { field: 'stage', operator: 'not_in', value: ['closed_won', 'closed_lost'] },
    ],
    sort_column: 'value',
    sort_direction: 'desc',
  },
  {
    id: 'deals_at_risk',
    name: 'Deals at Risk',
    description: 'Stale or low-probability open deals',
    icon: 'AlertTriangle',
    entity_type: 'deals',
    columns: [
      { id: 'col_name', field: 'name', label: 'Name', type: 'raw', format: 'text', width: 200 },
      { id: 'col_company', field: 'company_name', label: 'Company', type: 'raw', format: 'text', width: 150 },
      { id: 'col_value', field: 'value', label: 'Value', type: 'raw', format: 'currency', width: 120 },
      { id: 'col_stage', field: 'stage', label: 'Stage', type: 'raw', format: 'text', width: 130 },
      { id: 'col_owner', field: 'owner_name', label: 'Owner', type: 'raw', format: 'text', width: 130 },
      { id: 'col_days', field: 'days_in_stage', label: 'Days in Stage', type: 'formula', formula: 'days_in_stage', format: 'number', width: 110 },
      { id: 'col_activity', field: 'last_activity_days', label: 'Days Since Activity', type: 'formula', formula: 'last_activity_days', format: 'number', width: 130 },
    ],
    filters: [
      { field: 'stage', operator: 'not_in', value: ['closed_won', 'closed_lost'] },
      { field: 'last_activity_days', operator: 'gte', value: 7 },
    ],
    sort_column: 'last_activity_days',
    sort_direction: 'desc',
  },
  {
    id: 'win_loss_report',
    name: 'Win/Loss Report',
    description: 'Closed deals for analysis',
    icon: 'TrendingUp',
    entity_type: 'deals',
    columns: [
      { id: 'col_name', field: 'name', label: 'Name', type: 'raw', format: 'text', width: 200 },
      { id: 'col_company', field: 'company_name', label: 'Company', type: 'raw', format: 'text', width: 150 },
      { id: 'col_value', field: 'value', label: 'Value', type: 'raw', format: 'currency', width: 120 },
      { id: 'col_stage', field: 'stage', label: 'Stage', type: 'raw', format: 'text', width: 130 },
      { id: 'col_owner', field: 'owner_name', label: 'Owner', type: 'raw', format: 'text', width: 130 },
      { id: 'col_close', field: 'close_date', label: 'Close Date', type: 'raw', format: 'date', width: 120 },
      { id: 'col_days', field: 'days_in_stage', label: 'Days in Stage', type: 'formula', formula: 'days_in_stage', format: 'number', width: 110 },
    ],
    filters: [
      { field: 'stage', operator: 'in', value: ['closed_won', 'closed_lost'] },
    ],
    sort_column: 'close_date',
    sort_direction: 'desc',
  },
  {
    id: 'spin_gaps',
    name: 'SPIN Gaps',
    description: 'Deals with incomplete discovery',
    icon: 'Target',
    entity_type: 'deals',
    columns: [
      { id: 'col_name', field: 'name', label: 'Name', type: 'raw', format: 'text', width: 200 },
      { id: 'col_company', field: 'company_name', label: 'Company', type: 'raw', format: 'text', width: 150 },
      { id: 'col_value', field: 'value', label: 'Value', type: 'raw', format: 'currency', width: 120 },
      { id: 'col_stage', field: 'stage', label: 'Stage', type: 'raw', format: 'text', width: 130 },
      { id: 'col_owner', field: 'owner_name', label: 'Owner', type: 'raw', format: 'text', width: 130 },
      { id: 'col_spin', field: 'spin_score', label: 'SPIN Score', type: 'formula', formula: 'spin_score', format: 'number', width: 110 },
    ],
    filters: [
      { field: 'stage', operator: 'not_in', value: ['closed_won', 'closed_lost'] },
      { field: 'spin_score', operator: 'lt', value: 75 },
    ],
    sort_column: 'spin_score',
    sort_direction: 'asc',
  },
  {
    id: 'contacts_by_company',
    name: 'Contacts by Company',
    description: 'All contacts grouped by company',
    icon: 'Users',
    entity_type: 'contacts',
    columns: [
      { id: 'col_name', field: 'name', label: 'Name', type: 'raw', format: 'text', width: 200 },
      { id: 'col_email', field: 'email', label: 'Email', type: 'raw', format: 'text', width: 200 },
      { id: 'col_phone', field: 'phone', label: 'Phone', type: 'raw', format: 'text', width: 140 },
      { id: 'col_company', field: 'company_name', label: 'Company', type: 'raw', format: 'text', width: 150 },
      { id: 'col_status', field: 'status', label: 'Status', type: 'raw', format: 'text', width: 100 },
      { id: 'col_owner', field: 'owner_name', label: 'Owner', type: 'raw', format: 'text', width: 130 },
    ],
    filters: [],
    sort_column: 'company_name',
    sort_direction: 'asc',
  },
  {
    id: 'blank_report',
    name: 'Blank Report',
    description: 'Start from scratch with a custom report',
    icon: 'FileSpreadsheet',
    entity_type: 'deals',
    columns: [],
    filters: [],
  },
];
