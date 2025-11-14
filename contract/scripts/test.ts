import { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther, Address, Hex, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { identityRegistryAbi } from '../scripts/IdentityRegistry.js';
import { reputationRegistryAbi } from '../scripts/ReputationRegistry.js';
import { validationRegistryAbi } from '../scripts/ValidationRegistry.js';
import { intentRegistryAbi } from './IntentRegistry.js';
import dotenv from 'dotenv';
dotenv.config();
// Custom chain configuration
const customChain = defineChain({
  id: 420420422, // Change to your chain ID
  name: 'Polkadot Hub TestNet',
  nativeCurrency: {
    decimals: 18,
    name: 'Paseo',
    symbol: 'PAS',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'], // Change to your RPC URL
    },
    public: {
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    },
  },
});

// Contract addresses (update after deployment)
const IDENTITY_REGISTRY_ADDRESS = '0x2C81ec323472811B3649FF8795B8931B2b3039ED' as Address;
const VALIDATION_REGISTRY_ADDRESS = '0x9685a3ba40333685994E8f30524a7DF6bc0c7c02' as Address;
const REPUTATION_REGISTRY_ADDRESS = '0x057a15ABc6f2269566bC2ae405d4aAc651168807' as Address;
const INTENT_COORDINATOR_ADDRESS = '0x6097b4d674072f0e877d31a6decaf62139b4522f' as Address;

// Test accounts

const ownerAccount = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as `0x${string}`);
const userAccount = privateKeyToAccount(process.env.USER_PRIVATE_KEY as `0x${string}`);
const agentOwnerAccount = privateKeyToAccount(process.env.AGENT_OWNER_PRIVATE_KEY as `0x${string}`);
const targetAgentAccount = privateKeyToAccount(process.env.TARGET_AGENT_PRIVATE_KEY as `0x${string}`);

// Create clients
const publicClient = createPublicClient({
  chain: customChain,
  transport: http(),
});

const ownerWalletClient = createWalletClient({
  account: ownerAccount,
  chain: customChain,
  transport: http(),
});

const userWalletClient = createWalletClient({
  account: userAccount,
  chain: customChain,
  transport: http(),
});

const agentOwnerWalletClient = createWalletClient({
  account: agentOwnerAccount,
  chain: customChain,
  transport: http(),
});

const targetAgentWalletClient = createWalletClient({
  account: targetAgentAccount,
  chain: customChain,
  transport: http(),
});



// Helper functions
async function waitForTransaction(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt;
}

function encodeBytes(data: string): Hex {
  return `0x${Buffer.from(data).toString('hex')}` as Hex;
}

// Test Suite
async function testIdentityRegistry() {
  console.log('\n=== Testing Identity Registry ===\n');

  try {
    // 1. Register agent with URI
    // console.log('1. Registering agent...');
    // const { request } = await publicClient.simulateContract({
    //   address: IDENTITY_REGISTRY_ADDRESS,
    //   abi: identityRegistryAbi,
    //   functionName: 'register',
    //   args: ['https://example.com/agent1.json'],
    //   account: agentOwnerAccount,
    // });

    // const hash = await targetAgentWalletClient.writeContract(request);
    // const receipt = await waitForTransaction(hash);
    // console.log(`✅ Agent registered. Tx: ${hash}`);

    // // Extract agentId from logs (simplified - in production parse the event)
    // const agentId = 1n; // Assume first agent

    // // 2. Check if agent exists
    // console.log('\n2. Checking if agent exists...');
    // const exists = await publicClient.readContract({
    //   address: IDENTITY_REGISTRY_ADDRESS,
    //   abi: identityRegistryAbi,
    //   functionName: 'agentExists',
    //   args: [agentId],
    // });
    // console.log(`✅ Agent exists: ${exists}`);

    // // 3. Get tokenURI
    // console.log('\n3. Getting tokenURI...');
    // const tokenUri = await publicClient.readContract({
    //   address: IDENTITY_REGISTRY_ADDRESS,
    //   abi: identityRegistryAbi,
    //   functionName: 'tokenURI',
    //   args: [agentId],
    // });
    // console.log(`✅ TokenURI: ${tokenUri}`);

    // // 4. Get owner
    console.log('\n4. Getting owner...');
    const owner = await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: identityRegistryAbi,
      functionName: 'ownerOf',
      args: [agentId],
    });
    console.log(`✅ Owner: ${owner}`);

    // 5. Set metadata
    // console.log('\n5. Setting metadata...');
    // const metadataKey = 'agentWallet';
    // const metadataValue = encodeBytes('0x1234567890123456789012345678901234567890');

    // const { request: setMetadataRequest } = await publicClient.simulateContract({
    //   address: IDENTITY_REGISTRY_ADDRESS,
    //   abi: identityRegistryAbi,
    //   functionName: 'setMetadata',
    //   args: [agentId, metadataKey, metadataValue],
    //   account: agentOwnerAccount,
    // });

    // const setMetadataHash = await targetAgentWalletClient.writeContract(setMetadataRequest);
    // await waitForTransaction(setMetadataHash);
    // console.log(`✅ Metadata set. Tx: ${setMetadataHash}`);

    // // 6. Get metadata
    // console.log('\n6. Getting metadata...');
    // const retrievedMetadata = await publicClient.readContract({
    //   address: IDENTITY_REGISTRY_ADDRESS,
    //   abi: identityRegistryAbi,
    //   functionName: 'getMetadata',
    //   args: [agentId, metadataKey],
    // });
    // console.log(`✅ Metadata: ${retrievedMetadata}`);

    // return agentId;
  } catch (error) {
    console.error('❌ Identity Registry test failed:', error);
    throw error;
  }
}

