# LabSpace

LabSpace is a web and mobile app for managing laboratory room bookings and equipment loans.

## Deploy web and API on one Railway service

This setup serves the web app and API from the same existing Railway service, so the public API domain also opens the website. It avoids creating a second Railway app service, though normal usage of the existing Railway service can still incur charges. Keep the MySQL service private.

Push this repository to the `main` branch. In the Railway API service, set the **Root Directory** to `/` (the repository root) and the **Railway Config File** to `/railway.json`. The config file path is independent of the root directory. Both Railway config files use the combined build so a stale config-file selection still builds the web export and API. The server serves the website at `/`, `/dashboard`, and `/feature`, while the API remains under `/api`.

### MySQL

Create or use a MySQL service in the same Railway project and region. Do not enable public TCP access. In the API service's Variables, select variable references from the MySQL service; replace `MySQL` with its exact service name:

```text
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=<unique random secret, at least 32 characters>
JWT_EXPIRES_IN=8h
```

The API listens on Railway's `PORT` and binds to `0.0.0.0`. Its `/health` endpoint checks the database connection.

After MySQL is ready and the API service is deployed, open the API service shell and run:

```sh
npm run db:init
```

This creates the tables but does not create student accounts or import old data. To create an initial lab-head account in an empty database, temporarily set `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in Railway, then run `npm run db:bootstrap-admin`. The password must be at least 12 characters; remove those temporary variables afterwards.

Once deployed, open the API service's public HTTPS domain directly to see the website. `/health` should return `{"status":"ok", ...}` and `/api/...` remains the API. The web app defaults to the same-origin `/api` on a public domain; no separate Web service or `EXPO_PUBLIC_API_URL` is required.

Do not commit `.env` files, passwords, database URLs, or JWT secrets. Railway variables are separate from local `.env` files.

## Run locally

1. Copy `oasis-backend/.env.example` to `oasis-backend/.env`, configure MySQL and a unique `JWT_SECRET`, then run `npm install`, `npm run db:init`, and `npm run dev` from `oasis-backend`.
2. For an empty database, set the three `BOOTSTRAP_ADMIN_*` variables temporarily and run `npm run db:bootstrap-admin`.
3. Copy `oasis-mobile/.env.example` to `oasis-mobile/.env`. In `oasis-mobile`, run `npm install`, then `npm run web`.
