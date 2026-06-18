# BlueDoc

BlueDoc is a full-stack starter for document control, training assignments, policy acknowledgements, and compliance operations.

## Stack

- React + Vite
- Tailwind CSS
- Express API

## Run Locally

Start the Express backend like Shield:

```bash
cd server
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

In another terminal, start the React frontend:

```bash
cd ..
npm install
npm run dev:client
```

The client runs at `http://127.0.0.1:5173` and proxies API requests to `http://127.0.0.1:4100`.

## MySQL

BlueDoc uses MySQL through `mysql2`. Update `server\.env` with your local credentials before running `npm run db:setup` from the `server` folder.

The setup script creates the `bluedoc` database, creates the application tables, and seeds starter records for documents, training, employees, and activity.

## Express + IIS Deployment

Production builds are configured for an Express backend mounted at `/bluedoc`. IIS should point the `/bluedoc` application to:

```text
c:\inetpub\wwwroot\bluedoc
```

Build the frontend from the project root:

```bash
npm install
npm run build
```

Run the backend from the `server` folder:

```bash
cd server
npm install
npm start
```

Express serves the built frontend from the project root `dist` folder and exposes both API paths:

```text
http://127.0.0.1:4100/api
http://127.0.0.1:4100/bluedoc/api
```

The production frontend uses:

```text
VITE_APP_BASE_PATH=/bluedoc/
VITE_API_BASE_URL=/bluedoc/api
```

The generated `dist\web.config` routes all `/bluedoc` traffic through Express at `http://127.0.0.1:4100/bluedoc`.

Recommended IIS setup:

- Run Express separately on `127.0.0.1:4100`.
- Make `c:\inetpub\wwwroot\bluedoc` an IIS Application with alias `bluedoc`.
- Put the root `web.config` in `c:\inetpub\wwwroot\bluedoc\web.config`.
- The IIS rule proxies `/bluedoc/*` to `http://127.0.0.1:4100/bluedoc/*`.

IIS needs URL Rewrite and Application Request Routing installed with proxying enabled. Express needs access to MySQL.

## Current Workflows

- Organization overview with compliance metrics
- Controlled documents with review status and owners
- Training assignments connected to required documents
- Staff compliance table with acknowledgement progress
- Express API endpoints for documents, training, employees, and activity