// testIdentityRegistry()

async function testReputationRegistry(agentId: bigint) {
  console.log('\n=== Testing Reputation Registry ===\n');

  try {
    // 1. Get user's initial nonce/last index
    console.log('1. Getting last feedback index...');
    const lastIndex: any = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'getLastIndex',
      args: [agentId, userAccount.address],
    });
    console.log(`✅ Last index: ${lastIndex}`);

    // 2. Create feedbackAuth (simplified - in production, agent owner should sign this)
    const feedbackAuth = {
      agentId: agentId,
      clientAddress: userAccount.address,
      indexLimit: lastIndex + 2n, // Allow 2 feedback submissions
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      chainId: BigInt(customChain.id),
      identityRegistry: IDENTITY_REGISTRY_ADDRESS,
      signerAddress: agentOwnerAccount.address,
    };

    // 3. Give feedback
    console.log('\n2. Giving feedback...');
    const { request } = await publicClient.simulateContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'giveFeedback',
      args: [
        agentId,
        feedbackAuth,
        85, // score
        '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, // tag1
        '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex, // tag2
        'ipfs://Qm...', // uri
        '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, // fileHash
      ],
      account: userAccount,
    });

    const hash = await userWalletClient.writeContract(request);
    await waitForTransaction(hash);
    console.log(`✅ Feedback given. Tx: ${hash}`);

    // 4. Read feedback
    console.log('\n3. Reading feedback...');
    const feedback: any = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'readFeedback',
      args: [agentId, userAccount.address, 1n],
    });
    console.log(`✅ Feedback: Score=${feedback[0]}, Tag1=${feedback[1]}, Tag2=${feedback[2]}, Revoked=${feedback[3]}`);

    // 5. Get summary
    console.log('\n4. Getting summary...');
    const summary: any = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'getSummary',
      args: [
        agentId,
        [], // No filter
        '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      ],
    });
    console.log(`✅ Summary: Count=${summary[0]}, AvgScore=${summary[1]}`);

    // 6. Get clients
    console.log('\n5. Getting clients...');
    const clients: any = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'getClients',
      args: [agentId],
    });
    console.log(`✅ Clients: ${clients.join(', ')}`);

    // 7. Revoke feedback
    console.log('\n6. Revoking feedback...');
    const { request: revokeRequest } = await publicClient.simulateContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'revokeFeedback',
      args: [agentId, 1n],
      account: userAccount,
    });

    const revokeHash = await userWalletClient.writeContract(revokeRequest);
    await waitForTransaction(revokeHash);
    console.log(`✅ Feedback revoked. Tx: ${revokeHash}`);

    // 8. Read revoked feedback
    console.log('\n7. Reading revoked feedback...');
    const revokedFeedback: any = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: 'readFeedback',
      args: [agentId, userAccount.address, 1n],
    });
    console.log(`✅ Revoked status: ${revokedFeedback[3]}`);
  } catch (error) {
    console.error('❌ Reputation Registry test failed:', error);
    throw error;
  }
}

