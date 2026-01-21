-- Seed data for development/demo

-- Demo user (password: demo123)
INSERT INTO users (id, email, name, password_hash, role) VALUES
  ('user_demo', 'demo@satuso.com', 'Demo User', 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', 'admin');

-- Sample companies
INSERT INTO companies (id, name, domain, industry, employee_count, annual_revenue, owner_id) VALUES
  ('comp_1', 'Acme Corporation', 'acme.com', 'Technology', 500, 50000000, 'user_demo'),
  ('comp_2', 'TechStart Inc', 'techstart.io', 'Technology', 50, 5000000, 'user_demo'),
  ('comp_3', 'Global Solutions', 'globalsolutions.com', 'Consulting', 200, 25000000, 'user_demo'),
  ('comp_4', 'Innovate Labs', 'innovatelabs.co', 'Technology', 75, 8000000, 'user_demo'),
  ('comp_5', 'Enterprise Systems', 'enterprise-sys.com', 'Software', 1000, 100000000, 'user_demo');

-- Sample contacts
INSERT INTO contacts (id, name, email, phone, title, company_id, owner_id, status) VALUES
  ('cont_1', 'John Smith', 'john.smith@acme.com', '+1-555-0101', 'VP of Sales', 'comp_1', 'user_demo', 'active'),
  ('cont_2', 'Sarah Johnson', 'sarah@techstart.io', '+1-555-0102', 'CEO', 'comp_2', 'user_demo', 'active'),
  ('cont_3', 'Mike Chen', 'mchen@globalsolutions.com', '+1-555-0103', 'Director of Operations', 'comp_3', 'user_demo', 'active'),
  ('cont_4', 'Emily Davis', 'emily.d@innovatelabs.co', '+1-555-0104', 'CTO', 'comp_4', 'user_demo', 'lead'),
  ('cont_5', 'Robert Wilson', 'rwilson@enterprise-sys.com', '+1-555-0105', 'VP of Engineering', 'comp_5', 'user_demo', 'active'),
  ('cont_6', 'Lisa Anderson', 'lisa@acme.com', '+1-555-0106', 'Sales Manager', 'comp_1', 'user_demo', 'active'),
  ('cont_7', 'David Brown', 'david@techstart.io', '+1-555-0107', 'Product Manager', 'comp_2', 'user_demo', 'lead');

-- Sample deals with SPIN data
INSERT INTO deals (id, name, value, stage, contact_id, company_id, owner_id, close_date, spin_situation, spin_problem, spin_implication, spin_need_payoff, spin_progress, stage_changed_at) VALUES
  ('deal_1', 'Acme Enterprise License', 150000, 'negotiation', 'cont_1', 'comp_1', 'user_demo', date('now', '+30 days'),
   '50-person sales team currently using spreadsheets. 2 dedicated admins managing data.',
   'Reps waste 5+ hours per week on manual data entry. No visibility into pipeline.',
   'Lost $200k in potential revenue last quarter due to dropped follow-ups.',
   'Automation could free up 250 hours/month for actual selling.',
   4, datetime('now', '-5 days')),

  ('deal_2', 'TechStart Growth Package', 45000, 'proposal', 'cont_2', 'comp_2', 'user_demo', date('now', '+14 days'),
   '15-person sales team, growing fast. Using HubSpot free tier.',
   'Outgrowing current CRM limits. Need better reporting.',
   NULL,
   NULL,
   2, datetime('now', '-10 days')),

  ('deal_3', 'Global Solutions Pilot', 25000, 'qualified', 'cont_3', 'comp_3', 'user_demo', date('now', '+45 days'),
   'Consulting firm with 30 client-facing staff.',
   NULL,
   NULL,
   NULL,
   1, datetime('now', '-3 days')),

  ('deal_4', 'Innovate Labs Starter', 12000, 'lead', 'cont_4', 'comp_4', 'user_demo', date('now', '+60 days'),
   NULL,
   NULL,
   NULL,
   NULL,
   0, datetime('now', '-1 day')),

  ('deal_5', 'Enterprise Systems Expansion', 500000, 'proposal', 'cont_5', 'comp_5', 'user_demo', date('now', '+21 days'),
   'Already using our basic tier. 200+ users across 5 departments.',
   'Data silos between sales and customer success teams.',
   'Customer churn increased 15% due to poor handoffs.',
   'Unified view could reduce churn by 10%, worth $2M annually.',
   4, datetime('now', '-7 days')),

  ('deal_6', 'Acme Support Add-on', 30000, 'closed_won', 'cont_6', 'comp_1', 'user_demo', date('now', '-5 days'),
   'Existing customer wanting to expand.',
   'Support team needs CRM access.',
   NULL,
   NULL,
   2, datetime('now', '-10 days'));

-- Sample activities
INSERT INTO activities (id, type, subject, content, deal_id, contact_id, company_id, owner_id, created_at) VALUES
  ('act_1', 'call', 'Discovery Call', 'Discussed current pain points with spreadsheets. John mentioned they lose track of follow-ups regularly.', 'deal_1', 'cont_1', 'comp_1', 'user_demo', datetime('now', '-7 days')),
  ('act_2', 'email', 'Proposal Follow-up', 'Sent updated proposal with volume discount.', 'deal_1', 'cont_1', 'comp_1', 'user_demo', datetime('now', '-3 days')),
  ('act_3', 'meeting', 'Demo Session', 'Showed dashboard and SPIN features. Sarah was impressed with AI insights.', 'deal_2', 'cont_2', 'comp_2', 'user_demo', datetime('now', '-5 days')),
  ('act_4', 'note', 'Internal Note', 'Need to follow up on security questionnaire.', 'deal_5', 'cont_5', 'comp_5', 'user_demo', datetime('now', '-2 days')),
  ('act_5', 'call', 'Intro Call', 'Brief intro call. Mike interested in seeing a demo.', 'deal_3', 'cont_3', 'comp_3', 'user_demo', datetime('now', '-1 day'));

-- Sample tasks
INSERT INTO tasks (id, subject, content, deal_id, contact_id, owner_id, due_date, priority) VALUES
  ('task_1', 'Send contract to Acme', 'Final contract with legal-approved terms', 'deal_1', 'cont_1', 'user_demo', date('now', '+1 day'), 'high'),
  ('task_2', 'Schedule demo with TechStart team', 'Include their full sales team for buy-in', 'deal_2', 'cont_2', 'user_demo', date('now', '+3 days'), 'medium'),
  ('task_3', 'Complete security questionnaire', 'Enterprise Systems security requirements', 'deal_5', 'cont_5', 'user_demo', date('now'), 'high'),
  ('task_4', 'Follow up with Emily', 'She mentioned budget approval in Q2', 'deal_4', 'cont_4', 'user_demo', date('now', '+7 days'), 'low'),
  ('task_5', 'Prepare case study', 'For Global Solutions meeting', 'deal_3', 'cont_3', 'user_demo', date('now', '+2 days'), 'medium');
