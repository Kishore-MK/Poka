// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function agentExists(uint256 agentId) external view returns (bool);
    function ownerOf(uint256 agentId) external view returns (address);
}

/**
 * @title ReputationRegistry
 * @dev Registry for agent feedback and reputation management
 */
contract ReputationRegistry {
    struct FeedbackAuth {
        uint256 agentId;
        address clientAddress;
        uint64 indexLimit;
        uint256 expiry;
        uint256 chainId;
        address identityRegistry;
        address signerAddress;
    }

    struct Feedback {
        uint8 score;
        bytes32 tag1;
        bytes32 tag2;
        string uri;
        bytes32 fileHash;
        bool isRevoked;
    }

    struct Response {
        string responseUri;
        uint256 timestamp;
    }

    IIdentityRegistry public immutable identityRegistry;

    // agentId => clientAddress => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private _feedback;
    
    // agentId => clientAddress => lastIndex
    mapping(uint256 => mapping(address => uint64)) private _lastIndex;
    
    // agentId => list of clients
    mapping(uint256 => address[]) private _clients;
    
    // agentId => clientAddress => feedbackIndex => responderAddress => Response
    mapping(uint256 => mapping(address => mapping(uint64 => mapping(address => Response)))) private _responses;

    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex
    );

    event FeedbackResponse(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder
    );

    constructor(address _identityRegistry) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @dev Give feedback to an agent
     */
    function giveFeedback(
        uint256 agentId,
        FeedbackAuth calldata feedbackAuth,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata uri,
        bytes32 fileHash
    ) external {
        require(identityRegistry.agentExists(agentId), "Agent does not exist");
        require(score <= 100, "Score must be <= 100");
        require(block.timestamp < feedbackAuth.expiry, "FeedbackAuth expired");
        require(feedbackAuth.agentId == agentId, "AgentId mismatch");
        require(feedbackAuth.clientAddress == msg.sender, "Client mismatch");
        require(feedbackAuth.chainId == block.chainid, "ChainId mismatch");
        require(feedbackAuth.identityRegistry == address(identityRegistry), "Registry mismatch");

        uint64 currentIndex = _lastIndex[agentId][msg.sender];
        require(feedbackAuth.indexLimit > currentIndex, "IndexLimit too low");

        // Verify signature (simplified - should use EIP-191/ERC-1271)
        // In production, verify feedbackAuth signature here

        uint64 newIndex = currentIndex + 1;
        _lastIndex[agentId][msg.sender] = newIndex;

        if (currentIndex == 0) {
            _clients[agentId].push(msg.sender);
        }

        _feedback[agentId][msg.sender][newIndex] = Feedback({
            score: score,
            tag1: tag1,
            tag2: tag2,
            uri: uri,
            fileHash: fileHash,
            isRevoked: false
        });

        emit FeedbackGiven(agentId, msg.sender, newIndex, score, tag1, tag2);
    }

    /**
     * @dev Revoke feedback
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        require(_feedback[agentId][msg.sender][feedbackIndex].score > 0, "Feedback does not exist");
        require(!_feedback[agentId][msg.sender][feedbackIndex].isRevoked, "Already revoked");

        _feedback[agentId][msg.sender][feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @dev Respond to feedback
     */
    function respondToFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseUri
    ) external {
        require(_feedback[agentId][clientAddress][feedbackIndex].score > 0, "Feedback does not exist");

        _responses[agentId][clientAddress][feedbackIndex][msg.sender] = Response({
            responseUri: responseUri,
            timestamp: block.timestamp
        });

        emit FeedbackResponse(agentId, clientAddress, feedbackIndex, msg.sender);
    }

    /**
     * @dev Get summary statistics for an agent
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        bytes32 tag1,
        bytes32 tag2
    ) external view returns (uint64 count, uint8 averageScore) {
        address[] memory clients;
        if( clientAddresses.length > 0){
            clients = clientAddresses;
        } else {
             clients = _clients[agentId];
        }
        uint256 totalScore = 0;
        count = 0;

        for (uint256 i = 0; i < clients.length; i++) {
            uint64 lastIdx = _lastIndex[agentId][clients[i]];
            
            for (uint64 j = 1; j <= lastIdx; j++) {
                Feedback memory fb = _feedback[agentId][clients[i]][j];
                
                if (fb.isRevoked) continue;
                if (tag1 != bytes32(0) && fb.tag1 != tag1) continue;
                if (tag2 != bytes32(0) && fb.tag2 != tag2) continue;

                totalScore += fb.score;
                count++;
            }
        }

        averageScore = count > 0 ? uint8(totalScore / count) : 0;
    }

    /**
     * @dev Read specific feedback
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 index
    ) external view returns (
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        bool isRevoked
    ) {
        Feedback memory fb = _feedback[agentId][clientAddress][index];
        return (fb.score, fb.tag1, fb.tag2, fb.isRevoked);
    }

    /**
     * @dev Get all clients who gave feedback
     */
    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    /**
     * @dev Get last feedback index for a client
     */
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return _lastIndex[agentId][clientAddress];
    }

    /**
     * @dev Get response count for feedback
     */
    function getResponseCount(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        address[] calldata responders
    ) external view returns (uint64) {
        if (responders.length == 0) return 0;
        
        uint64 count = 0;
        for (uint256 i = 0; i < responders.length; i++) {
            if (_responses[agentId][clientAddress][feedbackIndex][responders[i]].timestamp > 0) {
                count++;
            }
        }
        return count;
    }
}