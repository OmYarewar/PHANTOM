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
  echo -e "  ${G}${B}👻 PHANTOM — Easy Terminal Installer${RST} ${DIM}(v1.0.0)${RST}"
  echo -e "  ${DIM}────────────────────────────────────────────────────────────${RST}"
}

banner

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "  ${RED}❌ Node.js is not installed.${RST} Please install Node.js 18+ first: https://nodejs.org"
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

# Ensure executable permissions on bin/phantom.js
chmod +x bin/phantom.js

# Configure CLI command executable symlink in user bin
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/phantom.js" "$BIN_DIR/phantom"

# Configure PATH in shell config files (~/.bashrc, ~/.zshrc)
PATH_LINE='export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"'

update_shell_rc() {
  RC_FILE="$1"
  if [ -f "$RC_FILE" ]; then
    if ! grep -q '\.local/bin' "$RC_FILE"; then
      echo "" >> "$RC_FILE"
      echo "# PHANTOM CLI PATH" >> "$RC_FILE"
      echo "$PATH_LINE" >> "$RC_FILE"
      echo -e "  ${CG}✓ Added PHANTOM CLI to ${RC_FILE}${RST}"
    fi
  fi
}

update_shell_rc "$HOME/.bashrc"
update_shell_rc "$HOME/.zshrc"

# Configure Fish shell if fish directory or command exists
FISH_CONF_DIR="$HOME/.config/fish"
FISH_CONF_FILE="$FISH_CONF_DIR/config.fish"
if [ -d "$FISH_CONF_DIR" ] || command -v fish >/dev/null 2>&1; then
  mkdir -p "$FISH_CONF_DIR"
  touch "$FISH_CONF_FILE"
  if ! grep -q '\.local/bin' "$FISH_CONF_FILE"; then
    echo "" >> "$FISH_CONF_FILE"
    echo "# PHANTOM CLI PATH" >> "$FISH_CONF_FILE"
    echo 'set -gx PATH $HOME/.local/bin $HOME/.npm-global/bin $PATH' >> "$FISH_CONF_FILE"
    echo -e "  ${CG}✓ Added PHANTOM CLI to ${FISH_CONF_FILE}${RST}"
  fi
  if command -v fish >/dev/null 2>&1; then
    fish -c "fish_add_path -m $HOME/.local/bin $HOME/.npm-global/bin" 2>/dev/null || true
  fi
fi

# Export PATH for current session
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

echo -e "  ${DIM}────────────────────────────────────────────────────────────${RST}"
echo -e "  ${G}${B}🎉 PHANTOM CLI successfully installed!${RST}\n"
echo -e "  ${B}Run server anywhere in terminal using:${RST}"
echo -e "    ${G}phantom start${RST}        ${DIM}# Launch PHANTOM server${RST}"
echo -e "    ${G}phantom dev${RST}          ${DIM}# Development mode (Server + Vite UI)${RST}"
echo -e "    ${G}phantom --port 8080${RST}  ${DIM}# Custom port${RST}"
echo -e "    ${G}phantom --help${RST}       ${DIM}# Display CLI help menu${RST}"
echo -e "  ${DIM}────────────────────────────────────────────────────────────${RST}\n"
