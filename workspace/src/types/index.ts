import { z } from 'zod'

// Agent Identity and Profile
export const AgentIdentitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  owner: z.string().optional(), // TON address of the agent owner
  publicKey: z.string(),
  endpoints: z.object({
    telegram: z.string().optional(),
    webhook: z.string().url().optional(),
    api: z.string().url().optional(),
  }),
  capabilities: z.array(z.string()),
  reputation: z.number().min(0).max(100).default(50),
  created: z.date(),
  updated: z.date(),
})

export type AgentIdentity = z.infer<typeof AgentIdentitySchema>

// Service Definitions
export const ServiceDefinitionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  category: z.enum([
    'development',
    'analysis',
    'content',
    'translation', 
    'design',
    'research',
    'automation',
    'blockchain',
    'other'
  ]),
  interface: z.object({
    input: z.record(z.any()), // JSON Schema for inputs
    output: z.record(z.any()), // JSON Schema for outputs
    method: z.enum(['sync', 'async', 'streaming']),
  }),
  pricing: z.object({
    model: z.enum(['fixed', 'usage', 'subscription', 'auction']),
    amount: z.string(), // TON amount as string to avoid precision issues
    currency: z.literal('TON'),
    billing: z.enum(['per-request', 'per-hour', 'per-result', 'per-month']),
  }),
  sla: z.object({
    responseTime: z.string(), // ISO 8601 duration
    availability: z.number().min(0).max(100), // percentage
    quality: z.string().max(500),
  }),
  tags: z.array(z.string()),
  active: z.boolean().default(true),
  created: z.date(),
  updated: z.date(),
})

export type ServiceDefinition = z.infer<typeof ServiceDefinitionSchema>

// Service Requests and Transactions
export const ServiceRequestSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(), // Agent or user ID
  providerId: z.string().uuid(), // Agent ID
  serviceId: z.string().uuid(),
  parameters: z.record(z.any()),
  maxPrice: z.string(), // Maximum willing to pay
  deadline: z.date().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  requirements: z.string().max(1000).optional(),
  escrowAddress: z.string().optional(), // TON smart contract address
  status: z.enum([
    'pending',
    'accepted', 
    'in_progress',
    'completed',
    'cancelled',
    'disputed'
  ]).default('pending'),
  created: z.date(),
  updated: z.date(),
})

export type ServiceRequest = z.infer<typeof ServiceRequestSchema>

export const ServiceResponseSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  providerId: z.string().uuid(),
  result: z.record(z.any()),
  deliveredAt: z.date(),
  quality: z.number().min(1).max(5).optional(), // Quality rating from requester
  feedback: z.string().max(1000).optional(),
})

export type ServiceResponse = z.infer<typeof ServiceResponseSchema>

// Transaction and Payment
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  fromAddress: z.string(), // TON address
  toAddress: z.string(), // TON address
  amount: z.string(),
  currency: z.literal('TON'),
  txHash: z.string().optional(), // On-chain transaction hash
  status: z.enum(['pending', 'confirmed', 'failed']),
  createdAt: z.date(),
  confirmedAt: z.date().optional(),
})

export type Transaction = z.infer<typeof TransactionSchema>

// Agent Reputation and Trust
export const ReputationEventSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  type: z.enum(['service_completed', 'service_cancelled', 'quality_rating', 'dispute_resolved']),
  impact: z.number().min(-10).max(10), // Reputation change
  details: z.record(z.any()),
  timestamp: z.date(),
})

export type ReputationEvent = z.infer<typeof ReputationEventSchema>

// Service Discovery and Matching
export const ServiceQuerySchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  maxPrice: z.string().optional(),
  minReputation: z.number().min(0).max(100).optional(),
  responseTime: z.string().optional(), // Max acceptable response time
  location: z.string().optional(), // For geo-specific services
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['price', 'reputation', 'response_time', 'popularity']).default('reputation'),
})

export type ServiceQuery = z.infer<typeof ServiceQuerySchema>

// Events for real-time communication
export interface ASFEvents {
  'service:registered': { service: ServiceDefinition }
  'service:updated': { service: ServiceDefinition }
  'service:deactivated': { serviceId: string }
  'request:created': { request: ServiceRequest }
  'request:accepted': { request: ServiceRequest }
  'request:completed': { request: ServiceRequest; response: ServiceResponse }
  'request:cancelled': { request: ServiceRequest; reason: string }
  'transaction:created': { transaction: Transaction }
  'transaction:confirmed': { transaction: Transaction }
  'agent:registered': { agent: AgentIdentity }
  'agent:updated': { agent: AgentIdentity }
  'reputation:updated': { agentId: string; oldScore: number; newScore: number }
}

// Configuration
export const ASFConfigSchema = z.object({
  network: z.enum(['mainnet', 'testnet']).default('testnet'),
  registryContract: z.string(), // TON smart contract address
  defaultTimeout: z.number().default(30000), // 30 seconds
  maxRetries: z.number().default(3),
  endpoints: z.object({
    ton: z.string().url(),
    telegram: z.string().url().optional(),
  }),
})

export type ASFConfig = z.infer<typeof ASFConfigSchema>
