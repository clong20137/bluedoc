const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mammoth = require('mammoth');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const { pingDatabase, query } = require('./db');
const { initializeDatabase } = require('./initializeDatabase');
const {
  getShieldAccountForRequest,
  getShieldWorkspaceUsers,
  loginWithShieldCredentials,
  logoutShieldSession,
  requireShieldSession
} = require('./shieldAuth');

const app = express();
const port = process.env.PORT || 4100;
const appBasePath = process.env.APP_BASE_PATH || '/bluedoc';
const clientDistPath = path.join(__dirname, '..', 'frontend', 'dist');
const uploadsRoot = path.join(__dirname, 'uploads', 'documents');

fs.mkdirSync(uploadsRoot, { recursive: true });

const upload = multer({
  dest: uploadsRoot,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowed = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ]);
    const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']);

    if (allowed.has(file.mimetype) || allowedExtensions.has(extension)) {
      callback(null, true);
      return;
    }

    callback(new Error('Unsupported document type.'));
  }
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

function completionPercent(completed, assigned) {
  if (!assigned) return 0;
  return Math.round((completed / assigned) * 100);
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function wrapPreviewHtml(title, body) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #f5f7fb; color: #172033; font-family: Georgia, "Times New Roman", serif; }
    main { max-width: 960px; min-height: calc(100vh - 64px); margin: 32px auto; padding: 48px; background: #fff; border: 1px solid #d6deeb; box-shadow: 0 18px 45px rgba(23, 32, 51, .08); }
    h1, h2, h3 { font-family: Arial, sans-serif; }
    img { max-width: 100%; }
    table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; }
    th, td { border: 1px solid #d6deeb; padding: 8px; vertical-align: top; }
    th { background: #eef3f9; text-align: left; }
    p { line-height: 1.6; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function toDocument(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    owner: row.owner,
    version: row.version,
    status: row.status,
    nextReview: formatDate(row.next_review),
    requiredTraining: row.required_training,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    downloadUrl: row.file_path ? `/documents/${row.id}/download` : null,
    viewUrl: row.file_path ? `/documents/${row.id}/view` : null,
    previewUrl: row.file_path ? `/documents/${row.id}/preview` : null,
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

function removeStoredFile(filePath) {
  if (!filePath) return;

  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsRoot = path.resolve(uploadsRoot);

  if (!resolvedPath.startsWith(resolvedUploadsRoot)) {
    return;
  }

  if (fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
  }
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

async function getActivity() {
  const rows = await query(`
    SELECT *
    FROM activity
    ORDER BY created_at DESC
    LIMIT 20
  `);

  return rows.map(toActivity);
}

const apiRouter = express.Router();

apiRouter.get('/health', asyncRoute(async (req, res) => {
  await pingDatabase();
  res.json({ ok: true, name: 'BlueDoc API', database: 'connected' });
}));

apiRouter.get('/auth/session', asyncRoute(async (req, res) => {
  const account = await getShieldAccountForRequest(req);
  if (!account) {
    res.status(401).json({
      authenticated: false,
      signInUrl: process.env.SHIELD_APP_URL || 'http://cg00kq3.state.in.us/shield/'
    });
    return;
  }

  res.json({ authenticated: true, account });
}));

apiRouter.post('/auth/login', asyncRoute(async (req, res) => {
  await loginWithShieldCredentials(req, res);
}));

apiRouter.post('/auth/logout', asyncRoute(async (req, res) => {
  await logoutShieldSession(req, res);
}));

apiRouter.use(requireShieldSession);

apiRouter.get('/dashboard', asyncRoute(async (req, res) => {
  const [documents, training, employees, activity] = await Promise.all([
    getDocuments(),
    getTraining(),
    getShieldWorkspaceUsers(),
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

apiRouter.get('/documents', asyncRoute(async (req, res) => {
  res.json(await getDocuments());
}));

apiRouter.post('/documents', upload.single('document'), asyncRoute(async (req, res) => {
  if (!req.body.title || !req.body.title.trim()) {
    res.status(400).json({ error: 'Document title is required.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'Document file is required.' });
    return;
  }

  const document = {
    id: `doc-${Date.now()}`,
    title: req.body.title.trim(),
    description: req.body.description || '',
    category: req.body.category || 'Policy',
    owner: req.body.owner || 'Unassigned',
    version: req.body.version || '1.0',
    status: req.body.status || 'Draft',
    nextReview: req.body.nextReview || '2026-12-31',
    requiredTraining: req.body.requiredTraining || 'None',
    originalFileName: req.file.originalname,
    storedFileName: req.file.filename,
    filePath: req.file.path,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    uploadedBy: req.shieldAccount?.displayName || req.shieldAccount?.email || 'Unknown',
    acknowledgements: 0,
    totalAssigned: 0
  };

  await query(`
    INSERT INTO documents
      (
        id, title, description, category, owner, version, status, next_review, required_training,
        original_file_name, stored_file_name, file_path, mime_type, file_size, uploaded_by,
        acknowledgements, total_assigned
      )
    VALUES
      (
        :id, :title, :description, :category, :owner, :version, :status, :nextReview, :requiredTraining,
        :originalFileName, :storedFileName, :filePath, :mimeType, :fileSize, :uploadedBy,
        :acknowledgements, :totalAssigned
      )
  `, document);

  await query(`
    INSERT INTO document_versions
      (id, document_id, version, original_file_name, stored_file_name, file_path, mime_type, file_size, uploaded_by)
    VALUES
      (:versionId, :id, :version, :originalFileName, :storedFileName, :filePath, :mimeType, :fileSize, :uploadedBy)
  `, { ...document, versionId: `ver-${Date.now()}` });

  res.status(201).json(document);
}));

apiRouter.put('/documents/:id', asyncRoute(async (req, res) => {
  const updates = {
    id: req.params.id,
    title: req.body.title?.trim(),
    description: req.body.description || '',
    category: req.body.category || 'Policy',
    owner: req.body.owner || 'Unassigned',
    version: req.body.version || '1.0',
    status: req.body.status || 'Draft',
    nextReview: req.body.nextReview || '2026-12-31',
    requiredTraining: req.body.requiredTraining || 'None'
  };

  if (!updates.title) {
    res.status(400).json({ error: 'Document title is required.' });
    return;
  }

  await query(`
    UPDATE documents
    SET title = :title,
      description = :description,
      category = :category,
      owner = :owner,
      version = :version,
      status = :status,
      next_review = :nextReview,
      required_training = :requiredTraining
    WHERE id = :id
  `, updates);

  const rows = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  res.json(toDocument(rows[0]));
}));

apiRouter.post('/documents/:id/file', upload.single('document'), asyncRoute(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Document file is required.' });
    return;
  }

  const rows = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  if (!rows[0]) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const payload = {
    id: req.params.id,
    versionId: `ver-${Date.now()}`,
    version: req.body.version || rows[0].version,
    originalFileName: req.file.originalname,
    storedFileName: req.file.filename,
    filePath: req.file.path,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    uploadedBy: req.shieldAccount?.displayName || req.shieldAccount?.email || 'Unknown'
  };

  await query(`
    UPDATE documents
    SET version = :version,
      status = 'Draft',
      original_file_name = :originalFileName,
      stored_file_name = :storedFileName,
      file_path = :filePath,
      mime_type = :mimeType,
      file_size = :fileSize,
      uploaded_by = :uploadedBy,
      published_at = NULL,
      published_by = NULL
    WHERE id = :id
  `, payload);

  await query(`
    INSERT INTO document_versions
      (id, document_id, version, original_file_name, stored_file_name, file_path, mime_type, file_size, uploaded_by)
    VALUES
      (:versionId, :id, :version, :originalFileName, :storedFileName, :filePath, :mimeType, :fileSize, :uploadedBy)
  `, payload);

  const updated = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  res.json(toDocument(updated[0]));
}));

apiRouter.post('/documents/:id/publish', asyncRoute(async (req, res) => {
  await query(`
    UPDATE documents
    SET status = 'Active',
      published_at = CURRENT_TIMESTAMP,
      published_by = :publishedBy
    WHERE id = :id
  `, {
    id: req.params.id,
    publishedBy: req.shieldAccount?.displayName || req.shieldAccount?.email || 'Unknown'
  });

  const rows = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  if (!rows[0]) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  res.json(toDocument(rows[0]));
}));

apiRouter.get('/documents/:id/download', asyncRoute(async (req, res) => {
  const rows = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  const document = rows[0];

  if (!document?.file_path || !fs.existsSync(document.file_path)) {
    res.status(404).json({ error: 'Document file not found.' });
    return;
  }

  res.download(document.file_path, document.original_file_name || `${document.title}.pdf`);
}));

apiRouter.get('/documents/:id/view', asyncRoute(async (req, res) => {
  const rows = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  const document = rows[0];

  if (!document?.file_path || !fs.existsSync(document.file_path)) {
    res.status(404).json({ error: 'Document file not found.' });
    return;
  }

  res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.original_file_name || document.title)}"`);
  res.sendFile(path.resolve(document.file_path));
}));

apiRouter.get('/documents/:id/preview', asyncRoute(async (req, res) => {
  const rows = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  const document = rows[0];

  if (!document?.file_path || !fs.existsSync(document.file_path)) {
    res.status(404).send(wrapPreviewHtml('Document not found', '<h1>Document file not found.</h1>'));
    return;
  }

  const fileName = String(document.original_file_name || '').toLowerCase();
  const filePath = path.resolve(document.file_path);
  const title = document.title || document.original_file_name || 'BlueDoc preview';

  if (fileName.endsWith('.pdf')) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.original_file_name || title)}"`);
    res.sendFile(filePath);
    return;
  }

  if (fileName.endsWith('.docx')) {
    const result = await mammoth.convertToHtml({ path: filePath });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(wrapPreviewHtml(title, result.value || '<p>This Word document did not contain previewable text.</p>'));
    return;
  }

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    const body = sheet
      ? `<h1>${escapeHtml(firstSheetName)}</h1>${xlsx.utils.sheet_to_html(sheet)}`
      : '<p>This spreadsheet did not contain previewable sheets.</p>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(wrapPreviewHtml(title, body));
    return;
  }

  if (fileName.endsWith('.txt') || document.mime_type === 'text/plain') {
    const text = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(wrapPreviewHtml(title, `<pre>${escapeHtml(text)}</pre>`));
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(415).send(wrapPreviewHtml(title, '<h1>Preview is not available for this file type.</h1><p>Download the file to view it locally.</p>'));
}));

apiRouter.delete('/documents/:id', asyncRoute(async (req, res) => {
  const documents = await query('SELECT * FROM documents WHERE id = :id LIMIT 1', { id: req.params.id });
  const document = documents[0];

  if (!document) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const versions = await query('SELECT file_path FROM document_versions WHERE document_id = :id', { id: req.params.id });

  await query('DELETE FROM documents WHERE id = :id', { id: req.params.id });

  const pathsToRemove = new Set([
    document.file_path,
    ...versions.map((version) => version.file_path)
  ].filter(Boolean));

  for (const filePath of pathsToRemove) {
    removeStoredFile(filePath);
  }

  res.json({ deleted: true, id: req.params.id });
}));

apiRouter.get('/training', asyncRoute(async (req, res) => {
  res.json(await getTraining());
}));

apiRouter.get('/employees', asyncRoute(async (req, res) => {
  res.json(await getShieldWorkspaceUsers());
}));

app.use('/api', apiRouter);
app.use(`${appBasePath}/api`, apiRouter);

app.use(appBasePath, express.static(clientDistPath));

app.get('/', (req, res) => {
  res.redirect(appBasePath);
});

app.get(appBasePath, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.get(`${appBasePath}/*`, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: 'BlueDoc API error',
    message: process.env.NODE_ENV === 'production' ? 'Unexpected server error.' : error.message
  });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`BlueDoc Express app listening on http://127.0.0.1:${port}${appBasePath}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize BlueDoc database:', error);
    process.exit(1);
  });
