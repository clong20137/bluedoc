import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  Download,
  Edit3,
  Trash2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  Upload,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const SHIELD_SIGN_IN_URL = import.meta.env.VITE_SHIELD_SIGN_IN_URL || 'http://cg00kq3.state.in.us/shield/';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'people', label: 'People', icon: Users }
];

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  return fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
}

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    title: '',
    category: 'Policy',
    owner: '',
    description: '',
    version: '1.0',
    nextReview: '2026-12-31',
    requiredTraining: 'None',
    file: null
  });
  const [editingDocumentId, setEditingDocumentId] = useState(null);

  async function loadSession() {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/auth/session');

      if (response.status === 401) {
        setSession({ authenticated: false, signInUrl: SHIELD_SIGN_IN_URL });
        return null;
      }

      if (!response.ok) {
        throw new Error('BlueDoc could not validate your Shield session.');
      }

      const payload = await response.json();
      setSession(payload);
      return payload;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/dashboard');

      if (response.status === 401) {
        setSession({ authenticated: false, signInUrl: SHIELD_SIGN_IN_URL });
        return;
      }

      if (!response.ok) {
        throw new Error('BlueDoc could not connect to the database.');
      }

      const payload = await response.json();
      setDashboard(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession().then((payload) => {
      if (payload?.authenticated) {
        loadDashboard();
      }
    });
  }, []);

  const filteredDocuments = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.documents.filter((document) => {
      const searchable = `${document.title} ${document.owner} ${document.category} ${document.status}`.toLowerCase();
      return searchable.includes(query.toLowerCase());
    });
  }, [dashboard, query]);

  async function addDocument(event) {
    event.preventDefault();
    if (!documentForm.title.trim()) return;

    const formData = new FormData();
    formData.append('title', documentForm.title);
    formData.append('category', documentForm.category);
    formData.append('owner', documentForm.owner);
    formData.append('description', documentForm.description);
    formData.append('version', documentForm.version);
    formData.append('nextReview', documentForm.nextReview);
    formData.append('requiredTraining', documentForm.requiredTraining);

    if (documentForm.file) {
      formData.append('document', documentForm.file);
    }

    if (editingDocumentId) {
      await apiFetch(`/documents/${editingDocumentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: documentForm.title,
          category: documentForm.category,
          owner: documentForm.owner,
          description: documentForm.description,
          version: documentForm.version,
          nextReview: documentForm.nextReview,
          requiredTraining: documentForm.requiredTraining,
          status: 'Draft'
        })
      });

      if (documentForm.file) {
        await apiFetch(`/documents/${editingDocumentId}/file`, {
          method: 'POST',
          body: formData
        });
      }
    } else {
      await apiFetch('/documents', {
        method: 'POST',
        body: formData
      });
    }

    setDocumentForm({
      title: '',
      category: 'Policy',
      owner: '',
      description: '',
      version: '1.0',
      nextReview: '2026-12-31',
      requiredTraining: 'None',
      file: null
    });
    setEditingDocumentId(null);
    await loadDashboard();
    setActiveTab('documents');
  }

  function editDocument(document) {
    setEditingDocumentId(document.id);
    setDocumentForm({
      title: document.title || '',
      category: document.category || 'Policy',
      owner: document.owner || '',
      description: document.description || '',
      version: document.version || '1.0',
      nextReview: document.nextReview || '2026-12-31',
      requiredTraining: document.requiredTraining || 'None',
      file: null
    });
    setActiveTab('documents');
  }

  async function publishDocument(documentId) {
    await apiFetch(`/documents/${documentId}/publish`, { method: 'POST' });
    await loadDashboard();
  }

  async function deleteDocument(document) {
    const confirmed = window.confirm(`Delete "${document.title}" from BlueDoc? This removes the stored file and version history.`);
    if (!confirmed) return;

    await apiFetch(`/documents/${document.id}`, { method: 'DELETE' });
    await loadDashboard();
  }

  async function signInWithShield(event) {
    event.preventDefault();
    setIsSigningIn(true);
    setLoginError('');

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to sign in with Shield credentials.');
      }

      setSession({ authenticated: true, account: payload.account });
      setLoginForm({ email: '', password: '' });
      await loadDashboard();
    } catch (requestError) {
      setLoginError(requestError.message);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut() {
    await apiFetch('/auth/logout', { method: 'POST' });
    setDashboard(null);
    setSession({ authenticated: false, signInUrl: SHIELD_SIGN_IN_URL });
    setActiveTab('overview');
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-field text-ink">
        <div className="flex items-center gap-3 rounded border border-line bg-white px-5 py-4 shadow-panel">
          <ShieldCheck className="h-6 w-6 text-harbor" />
          <span className="text-sm font-semibold">Loading BlueDoc workspace</span>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    if (session && !session.authenticated) {
      return (
        <main className="grid min-h-screen place-items-center bg-field px-4 text-ink">
          <div className="max-w-md rounded border border-line bg-white p-6 shadow-panel">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-harbor" />
              <h1 className="text-xl font-bold">Sign in with Shield</h1>
            </div>
          <p className="mt-3 text-sm text-slategray">
              Use your Shield credentials to open the BlueDoc dashboard.
            </p>
            <form onSubmit={signInWithShield} className="mt-5 space-y-4">
              <Field label="Email">
                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  className="input"
                  type="email"
                  autoComplete="email"
                />
              </Field>
              <Field label="Password">
                <input
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="input"
                  type="password"
                  autoComplete="current-password"
                />
              </Field>
              {loginError && <p className="text-sm font-semibold text-rose">{loginError}</p>}
              <button
                type="submit"
                disabled={isSigningIn}
                className="inline-flex h-10 w-full items-center justify-center rounded bg-harbor px-4 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSigningIn ? 'Signing in' : 'Sign in'}
              </button>
            </form>
            <a href={session.signInUrl || SHIELD_SIGN_IN_URL} className="mt-4 inline-flex text-sm font-semibold text-harbor">
              Open Shield instead
            </a>
          </div>
        </main>
      );
    }

    return (
      <main className="grid min-h-screen place-items-center bg-field px-4 text-ink">
        <div className="max-w-md rounded border border-line bg-white p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber" />
            <h1 className="text-xl font-bold">Database connection needed</h1>
          </div>
          <p className="mt-3 text-sm text-slategray">
            {error || 'BlueDoc could not load its workspace data.'} Check the MySQL service and environment settings, then try again.
          </p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-5 inline-flex h-10 items-center justify-center rounded bg-harbor px-4 text-sm font-semibold text-white transition hover:bg-ink"
          >
            Retry connection
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-field text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-line bg-white px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded bg-harbor text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">BlueDoc</h1>
            <p className="text-xs font-medium uppercase tracking-wide text-slategray">Command library</p>
          </div>
        </div>
        {session?.account && (
          <div className="mt-6 rounded border border-line bg-white p-3 text-sm">
            <p className="font-semibold">{session.account.displayName}</p>
            <p className="text-xs text-slategray">{session.account.email}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded border border-line bg-field text-xs font-semibold text-slategray transition hover:border-rose hover:text-rose"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}

        <nav className="mt-9 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-sm font-semibold transition',
                  activeTab === tab.id ? 'bg-harbor text-white' : 'text-slategray hover:bg-field hover:text-ink'
                )}
                title={tab.label}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-10 rounded border border-line bg-field p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slategray">Compliance pulse</p>
          <p className="mt-3 text-3xl font-bold">{dashboard.metrics.compliance}%</p>
          <p className="mt-1 text-sm text-slategray">Training completions across assigned policies and procedures.</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-harbor">Policy, training, and accountability in one system</p>
              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Agency Operations Workspace</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slategray" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search documents, owners, status"
                  className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20"
                />
              </label>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-harbor px-4 text-sm font-semibold text-white transition hover:bg-ink"
              >
                <Plus className="h-4 w-4" />
                New document
              </button>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex h-10 items-center justify-center gap-2 rounded border border-line bg-white px-4 text-sm font-semibold text-slategray transition hover:border-rose hover:text-rose lg:hidden"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>

          <nav className="mt-4 grid grid-cols-4 gap-2 lg:hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={classNames(
                    'flex h-11 items-center justify-center rounded border text-sm font-semibold',
                    activeTab === tab.id ? 'border-harbor bg-harbor text-white' : 'border-line bg-field text-slategray'
                  )}
                  title={tab.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </nav>
        </header>

        <main className="px-4 py-6 sm:px-7">
          {activeTab === 'overview' && <Overview dashboard={dashboard} />}
          {activeTab === 'documents' && (
            <Documents
              documents={filteredDocuments}
              form={documentForm}
              setForm={setDocumentForm}
              editingDocumentId={editingDocumentId}
              onEdit={editDocument}
              onPublish={publishDocument}
              onDelete={deleteDocument}
              onSubmit={addDocument}
              onCancel={() => {
                setEditingDocumentId(null);
                setDocumentForm({
                  title: '',
                  category: 'Policy',
                  owner: '',
                  description: '',
                  version: '1.0',
                  nextReview: '2026-12-31',
                  requiredTraining: 'None',
                  file: null
                });
              }}
            />
          )}
          {activeTab === 'training' && <Training training={dashboard.training} />}
          {activeTab === 'people' && <People employees={dashboard.employees} />}
        </main>
      </div>
    </div>
  );
}

function Overview({ dashboard }) {
  const metricCards = [
    { label: 'Compliance', value: `${dashboard.metrics.compliance}%`, icon: ClipboardCheck, tone: 'text-mint' },
    { label: 'Active documents', value: dashboard.metrics.activeDocuments, icon: FileCheck2, tone: 'text-harbor' },
    { label: 'Review queue', value: dashboard.metrics.reviewQueue, icon: Activity, tone: 'text-amber' },
    { label: 'Staff tracked', value: dashboard.metrics.staffTracked, icon: Users, tone: 'text-signal' }
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded border border-line bg-white p-5 shadow-panel">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slategray">{metric.label}</p>
                <Icon className={classNames('h-5 w-5', metric.tone)} />
              </div>
              <p className="mt-4 text-3xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-lg font-bold">Training tied to controlled documents</h3>
          </div>
          <div className="divide-y divide-line">
            {dashboard.training.map((item) => (
              <TrainingRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        <div className="rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-lg font-bold">Recent activity</h3>
          </div>
          <div className="space-y-4 p-5">
            {dashboard.activity.map((item) => (
              <div key={item.id} className="border-l-2 border-signal pl-4">
                <p className="font-semibold">{item.event}</p>
                <p className="mt-1 text-sm text-slategray">{item.detail}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slategray">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Documents({ documents, form, setForm, editingDocumentId, onEdit, onPublish, onDelete, onSubmit, onCancel }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="rounded border border-line bg-white shadow-panel">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-lg font-bold">Document library</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-field">
              <tr>
                {['Document', 'Owner', 'Status', 'File', 'Actions'].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slategray">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.map((document) => (
                <tr key={document.id} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{document.title}</p>
                    <p className="mt-1 text-sm text-slategray">
                      {document.category} - v{document.version} - review {document.nextReview}
                    </p>
                    {document.description && <p className="mt-2 text-sm text-slategray">{document.description}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-slategray">{document.owner}</td>
                  <td className="px-5 py-4">
                    <StatusPill status={document.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slategray">
                    {document.originalFileName || 'No file'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {document.downloadUrl && (
                        <a
                          href={apiUrl(document.downloadUrl)}
                          className="inline-flex h-8 items-center gap-1 rounded border border-line px-2 text-xs font-semibold text-slategray hover:text-harbor"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(document)}
                        className="inline-flex h-8 items-center gap-1 rounded border border-line px-2 text-xs font-semibold text-slategray hover:text-harbor"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onPublish(document.id)}
                        className="inline-flex h-8 items-center gap-1 rounded border border-mint/30 bg-mint/10 px-2 text-xs font-semibold text-mint hover:bg-mint hover:text-white"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(document)}
                        className="inline-flex h-8 items-center gap-1 rounded border border-rose/30 bg-rose/10 px-2 text-xs font-semibold text-rose hover:bg-rose hover:text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded border border-line bg-white p-5 shadow-panel">
        <h3 className="text-lg font-bold">{editingDocumentId ? 'Edit controlled document' : 'Upload controlled document'}</h3>
        <div className="mt-5 space-y-4">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="input"
              placeholder="Policy or procedure name"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className="input"
            >
              <option>Policy</option>
              <option>Procedure</option>
              <option>Standard</option>
              <option>Training Guide</option>
            </select>
          </Field>
          <Field label="Owner">
            <input
              value={form.owner}
              onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
              className="input"
              placeholder="Division or unit"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full rounded border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20"
              placeholder="Purpose, scope, or review notes"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Version">
              <input
                value={form.version}
                onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                className="input"
              />
            </Field>
            <Field label="Review date">
              <input
                type="date"
                value={form.nextReview}
                onChange={(event) => setForm((current) => ({ ...current, nextReview: event.target.value }))}
                className="input"
              />
            </Field>
          </div>
          <Field label="Required training">
            <input
              value={form.requiredTraining}
              onChange={(event) => setForm((current) => ({ ...current, requiredTraining: event.target.value }))}
              className="input"
              placeholder="None"
            />
          </Field>
          <Field label={editingDocumentId ? 'Replace file' : 'Document file'}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
              className="block w-full text-sm text-slategray file:mr-3 file:h-10 file:rounded file:border-0 file:bg-field file:px-3 file:text-sm file:font-semibold file:text-harbor"
            />
          </Field>
          <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-harbor px-4 text-sm font-semibold text-white transition hover:bg-ink">
            <Upload className="h-4 w-4" />
            {editingDocumentId ? 'Save changes' : 'Upload to library'}
          </button>
          {editingDocumentId && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 w-full items-center justify-center rounded border border-line bg-white px-4 text-sm font-semibold text-slategray transition hover:text-ink"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function Training({ training }) {
  return (
    <section className="rounded border border-line bg-white shadow-panel">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-lg font-bold">Training assignments</h3>
      </div>
      <div className="divide-y divide-line">
        {training.map((item) => (
          <TrainingRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function People({ employees }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {employees.map((employee) => (
        <div key={employee.id} className="rounded border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">{employee.name}</h3>
              <p className="mt-1 text-sm text-slategray">{employee.role} - {employee.unit}</p>
              <p className="mt-1 text-xs text-slategray">{employee.email}</p>
            </div>
            <div className={classNames('rounded px-2.5 py-1 text-xs font-bold', employee.isActive ? 'bg-mint/10 text-mint' : 'bg-rose/10 text-rose')}>
              {employee.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
          <ProgressBar value={employee.compliance} />
          <p className="mt-2 text-sm font-semibold">Training compliance pending assignment data</p>
        </div>
      ))}
    </section>
  );
}

function TrainingRow({ item }) {
  return (
    <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_11rem] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-harbor" />
          <h4 className="font-semibold">{item.name}</h4>
        </div>
        <p className="mt-1 text-sm text-slategray">{item.documentTitle} - {item.mode} - due {item.dueDate}</p>
        <ProgressBar value={item.percentComplete} />
      </div>
      <div className="text-left md:text-right">
        <p className="text-2xl font-bold">{item.percentComplete}%</p>
        <p className="text-sm text-slategray">{item.completed}/{item.assigned} completed</p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    Active: 'bg-mint/10 text-mint',
    'In Review': 'bg-amber/10 text-amber',
    Draft: 'bg-signal/10 text-signal'
  };

  return <span className={classNames('rounded px-2.5 py-1 text-xs font-bold', styles[status])}>{status}</span>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slategray">{label}</span>
      {children}
    </label>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded bg-line">
      <div className="h-full rounded bg-harbor" style={{ width: `${value}%` }} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
