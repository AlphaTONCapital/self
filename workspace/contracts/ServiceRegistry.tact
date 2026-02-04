// Agent Service Framework - Service Registry Smart Contract
// This contract manages agent registration and service discovery on TON blockchain

import "@stdlib/deploy";

message AgentRegistration {
    agentId: String;
    name: String; 
    description: String;
    publicKey: String;
    endpoints: String; // JSON string
    capabilities: String; // JSON array as string
}

message ServiceRegistration {
    serviceId: String;
    agentId: String;
    name: String;
    description: String;
    category: String;
    pricing: String; // JSON string with pricing model
    sla: String; // JSON string with SLA details
    tags: String; // JSON array as string
}

message UpdateReputation {
    agentId: String;
    change: Int;
    reason: String;
}

struct Agent {
    id: String;
    name: String;
    description: String;
    publicKey: String;
    endpoints: String;
    capabilities: String;
    reputation: Int;
    active: Bool;
    registered: Int; // timestamp
}

struct Service {
    id: String;
    agentId: String;
    name: String;
    description: String;
    category: String;
    pricing: String;
    sla: String;
    tags: String;
    active: Bool;
    created: Int; // timestamp
}

contract ServiceRegistry with Deployable {
    owner: Address;
    agentCount: Int = 0;
    serviceCount: Int = 0;
    registrationFee: Int = ton("0.1");
    
    // Storage maps
    agents: map<String, Agent>;
    services: map<String, Service>;
    agentServices: map<String, String>; // agentId -> comma-separated service IDs
    
    init(owner: Address) {
        self.owner = owner;
    }
    
    // Agent Management
    receive(msg: AgentRegistration) {
        let ctx: Context = context();
        
        // Check registration fee
        require(ctx.value >= self.registrationFee, "Insufficient registration fee");
        
        // Create agent record
        let agent: Agent = Agent{
            id: msg.agentId,
            name: msg.name,
            description: msg.description,
            publicKey: msg.publicKey,
            endpoints: msg.endpoints,
            capabilities: msg.capabilities,
            reputation: 50, // Starting reputation
            active: true,
            registered: now()
        };
        
        // Store agent
        self.agents.set(msg.agentId, agent);
        self.agentCount = self.agentCount + 1;
        
        // Send confirmation
        send(SendParameters{
            to: ctx.sender,
            value: 0,
            mode: SendRemainingValue,
            body: "Agent registered successfully".asComment()
        });
    }
    
    get fun getAgent(agentId: String): Agent? {
        return self.agents.get(agentId);
    }
    
    get fun getStats(): map<String, Int> {
        let stats: map<String, Int> = emptyMap();
        stats.set("totalAgents", self.agentCount);
        stats.set("totalServices", self.serviceCount);
        return stats;
    }
}
