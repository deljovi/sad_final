# OASIS

OASIS is a web and mobile app for managing laboratory room bookings and equipment loans.

## Public deployment: Railway + Vercel

The web app and API are public over HTTPS; keep the MySQL service private so only the API can reach it. Never commit `.env` files, passwords, database URLs, or JWT secrets.

### 1. Deploy the API and MySQL on Railway

1. Push this repository to a Git provider account you control, then create a Railway project from that repository.
2. Set the API service's **Root Directory** to `/oasis-backend`. Railway will use `railway.json` to start the API and check `/health`.
3. Add a Railway MySQL service. Keep its public TCP access disabled.
4. In the API service's Variables, add database references to the MySQL service. Use Railway's variable-reference picker (or replace `MySQL` with the exact database service name):

   ```text
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   JWT_SECRET=<a unique random secret of at least 32 characters>
   JWT_EXPIRES_IN=8h
   CORS_ORIGIN=http://localhost:8081
   ```

5. After the API service can connect to MySQL, open a shell for the API service and run `npm run db:init` once. This creates the database tables.
6. Create the first lab-head account. Temporarily add `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` to the API service's Variables. The password must have at least 12 characters. In the API service shell, run `npm run db:bootstrap-admin`, then remove those three temporary variables. This command only works while the `users` table is empty.
7. Generate a public HTTPS domain for the API service in Railway and note its URL.

### 2. Deploy the web app on Vercel

1. Import the same repository into Vercel and set **Root Directory** to `oasis-mobile`.
2. Set the Vercel environment variable `EXPO_PUBLIC_API_URL` to `https://<your-railway-api-domain>/api`.
3. Deploy. The build command and output directory are configured in `vercel.json`.
4. Copy the deployed Vercel HTTPS origin (for example, `https://oasis.example.vercel.app`) into the Railway API service's `CORS_ORIGIN` variable. Redeploy the API after changing it. For multiple allowed origins, separate them with commas.

The frontend embeds `EXPO_PUBLIC_API_URL` at build time, so redeploy the web app whenever that value changes. `CORS_ORIGIN` is an origin only (scheme + host, no `/api` path). The database must not be exposed publicly; only expose the API.

## Run locally

1. Start MySQL and copy `oasis-backend/.env.example` to `oasis-backend/.env`. Set the database credentials and a unique `JWT_SECRET`.
2. In `oasis-backend`, run `npm install`, `npm run db:init`, then `npm run dev`.
3. For an empty database, set the three `BOOTSTRAP_ADMIN_*` variables temporarily and run `npm run db:bootstrap-admin`.
4. Copy this folder's `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.
   - Web/iOS simulator: `http://localhost:3000/api`
   - Android emulator: `http://10.0.2.2:3000/api`
   - Physical device: use the computer's LAN IP address.
5. In `oasis-mobile`, run `npm install` and `npm run web` (or `npm start` for Expo).
