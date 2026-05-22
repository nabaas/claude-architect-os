#!/usr/bin/env bash
# scripts/install.sh
# Complete Installation Script — Claude Architect OS v4.0
# Idempotent: safe to run multiple times
#
# Usage:
#   chmod +x scripts/install.sh
#   ./scripts/install.sh
#   ./scripts/install.sh --skip-docker  # skip Docker service setup
#   ./scripts/install.sh --verbose      # show all command output

set -euo pipefail

# ============================================================
# CONFIGURATION
# ============================================================
CMNDCENTER="${HOME}/CMNDCENTER"
CAO_REPO="${CMNDCENTER}/repos/claude-architect-os"
AMSA_MEMORY_DIR="${HOME}/.amsa/memory"
AMSA_QUEUE_DIR="${HOME}/.amsa/linear-queue"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
LOG_FILE="${AMSA_MEMORY_DIR}/install-log.json"
INSTALL_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERBOSE=false
SKIP_DOCKER=false
ERRORS=()
INSTALLED=()
SKIPPED=()

# ============================================================
# ARGUMENT PARSING
# ============================================================
for arg in "$@"; do
  case $arg in
    --verbose)   VERBOSE=true ;;
    --skip-docker) SKIP_DOCKER=true ;;
    --help)
      echo "Usage: $0 [--verbose] [--skip-docker] [--help]"
      echo ""
      echo "  --verbose      Show all command output"
      echo "  --skip-docker  Skip Docker Compose service startup"
      echo "  --help         Show this message"
      exit 0
      ;;
  esac
done

# ============================================================
# OUTPUT HELPERS
# ============================================================
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

log_header() {
  echo ""
  echo -e "${BOLD}${CYAN}========================================${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}========================================${RESET}"
}

log_info()    { echo -e "  ${CYAN}[INFO]${RESET}  $1"; }
log_success() { echo -e "  ${GREEN}[OK]${RESET}    $1"; INSTALLED+=("$1"); }
log_skip()    { echo -e "  ${YELLOW}[SKIP]${RESET}  $1"; SKIPPED+=("$1"); }
log_warn()    { echo -e "  ${YELLOW}[WARN]${RESET}  $1"; }
log_error()   { echo -e "  ${RED}[ERROR]${RESET} $1"; ERRORS+=("$1"); }

run_cmd() {
  if $VERBOSE; then
    "$@"
  else
    "$@" > /dev/null 2>&1
  fi
}

# ============================================================
# PREFLIGHT
# ============================================================
log_header "Claude Architect OS — Installation"
log_info "Start time: ${INSTALL_START}"
log_info "Platform: $(uname -sm)"
log_info "Home: ${HOME}"
log_info "CAO Repo: ${CAO_REPO}"
echo ""

# Must be macOS
if [[ "$(uname)" != "Darwin" ]]; then
  log_error "This installer requires macOS. Detected: $(uname)"
  exit 1
fi

# Must be inside the repo
if [[ ! -f "${CAO_REPO}/scripts/install.sh" ]] && [[ ! -f "scripts/install.sh" ]]; then
  log_warn "Could not confirm repo location. Assuming CAO_REPO=${CAO_REPO}"
fi

# ============================================================
# STEP 1: Create directory structure
# ============================================================
log_header "Step 1: Directory Structure"

dirs=(
  "${CMNDCENTER}"
  "${CMNDCENTER}/repos"
  "${AMSA_MEMORY_DIR}"
  "${AMSA_MEMORY_DIR}/loki_runs"
  "${AMSA_QUEUE_DIR}"
  "${AMSA_MEMORY_DIR}/trend-cache"
  "${HOME}/.amsa/memory/routing-log"
  "${LAUNCH_AGENTS_DIR}"
)

for dir in "${dirs[@]}"; do
  if [[ -d "$dir" ]]; then
    log_skip "Directory exists: ${dir}"
  else
    mkdir -p "$dir"
    log_success "Created: ${dir}"
  fi
done

# ============================================================
# STEP 2: Homebrew
# ============================================================
log_header "Step 2: Homebrew"

