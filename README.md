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

## Express + IIS Deployment

Production builds are configured for an Express backend mounted at `/bluedoc`. IIS should point the `/bluedoc` application to:

```text
c:\inetpub\bluedoc
```

Deploy the full project folder there, not only `dist`, because Express and MySQL live in the Node backend. Then install dependencies and build:

```bash
npm install
npm run build
npm start
```

Express serves the built frontend from `dist` and exposes both API paths:

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

There are two supported IIS shapes:

- Full Express app in `c:\inetpub\bluedoc`: use the root `web.config` with iisnode so IIS runs `server/index.js`.
- Static `dist` folder only: use `dist\web.config` with URL Rewrite + Application Request Routing proxying to a separately running Express process on `127.0.0.1:4100`.

The full Express app setup needs iisnode installed. The static proxy setup needs IIS URL Rewrite and Application Request Routing installed with proxying enabled. In both setups, Express needs access to MySQL.

## Current Workflows

- Organization overview with compliance metrics
- Controlled documents with review status and owners
- Training assignments connected to required documents
- Staff compliance table with acknowledgement progress
- Express API endpoints for documents, training, employees, and activity
