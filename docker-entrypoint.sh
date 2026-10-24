#!/bin/sh
set -e

# Validate required production environment variables
if [ -z "$JWT_SECRET" ]; then
  echo "Error: JWT_SECRET environment variable is required but not set." >&2
  echo "Please set JWT_SECRET before starting the container." >&2
  exit 1
fi

# Run migrations and baseline seeds at container runtime with mounted volume
echo "==> Running database migrations and seeds..."
npm run db:migrate || true
npm run seed || true

echo "==> Starting application server..."
exec "$@"