if command -v brew &>/dev/null; then
  log_skip "Homebrew already installed ($(brew --version | head -1))"
else
  log_info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add to PATH for Apple Silicon
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  log_success "Homebrew installed"
fi

log_info "Running brew update..."
run_cmd brew update
log_success "Homebrew updated"

# ============================================================
# STEP 3: Core CLI tools
# ============================================================
log_header "Step 3: Core CLI Tools"

brew_install() {
  local pkg="$1"
  local cmd="${2:-$1}"
  if command -v "$cmd" &>/dev/null; then
    log_skip "${pkg} already installed"
  else
    log_info "Installing ${pkg}..."
    run_cmd brew install "$pkg"
    log_success "${pkg} installed"
  fi
}

brew_install "gh" "gh"
brew_install "node" "node"
brew_install "jq" "jq"
brew_install "git" "git"
brew_install "curl" "curl"
brew_install "python@3.12" "python3"
brew_install "docker" "docker"

# Docker Desktop check
if ! docker info &>/dev/null 2>&1; then
  log_warn "Docker daemon not running. Start Docker Desktop and re-run if needed."
  SKIP_DOCKER=true
fi

# ============================================================
# STEP 4: Ollama
# ============================================================
log_header "Step 4: Ollama"

if command -v ollama &>/dev/null; then
  log_skip "Ollama already installed ($(ollama --version 2>/dev/null || echo 'version unknown'))"
else
  log_info "Installing Ollama..."
  if brew list --cask ollama &>/dev/null 2>&1; then
    log_skip "Ollama cask already installed"
  else
    run_cmd brew install --cask ollama
    log_success "Ollama installed via Homebrew Cask"
  fi
fi

# Pull models if Ollama is running
if pgrep -x "ollama" > /dev/null 2>&1 || ollama list &>/dev/null 2>&1; then
  for model in "hermes3" "gemma3:4b"; do
    if ollama list 2>/dev/null | grep -q "${model%:*}"; then
      log_skip "Ollama model already pulled: ${model}"
    else
      log_info "Pulling Ollama model: ${model} (this may take a few minutes)..."
      ollama pull "$model" 2>&1 | tail -1 || log_warn "Failed to pull ${model} — retry manually: ollama pull ${model}"
      log_success "Ollama model pulled: ${model}"
    fi
  done
else
  log_warn "Ollama is not running. Start it and pull models manually:"
  log_warn "  ollama pull hermes3"
  log_warn "  ollama pull gemma3:4b"
fi

# ============================================================
# STEP 5: Node.js packages
# ============================================================
log_header "Step 5: Node.js Global Packages"

node_install() {
  local pkg="$1"
  local cmd="${2:-$1}"
  if command -v "$cmd" &>/dev/null; then
    log_skip "npm package already installed: ${pkg}"
  else
    log_info "Installing npm package: ${pkg}..."
    run_cmd npm install -g "$pkg"
    log_success "Installed: ${pkg}"
  fi
}

node_install "n8n" "n8n"
node_install "repomix" "repomix"
node_install "typescript" "tsc"
node_install "ts-node" "ts-node"

# ============================================================
# STEP 6: Python packages
# ============================================================
log_header "Step 6: Python Packages"

python_install() {
  local pkg="$1"
  local import="${2:-$1}"
  if python3 -c "import $import" &>/dev/null 2>&1; then
    log_skip "Python package already installed: ${pkg}"
  else
    log_info "Installing Python package: ${pkg}..."
    run_cmd python3 -m pip install --quiet --upgrade "$pkg"
    log_success "Installed: ${pkg}"
  fi
}

python_install "chromadb" "chromadb"
python_install "anthropic" "anthropic"
python_install "supabase" "supabase"
python_install "aiohttp" "aiohttp"
python_install "pydantic" "pydantic"
python_install "typer" "typer"
python_install "rich" "rich"

# ============================================================
# STEP 7: Supabase CLI
# ============================================================
log_header "Step 7: Supabase CLI"

