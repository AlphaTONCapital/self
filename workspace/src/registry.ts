import { EventEmitter } from 'eventemitter3'
import {
  AgentIdentity,
  ServiceDefinition,
  ServiceQuery,
  ServiceRequest,
  ASFEvents,
  ASFConfig,
} from './types'

export class ServiceRegistry extends EventEmitter<ASFEvents> {
  private agents: Map<string, AgentIdentity> = new Map()
  private services: Map<string, ServiceDefinition> = new Map()
  private requests: Map<string, ServiceRequest> = new Map()
  private config: ASFConfig

  constructor(config: ASFConfig) {
    super()
    this.config = config
  }

  // Agent Registration
  async registerAgent(agent: AgentIdentity): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Verify agent signature
      // 2. Check for existing registration
      // 3. Store on-chain via TON smart contract
      
      this.agents.set(agent.id, agent)
      this.emit('agent:registered', { agent })
      
      console.log(`Agent registered: ${agent.name} (${agent.id})`)
      return true
    } catch (error) {
      console.error('Failed to register agent:', error)
      return false
    }
  }

  async updateAgent(agentId: string, updates: Partial<AgentIdentity>): Promise<boolean> {
    const existing = this.agents.get(agentId)
    if (!existing) return false

    const updated = {
      ...existing,
      ...updates,
      updated: new Date(),
    }

    this.agents.set(agentId, updated)
    this.emit('agent:updated', { agent: updated })
    
    return true
  }

  getAgent(agentId: string): AgentIdentity | undefined {
    return this.agents.get(agentId)
  }

  getAllAgents(): AgentIdentity[] {
    return Array.from(this.agents.values())
  }

  // Service Registration
  async registerService(service: ServiceDefinition): Promise<boolean> {
    try {
      // Validate agent exists
      if (!this.agents.has(service.agentId)) {
        throw new Error(`Agent ${service.agentId} not registered`)
      }

      this.services.set(service.id, service)
      this.emit('service:registered', { service })
      
      console.log(`Service registered: ${service.name} by ${service.agentId}`)
      return true
    } catch (error) {
      console.error('Failed to register service:', error)
      return false
    }
  }

  async updateService(serviceId: string, updates: Partial<ServiceDefinition>): Promise<boolean> {
    const existing = this.services.get(serviceId)
    if (!existing) return false

    const updated = {
      ...existing,
      ...updates,
      updated: new Date(),
    }

    this.services.set(serviceId, updated)
    this.emit('service:updated', { service: updated })
    
    return true
  }

  async deactivateService(serviceId: string): Promise<boolean> {
    const service = this.services.get(serviceId)
    if (!service) return false

    service.active = false
    service.updated = new Date()
    this.services.set(serviceId, service)
    this.emit('service:deactivated', { serviceId })
    
    return true
  }

  // Service Discovery
  async discoverServices(query: ServiceQuery): Promise<ServiceDefinition[]> {
    let results = Array.from(this.services.values()).filter(service => service.active)

    // Apply filters
    if (query.category) {
      results = results.filter(s => s.category === query.category)
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(s => 
        query.tags!.some(tag => s.tags.includes(tag))
      )
    }

    if (query.maxPrice) {
      const maxPrice = parseFloat(query.maxPrice)
      results = results.filter(s => parseFloat(s.pricing.amount) <= maxPrice)
    }

    if (query.minReputation) {
      results = results.filter(s => {
        const agent = this.agents.get(s.agentId)
        return agent && agent.reputation >= query.minReputation!
      })
    }

    // Apply sorting
    switch (query.sortBy) {
      case 'price':
        results.sort((a, b) => parseFloat(a.pricing.amount) - parseFloat(b.pricing.amount))
        break
      case 'reputation':
        results.sort((a, b) => {
          const agentA = this.agents.get(a.agentId)
          const agentB = this.agents.get(b.agentId)
          return (agentB?.reputation || 0) - (agentA?.reputation || 0)
        })
        break
      case 'response_time':
        results.sort((a, b) => 
          this.parseDuration(a.sla.responseTime) - this.parseDuration(b.sla.responseTime)
        )
        break
      case 'popularity':
        // For now, sort by creation date (newer = more popular)
        results.sort((a, b) => b.created.getTime() - a.created.getTime())
        break
    }

    // Apply limit
    return results.slice(0, query.limit)
  }

  // Service Matching - Find best services for a request
  async matchServices(request: ServiceRequest): Promise<ServiceDefinition[]> {
    const query: ServiceQuery = {
      maxPrice: request.maxPrice,
      limit: 10,
      sortBy: 'reputation',
    }

    const candidates = await this.discoverServices(query)
    
    // Filter to only services that match the specific request
    return candidates.filter(service => service.id === request.serviceId)
  }

  // Request Management
  async createRequest(request: ServiceRequest): Promise<boolean> {
    try {
      this.requests.set(request.id, request)
      this.emit('request:created', { request })
      
      console.log(`Service request created: ${request.id}`)
      return true
    } catch (error) {
      console.error('Failed to create request:', error)
      return false
    }
  }

  async updateRequest(requestId: string, updates: Partial<ServiceRequest>): Promise<boolean> {
    const existing = this.requests.get(requestId)
    if (!existing) return false

    const updated = {
      ...existing,
      ...updates,
      updated: new Date(),
    }

    this.requests.set(requestId, updated)
    
    return true
  }

  getRequest(requestId: string): ServiceRequest | undefined {
    return this.requests.get(requestId)
  }

  // Statistics and Analytics
  getStats() {
    const totalAgents = this.agents.size
    const totalServices = this.services.size
    const activeServices = Array.from(this.services.values()).filter(s => s.active).length
    const totalRequests = this.requests.size
    
    const servicesByCategory = Array.from(this.services.values()).reduce((acc, service) => {
      acc[service.category] = (acc[service.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const avgReputation = this.agents.size > 0 
      ? Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.reputation, 0) / this.agents.size
      : 0

    return {
      agents: {
        total: totalAgents,
        avgReputation: Math.round(avgReputation * 100) / 100,
      },
      services: {
        total: totalServices,
        active: activeServices,
        byCategory: servicesByCategory,
      },
      requests: {
        total: totalRequests,
      },
    }
  }

  // Search functionality
  async searchAgents(query: string): Promise<AgentIdentity[]> {
    const lowercaseQuery = query.toLowerCase()
    return Array.from(this.agents.values()).filter(agent =>
      agent.name.toLowerCase().includes(lowercaseQuery) ||
      agent.description.toLowerCase().includes(lowercaseQuery) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(lowercaseQuery))
    )
  }

  async searchServices(query: string): Promise<ServiceDefinition[]> {
    const lowercaseQuery = query.toLowerCase()
    return Array.from(this.services.values()).filter(service =>
      service.active && (
        service.name.toLowerCase().includes(lowercaseQuery) ||
        service.description.toLowerCase().includes(lowercaseQuery) ||
        service.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      )
    )
  }

  // Helper methods
  private parseDuration(duration: string): number {
    // Simple ISO 8601 duration parser - PT1M = 60 seconds, PT1H = 3600 seconds
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')
    
    return hours * 3600 + minutes * 60 + seconds
  }
}
