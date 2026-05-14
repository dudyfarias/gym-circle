#!/bin/sh
set -eu

echo "[xcode-cloud] Gym Circle post-clone setup started"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

NODE_VERSION="${NODE_VERSION:-22}"

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    return 0
  fi
  return 1
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo "[xcode-cloud] Using existing Node: $(node --version)"
    echo "[xcode-cloud] Using existing npm: $(npm --version)"
    return 0
  fi

  if load_nvm; then
    echo "[xcode-cloud] Installing Node $NODE_VERSION with nvm"
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
    return 0
  fi

  if command -v brew >/dev/null 2>&1; then
    echo "[xcode-cloud] Installing Node with Homebrew"
    brew install node
    return 0
  fi

  echo "[xcode-cloud] Installing nvm + Node $NODE_VERSION"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | sh
  load_nvm
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
}

ensure_node

echo "[xcode-cloud] Node: $(node --version)"
echo "[xcode-cloud] npm: $(npm --version)"

if [ -f package-lock.json ]; then
  echo "[xcode-cloud] Installing dependencies with npm ci"
  npm ci --no-audit --no-fund || {
    echo "[xcode-cloud] npm ci failed; falling back to npm install"
    npm install --no-audit --no-fund
  }
else
  echo "[xcode-cloud] package-lock.json not found; installing dependencies with npm install"
  npm install --no-audit --no-fund
fi

echo "[xcode-cloud] Building web app"
npm run build

echo "[xcode-cloud] Syncing Capacitor iOS project"
npx cap sync ios

echo "[xcode-cloud] Patching iOS permission strings"
npm run --if-present cap:patch:ios

echo "[xcode-cloud] Gym Circle post-clone setup finished"
