-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id BIGINT PRIMARY KEY,
    owner TEXT NOT NULL,
    token_uri TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT REFERENCES agents(id),
    client TEXT NOT NULL,
    score SMALLINT NOT NULL,
    uri TEXT,
    tags TEXT[], -- Storing bytes32 tags as hex strings or converted text
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, client, created_at) -- Basic constraint, might need refinement based on contract index
);

-- Create validations table
CREATE TABLE IF NOT EXISTS validations (
    request_hash TEXT PRIMARY KEY,
    agent_id BIGINT REFERENCES agents(id),
    validator TEXT NOT NULL,
    status TEXT, -- 'Requested', 'Responded'
    response_score SMALLINT,
    response_uri TEXT,
    tags TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create intents table
CREATE TABLE IF NOT EXISTS intents (
    intent_id TEXT PRIMARY KEY,
    creator_agent_id BIGINT REFERENCES agents(id),
    target_agent_id BIGINT REFERENCES agents(id),
    status TEXT, -- 'Pending', 'Executed', 'Failed', 'Revoked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner);
CREATE INDEX IF NOT EXISTS idx_feedback_agent_id ON feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_validations_agent_id ON validations(agent_id);
CREATE INDEX IF NOT EXISTS idx_intents_creator ON intents(creator_agent_id);
CREATE INDEX IF NOT EXISTS idx_intents_target ON intents(target_agent_id);
