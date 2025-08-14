# cognipin-service – Job Hunt Tracker v0

Minimal REST service (NestJS + TypeORM + Postgres). Auth via Clerk (required).

## Env

- `DATABASE_URL` – Postgres connection string
- `CLERK_SECRET_KEY` – Backend secret key for verifying JWTs

## Commands

```bash
# from cognipin-service/
make db:migrate           # run migrations
make seed-platforms       # seed default platforms
make dev                  # start dev server (PORT=8080)
```

## Example usage

All requests require a valid Clerk Bearer token in `Authorization: Bearer <token>`.

```bash
# Create company (name/logo auto-derived)
curl -X POST localhost:8080/api/v1/companies \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"website_url":"https://www.linkedin.com"}'

# List platforms
curl -s localhost:8080/api/v1/platforms -H "Authorization: Bearer $CLERK_JWT"
```


