// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @dev ERC-721 based agent identity registry with metadata storage
 */
contract IdentityRegistry is ERC721URIStorage, Ownable {
    struct MetadataEntry {
        string key;
        bytes value;
    }

    // agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;
    
    uint256 private _nextAgentId;

    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event MetadataSet(uint256 indexed agentId, string key, bytes value);

    constructor() ERC721("TrustlessAgent", "TAGENT") Ownable(msg.sender) {
        _nextAgentId = 1;
    }

    /**
     * @dev Register new agent with tokenURI and metadata
     */
    function register(
        string memory tokenURI_,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenURI_);

        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(agentId, metadata[i].key, metadata[i].value);
        }

        emit AgentRegistered(agentId, msg.sender);
    }

    /**
     * @dev Register new agent with tokenURI only
     */
    function register(string memory tokenURI_) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenURI_);
        emit AgentRegistered(agentId, msg.sender);
    }

    /**
     * @dev Register new agent without tokenURI (set later)
     */
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        emit AgentRegistered(agentId, msg.sender);
    }

    /**
     * @dev Set metadata for an agent
     */
    function setMetadata(
        uint256 agentId,
        string calldata key,
        bytes calldata value
    ) external {
        require(_ownerOf(agentId) == msg.sender, "Not agent owner");
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, value);
    }

    /**
     * @dev Get metadata for an agent
     */
    function getMetadata(
        uint256 agentId,
        string calldata key
    ) external view returns (bytes memory) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _metadata[agentId][key];
    }

    /**
     * @dev Check if agent exists
     */
    function agentExists(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }
}