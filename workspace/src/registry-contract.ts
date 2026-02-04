import { AgentWallet } from './wallet'
import { AgentIdentity, ServiceDefinition } from '@atoncap/asf-core'

export interface RegistryContractConfig {
  contractAddress: string
  wallet: AgentWallet
}

export class TONServiceRegistry {
  private wallet: AgentWallet
  private contractAddress: string

  constructor(config: RegistryContractConfig) {
    this.wallet = config.wallet
    this.contractAddress = config.contractAddress
  }

  // Agent Registration on TON Blockchain
  async registerAgentOnChain(agent: AgentIdentity): Promise<{
    txHash: string
    success: boolean
    error?: string
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'registerAgent',
        [
          agent.id,
          agent.name,
          agent.description,
          agent.publicKey,
          JSON.stringify(agent.endpoints),
          JSON.stringify(agent.capabilities),
        ],
        '0.1' // Registration fee
      )

      return {
        txHash: result.txHash,
        success: result.success,
      }
    } catch (error) {
      return {
        txHash: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async updateAgentOnChain(
    agentId: string,
    updates: Partial<AgentIdentity>
  ): Promise<{
    txHash: string
    success: boolean
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'updateAgent',
        [
          agentId,
          JSON.stringify(updates),
        ],
        '0.05' // Update fee
      )

      return {
        txHash: result.txHash,
        success: result.success,
      }
    } catch (error) {
      throw new Error(`Failed to update agent on chain: ${error}`)
    }
  }

  // Service Registration on TON Blockchain
  async registerServiceOnChain(service: ServiceDefinition): Promise<{
    txHash: string
    success: boolean
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'registerService',
        [
          service.id,
          service.agentId,
          service.name,
          service.description,
          service.category,
          JSON.stringify(service.interface),
          JSON.stringify(service.pricing),
          JSON.stringify(service.sla),
          JSON.stringify(service.tags),
        ],
        '0.05' // Service registration fee
      )

      return {
        txHash: result.txHash,
        success: result.success,
      }
    } catch (error) {
      throw new Error(`Failed to register service on chain: ${error}`)
    }
  }

  async updateServiceOnChain(
    serviceId: string,
    updates: Partial<ServiceDefinition>
  ): Promise<{
    txHash: string
    success: boolean
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'updateService',
        [
          serviceId,
          JSON.stringify(updates),
        ],
        '0.02' // Update fee
      )

      return {
        txHash: result.txHash,
        success: result.success,
      }
    } catch (error) {
      throw new Error(`Failed to update service on chain: ${error}`)
    }
  }

  async deactivateServiceOnChain(serviceId: string): Promise<{
    txHash: string
    success: boolean
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'deactivateService',
        [serviceId],
        '0.01'
      )

      return {
        txHash: result.txHash,
        success: result.success,
      }
    } catch (error) {
      throw new Error(`Failed to deactivate service on chain: ${error}`)
    }
  }

  // Query Methods (Read-only, no transaction fees)
  async getAgentFromChain(agentId: string): Promise<AgentIdentity | null> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'getAgent',
        [agentId],
        '0' // Read-only call
      )

      if (result.success && result.result) {
        return this.parseAgentFromChain(result.result)
      }
      
      return null
    } catch (error) {
      console.error('Failed to get agent from chain:', error)
      return null
    }
  }

  async getServiceFromChain(serviceId: string): Promise<ServiceDefinition | null> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'getService',
        [serviceId],
        '0'
      )

      if (result.success && result.result) {
        return this.parseServiceFromChain(result.result)
      }
      
      return null
    } catch (error) {
      console.error('Failed to get service from chain:', error)
      return null
    }
  }

  async searchAgentsOnChain(query: {
    category?: string
    minReputation?: number
    limit?: number
  }): Promise<AgentIdentity[]> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'searchAgents',
        [JSON.stringify(query)],
        '0'
      )

      if (result.success && result.result?.agents) {
        return result.result.agents.map((agent: any) => 
          this.parseAgentFromChain(agent)
        )
      }
      
      return []
    } catch (error) {
      console.error('Failed to search agents on chain:', error)
      return []
    }
  }

  async searchServicesOnChain(query: {
    category?: string
    tags?: string[]
    maxPrice?: string
    minReputation?: number
    limit?: number
  }): Promise<ServiceDefinition[]> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'searchServices',
        [JSON.stringify(query)],
        '0'
      )

      if (result.success && result.result?.services) {
        return result.result.services.map((service: any) => 
          this.parseServiceFromChain(service)
        )
      }
      
      return []
    } catch (error) {
      console.error('Failed to search services on chain:', error)
      return []
    }
  }

  // Reputation Management
  async updateReputationOnChain(
    agentId: string,
    change: number,
    reason: string
  ): Promise<{
    txHash: string
    success: boolean
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'updateReputation',
        [agentId, change, reason],
        '0.01'
      )

      return {
        txHash: result.txHash,
        success: result.success,
      }
    } catch (error) {
      throw new Error(`Failed to update reputation on chain: ${error}`)
    }
  }

  // Registry Statistics
  async getRegistryStats(): Promise<{
    totalAgents: number
    totalServices: number
    activeServices: number
    totalTransactions: number
  }> {
    try {
      const result = await this.wallet.callContract(
        this.contractAddress,
        'getStats',
        [],
        '0'
      )

      if (result.success && result.result) {
        return result.result
      }
      
      return {
        totalAgents: 0,
        totalServices: 0,
        activeServices: 0,
        totalTransactions: 0,
      }
    } catch (error) {
      console.error('Failed to get registry stats:', error)
      return {
        totalAgents: 0,
        totalServices: 0,
        activeServices: 0,
        totalTransactions: 0,
      }
    }
  }

  // Private helper methods
  private parseAgentFromChain(chainData: any): AgentIdentity {
    return {
      id: chainData.id,
      name: chainData.name,
      description: chainData.description,
      version: chainData.version || '1.0.0',
      owner: chainData.owner,
      publicKey: chainData.publicKey,
      endpoints: JSON.parse(chainData.endpoints || '{}'),
      capabilities: JSON.parse(chainData.capabilities || '[]'),
      reputation: chainData.reputation || 50,
      created: new Date(chainData.created),
      updated: new Date(chainData.updated),
    }
  }

  private parseServiceFromChain(chainData: any): ServiceDefinition {
    return {
      id: chainData.id,
      agentId: chainData.agentId,
      name: chainData.name,
      description: chainData.description,
      category: chainData.category,
      interface: JSON.parse(chainData.interface),
      pricing: JSON.parse(chainData.pricing),
      sla: JSON.parse(chainData.sla),
      tags: JSON.parse(chainData.tags || '[]'),
      active: chainData.active,
      created: new Date(chainData.created),
      updated: new Date(chainData.updated),
    }
  }
}
