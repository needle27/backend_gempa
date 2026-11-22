#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_DIR")"
BACKUP_DIR="$PARENT_DIR/backups/frontend"
VERSION="$(node -p "require('$PROJECT_DIR/package.json').version")"
ACTION="${1:-help}"
LABEL="${2:-stable}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

make_backup() {
  local kind="$1"
  local archive="$BACKUP_DIR/v${VERSION}-${kind}-${STAMP}.zip"
  ditto -c -k --sequesterRsrc "$PROJECT_DIR" "$archive"
  shasum -a 256 "$archive" > "${archive}.sha256"
  echo "Backup created: $archive"
  echo "SHA256: $(awk '{print $1}' "${archive}.sha256")"
}

case "$ACTION" in
  backup)
    case "$LABEL" in stable|development) make_backup "$LABEL" ;;
      *) echo "Label must be stable or development"; exit 2 ;;
    esac
    ;;
  mark-stable)
    make_backup stable
    echo "Checkpoint v${VERSION} marked STABLE."
    ;;
  rollback)
    TARGET="${2:-}"
    if [[ -z "$TARGET" ]]; then
      echo "Usage: bash scripts/frontend-checkpoint.sh rollback 0.4.34"
      exit 2
    fi
    ARCHIVE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "v${TARGET}-stable-*.zip" | sort | tail -n 1)"
    if [[ -z "$ARCHIVE" ]]; then
      echo "No stable checkpoint found for v${TARGET} in $BACKUP_DIR"
      exit 1
    fi
    FAILED_DIR="${PARENT_DIR}/${PROJECT_NAME}-failed-${STAMP}"
    echo "Current project will be preserved at: $FAILED_DIR"
    mv "$PROJECT_DIR" "$FAILED_DIR"
    ditto -x -k "$ARCHIVE" "$PARENT_DIR"
    echo "Rollback restored from: $ARCHIVE"
    echo "Previous project preserved at: $FAILED_DIR"
    ;;
  list)
    ls -lh "$BACKUP_DIR"
    ;;
  *)
    cat <<USAGE
SEISMAP frontend checkpoint manager (no Git required)

Before applying a patch:
  bash scripts/frontend-checkpoint.sh backup stable

After a patch is installed and manually verified:
  bash scripts/frontend-checkpoint.sh mark-stable

List checkpoints:
  bash scripts/frontend-checkpoint.sh list

Rollback to a previously verified stable version:
  bash scripts/frontend-checkpoint.sh rollback 0.4.34

Rollback preserves the current project in a timestamped *-failed-* folder.
USAGE
    ;;
esac
