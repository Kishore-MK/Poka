// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IIdentityRegistry {
    function agentExists(uint256 agentId) external view returns (bool);
    function ownerOf(uint256 agentId) external view returns (address);
}

/**
 * @title IntentCoordinator
 * @dev Intent-based coordination layer for agent-to-agent interactions
 */
contract IntentCoordinator {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    enum IntentStatus {
        Pending,
        Executed,
        Failed,
        Revoked
    }

    struct Intent {
        bytes32 intentId;
        uint256 nonce;
        address userAddress;
        uint256 creatorAgentId;
        uint256 targetAgentId;
        uint256 createdAt;
        uint256 expiresAt;
        bool canRevoke;
        uint256 lockExpiry;
        IntentStatus status;
    }

    IIdentityRegistry public immutable identityRegistry;

    // intentId => Intent
    mapping(bytes32 => Intent) private _intents;
    
    // userAddress => nonce
    mapping(address => uint256) private _userNonces;
    
    // agentId => intentIds[]
    mapping(uint256 => bytes32[]) private _agentIntents;

    // Maximum lock duration (e.g., 10 seconds)
    uint256 public constant MAX_LOCK_DURATION = 10;

    event IntentCreated(
        bytes32 indexed intentId,
        address indexed userAddress,
        uint256 indexed creatorAgentId,
        uint256 targetAgentId,
        uint256 expiresAt
    );

    event RevocationLocked(
        bytes32 indexed intentId,
        uint256 lockExpiry
    );

    event IntentRevoked(
        bytes32 indexed intentId,
        address indexed revokedBy
    );

    event IntentExecuted(
        bytes32 indexed intentId,
        uint256 indexed targetAgentId
    );

    event IntentFailed(
        bytes32 indexed intentId,
        uint256 indexed targetAgentId,
        string reason
    );

    constructor(address _identityRegistry) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @dev Create a new intent with user signature
     */
    function createIntent(
        uint256 creatorAgentId,
        uint256 targetAgentId,
        uint256 expiresAt,
        address userAddress,
        uint256 nonce,
        bytes calldata signature
    ) external returns (bytes32 intentId) {
        require(identityRegistry.agentExists(creatorAgentId), "Creator agent does not exist");
        require(identityRegistry.agentExists(targetAgentId), "Target agent does not exist");
        require(expiresAt > block.timestamp, "Expiry must be in future");
        require(nonce == _userNonces[userAddress] + 1, "Invalid nonce");

        // Verify user signature
        intentId = keccak256(
            abi.encodePacked(
                userAddress,
                creatorAgentId,
                targetAgentId,
                nonce,
                expiresAt,
                block.chainid,
                address(this)
            )
        );

        bytes32 ethSignedHash = intentId.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);
        require(recoveredSigner == userAddress, "Invalid signature");

        // Create intent
        _intents[intentId] = Intent({
            intentId: intentId,
            nonce: nonce,
            userAddress: userAddress,
            creatorAgentId: creatorAgentId,
            targetAgentId: targetAgentId,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            canRevoke: true,
            lockExpiry: 0,
            status: IntentStatus.Pending
        });

        _userNonces[userAddress] = nonce;
        _agentIntents[creatorAgentId].push(intentId);
        _agentIntents[targetAgentId].push(intentId);

        emit IntentCreated(intentId, userAddress, creatorAgentId, targetAgentId, expiresAt);
    }

    /**
     * @dev Lock revocation before sending HTTP request (only creator agent)
     */
    function lockRevocation(bytes32 intentId) external {
        Intent storage intent = _intents[intentId];
        require(intent.intentId != bytes32(0), "Intent does not exist");
        require(block.timestamp < intent.expiresAt, "Intent expired");
        require(intent.status == IntentStatus.Pending, "Intent not pending");
        require(
            identityRegistry.ownerOf(intent.creatorAgentId) == msg.sender,
            "Not creator agent owner"
        );
        require(intent.canRevoke, "Already locked");

        intent.canRevoke = false;
        intent.lockExpiry = block.timestamp + MAX_LOCK_DURATION;

        emit RevocationLocked(intentId, intent.lockExpiry);
    }

    /**
     * @dev Revoke intent (only user, and only if canRevoke is true)
     */
    function revokeIntent(bytes32 intentId) external {
        Intent storage intent = _intents[intentId];
        require(intent.intentId != bytes32(0), "Intent does not exist");
        require(intent.userAddress == msg.sender, "Not intent creator");
        require(intent.status == IntentStatus.Pending, "Intent not pending");
        
        // Check if lock has expired
        if (!intent.canRevoke && block.timestamp >= intent.lockExpiry) {
            intent.canRevoke = true;
        }
        
        require(intent.canRevoke, "Cannot revoke - locked by agent");

        intent.status = IntentStatus.Revoked;

        emit IntentRevoked(intentId, msg.sender);
    }

    /**
     * @dev Mark intent as executed (only target agent)
     */
    function markExecuted(bytes32 intentId) external {
        Intent storage intent = _intents[intentId];
        require(intent.intentId != bytes32(0), "Intent does not exist");
        require(block.timestamp < intent.expiresAt, "Intent expired");
        require(intent.status == IntentStatus.Pending, "Intent not pending");
        require(
            identityRegistry.ownerOf(intent.targetAgentId) == msg.sender,
            "Not target agent owner"
        );

        intent.status = IntentStatus.Executed;

        emit IntentExecuted(intentId, intent.targetAgentId);
    }

    /**
     * @dev Mark intent as failed (only target agent)
     */
    function markFailed(bytes32 intentId, string calldata reason) external {
        Intent storage intent = _intents[intentId];
        require(intent.intentId != bytes32(0), "Intent does not exist");
        require(intent.status == IntentStatus.Pending, "Intent not pending");
        require(
            identityRegistry.ownerOf(intent.targetAgentId) == msg.sender,
            "Not target agent owner"
        );

        intent.status = IntentStatus.Failed;

        emit IntentFailed(intentId, intent.targetAgentId, reason);
    }

    /**
     * @dev Get intent details
     */
    function getIntent(bytes32 intentId)
        external
        view
        returns (
            address userAddress,
            uint256 creatorAgentId,
            uint256 targetAgentId,
            uint256 createdAt,
            uint256 expiresAt,
            bool canRevoke,
            IntentStatus status
        )
    {
        Intent memory intent = _intents[intentId];
        require(intent.intentId != bytes32(0), "Intent does not exist");

        // Update canRevoke if lock expired
        bool revocable = intent.canRevoke;
        if (!revocable && block.timestamp >= intent.lockExpiry) {
            revocable = true;
        }

        return (
            intent.userAddress,
            intent.creatorAgentId,
            intent.targetAgentId,
            intent.createdAt,
            intent.expiresAt,
            revocable,
            intent.status
        );
    }

    /**
     * @dev Check if intent is valid for execution
     */
    function isIntentValid(bytes32 intentId) external view returns (bool) {
        Intent memory intent = _intents[intentId];
        return (
            intent.intentId != bytes32(0) &&
            block.timestamp < intent.expiresAt &&
            intent.status == IntentStatus.Pending
        );
    }

    /**
     * @dev Get user's current nonce
     */
    function getUserNonce(address userAddress) external view returns (uint256) {
        return _userNonces[userAddress];
    }

    /**
     * @dev Get all intents for an agent
     */
    function getAgentIntents(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentIntents[agentId];
    }

    /**
     * @dev Verify intent signature off-chain
     */
    function verifyIntentSignature(
        address userAddress,
        uint256 creatorAgentId,
        uint256 targetAgentId,
        uint256 nonce,
        uint256 expiresAt,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 intentId = keccak256(
            abi.encodePacked(
                userAddress,
                creatorAgentId,
                targetAgentId,
                nonce,
                expiresAt,
                block.chainid,
                address(this)
            )
        );

        bytes32 ethSignedHash = intentId.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);
        
        return recoveredSigner == userAddress;
    }
}