if command -v supabase &>/dev/null; then
  log_skip "Supabase CLI already installed ($(supabase --version 2>/dev/null || echo 'unknown'))"
else
  log_info "Installing Supabase CLI..."
  run_cmd brew install supabase/tap/supabase
  log_success "Supabase CLI installed"
fi

# ============================================================
# STEP 8: Environment variables
# ============================================================
log_header "Step 8: Environment Variables"

ENV_FILE="${CAO_REPO}/.env"
ENV_EXAMPLE_FILE="${CAO_REPO}/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  log_skip ".env file already exists at ${ENV_FILE}"
else
  if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    log_success "Created .env from .env.example — EDIT ${ENV_FILE} with your actual values"
  else
    cat > "$ENV_FILE" << 'ENVEOF'
# Claude Architect OS — Environment Variables
# Fill in all values before running docker compose up

# Postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME_strong_password_here
POSTGRES_DB=claude_architect_os

# Supabase
SUPABASE_ANON_KEY=CHANGE_ME_generate_with_supabase_cli
SUPABASE_SERVICE_KEY=CHANGE_ME_generate_with_supabase_cli
SUPABASE_URL=http://localhost:8000
JWT_SECRET=CHANGE_ME_minimum_32_char_secret_here

# Auth
SITE_URL=http://localhost:3000
WEBUI_SECRET_KEY=CHANGE_ME_open_webui_secret
WEBUI_JWT_SECRET_KEY=CHANGE_ME_open_webui_jwt_secret

# Realtime
REALTIME_SECRET_KEY=CHANGE_ME_realtime_secret_key
REALTIME_ENC_KEY=supabaserealtime

# n8n
N8N_ENCRYPTION_KEY=CHANGE_ME_n8n_encryption_key
N8N_USER=admin
N8N_PASSWORD=CHANGE_ME_n8n_admin_password
N8N_WEBHOOK_URL=http://localhost:5678

# Redis
REDIS_PASSWORD=

# ChromaDB (leave empty for no auth in local dev)
CHROMA_AUTH_TOKEN=
CHROMA_AUTH_PROVIDER=

# API Keys
ANTHROPIC_API_KEY=CHANGE_ME_your_anthropic_api_key

# Timezone
TZ=America/New_York
ENVEOF
    log_success "Created .env template at ${ENV_FILE} — EDIT THIS FILE before running services"
  fi
fi

# Add ANTHROPIC_API_KEY to ~/.zshrc if not already there
if ! grep -q "ANTHROPIC_API_KEY" "${HOME}/.zshrc" 2>/dev/null; then
  echo "" >> "${HOME}/.zshrc"
  echo "# Claude Architect OS" >> "${HOME}/.zshrc"
  echo "export CAO_REPO=\"${CAO_REPO}\"" >> "${HOME}/.zshrc"
  echo "export CMNDCENTER=\"${CMNDCENTER}\"" >> "${HOME}/.zshrc"
  echo "export ANTHROPIC_API_KEY=\"\"  # Fill in your key" >> "${HOME}/.zshrc"
  log_success "Added environment variable stubs to ~/.zshrc"
else
  log_skip "~/.zshrc already has CAO environment variables"
fi

# ============================================================
# STEP 9: Docker services
# ============================================================
log_header "Step 9: Docker Services"

if $SKIP_DOCKER; then
  log_skip "Docker services skipped (--skip-docker flag or Docker not running)"
else
  if [[ -f "${CAO_REPO}/infrastructure/docker-compose.yml" ]]; then
    log_info "Starting Docker services (this may take several minutes on first run)..."
    cd "${CAO_REPO}"
    if run_cmd docker compose -f infrastructure/docker-compose.yml up -d; then
      log_success "Docker services started"
      log_info "Services:"
      docker compose -f infrastructure/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    else
      log_error "Docker services failed to start — check logs: docker compose -f infrastructure/docker-compose.yml logs"
    fi
  else
    log_warn "docker-compose.yml not found at expected path"
  fi
fi

