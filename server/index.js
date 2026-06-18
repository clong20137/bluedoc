const express = require('express');
const cors = require('cors');
const { pingDatabase, query } = require('./db');

const app = express();
const port = process.env.PORT || 4100;

app.use(cors());
app.use(express.json());

function completionPercent(completed, assigned) {
  if (!assigned) return 0;
  return Math.round((completed / assigned) * 100);
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function toDocument(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    owner: row.owner,
    version: row.version,
    status: row.status,
    nextReview: formatDate(row.next_review),
    requiredTraining: row.required_training,
    acknowledgements: row.acknowledgements,
    totalAssigned: row.total_assigned
  };
}

function toTraining(row) {
  return {
    id: row.id,
    name: row.name,
    documentId: row.document_id,
    documentTitle: row.document_title,
    dueDate: formatDate(row.due_date),
    assigned: row.assigned,
    completed: row.completed,
    mode: row.mode,
    percentComplete: completionPercent(row.completed, row.assigned)
  };
}

function toEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    unit: row.unit,
    compliance: row.compliance,
    overdue: row.overdue
  };
}

function toActivity(row) {
  return {
    id: row.id,
    event: row.event,
    detail: row.detail,
    time: row.event_time
  };
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function getDocuments() {
  const rows = await query(`
    SELECT *
    FROM documents
    ORDER BY created_at DESC, title ASC
  `);

  return rows.map(toDocument);
}

async function getTraining() {
  const rows = await query(`
    SELECT
      training.*,
      documents.title AS document_title
    FROM training
    LEFT JOIN documents ON documents.id = training.document_id
    ORDER BY training.due_date ASC
  `);

  return rows.map(toTraining);
}

async function getEmployees() {
  const rows = await query(`
    SELECT *
    FROM employees
    ORDER BY name ASC
  `);

  return rows.map(toEmployee);
}

async function getActivity() {
  const rows = await query(`
    SELECT *
    FROM activity
    ORDER BY created_at DESC
    LIMIT 20
  `);

  return rows.map(toActivity);
}

app.get('/api/health', asyncRoute(async (req, res) => {
  await pingDatabase();
  res.json({ ok: true, name: 'BlueDoc API', database: 'connected' });
}));

app.get('/api/dashboard', asyncRoute(async (req, res) => {
  const [documents, training, employees, activity] = await Promise.all([
    getDocuments(),
    getTraining(),
    getEmployees(),
    getActivity()
  ]);

  const assigned = training.reduce((sum, item) => sum + item.assigned, 0);
  const completed = training.reduce((sum, item) => sum + item.completed, 0);
  const activeDocuments = documents.filter((item) => item.status === 'Active').length;
  const reviewQueue = documents.filter((item) => item.status !== 'Active').length;

  res.json({
    metrics: {
      compliance: completionPercent(completed, assigned),
      activeDocuments,
      reviewQueue,
      staffTracked: employees.length
    },
    documents,
    training,
    employees,
    activity
  });
}));

app.get('/api/documents', asyncRoute(async (req, res) => {
  res.json(await getDocuments());
}));

app.post('/api/documents', asyncRoute(async (req, res) => {
  if (!req.body.title || !req.body.title.trim()) {
    res.status(400).json({ error: 'Document title is required.' });
    return;
  }

  const document = {
    id: `doc-${Date.now()}`,
    title: req.body.title.trim(),
    category: req.body.category || 'Policy',
    owner: req.body.owner || 'Unassigned',
    version: req.body.version || '1.0',
    status: req.body.status || 'Draft',
    nextReview: req.body.nextReview || '2026-12-31',
    requiredTraining: req.body.requiredTraining || 'None',
    acknowledgements: 0,
    totalAssigned: 0
  };

  await query(`
    INSERT INTO documents
      (id, title, category, owner, version, status, next_review, required_training, acknowledgements, total_assigned)
    VALUES
      (:id, :title, :category, :owner, :version, :status, :nextReview, :requiredTraining, :acknowledgements, :totalAssigned)
  `, document);

  res.status(201).json(document);
}));

app.get('/api/training', asyncRoute(async (req, res) => {
  res.json(await getTraining());
}));

app.get('/api/employees', asyncRoute(async (req, res) => {
  res.json(await getEmployees());
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: 'BlueDoc API error',
    message: process.env.NODE_ENV === 'production' ? 'Unexpected server error.' : error.message
  });
});

app.listen(port, () => {
  console.log(`BlueDoc API listening on http://127.0.0.1:${port}`);
});