// testReputationRegistry(1n)

async function testValidationRegistry(agentId: bigint) {
  console.log('\n=== Testing Validation Registry ===\n');

  try {
    const validatorAddress = ownerAccount.address; // Using owner as validator
    const requestHash = '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex;

    // 1. Request validation
    console.log('1. Requesting validation...');
    const { request } = await publicClient.simulateContract({
      address: VALIDATION_REGISTRY_ADDRESS,
      abi: validationRegistryAbi,
      functionName: 'requestValidation',
      args: [
        agentId,
        validatorAddress,
        'ipfs://QmValidationRequest...',
        requestHash,
        '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, // tag
      ],
      account: agentOwnerAccount,
    });

    const hash = await agentOwnerWalletClient.writeContract(request);
    await waitForTransaction(hash);
    console.log(`✅ Validation requested. Tx: ${hash}`);

    //   // 2. Get validation status (before response)
    //   console.log('\n2. Getting validation status...');
    //   const statusBefore:any = await publicClient.readContract({
    //     address: VALIDATION_REGISTRY_ADDRESS,
    //     abi: validationRegistryAbi,
    //     functionName: 'getValidationStatus',
    //     args: [requestHash],
    //   });
    //   console.log(`✅ Status: Validator=${statusBefore[0]}, AgentId=${statusBefore[1]}, Response=${statusBefore[2]}`);

    //   // 3. Submit validation response
    //   console.log('\n3. Submitting validation response...');
    //   const { request: responseRequest } = await publicClient.simulateContract({
    //     address: VALIDATION_REGISTRY_ADDRESS,
    //     abi: validationRegistryAbi,
    //     functionName: 'validationResponse',
    //     args: [
    //       requestHash,
    //       100, // response (passed)
    //       'ipfs://QmValidationResponse...',
    //       '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
    //       '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    //     ],
    //     account: ownerAccount,
    //   });

    //   const responseHash = await ownerWalletClient.writeContract(responseRequest);
    //   await waitForTransaction(responseHash);
    //   console.log(`✅ Validation response submitted. Tx: ${responseHash}`);

    //   // 4. Get validation status (after response)
    //   console.log('\n4. Getting updated validation status...');
    //   const statusAfter:any = await publicClient.readContract({
    //     address: VALIDATION_REGISTRY_ADDRESS,
    //     abi: validationRegistryAbi,
    //     functionName: 'getValidationStatus',
    //     args: [requestHash],
    //   });
    //   console.log(`✅ Updated status: Response=${statusAfter[2]}, LastUpdate=${statusAfter[4]}`);

    //   // 5. Get agent validations
    //   console.log('\n5. Getting agent validations...');
    //   const agentValidations:any = await publicClient.readContract({
    //     address: VALIDATION_REGISTRY_ADDRESS,
    //     abi: validationRegistryAbi,
    //     functionName: 'getAgentValidations',
    //     args: [agentId],
    //   });
    //   console.log(`✅ Agent validations: ${agentValidations.length} validations`);

    //   // 6. Get validator requests
    //   console.log('\n6. Getting validator requests...');
    //   const validatorRequests:any = await publicClient.readContract({
    //     address: VALIDATION_REGISTRY_ADDRESS,
    //     abi: validationRegistryAbi,
    //     functionName: 'getValidatorRequests',
    //     args: [validatorAddress],
    //   });
    //   console.log(`✅ Validator requests: ${validatorRequests.length} requests`);

    //   // 7. Get summary
    //   console.log('\n7. Getting summary...');
    //   const summary:any = await publicClient.readContract({
    //     address: VALIDATION_REGISTRY_ADDRESS,
    //     abi: validationRegistryAbi,
    //     functionName: 'getSummary',
    //     args: [
    //       agentId,
    //       [],
    //       '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
    //     ],
    //   });
    //   console.log(`✅ Summary: Count=${summary[0]}, AvgResponse=${summary[1]}`);
  } catch (error) {
    console.error('❌ Validation Registry test failed:', error);
    throw error;
  }
}


// testValidationRegistry(1n)



