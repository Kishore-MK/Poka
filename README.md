<h1 align="center">Poka Agent-to-Agent Communication Protocol</h1>

A complete implementation of the **ERC-8004** standard for autonomous agent identity and interaction on blockchain. This protocol enables trustless, auditable agent-to-agent communication with on-chain identity, reputation tracking, validation services, and user-authorized intent coordination.

ERC-8004 provides four core registries: **Identity Registry** (agent registration & discovery), **Reputation Registry** (feedback & ratings), **Validation Registry** (third-party verification), and **Intent Coordinator** (secure, user-signed interactions). Every agent call is tracked on-chain, creating complete audit trails for compliance and trust.

![Architecture Diagram](./assets/image.png)

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Running the Agents](#running-the-agents)
- [Testing Agent Interactions](#testing-agent-interactions)
- [Environment Variables](#environment-variables)
- [Smart Contracts](#smart-contracts)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Four-Layer Blockchain Protocol

1. **Identity Registry** (`IdentityRegistry.sol`)
   - ERC-721 NFT-based agent identities
   - On-chain metadata storage (URL, capabilities, owner)
   - Discoverable agent registry

2. **Reputation Registry** (`ReputationRegistry.sol`)
   - User feedback system (0-100 scores)
   - Immutable rating history
   - Average score calculation

3. **Validation Registry** (`ValidationRegistry.sol`)
   - Third-party work verification
   - Proof of completion on-chain
   - Quality assurance layer

4. **Intent Coordinator** (`IntentRegistry.sol`) ⭐
   - User-signed intent creation (EIP-712)
   - Revocation lock mechanism (10-second window)
   - Complete audit trail of interactions
   - Prevents unauthorized agent actions

---

## ✅ Prerequisites

- **Bun** >= 1.0.0 ([Install Bun](https://bun.sh))
- **Node.js** >= 18.0.0 (for Hardhat contracts)
- **Google Gemini API Key** ([Get API Key](https://aistudio.google.com/app/apikey))
- Two Ethereum private keys (for agent and user accounts)

---

## 📁 Project Structure

```
poka/
├── README.md
├── agents/
│   ├── agent1/                    # First agent instance
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts           # Main entry point
│   │       ├── tools.ts           # Combined tools export
│   │       ├── agent/
│   │       │   ├── agent-server.ts           # HTTP server (Hono)
│   │       │   ├── agent-storage.ts          # Local data storage
│   │       │   └── agent-interaction-tools.ts # Agent discovery & calling tools
│   │       └── contract/
│   │           ├── contract-client.ts        # Blockchain connection
│   │           ├── contract-abis.ts          # Contract ABIs
│   │           └── contract-tools.ts         # Blockchain interaction tools
│   │
│   └── agent2/                    # Second agent instance (same structure)
│       └── ... (identical structure to agent1)
│
└── contract/                      # Smart contracts (optional for local dev)
    ├── contracts/
    │   ├── IdentityRegistry.sol
    │   ├── IntentRegistry.sol
    │   ├── ReputationRegistry.sol
    │   └── ValidationRegistry.sol
    ├── scripts/                   # Deployment scripts
    ├── hardhat.config.ts
    └── package.json
```

---

## 🚀 Local Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd poka
```

### Step 2: Setup Agent 1

```bash
cd agents/agent1
bun install
```

Create `.env` file in `agents/agent1/`:

```env
# Contract Addresses (Already deployed - use these)
IDENTITY_REGISTRY_ADDRESS=0x2C81ec323472811B3649FF8795B8931B2b3039ED
VALIDATION_REGISTRY_ADDRESS=0x9685a3ba40333685994E8f30524a7DF6bc0c7c02
REPUTATION_REGISTRY_ADDRESS=0x057a15ABc6f2269566bC2ae405d4aAc651168807
INTENT_COORDINATOR_ADDRESS=0x6097b4d674072f0e877d31a6decaf62139b4522f
 

# Private Keys (Generate new ones or use test keys)
AGENT_PRIVATE_KEY=0x...your_agent_private_key
USER_PRIVATE_KEY=0x...your_user_private_key

# Agent Configuration
AGENT_PORT=3001
AGENT_NAME=Calculator Agent
AGENT_DESCRIPTION=An agent that performs calculations and text operations

# API Keys
GOOGLE_API_KEY=your_gemini_api_key_here
```

### Step 3: Setup Agent 2

```bash
cd ../agent2
bun install
```

Create `.env` file in `agents/agent2/`:

```env
# Contract Addresses (Same as Agent 1)
IDENTITY_REGISTRY_ADDRESS=0x2C81ec323472811B3649FF8795B8931B2b3039ED
VALIDATION_REGISTRY_ADDRESS=0x9685a3ba40333685994E8f30524a7DF6bc0c7c02
REPUTATION_REGISTRY_ADDRESS=0x057a15ABc6f2269566bC2ae405d4aAc651168807
INTENT_COORDINATOR_ADDRESS=0x6097b4d674072f0e877d31a6decaf62139b4522f
 

# Private Keys (DIFFERENT from Agent 1)
AGENT_PRIVATE_KEY=0x...different_agent_private_key
USER_PRIVATE_KEY=0x...different_user_private_key

# Agent Configuration (DIFFERENT PORT!)
AGENT_PORT=3002
AGENT_NAME=Echo Agent
AGENT_DESCRIPTION=An agent that echoes messages and generates text

# API Keys
GOOGLE_API_KEY=your_gemini_api_key_here
```

---

## 🎮 Running the Agents

### Start Local Blockchain (If not using existing deployment)

```bash
# In a separate terminal
cd contract
npx hardhat node
```

### Run Agent 1

```bash
cd agents/agent1
bun run src/index.ts
```

Expected output:
```
✅ Agent HTTP server started on port 3001
🚀 Agent server running on http://localhost:3001

╭────────────────────────────────────────────────╮
│  🤖 ERC-8004 AI Agent Chat                     │
│  Blockchain-powered autonomous agent           │
│                                                │
│  Commands:                                     │
│  - "register me" - Register this agent         │
│  - "discover agent [ID]" - Find another agent  │
│  - "my id" - Get your agent ID                 │
╰────────────────────────────────────────────────╯

? You › 
```

### Run Agent 2 (In separate terminal)

```bash
cd agents/agent2
bun run src/index.ts
```

---

## 🧪 Testing Agent Interactions

### 1. Register Both Agents

**In Agent 1 terminal:**
```
You › register me
```

Response:
```
✅ Agent registered with ID: 21
```

**In Agent 2 terminal:**
```
You › register me
```

Response:
```
✅ Agent registered with ID: 22
```

### 2. Set Agent URLs

**Agent 1:**
```
You › set my url to http://localhost:3001
```

**Agent 2:**
```
You › set my url to http://localhost:3002
```

### 3. Get Your Agent ID

```
You › my id
```

Response:
```
Your agent ID is: 21
```

### 4. Discover Another Agent

**From Agent 1:**
```
You › discover agent 22
```

Response:
```
✅ Found agent 22
Name: Echo Agent
URL: http://localhost:3002
Actions: calculate, echo, generate_text
```

### 5. Call Another Agent's Action

**From Agent 1 (calling Agent 2):**
```
You › ask agent 22 to echo "Hello from Agent 21!"
```

**What happens:**
1. ✅ Intent created on-chain (user signature required)
2. ✅ Revocation locked for 10 seconds
3. ✅ HTTP call to Agent 22 with intent ID
4. ✅ Agent 22 processes and marks executed on-chain
5. ✅ Response returned: `{ echo: "Hello from Agent 21!" }`

**Check Agent 2 terminal - you'll see:**
```
=== Echo Action Called ===
Intent ID: 0x...
Request body: { message: "Hello from Agent 21!" }
✅ Echo result: { echo: "Hello from Agent 21!" }
✅ Stored execution result
📝 Marking intent as executed on-chain...
✅ Intent marked as executed on-chain. Tx: 0x...
```

### 6. Rate an Agent

```
You › rate agent 22 with score 95
```

### 7. Check Agent Reputation

```
You › what is the reputation of agent 22
```

Response:
```
Agent 22 reputation:
- Total feedback: 1
- Average score: 95/100
```

### 8. Request Validation

```
You › request validation for my work
```

---

## 🔧 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `IDENTITY_REGISTRY_ADDRESS` | Identity registry contract | `0x2C81...39ED` |
| `VALIDATION_REGISTRY_ADDRESS` | Validation registry contract | `0x9685...c02` |
| `REPUTATION_REGISTRY_ADDRESS` | Reputation registry contract | `0x057a...807` |
| `INTENT_COORDINATOR_ADDRESS` | Intent coordinator contract | `0x6097...522f` |
| `AGENT_PRIVATE_KEY` | Agent's private key | `0x...` |
| `USER_PRIVATE_KEY` | User's private key | `0x...` |
| `AGENT_PORT` | HTTP server port | `3001`, `3002` |
| `AGENT_NAME` | Agent display name | `Calculator Agent` |
| `AGENT_DESCRIPTION` | Agent description | `Performs calculations` |
| `GOOGLE_API_KEY` | Gemini API key | `AIza...` |

### Getting Private Keys

**For Testing (Hardhat default keys):**
```bash
# Agent 1
AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
USER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Agent 2
AGENT_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
USER_PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
```

 

---

## 📜 Smart Contracts

### Already Deployed Contracts (Use These)

The following contracts are already deployed and ready to use:

- **Identity Registry**: `0x2C81ec323472811B3649FF8795B8931B2b3039ED`
- **Reputation Registry**: `0x057a15ABc6f2269566bC2ae405d4aAc651168807`
- **Validation Registry**: `0x9685a3ba40333685994E8f30524a7DF6bc0c7c02`
- **Intent Coordinator**: `0x6097b4d674072f0e877d31a6decaf62139b4522f`

### Deploy Your Own (Optional)

If you want to deploy fresh contracts:

```bash
cd contract
npm install

# Start local blockchain
npx hardhat node

# In another terminal, deploy
npx hardhat run scripts/IdentityRegistry.ts --network localhost
npx hardhat run scripts/ReputationRegistry.ts --network localhost
npx hardhat run scripts/ValidationRegistry.ts --network localhost
npx hardhat run scripts/IntentRegistry.ts --network localhost
```

Update the contract addresses in both agent `.env` files.

---

## 🐛 Troubleshooting

### Issue: "Agent not registered"

**Solution:** Run `register me` command first for each agent.

### Issue: "Missing intent ID in header"

**Solution:** The calling agent must create an intent before calling another agent's action. Use the full workflow:
1. Create intent
2. Lock revocation
3. Call action

### Issue: "Invalid signature"

**Solution:** 
- Check that `USER_PRIVATE_KEY` is correct
- Ensure `CHAIN_ID` matches your network
- Verify contract addresses are correct

### Issue: "Port already in use"

**Solution:** 
- Make sure each agent uses a different `AGENT_PORT`
- Check if another process is using the port: `lsof -i :3001`

### Issue: "Connection refused to contract"

**Solution:**
- Ensure local blockchain is running (`npx hardhat node`)
- Check `RPC_URL` in `.env`
- Verify contracts are deployed

### Issue: "Tool execution failed"

**Solution:**
- Check agent has sufficient ETH for gas
- Verify contract addresses are correct
- Check agent is registered on-chain

### Issue: "Agent discovery returns empty"

**Solution:**
- Target agent must be registered
- Target agent must have URL metadata set
- Target agent's HTTP server must be running

---

## 📚 Additional Resources

- **ERC-8004 Specification**: [Ethereum EIPs](https://eips.ethereum.org/EIPS/eip-8004)
- **LangGraph Documentation**: [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- **Viem Documentation**: [Viem Docs](https://viem.sh)
- **Hono Framework**: [Hono Docs](https://hono.dev)

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🔗 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ using ERC-8004, LangGraph, Viem, and Hono**