# LabSpace web and mobile app

For Railway deployment of the API, MySQL database, and public web app, follow the repository's [deployment guide](../README.md#deploy-the-complete-app-to-railway).

## Run locally

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.
2. Install dependencies with `npm install`.
3. Run `npm run web` for development or `npm run build:web` to export the production web app.
4. To serve the production export locally, run `npm run serve:web` after building.
