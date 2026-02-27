#!/bin/zsh
cd /Users/vincent/.openclaw/workspace/vessel_mission_control

# Pull latest from lovable branch (Lovable's changes)
git fetch origin

# Push any local changes on main
git checkout main
git add -A
git diff --cached --quiet || git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

echo "Sync complete. To merge Lovable's changes into main, run: git merge origin/lovable"
