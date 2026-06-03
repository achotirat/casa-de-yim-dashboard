#!/bin/bash
# Installs crontab entry for eZee auto-export every Sunday at 05:00 AM
# Run once: bash scripts/setup-cron.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/logs"
CRON_CMD="0 5 * * 0 cd \"$PROJECT_DIR\" && /usr/local/bin/node node_modules/.bin/tsx scripts/ezee-export.ts >> \"$LOG_DIR/ezee-export.log\" 2>&1"

echo "Project dir: $PROJECT_DIR"
echo "Log dir:     $LOG_DIR"
echo "Cron entry:  $CRON_CMD"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"
echo "✓ Created $LOG_DIR"

# Add cron entry (skip if already present)
if crontab -l 2>/dev/null | grep -q "ezee-export"; then
  echo "⚠️  Cron entry already exists — skipping"
else
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "✓ Cron entry installed"
fi

echo ""
echo "Verify with: crontab -l"
echo "Test run:    cd \"$PROJECT_DIR\" && npx tsx scripts/ezee-export.ts --headed"
