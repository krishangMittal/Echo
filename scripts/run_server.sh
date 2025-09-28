#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
export PYTHONPATH="${PYTHONPATH:-${PROJECT_ROOT}}"
cd "${PROJECT_ROOT}"

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload "$@"
