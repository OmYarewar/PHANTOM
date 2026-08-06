#!/usr/bin/env bash

set -e

# ANSI Color Definitions
G='\033[38;2;16;185;129m'   # Emerald Green
CG='\033[38;2;52;211;153m'  # Light Emerald
C='\033[38;2;6;182;212m'    # Cyan
B='\033[1m'                 # Bold
DIM='\033[2m'               # Dim
RST='\033[0m'               # Reset
Y='\033[38;2;234;179;8m'    # Yellow
RED='\033[38;2;239;68;68m'  # Red

banner() {
  echo -e "${G}${B}"
  echo "  ██████╗ ██╗  ██╗██████╗ ███╗   ██╗████████╗██████╗ ███╗   ███╗"
  echo "  ██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗████╗ ████║"
  echo "  ██████╔╝███████║██████╔╝██╔██╗ ██║   ██║   ██║  ██║██╔████╔██║"
  echo "  ██╔═══╝ ██╔══██║██╔══██╗██║╚██╗██║   ██║   ██║  ██║██║╚██╔╝██║"
  echo "  ██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ██████╔╝██║ ╚═╝ ██║"
  echo "  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═════╝ ╚═╝     ╚═╝"
  echo -e "${RST}"
  echo -e "  ${G}${B}👻 PHANTOM — Universal Linux & Shell Installer${RST} ${DIM}(v1.0.0)${RST}"
  echo -e "  ${DIM}────────────────────────────────────────────────────────────${RST}"
}

banner

# Detect Operating System & Distribution
OS_NAME=$(uname -s)
if [ "$OS_NAME" != "Linux" ] && [ "$OS_NAME" != "Darwin" ]; then
  echo -e "  ${RED}⚠️ Warning: Unsupported operating system: ${OS_NAME}.${RST}"
fi

# Check Node.js prerequisite
if ! command -v node >/dev/null 2>&1; then
  echo -e "  ${RED}❌ Node.js is not installed.${RST}"
  echo -e "  ${Y}👉 Please install Node.js 18+ for your Linux distribution:${RST}"
  echo -e "     - Ubuntu/Debian:  sudo apt update && sudo apt install -y nodejs npm"
  echo -e "     - Fedora/RHEL:    sudo dnf install -y nodejs npm"
  echo -e "     - Arch/Manjaro:   sudo pacman -S nodejs npm"
  echo -e "     - Alpine:         sudo apk add nodejs npm"
  echo -e "     - Official website: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v)
echo -e "  ${CG}✓ Detected Node.js ${NODE_VER}${RST}"

# Determine installation directory
INSTALL_DIR="$HOME/.phantom"

if [ -f "package.json" ] && grep -q '"name": "phantom"' package.json; then
  INSTALL_DIR="$(pwd)"
  echo -e "  ${C}➜ Installing in current directory:${RST} ${INSTALL_DIR}"
else
  echo -e "  ${C}➜ Installing PHANTOM to:${RST} ${INSTALL_DIR}"
  if [ -d "$INSTALL_DIR" ]; then
    echo -e "  ${DIM}Updating existing repository...${RST}"
    git -C "$INSTALL_DIR" pull --rebase || true
  else
    git clone https://github.com/OmYarewar/PHANTOM.git "$INSTALL_DIR"
  fi
fi

cd "$INSTALL_DIR"

echo -e "  ${C}➜ Installing dependencies (npm install)...${RST}"
npm install --quiet

echo -e "  ${C}➜ Building native SQLite bindings...${RST}"
npm rebuild better-sqlite3 --quiet || true

# Ensure executable permissions on bin/phantom.js
chmod +x bin/phantom.js

# Configure CLI command executable symlink in user bin paths
TARGET_BIN="$INSTALL_DIR/bin/phantom.js"
PRIMARY_BIN_DIR="$HOME/.local/bin"
NPM_GLOBAL_BIN_DIR="$HOME/.npm-global/bin"

mkdir -p "$PRIMARY_BIN_DIR" "$NPM_GLOBAL_BIN_DIR"
ln -sf "$TARGET_BIN" "$PRIMARY_BIN_DIR/phantom"
ln -sf "$TARGET_BIN" "$NPM_GLOBAL_BIN_DIR/phantom"

