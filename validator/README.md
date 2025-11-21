# ERC-8004 Validator CLI

A command-line tool for validating agent intent executions in the ERC-8004 protocol.

## Features

- Fetch intent execution data from agents
- Verify data integrity using cryptographic hashing
- Submit validation responses to the blockchain
- Check validation status

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `CHAIN_ID`: Blockchain chain ID (default: 296 for Hedera testnet)
- `RPC_URL`: RPC endpoint URL
- `IDENTITY_REGISTRY_ADDRESS`: Address of the Identity Registry contract
- `VALIDATION_REGISTRY_ADDRESS`: Address of the Validation Registry contract
- `VALIDATOR_PRIVATE_KEY`: Your validator's private key (0x...)

## Usage

Run the validator CLI:
```bash
npm run dev
```

### Validate an Intent

1. Select "Validate Intent" from the menu
2. Enter the Intent ID (0x...)
3. Enter the Target Agent ID (number)
4. The validator will:
   - Fetch the agent's URL from the blockchain
   - Retrieve intent execution data from the agent's `/intents` endpoint
   - Verify data integrity
   - Prompt you to confirm submission
   - Submit the validation response to the blockchain

### Check Validation Status

1. Select "Check Validation Status" from the menu
2. Enter the Request Hash (Intent ID)
3. View the validation details including:
   - Validator address
   - Agent ID
   - Response score
   - Tag
   - Last update timestamp

## How It Works

1. **Fetch Agent URL**: Retrieves the agent's URL from the Identity Registry using the `domain` metadata key
2. **Get Intent Data**: Calls the agent's `/intents` endpoint to get all executed intents
3. **Find Intent**: Searches for the specific intent by ID
4. **Verify Data**: Computes a hash of the intent result data
5. **Score**: Assigns a score (100 if data exists, 0 if missing)
6. **Submit**: Sends the validation response to the Validation Registry contract

## Scoring

- **100**: Intent data exists and is valid
- **0**: Intent data is missing or invalid

## Endpoints Used

- Agent endpoint: `GET /intents` - Returns all executed intents
- Metadata key: `domain` - Agent's base URL

## Example

```bash
$ npm run dev

🔍 ERC-8004 Validator CLI

Validator Address: 0x1234...

? What would you like to do? Validate Intent
? Enter Intent ID (0x...): 0xabcd...
? Enter Target Agent ID: 1

✔ Data verified successfully!
? Submit validation response with score 100? Yes
✔ Validation submitted! Tx: 0x5678...

📊 Validation Summary:
  Intent ID: 0xabcd...
  Target Agent: 1
  Score: 100/100
  Data Hash: 0x9876...
  Transaction: 0x5678...
```
