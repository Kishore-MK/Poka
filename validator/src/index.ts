import { createPublicClient, createWalletClient, http, defineChain, Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem';
import * as dotenv from 'dotenv';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';

dotenv.config();

// Custom chain configuration
const customChain = defineChain({
    id: Number(process.env.CHAIN_ID || 296),
    name: 'Hedera Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Hbar',
        symbol: 'HBAR',
    },
    rpcUrls: {
        default: {
            http: [process.env.RPC_URL || 'https://testnet.hashio.io/api'],
        },
        public: {
            http: [process.env.RPC_URL || 'https://testnet.hashio.io/api'],
        },
    },
});

// Contract addresses
const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS as Address;
const VALIDATION_REGISTRY_ADDRESS = process.env.VALIDATION_REGISTRY_ADDRESS as Address;

// Validator account
const validatorAccount = privateKeyToAccount(process.env.VALIDATOR_PRIVATE_KEY as Hex);

// Create clients
const publicClient = createPublicClient({
    chain: customChain,
    transport: http(),
});

const validatorWalletClient = createWalletClient({
    account: validatorAccount,
    chain: customChain,
    transport: http(),
});
console.log(validatorAccount.address);
// Contract ABIs
const identityRegistryAbi = [
    {
        inputs: [
            { name: 'agentId', type: 'uint256' },
            { name: 'key', type: 'string' },
        ],
        name: 'getMetadata',
        outputs: [{ name: '', type: 'bytes' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

const validationRegistryAbi = [
    {
        inputs: [
            { name: 'requestHash', type: 'bytes32' },
            { name: 'response', type: 'uint8' },
            { name: 'responseUri', type: 'string' },
            { name: 'responseHash', type: 'bytes32' },
            { name: 'tag', type: 'bytes32' },
        ],
        name: 'validationResponse',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'requestHash', type: 'bytes32' }],
        name: 'getValidationStatus',
        outputs: [
            { name: 'validatorAddress', type: 'address' },
            { name: 'agentId', type: 'uint256' },
            { name: 'response', type: 'uint8' },
            { name: 'tag', type: 'bytes32' },
            { name: 'lastUpdate', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Helper functions
async function waitForTransaction(hash: Hex) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt;
}

function hashData(data: any): Hex {
    const jsonStr = JSON.stringify(data);
    return keccak256(`0x${Buffer.from(jsonStr).toString('hex')}` as Hex);
}

async function getAgentURL(agentId: bigint): Promise<string | null> {
    try {
        const urlMetadata = await publicClient.readContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'getMetadata',
            args: [agentId, 'domain'],
        });

        if (!urlMetadata || urlMetadata === '0x') {
            return null;
        }

        return Buffer.from(urlMetadata.slice(2), 'hex').toString('utf8');
    } catch (error: any) {
        console.error(chalk.red(`Failed to get agent URL: ${error.message}`));
        return null;
    }
}

async function fetchIntentData(agentURL: string, intentId: string): Promise<any> {
    try {
        // Use the /intents endpoint to get all intents
        const response = await fetch(`${agentURL}/intents`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Find the specific intent by ID
        const intent = data.intents?.find((i: any) => i.intentId === intentId);

        if (!intent) {
            throw new Error('Intent not found');
        }

        return {
            success: intent.success,
            result: intent.result,
            timestamp: intent.timestamp,
            transactionHash: intent.transactionHash,
        };
    } catch (error: any) {
        throw new Error(`Failed to fetch intent data: ${error.message}`);
    }
}

async function validateIntent(requestHash: string, agentId: string) {
    const spinner = ora('Validating intent...').start();

    try {
        const agentIdBigInt = BigInt(agentId);

        // Step 1: Get agent URL
        spinner.text = 'Fetching agent URL from blockchain...';
        const agentURL = await getAgentURL(agentIdBigInt);

        if (!agentURL) {
            spinner.fail(chalk.red('Agent URL not found in metadata'));
            return;
        }

        console.log(chalk.gray(`\nAgent URL: ${agentURL}`));

        // Step 2: Fetch all intents from agent
        spinner.text = 'Fetching intents data...';
        const response = await fetch(`${agentURL}/intents`);

        if (!response.ok) {
            spinner.fail(chalk.red(`Failed to fetch intents: HTTP ${response.status}`));
            return;
        }

        const data = await response.json();

        if (!data.intents || data.intents.length === 0) {
            spinner.fail(chalk.red('No intents found'));
            return;
        }

        console.log(chalk.gray(`\nFound ${data.intents.length} intent(s)`));
        console.log(chalk.gray('Latest intent data:'));
        console.log(chalk.gray(JSON.stringify(data.intents[0], null, 2)));

        // Step 3: Verify data exists and compute hash
        spinner.text = 'Verifying data integrity...';

        const latestIntent = data.intents[0];
        if (!latestIntent.result) {
            spinner.fail(chalk.red('No result data found'));
            return;
        }

        const dataHash = hashData(latestIntent.result);
        console.log(chalk.gray(`\nComputed hash: ${dataHash}`));

        // Step 4: Determine score (binary: data exists = 100, missing = 0)
        const score = latestIntent.success ? 100 : 0;

        if (score === 0) {
            spinner.fail(chalk.red('Validation failed: Intent execution failed'));
            return;
        }

        spinner.succeed(chalk.green('Data verified successfully!'));

        // Step 5: Ask for confirmation
        const confirmResponse = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow(`Submit validation response with score ${score}?`),
            initial: true,
        });

        if (!confirmResponse.confirm) {
            console.log(chalk.gray('Validation cancelled.'));
            return;
        }

        // Step 6: Submit validation response
        spinner.start('Submitting validation response to blockchain...');

        const hash = await validatorWalletClient.writeContract({
            address: VALIDATION_REGISTRY_ADDRESS,
            abi: validationRegistryAbi,
            functionName: 'validationResponse',
            args: [
                requestHash as Hex,
                score,
                `${agentURL}/intents`, // responseUri - points to intents endpoint
                dataHash, // responseHash
                '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, // tag: "verified"
            ],
            account: validatorAccount,
        });

        await waitForTransaction(hash);

        spinner.succeed(chalk.green(`✅ Validation submitted! Tx: ${hash}`));

        // Step 7: Show summary
        console.log(chalk.cyan('\n📊 Validation Summary:'));
        console.log(chalk.white(`  Request Hash: ${requestHash}`));
        console.log(chalk.white(`  Agent ID: ${agentId}`));
        console.log(chalk.white(`  Score: ${score}/100`));
        console.log(chalk.white(`  Data Hash: ${dataHash}`));
        console.log(chalk.white(`  Transaction: ${hash}`));

    } catch (error: any) {
        spinner.fail(chalk.red('Validation failed'));
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
    }
}

async function checkValidationStatus(requestHash: string) {
    const spinner = ora('Fetching validation status...').start();

    try {
        const status = await publicClient.readContract({
            address: VALIDATION_REGISTRY_ADDRESS,
            abi: validationRegistryAbi,
            functionName: 'getValidationStatus',
            args: [requestHash as Hex],
        });

        spinner.succeed(chalk.green('Validation status fetched'));

        console.log(chalk.cyan('\n📊 Validation Status:'));
        console.log(chalk.white(`  Request Hash: ${requestHash}`));
        console.log(chalk.white(`  Validator: ${status[0]}`));
        console.log(chalk.white(`  Agent ID: ${status[1]}`));
        console.log(chalk.white(`  Response Score: ${status[2]}/100`));
        console.log(chalk.white(`  Tag: ${status[3]}`));
        console.log(chalk.white(`  Last Update: ${new Date(Number(status[4]) * 1000).toLocaleString()}`));

    } catch (error: any) {
        spinner.fail(chalk.red('Failed to fetch status'));
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
    }
}

async function main() {
    console.clear();
    console.log(chalk.bold.cyan('\n🔍 ERC-8004 Validator CLI\n'));
    console.log(chalk.gray(`Validator Address: ${validatorAccount.address}\n`));

    const response = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            { title: 'Validate Intent', value: 'validate' },
            { title: 'Check Validation Status', value: 'status' },
            { title: 'Exit', value: 'exit' },
        ],
    });

    if (!response.action || response.action === 'exit') {
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
    }

    if (response.action === 'validate') {
        const intentResponse = await prompts([
            {
                type: 'text',
                name: 'requestHash',
                message: 'Enter Request Hash (0x...):',
                validate: (value) => value.startsWith('0x') ? true : 'Must start with 0x',
            },
            {
                type: 'text',
                name: 'agentId',
                message: 'Enter Agent ID:',
                validate: (value) => !isNaN(Number(value)) ? true : 'Must be a number',
            },
        ]);

        if (intentResponse.requestHash && intentResponse.agentId) {
            await validateIntent(intentResponse.requestHash, intentResponse.agentId);
        }
    } else if (response.action === 'status') {
        const statusResponse = await prompts({
            type: 'text',
            name: 'requestHash',
            message: 'Enter Request Hash (0x...):',
            validate: (value) => value.startsWith('0x') ? true : 'Must start with 0x',
        });

        if (statusResponse.requestHash) {
            await checkValidationStatus(statusResponse.requestHash);
        }
    }

    // Ask if user wants to continue
    const continueResponse = await prompts({
        type: 'confirm',
        name: 'continue',
        message: chalk.yellow('\nPerform another action?'),
        initial: true,
    });

    if (continueResponse.continue) {
        await main();
    } else {
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
    }
}

// Run validator
main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});
