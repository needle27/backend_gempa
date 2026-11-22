#!/usr/bin/env bash
set -euo pipefail
python -m pytest -v tests/integration/test_api_workflow.py
