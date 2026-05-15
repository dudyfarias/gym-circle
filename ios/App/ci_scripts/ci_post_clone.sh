#!/bin/sh
set -e

# ============================================================================
# Xcode Cloud — post-clone hook for the Gym Circle Capacitor wrapper.
# ============================================================================
#
# Xcode Cloud automatically runs this script after cloning the repository
# and before xcodebuild starts. It must live at:
#   ios/App/ci_scripts/ci_post_clone.sh
# (alongside ios/App/App.xcodeproj). The filename is reserved by Apple —
# do not rename.
#
# Why this script exists
# ----------------------
# The iOS project's Swift Package Manager manifest references
# @capacitor/* packages by local path inside node_modules/:
#
#   /Volumes/workspace/repository/node_modules/@capacitor/keyboard
#   /Volumes/workspace/repository/node_modules/@capacitor/splash-screen
#   /Volumes/workspace/repository/node_modules/@capacitor/status-bar
#   /Volumes/workspace/repository/node_modules/@capacitor/push-notifications
#
# node_modules/ is .gitignored (correctly — we don't version JS deps).
# Xcode Cloud does NOT run `npm install` on its own. Without this script,
# xcodebuild fails with:
#
#   "the package at /Volumes/workspace/repository/node_modules/@capacitor/<x>
#    cannot be accessed"
#
# This script provisions Node.js (not pre-installed on Xcode Cloud images)
# and runs `npm ci` at the repo root so the @capacitor/* paths exist
# before SPM resolution kicks in.

# ----------------------------------------------------------------------------
# Locate the repo root. Xcode Cloud exposes $CI_PRIMARY_REPOSITORY_PATH
# which points to /Volumes/workspace/repository.
# ----------------------------------------------------------------------------
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "→ Working directory: $(pwd)"

# ----------------------------------------------------------------------------
# Provision Node.js via Homebrew if it is not already on PATH. Xcode Cloud
# images ship with Homebrew but not Node by default.
# ----------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "→ Installing Node.js via Homebrew"
  brew install node
fi
echo "→ node $(node --version), npm $(npm --version)"

# ----------------------------------------------------------------------------
# Install root workspace dependencies. We use --legacy-peer-deps to mirror
# how the local devs install (apps/web pulls Next.js + React 19 which has
# some peer conflicts; the repo is verified to build fine with this flag).
#
# Prefer `npm ci` so we get the exact lockfile state, falling back to
# `npm install` if the lockfile drifts (defensive: don't fail the build
# just because someone forgot to commit a lockfile bump).
# ----------------------------------------------------------------------------
echo "→ Installing dependencies (npm ci --legacy-peer-deps)"
if ! npm ci --legacy-peer-deps; then
  echo "  npm ci failed; falling back to npm install"
  npm install --legacy-peer-deps
fi

# ----------------------------------------------------------------------------
# Sync Capacitor so any updates to capacitor.config.ts / package.json
# flow into the iOS project before xcodebuild reads it. Also re-applies
# the patch-ios-permissions.mjs script (see package.json cap:sync alias),
# which guarantees the Info.plist permission strings stay in PT-BR.
# ----------------------------------------------------------------------------
echo "→ Syncing Capacitor iOS"
npm run cap:sync:ios

echo "✓ Post-clone setup complete; xcodebuild can resolve @capacitor packages"
