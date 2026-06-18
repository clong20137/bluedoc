# BlueDoc

BlueDoc is a full-stack starter for document control, training assignments, policy acknowledgements, and compliance operations.

BlueDoc follows the same split deployment style as Shield, with a dedicated Express backend and a built React frontend.

## Stack

- React + Vite
- Tailwind CSS
- Express API

## Run Locally

Start the Express backend like Shield:

```bash
cd backend
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

In another terminal, start the React frontend:

```bash
cd ..
npm install
cd frontend
npm install
npm run dev
```

The client runs at `http://127.0.0.1:5173` and proxies API requests to `http://127.0.0.1:4100`.

## MySQL

BlueDoc uses MySQL through `mysql2`. Update `backend\.env` with your local credentials before running `npm run db:setup` from the `backend` folder.

The setup script creates the `bluedoc` database and application tables.

`npm run db:setup` creates the real empty schema only. Demo starter data is optional:

```bash
npm run db:seed
```

## Shield SSO

BlueDoc uses Shield as the identity provider. The backend validates the existing `shield_session` cookie against Shield's `user_sessions` table.

Add these values to `backend\.env`:

```env
ALLOWED_ORIGINS=http://cg00kq3.state.in.us,http://localhost,http://127.0.0.1
SHIELD_APP_URL=http://cg00kq3.state.in.us/shield/
SHIELD_DB_HOST=127.0.0.1
SHIELD_DB_PORT=3306
SHIELD_DB_USER=root
SHIELD_DB_PASSWORD=your_shield_mysql_password
SHIELD_DB_NAME=shield
```

When the user is already signed into Shield on the same host, BlueDoc accepts that session. If no Shield session exists, BlueDoc lets the user sign in with Shield credentials, creates the same `shield_session` cookie, and opens the BlueDoc dashboard. Signing out from BlueDoc revokes that shared Shield session cookie.

## Express + IIS Deployment

Production builds are configured for an Express backend mounted at `/bluedoc`. IIS should point the `/bluedoc` application to:

```text
c:\inetpub\wwwroot\bluedoc
```

Build the frontend from the project root:

```bash
cd frontend
npm install
npm run build
```

Run the backend from the `backend` folder:

```bash
cd ..\backend
npm install
npm start
```

Express serves the built frontend from `frontend\dist` and exposes both API paths:

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

Recommended IIS setup, matching Shield:

- Run the Express backend separately on `127.0.0.1:4100`.
- Build the frontend from `frontend`.
- Copy the contents of `frontend\dist` into `c:\inetpub\wwwroot\bluedoc`.
- The generated `frontend\dist\web.config` is the same kind of React fallback config Shield uses.
- Configure IIS to proxy `/api/*` to `http://127.0.0.1:4100/api/*` at the site level, or keep using Vite's dev proxy during development.

IIS needs Default Document enabled for `index.html`. URL Rewrite is only needed for React deep-link fallback and API proxy rules. Application Request Routing is needed if IIS proxies `/api` to Express. Express needs access to MySQL.

For Shield-style IIS hosting, the frontend folder at `c:\inetpub\wwwroot\bluedoc` handles React routes only. API requests go to `/api`, so IIS needs a site-level rule in:

```text
c:\inetpub\wwwroot\web.config
```

Use `iis-root-web.config` as the template for that file. It proxies `/api/*` to the Express backend at `http://127.0.0.1:4100/api/*`.

## Current Workflows

- Organization overview with compliance metrics
- Controlled documents with file upload, metadata editing, file replacement, download, publishing, and deletion
- Training assignments connected to required documents
- Agency users sourced from Shield's `users` table
- Express API endpoints for documents, training, employees, and activity
