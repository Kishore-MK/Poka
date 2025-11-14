// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function agentExists(uint256 agentId) external view returns (bool);
    function ownerOf(uint256 agentId) external view returns (address);
}

/**
 * @title ValidationRegistry
 * @dev Registry for agent validation requests and responses
 */
contract ValidationRegistry {
    struct ValidationRequest {
        uint256 agentId;
        address validatorAddress;
        string requestUri;
        bytes32 requestHash;
        bytes32 tag;
        uint256 timestamp;
    }

    struct ValidationStatus {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 tag;
        uint256 lastUpdate;
        string responseUri;
        bytes32 responseHash;
    }

    IIdentityRegistry public immutable identityRegistry;

    // requestHash => ValidationStatus
    mapping(bytes32 => ValidationStatus) private _validationStatus;
    
    // agentId => requestHashes[]
    mapping(uint256 => bytes32[]) private _agentValidations;
    
    // validatorAddress => requestHashes[]
    mapping(address => bytes32[]) private _validatorRequests;

    event ValidationRequested(
        bytes32 indexed requestHash,
        uint256 indexed agentId,
        address indexed validatorAddress,
        string requestUri,
        bytes32 tag
    );

    event ValidationResponse(
        bytes32 indexed requestHash,
        address indexed validatorAddress,
        uint256 indexed agentId,
        uint8 response,
        string responseUri,
        bytes32 responseHash,
        bytes32 tag
    );

    constructor(address _identityRegistry) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @dev Request validation for agent work
     */
    function requestValidation(
        uint256 agentId,
        address validatorAddress,
        string calldata requestUri,
        bytes32 requestHash,
        bytes32 tag
    ) external {
        require(identityRegistry.agentExists(agentId), "Agent does not exist");
        require(
            identityRegistry.ownerOf(agentId) == msg.sender,
            "Not agent owner"
        );
        require(validatorAddress != address(0), "Invalid validator");
        require(requestHash != bytes32(0), "Invalid request hash");

        _validationStatus[requestHash] = ValidationStatus({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            tag: tag,
            lastUpdate: block.timestamp,
            responseUri: "",
            responseHash: bytes32(0)
        });

        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequested(
            requestHash,
            agentId,
            validatorAddress,
            requestUri,
            tag
        );
    }

    /**
     * @dev Submit validation response (only by assigned validator)
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseUri,
        bytes32 responseHash,
        bytes32 tag
    ) external {
        ValidationStatus storage status = _validationStatus[requestHash];
        require(status.validatorAddress == msg.sender, "Not assigned validator");
        require(status.agentId != 0, "Validation request does not exist");
        require(response <= 100, "Response must be <= 100");

        status.response = response;
        status.responseUri = responseUri;
        status.responseHash = responseHash;
        status.tag = tag;
        status.lastUpdate = block.timestamp;

        emit ValidationResponse(
            requestHash,
            msg.sender,
            status.agentId,
            response,
            responseUri,
            responseHash,
            tag
        );
    }

    /**
     * @dev Get validation status for a request
     */
    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 tag,
            uint256 lastUpdate
        )
    {
        ValidationStatus memory status = _validationStatus[requestHash];
        return (
            status.validatorAddress,
            status.agentId,
            status.response,
            status.tag,
            status.lastUpdate
        );
    }

    /**
     * @dev Get summary statistics for agent validations
     */
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        bytes32 tag
    ) external view returns (uint64 count, uint8 avgResponse) {
        bytes32[] memory requests = _agentValidations[agentId];
        uint256 totalResponse = 0;
        count = 0;

        for (uint256 i = 0; i < requests.length; i++) {
            ValidationStatus memory status = _validationStatus[requests[i]];
            
            // Skip if no response yet
            if (status.lastUpdate == 0 || status.response == 0) continue;
            
            // Filter by validator if specified
            if (validatorAddresses.length > 0) {
                bool validatorMatch = false;
                for (uint256 j = 0; j < validatorAddresses.length; j++) {
                    if (status.validatorAddress == validatorAddresses[j]) {
                        validatorMatch = true;
                        break;
                    }
                }
                if (!validatorMatch) continue;
            }
            
            // Filter by tag if specified
            if (tag != bytes32(0) && status.tag != tag) continue;

            totalResponse += status.response;
            count++;
        }

        avgResponse = count > 0 ? uint8(totalResponse / count) : 0;
    }

    /**
     * @dev Get all validation requests for an agent
     */
    function getAgentValidations(uint256 agentId)
        external
        view
        returns (bytes32[] memory)
    {
        return _agentValidations[agentId];
    }

    /**
     * @dev Get all validation requests assigned to a validator
     */
    function getValidatorRequests(address validatorAddress)
        external
        view
        returns (bytes32[] memory)
    {
        return _validatorRequests[validatorAddress];
    }

    /**
     * @dev Get identity registry address
     */
    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }
}