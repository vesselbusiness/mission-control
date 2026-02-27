#!/bin/zsh
cd /Users/vincent/.openclaw/workspace/vessel_mission_control

# Pull latest from GitHub
git pull origin main

# Push any local changes
git add -A
git diff --cached --quiet || git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main
