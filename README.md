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

## Current Workflows

- Organization overview with compliance metrics
- Controlled documents with review status and owners
- Training assignments connected to required documents
- Staff compliance table with acknowledgement progress
- Express API endpoints for documents, training, employees, and activity
