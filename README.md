# BlueDoc

BlueDoc is a full-stack starter for document control, training assignments, policy acknowledgements, and compliance operations.

## Stack

- React + Vite
- Tailwind CSS
- Express API

## Run Locally

```bash
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

The client runs at `http://127.0.0.1:5173` and proxies API requests to `http://127.0.0.1:4100`.

## MySQL

BlueDoc uses MySQL through `mysql2`. Update `.env` with your local credentials before running `npm run db:setup`.

The setup script creates the `bluedoc` database, creates the application tables, and seeds starter records for documents, training, employees, and activity.

## IIS Deployment

Production builds are configured for an IIS application mounted at `/bluedoc`, with static files copied to:

```text
c:\inetpub\bluedoc
```

Build the React app:

```bash
npm run build
```

Copy the contents of `dist` into `c:\inetpub\bluedoc`.

The production frontend uses:

```text
VITE_APP_BASE_PATH=/bluedoc/
VITE_API_BASE_URL=/bluedoc/api
```

The generated `dist\web.config` includes:

- A React fallback rule so refreshes work under `/bluedoc`
- An optional reverse proxy rule from `/bluedoc/api/*` to the Express API at `http://127.0.0.1:4100/api/*`

For the proxy rule, IIS needs URL Rewrite and Application Request Routing installed and proxying enabled. The Express API still needs to run as a Node process on the server with access to MySQL.

## Current Workflows

- Organization overview with compliance metrics
- Controlled documents with review status and owners
- Training assignments connected to required documents
- Staff compliance table with acknowledgement progress
- Express API endpoints for documents, training, employees, and activity