if [ -w "/usr/local/bin" ]; then
  ln -sf "$TARGET_BIN" "/usr/local/bin/phantom" 2>/dev/null || true
fi

# ─── Universal Shell Configuration Support (Bash, Zsh, Fish, Ksh, Tcsh, Dash) ───

# 1. Standard POSIX Shells (Bash, Zsh, Ksh, Dash, Sh)
POSIX_PATH_LINE='export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"'

update_posix_shell_rc() {
  RC_FILE="$1"
  if [ -f "$RC_FILE" ] || [ "$2" = "create" ]; then
    mkdir -p "$(dirname "$RC_FILE")"
    touch "$RC_FILE"
    if ! grep -q '\.local/bin' "$RC_FILE"; then
      echo "" >> "$RC_FILE"
      echo "# PHANTOM CLI PATH" >> "$RC_FILE"
      echo "$POSIX_PATH_LINE" >> "$RC_FILE"
      echo -e "  ${CG}✓ Configured PHANTOM CLI in ${RC_FILE}${RST}"
    fi
  fi
}

update_posix_shell_rc "$HOME/.bashrc" "create"
update_posix_shell_rc "$HOME/.bash_profile"
update_posix_shell_rc "$HOME/.zshrc" "create"
update_posix_shell_rc "$HOME/.zshenv"
update_posix_shell_rc "$HOME/.profile"
update_posix_shell_rc "$HOME/.kshrc"

# 2. Fish Shell Support
FISH_CONF_DIR="$HOME/.config/fish"
FISH_CONF_FILE="$FISH_CONF_DIR/config.fish"
if [ -d "$FISH_CONF_DIR" ] || command -v fish >/dev/null 2>&1; then
  mkdir -p "$FISH_CONF_DIR"
  touch "$FISH_CONF_FILE"
  if ! grep -q '\.local/bin' "$FISH_CONF_FILE"; then
    echo "" >> "$FISH_CONF_FILE"
    echo "# PHANTOM CLI PATH" >> "$FISH_CONF_FILE"
    echo 'set -gx PATH $HOME/.local/bin $HOME/.npm-global/bin $PATH' >> "$FISH_CONF_FILE"
    echo -e "  ${CG}✓ Configured PHANTOM CLI in ${FISH_CONF_FILE}${RST}"
  fi
  if command -v fish >/dev/null 2>&1; then
    fish -c "fish_add_path -m $HOME/.local/bin $HOME/.npm-global/bin" 2>/dev/null || true
  fi
fi

# 3. Csh / Tcsh Support
TCSH_PATH_LINE='setenv PATH "$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"'
update_csh_rc() {
  RC_FILE="$1"
  if [ -f "$RC_FILE" ]; then
    if ! grep -q '\.local/bin' "$RC_FILE"; then
      echo "" >> "$RC_FILE"
      echo "# PHANTOM CLI PATH" >> "$RC_FILE"
      echo "$TCSH_PATH_LINE" >> "$RC_FILE"
      echo -e "  ${CG}✓ Configured PHANTOM CLI in ${RC_FILE}${RST}"
    fi
  fi
}
update_csh_rc "$HOME/.tcshrc"
update_csh_rc "$HOME/.cshrc"

# Export PATH for current installer session
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

echo -e "  ${DIM}────────────────────────────────────────────────────────────${RST}"
echo -e "  ${G}${B}🎉 PHANTOM CLI successfully installed and configured for your shell!${RST}\n"
echo -e "  ${B}Launch server in any terminal window using:${RST}"
echo -e "    ${G}phantom start${RST}        ${DIM}# Launch production PHANTOM server${RST}"
echo -e "    ${G}phantom dev${RST}          ${DIM}# Launch dev mode (Server + Vite UI)${RST}"
echo -e "    ${G}phantom --port 8080${RST}  ${DIM}# Launch on custom port${RST}"
echo -e "    ${G}phantom --help${RST}       ${DIM}# Display CLI help menu${RST}\n"
echo -e "  ${DIM}💡 Note: If running 'phantom' in an open terminal, type 'exec \$SHELL' or restart your terminal.${RST}"
echo -e "  ${DIM}────────────────────────────────────────────────────────────${RST}\n"