# ============================================================
# STEP 10: Register LaunchAgent
# ============================================================
log_header "Step 10: LaunchAgent Registration"

PLIST_SRC="${CAO_REPO}/infrastructure/launchagents/com.claudearchitectos.auto-upgrade.plist"
PLIST_DEST="${LAUNCH_AGENTS_DIR}/com.claudearchitectos.auto-upgrade.plist"

if [[ ! -f "$PLIST_SRC" ]]; then
  log_warn "LaunchAgent plist not found at ${PLIST_SRC} — skipping"
else
  if [[ -f "$PLIST_DEST" ]]; then
    # Check if already loaded
    if launchctl list | grep -q "com.claudearchitectos.auto-upgrade"; then
      log_skip "LaunchAgent already loaded"
    else
      cp "$PLIST_SRC" "$PLIST_DEST"
      launchctl load "$PLIST_DEST"
      log_success "LaunchAgent reloaded"
    fi
  else
    cp "$PLIST_SRC" "$PLIST_DEST"
    launchctl load "$PLIST_DEST"
    log_success "LaunchAgent registered (runs daily at 3:00 AM)"
  fi
fi

# ============================================================
# STEP 11: Wire into CMNDCENTER
# ============================================================
log_header "Step 11: CMNDCENTER Integration"

if [[ -f "${CAO_REPO}/scripts/wire-cmndcenter.sh" ]]; then
  log_info "Running wire-cmndcenter.sh..."
  if bash "${CAO_REPO}/scripts/wire-cmndcenter.sh" 2>&1; then
    log_success "CMNDCENTER wiring complete"
  else
    log_warn "CMNDCENTER wiring had warnings — check manually"
  fi
else
  log_warn "wire-cmndcenter.sh not found — skipping CMNDCENTER wiring"
fi

# ============================================================
# STEP 12: Raycast extension
# ============================================================
log_header "Step 12: Raycast Extension"

RAYCAST_EXTENSIONS_DIR="${HOME}/Library/Application Support/com.raycast.macos/extensions"

