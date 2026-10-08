#!/bin/bash

# CupNightOracle Contract Compilation & Testnet Deployment
set -e

echo "⚙️ Compiling CupNightOracle.sol with Foundry..."
forge build

echo "🔍 Running smart contract tests..."
forge test -vvv

if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Fix issues before deploying."
    exit 1
fi

echo "✅ Tests passed! Proceeding to deployment."

# ─── Deploy to Base Sepolia Testnet ──────────────────────
DEPLOY_CMD="forge create --rpc-url $BASE_SEPOLIA_RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --constructor-args $(printf '%s,' "$USDC_ADDRESS") CupNightOracle"

echo "🚀 Deploying to Base Sepolia..."
DEPLOY_OUTPUT=$(eval $DEPLOY_CMD)

# Parse contract address from output
CONTRACT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "Deployed to:" | awk '{print $NF}')
echo ""
echo "🎉 CupNightOracle deployed at: $CONTRACT_ADDR"
echo ""

echo "⚠️  IMPORTANT: Save these for later use:"
echo ""
echo "Add to your .env file:"
echo "CUPNIGHT_CONTRACT_ADDRESS=$CONTRACT_ADDR"
echo ""

# Generate frontend ABI bindings
echo "📝 Generating contract ABIs..."
forge inspect CupNightOracle abi --json > ../apps/next-app/constants/cupnight_contract_abi.json
forge inspect CupNightOracle bytecode > ../apps/next-app/constants/cupnight_contract_bytecode.txt

echo "✅ Deployment complete! Frontend ABIs generated in apps/next-app/"

# ─── Setup Foundry Git hooks ──────────────────────────────
cd .. && forge init --no-git --force setup/hooks 2>/dev/null || true
