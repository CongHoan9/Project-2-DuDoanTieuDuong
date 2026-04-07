# Architecture Update 04/2026

This update aligns the project with the latest instructor requirements.

## What changed

- Prediction history is now stored in `Supabase Postgres` by setting `DATABASE_URL` to the Supabase connection string.
- The backend accepts standard Supabase Postgres URLs and normalizes them for SQLAlchemy + `psycopg`.
- The old local file `backend/diabetes_checks.db` is no longer used.
- The trained model artifacts continue to live in `backend/assets` and are loaded from the repository at runtime.
- History records now store both:
  - summary fields for the table view
  - full `input_payload` and `prediction_payload` JSON for drill-down details
- The History tab now supports clicking a record to view:
  - all 8 clinical inputs
  - AI conclusion
  - clinical interpretation
  - alerts
- recommended actions
- metric insights
- The model is warmed up once at FastAPI startup and then reused from in-memory cache for later predictions.

## Environment setup

See `backend/.env.example` for the expected runtime variables.

Important: the Supabase `publishable key` and `secret key` are not the same thing as the Postgres `DATABASE_URL`. This backend path only needs the database connection string.
