#!/bin/bash

# Phase 1.4: Install Foundry (Solidity dev tools)
set -e

echo "⚙️ Installing Foundry..."
curl -L https://foundry.paradigm.xyz | bash

if [[ ! -x "$HOME/.foundry/bin/foundryup" ]]; then
    export PATH="$HOME/.foundry/bin:$PATH"
fi

echo "🔄 Running foundryup to install forge, cargo, anvil..."
foundryup

echo "✅ Foundry installed!"
echo ""

# Verify versions
echo "forge --version"
forge --version

echo ""
echo "anvil --version"
anvil --version

echo ""
echo "Setting up CupNight smart contract project..."