async function testIntentCoordinator(creatorAgentId: bigint, targetAgentId: bigint) {
  console.log('\n=== Testing Intent Coordinator ===\n');

  try {
    // 1. Get user nonce
    // console.log('1. Getting user nonce...');
    // const nonce: any = await publicClient.readContract({
    //   address: INTENT_COORDINATOR_ADDRESS,
    //   abi: intentRegistryAbi,
    //   functionName: 'getUserNonce',
    //   args: [userAccount.address],
    // });
    // console.log(`✅ User nonce: ${nonce}`);

    // // 2. Create intent signature
    // console.log('\n2. Creating intent signature...');
    // const newNonce = nonce + 1n;
    // const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now

    // const messageHash = keccak256(
    //   encodePacked(
    //     ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
    //     [userAccount.address, creatorAgentId, targetAgentId, newNonce, expiresAt, BigInt(customChain.id), INTENT_COORDINATOR_ADDRESS]
    //   )
    // );

    // const signature = await userAccount.signMessage({
    //   message: { raw: messageHash },
    // });

    // console.log(`✅ Signature created: ${signature.slice(0, 20)}...`);
    // console.log(userAccount.address, creatorAgentId, targetAgentId, newNonce, expiresAt, signature, [userAccount.address, creatorAgentId, targetAgentId, newNonce, expiresAt, signature].length);

    // // 3. Verify signature off-chain
    // console.log('\n3. Verifying signature...');
    // const isValid = await publicClient.readContract({
    //   address: INTENT_COORDINATOR_ADDRESS,
    //   abi: intentRegistryAbi,
    //   functionName: 'verifyIntentSignature',
    //   args: [userAccount.address, creatorAgentId, targetAgentId, newNonce, expiresAt, signature],
    // });
    // console.log(`✅ Signature valid: ${isValid}`);

    // // 4. Create intent
    // console.log('\n4. Creating intent...');
    // const { request, result: intendId } = await publicClient.simulateContract({
    //   address: INTENT_COORDINATOR_ADDRESS,
    //   abi: intentRegistryAbi,
    //   functionName: 'createIntent',
    //   args: [creatorAgentId, targetAgentId, expiresAt, userAccount.address, newNonce, signature],
    //   account: userAccount,
    // });
    // console.log("ID of the intent",intendId);


    // const hash = await userWalletClient.writeContract(request);
    // await waitForTransaction(hash);
    // console.log(`✅ Intent created. Tx: ${hash}`);

    // const intent: any = await publicClient.readContract({
    //   address: INTENT_COORDINATOR_ADDRESS,
    //   abi: intentRegistryAbi,
    //   functionName: 'getIntent',
    //   args: ['0x1bae4f7a20370a6f304cc8a1d061c42fd0685c11048fbadf23c1236b19262ff8']
    // });

    // console.log(`Intent details: user address=${intent[0]},CreatorAgentId =${intent[1]}, TargetAgentId=${intent[2]}, CreatedAt=${intent[3]}, ExpiresAt=${intent[4]},  Revocable=${intent[5]}, status=${intent[6]}`);

    // console.log(ownerWalletClient.account.address);

    // const txHash = await ownerWalletClient.writeContract({
    //   address: INTENT_COORDINATOR_ADDRESS,
    //   abi: intentRegistryAbi,
    //   functionName: 'lockRevocation',
    //   args: ['0x1bae4f7a20370a6f304cc8a1d061c42fd0685c11048fbadf23c1236b19262ff8']
    // });

 
    // await waitForTransaction(txHash);

    // console.log(`✅ Intent Revocation locked. Tx: ${txHash}`);

    
    // const txHash = await ownerWalletClient.writeContract({
    //   address: INTENT_COORDINATOR_ADDRESS,
    //   abi: intentRegistryAbi,
    //   functionName: 'markExecuted',
    //   args: ['0xa8d67a6adb617b4a3937965d0836e17c1f01d6382eada3dad51f0738e7f3e0a5']
    // });

 
    // await waitForTransaction(txHash);

    // console.log(`✅ Intent Revocation locked. Tx: ${txHash}`);


    const result=await publicClient.readContract({
      address: INTENT_COORDINATOR_ADDRESS,
      abi: intentRegistryAbi,
      functionName: 'isIntentValid',
      args: ['0xa8d67a6adb617b4a3937965d0836e17c1f01d6382eada3dad51f0738e7f3e0a5']
    });

    console.log(`Is intent valid: ${result}`);


  } catch (error) {
    console.error('❌ Intent Coordinator test failed:', error);
    throw error;
  }
}

testIntentCoordinator(1n, 2n)