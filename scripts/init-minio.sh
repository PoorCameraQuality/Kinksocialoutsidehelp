#!/usr/bin/env bash
# Optional: create bucket when MinIO runs outside docker-compose minio-init.
# With docker-compose.dev.yml, the minio-init service runs mc automatically.
set -euo pipefail
echo "Use: docker compose -f docker-compose.dev.yml up -d"
echo "Or: mc alias set local http://127.0.0.1:9000 minioadmin minioadmin && mc mb -p local/c2k-uploads"
