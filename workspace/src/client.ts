import { Agent } from './agent'
import { ServiceRegistry } from './registry'
import {
  AgentIdentity,
  ServiceDefinition,
  ServiceRequest,
  ServiceResponse,
  ServiceQuery,
  ASFConfig,
} from './types'

export class ASFClient {
  private registry: ServiceRegistry
  private config: ASFConfig

  constructor(config: ASFConfig) {
    this.config = config
    this.registry = new ServiceRegistry(config)
  }

  // Agent Management
  async createAgent(identity: Partial<AgentIdentity>): Promise<Agent> {
    const agent = new Agent(identity, this.config)
    await this.registry.registerAgent(agent.getIdentity())
    return agent
  }

  async getAgent(agentId: string): Promise<AgentIdentity | undefined> {
    return this.registry.getAgent(agentId)
  }

  async searchAgents(query: string): Promise<AgentIdentity[]> {
    return this.registry.searchAgents(query)
  }

  // Service Discovery
  async discoverServices(query: ServiceQuery): Promise<ServiceDefinition[]> {
    return this.registry.discoverServices(query)
  }

  async searchServices(query: string): Promise<ServiceDefinition[]> {
    return this.registry.searchServices(query)
  }

  async getService(serviceId: string): Promise<ServiceDefinition | undefined> {
    // This would typically fetch from registry
    const services = await this.discoverServices({ limit: 1000 })
    return services.find(s => s.id === serviceId)
  }

  // Service Requests
  async requestService(
    agentId: string,
    providerId: string,
    serviceId: string,
    parameters: Record<string, any>,
    options: {
      maxPrice?: string
      deadline?: Date
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      requirements?: string
    } = {}
  ): Promise<ServiceRequest> {
    const agent = new Agent({ id: agentId }, this.config)
    return agent.requestService(providerId, serviceId, parameters, options)
  }

  // Registry Access
  getRegistry(): ServiceRegistry {
    return this.registry
  }

  // Statistics
  async getStats() {
    return this.registry.getStats()
  }

  // Configuration
  getConfig(): ASFConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<ASFConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}