if [[ -d "$RAYCAST_EXTENSIONS_DIR" ]]; then
  if [[ -d "${CAO_REPO}/raycast" ]]; then
    # Symlink the extension directory
    EXTENSION_LINK="${RAYCAST_EXTENSIONS_DIR}/claude-architect-os"
    if [[ -L "$EXTENSION_LINK" ]]; then
      log_skip "Raycast extension symlink already exists"
    else
      ln -sf "${CAO_REPO}/raycast" "$EXTENSION_LINK"
      log_success "Raycast extension symlinked"
    fi
  else
    log_info "No Raycast extension directory found in repo — using script-commands approach"
    RAYCAST_SCRIPTS_SRC="${CAO_REPO}/raycast-scripts"
    RAYCAST_SCRIPTS_DEST="${HOME}/.config/raycast-script-commands"
    if [[ -d "$RAYCAST_SCRIPTS_SRC" ]]; then
      mkdir -p "$RAYCAST_SCRIPTS_DEST"
      for script in "${RAYCAST_SCRIPTS_SRC}"/*.sh; do
        [[ -f "$script" ]] || continue
        dest="${RAYCAST_SCRIPTS_DEST}/$(basename "$script")"
        if [[ -f "$dest" ]]; then
          log_skip "Raycast script already exists: $(basename "$script")"
        else
          cp "$script" "$dest"
          chmod +x "$dest"
          log_success "Copied Raycast script: $(basename "$script")"
        fi
      done
    fi
  fi
else
  log_skip "Raycast not installed — skipping extension registration"
fi

# ============================================================
# STEP 13: Project dependencies
# ============================================================
log_header "Step 13: Project Dependencies"

if [[ -f "${CAO_REPO}/package.json" ]]; then
  log_info "Installing Node.js dependencies..."
  cd "${CAO_REPO}"
  if run_cmd npm install; then
    log_success "Node.js dependencies installed"
  else
    log_error "npm install failed"
  fi
else
  log_skip "No package.json found — skipping npm install"
fi

if [[ -f "${CAO_REPO}/requirements.txt" ]]; then
  log_info "Installing Python dependencies..."
  run_cmd python3 -m pip install --quiet -r "${CAO_REPO}/requirements.txt"
  log_success "Python dependencies installed"
else
  log_skip "No requirements.txt found — skipping pip install"
fi

# ============================================================
# STEP 14: Initial memory files
# ============================================================
log_header "Step 14: Memory System Bootstrap"

init_json_file() {
  local file="$1"
  local content="$2"
  if [[ -f "$file" ]]; then
    log_skip "Memory file already exists: $(basename "$file")"
  else
    echo "$content" > "$file"
    log_success "Created memory file: $(basename "$file")"
  fi
}

init_json_file "${AMSA_MEMORY_DIR}/patterns.json" "[]"
init_json_file "${AMSA_MEMORY_DIR}/karpathy_wrapup.json" '{"session_id":"init","synthesized_at":"'"${INSTALL_START}"'","top_wins":[],"top_failures":[],"top_insights":["Claude Architect OS installed successfully"],"recommended_promotions":[],"quality_score":1.0}'
init_json_file "${AMSA_MEMORY_DIR}/routing-log.jsonl" ""
init_json_file "${AMSA_QUEUE_DIR}/queue.json" "[]"

# ============================================================
# STEP 15: Health check
# ============================================================
log_header "Step 15: Health Check"

check_service() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 3 "$url" &>/dev/null; then
    log_success "${name} is healthy: ${url}"
  else
    log_warn "${name} is not responding at ${url} (may still be starting)"
  fi
}

check_service "ChromaDB"  "http://localhost:8000/api/v1/heartbeat"
check_service "n8n"       "http://localhost:5678/healthz"
check_service "Ollama"    "http://localhost:11434/api/tags"
check_service "Open-WebUI" "http://localhost:3001/health"
check_service "Supabase"  "http://localhost:8000/rest/v1/"

# ============================================================
# WRITE INSTALL LOG
# ============================================================
mkdir -p "$(dirname "$LOG_FILE")"

install_end=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$LOG_FILE" << LOGEOF
{
  "install_start": "${INSTALL_START}",
  "install_end": "${install_end}",
  "status": "$([ ${#ERRORS[@]} -eq 0 ] && echo "success" || echo "partial")",
  "installed_count": ${#INSTALLED[@]},
  "skipped_count": ${#SKIPPED[@]},
  "error_count": ${#ERRORS[@]},
  "errors": $(printf '%s\n' "${ERRORS[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]"),
  "platform": "$(uname -sm)",
  "version": "4.0.0"
}
LOGEOF

# ============================================================
# SUMMARY
# ============================================================
log_header "Installation Complete"

echo ""
echo -e "  Installed:  ${GREEN}${#INSTALLED[@]} components${RESET}"
echo -e "  Skipped:    ${YELLOW}${#SKIPPED[@]} already present${RESET}"
echo -e "  Errors:     ${RED}${#ERRORS[@]} errors${RESET}"
echo ""

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo -e "${RED}Errors encountered:${RESET}"
  for err in "${ERRORS[@]}"; do
    echo -e "  - $err"
  done
  echo ""
fi

echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "  1. Edit ${ENV_FILE} with your actual credentials"
echo -e "  2. Run: source ~/.zshrc"
echo -e "  3. Run: docker compose -f ${CAO_REPO}/infrastructure/docker-compose.yml up -d"
echo -e "  4. Open Supabase Studio: http://localhost:3000"
echo -e "  5. Run schema: psql -d postgres -f ${CAO_REPO}/memory/schema/supabase.sql"
echo -e "  6. Test: curl http://localhost:8000/api/v1/heartbeat"
echo ""
echo -e "  ${BOLD}Docs:${RESET}  ${CAO_REPO}/brain/prompt_layers/stack.md"
echo -e "  ${BOLD}Agents:${RESET} ${CAO_REPO}/agents/registry.json"
echo -e "  ${BOLD}Log:${RESET}   ${LOG_FILE}"
echo ""
