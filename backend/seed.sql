USE bluedoc;

INSERT INTO documents
  (id, title, category, owner, version, status, next_review, required_training, acknowledgements, total_assigned)
VALUES
  ('doc-100', 'Use of Force Policy', 'Policy', 'Operations Command', '4.2', 'Active', '2026-08-14', 'Annual Policy Review', 82, 96),
  ('doc-141', 'Evidence Intake Procedure', 'Procedure', 'Records Unit', '2.7', 'In Review', '2026-07-02', 'Property Room Handling', 34, 41),
  ('doc-212', 'Cybersecurity Awareness Standard', 'Standard', 'IT Services', '1.5', 'Active', '2026-09-25', 'Security Refresher', 119, 124),
  ('doc-318', 'Emergency Vehicle Operations', 'Training Guide', 'Training Division', '3.1', 'Draft', '2026-06-28', 'EVOC Practical', 18, 77)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = VALUES(category),
  owner = VALUES(owner),
  version = VALUES(version),
  status = VALUES(status),
  next_review = VALUES(next_review),
  required_training = VALUES(required_training),
  acknowledgements = VALUES(acknowledgements),
  total_assigned = VALUES(total_assigned);

INSERT INTO training
  (id, name, document_id, due_date, assigned, completed, mode)
VALUES
  ('trn-500', 'Annual Policy Review', 'doc-100', '2026-07-31', 96, 82, 'Self-paced'),
  ('trn-501', 'Property Room Handling', 'doc-141', '2026-07-10', 41, 34, 'Instructor led'),
  ('trn-502', 'Security Refresher', 'doc-212', '2026-08-09', 124, 119, 'Self-paced'),
  ('trn-503', 'EVOC Practical', 'doc-318', '2026-07-18', 77, 18, 'Practical')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  document_id = VALUES(document_id),
  due_date = VALUES(due_date),
  assigned = VALUES(assigned),
  completed = VALUES(completed),
  mode = VALUES(mode);

INSERT INTO employees
  (id, name, role, unit, compliance, overdue)
VALUES
  ('emp-1', 'Jordan Lee', 'Patrol Supervisor', 'Patrol', 96, 0),
  ('emp-2', 'Maya Patel', 'Records Specialist', 'Records', 88, 1),
  ('emp-3', 'Chris Morgan', 'Training Coordinator', 'Training', 73, 3),
  ('emp-4', 'Avery Brooks', 'IT Analyst', 'Technology', 100, 0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  unit = VALUES(unit),
  compliance = VALUES(compliance),
  overdue = VALUES(overdue);

INSERT INTO activity
  (id, event, detail, event_time)
VALUES
  ('act-1', 'Version 4.2 published', 'Use of Force Policy moved to active library', 'Today, 9:42 AM'),
  ('act-2', 'Assignment created', 'EVOC Practical assigned to Patrol cohort', 'Yesterday, 4:18 PM'),
  ('act-3', 'Review requested', 'Records Unit requested approval on Evidence Intake Procedure', 'Yesterday, 11:03 AM')
ON DUPLICATE KEY UPDATE
  event = VALUES(event),
  detail = VALUES(detail),
  event_time = VALUES(event_time);
