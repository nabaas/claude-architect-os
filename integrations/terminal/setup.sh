#!/bin/bash
# Terminal Stack Setup — Claude Architect OS
# Warp + Oh My Zsh + Starship + Power Tools

set -e
echo "⚡ Setting up terminal stack for Claude Architect OS..."

# Homebrew check
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# ─── Core Terminal Tools ──────────────────────────────────────────────────

echo "Installing power tools..."
brew install \
  zoxide \      # smart cd with frecency
  fzf \         # fuzzy search everything
  bat \         # better cat with syntax highlighting
  eza \         # better ls with icons
  ripgrep \     # faster grep
  fd \          # faster find
  delta \       # better git diff
  starship \    # cross-shell prompt
  tmux \        # session persistence
  jq \          # JSON processing
  yq \          # YAML processing
  gh \          # GitHub CLI
  httpie        # better curl

# ─── Oh My Zsh ────────────────────────────────────────────────────────────

if [ ! -d "$HOME/.oh-my-zsh" ]; then
  echo "Installing Oh My Zsh..."
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

# Plugins
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

if [ ! -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ]; then
  git clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
fi

if [ ! -d "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" ]; then
  git clone https://github.com/zsh-users/zsh-syntax-highlighting "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
fi

# ─── Write .zshrc additions ───────────────────────────────────────────────

cat >> "$HOME/.zshrc" << 'ZSHEOF'

# ─── Claude Architect OS ──────────────────────────────────────────────────
export CMNDCENTER="$HOME/CMNDCENTER"
export CAO="$CMNDCENTER/repos/claude-architect-os"
export PATH="$PATH:$HOME/bin:$CAO/scripts"

# Model shortcuts
export CLAUDE_DEFAULT="claude-sonnet-4-6"
export CLAUDE_FAST="claude-haiku-4-5-20251001"
export CLAUDE_DEEP="claude-opus-4-7"

# Aliases
alias ls='eza --icons --group-directories-first'
alias ll='eza -la --icons --group-directories-first'
alias cat='bat --style=plain'
alias grep='rg'
alias find='fd'
alias cd='z'

# CMNDCENTER shortcuts
alias cmnd='bash $CMNDCENTER/command-center.sh'
alias loki='bash $CMNDCENTER/loki/loki.sh'
alias cao='cd $CAO'
alias cao-upgrade='bash $CAO/scripts/upgrade.sh'
alias cao-wire='bash $CAO/scripts/wire-cmndcenter.sh'
alias cao-install='bash $CAO/scripts/install.sh'

# Ollama shortcuts
alias models='ollama list'
alias hermes='ollama run hermes3'
alias gemma='ollama run gemma3:4b'

# Docker shortcuts
alias dcup='docker compose -f $CAO/infrastructure/docker-compose.yml up -d'
alias dcdown='docker compose -f $CAO/infrastructure/docker-compose.yml down'
alias dcps='docker compose -f $CAO/infrastructure/docker-compose.yml ps'

# AI quick commands
alias claude-code='claude'
alias opencode='~/bin/opencode'

# Initialize
eval "$(zoxide init zsh)"
eval "$(fzf --zsh)"
eval "$(starship init zsh)"
ZSHEOF

# ─── Starship Config ──────────────────────────────────────────────────────

mkdir -p "$HOME/.config"
cat > "$HOME/.config/starship.toml" << 'STAREOF'
format = """
[$username@$hostname](bold green) in [$directory](bold blue) $git_branch$git_status
[$character](bold yellow) """

[git_branch]
symbol = " "
style = "bold purple"

[git_status]
format = '([\[$all_status$ahead_behind\]]($style) )'
style = "bold red"

[directory]
truncation_length = 3
truncate_to_repo = true

[character]
success_symbol = "[❯](bold green)"
error_symbol = "[❯](bold red)"

[python]
symbol = " "

[nodejs]
symbol = " "

[docker_context]
symbol = " "
STAREOF

echo "✅ Terminal stack installed. Run: source ~/.zshrc"
