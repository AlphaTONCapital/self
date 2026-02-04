import { EventEmitter } from 'eventemitter3'
import { v4 as uuid } from 'uuid'
import {
  AgentIdentity,
  ServiceDefinition,
  ServiceRequest,
  ServiceResponse,
  ServiceQuery,
  ASFEvents,
  ASFConfig,
  AgentIdentitySchema,
  ServiceDefinitionSchema,
  ServiceRequestSchema,
} from './types'

export class Agent extends EventEmitter<ASFEvents> {
  private identity: AgentIdentity
  private services: Map<string, ServiceDefinition> = new Map()
  private config: ASFConfig

  constructor(identity: Partial<AgentIdentity>, config: ASFConfig) {
    super()
    
    // Initialize agent identity with defaults
    this.identity = AgentIdentitySchema.parse({
      id: identity.id || uuid(),
      name: identity.name || 'Unknown Agent',
      description: identity.description || 'An AI agent',
      version: identity.version || '1.0.0',
      owner: identity.owner,
      publicKey: identity.publicKey || this.generatePublicKey(),
      endpoints: identity.endpoints || {},
      capabilities: identity.capabilities || [],
      reputation: identity.reputation || 50,
      created: identity.created || new Date(),
      updated: new Date(),
    })
    
    this.config = config
  }

  // Agent Identity Management
  getIdentity(): AgentIdentity {
    return { ...this.identity }
  }

  updateIdentity(updates: Partial<AgentIdentity>): void {
    this.identity = AgentIdentitySchema.parse({
      ...this.identity,
      ...updates,
      updated: new Date(),
    })
    this.emit('agent:updated', { agent: this.identity })
  }

  // Service Management
  registerService(serviceData: Partial<ServiceDefinition>): ServiceDefinition {
    const service = ServiceDefinitionSchema.parse({
      id: serviceData.id || uuid(),
      agentId: this.identity.id,
      name: serviceData.name || 'Unnamed Service',
      description: serviceData.description || 'A service provided by this agent',
      category: serviceData.category || 'other',
      interface: serviceData.interface || {
        input: {},
        output: {},
        method: 'sync',
      },
      pricing: serviceData.pricing || {
        model: 'fixed',
        amount: '1.0',
        currency: 'TON',
        billing: 'per-request',
      },
      sla: serviceData.sla || {
        responseTime: 'PT1M', // 1 minute
        availability: 99,
        quality: 'Best effort',
      },
      tags: serviceData.tags || [],
      active: serviceData.active !== false,
      created: serviceData.created || new Date(),
      updated: new Date(),
    })

    this.services.set(service.id, service)
    this.emit('service:registered', { service })
    
    return service
  }

  updateService(serviceId: string, updates: Partial<ServiceDefinition>): ServiceDefinition | null {
    const existing = this.services.get(serviceId)
    if (!existing) return null

    const updated = ServiceDefinitionSchema.parse({
      ...existing,
      ...updates,
      updated: new Date(),
    })

    this.services.set(serviceId, updated)
    this.emit('service:updated', { service: updated })
    
    return updated
  }

  deactivateService(serviceId: string): boolean {
    const service = this.services.get(serviceId)
    if (!service) return false

    service.active = false
    service.updated = new Date()
    this.services.set(serviceId, service)
    this.emit('service:deactivated', { serviceId })
    
    return true
  }

  getServices(): ServiceDefinition[] {
    return Array.from(this.services.values())
  }

  getActiveServices(): ServiceDefinition[] {
    return Array.from(this.services.values()).filter(s => s.active)
  }

  // Service Request Handling
  async handleServiceRequest(request: ServiceRequest): Promise<ServiceResponse | null> {
    const service = this.services.get(request.serviceId)
    if (!service || !service.active) {
      throw new Error(`Service ${request.serviceId} not found or inactive`)
    }

    // Validate request parameters against service interface
    // This is a simplified validation - in practice, you'd use the JSON schema
    if (!this.validateRequestParameters(request.parameters, service.interface.input)) {
      throw new Error('Invalid request parameters')
    }

    this.emit('request:accepted', { request })

    try {
      // Execute the service - this is where the actual AI agent work happens
      const result = await this.executeService(service, request.parameters)

      const response: ServiceResponse = {
        id: uuid(),
        requestId: request.id,
        providerId: this.identity.id,
        result,
        deliveredAt: new Date(),
      }

      this.emit('request:completed', { request, response })
      return response

    } catch (error) {
      this.emit('request:cancelled', { 
        request, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  // Service Discovery
  async discoverServices(query: ServiceQuery): Promise<ServiceDefinition[]> {
    // This would typically query a registry contract or service
    // For now, return a mock implementation
    console.log('Discovering services with query:', query)
    return []
  }

  // Service Requests
  async requestService(
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
    const request = ServiceRequestSchema.parse({
      id: uuid(),
      requesterId: this.identity.id,
      providerId,
      serviceId,
      parameters,
      maxPrice: options.maxPrice || '10.0',
      deadline: options.deadline,
      priority: options.priority || 'normal',
      requirements: options.requirements,
      status: 'pending',
      created: new Date(),
      updated: new Date(),
    })

    this.emit('request:created', { request })
    return request
  }

  // Private helper methods
  private generatePublicKey(): string {
    // In a real implementation, this would generate a proper cryptographic key
    return `agent_${this.identity?.id || uuid()}_pubkey`
  }

  private validateRequestParameters(parameters: Record<string, any>, schema: Record<string, any>): boolean {
    // Simplified validation - would use JSON schema validation in practice
    return typeof parameters === 'object' && parameters !== null
  }

  private async executeService(service: ServiceDefinition, parameters: Record<string, any>): Promise<Record<string, any>> {
    // This is where the actual service execution happens
    // Each agent would override this method to implement their specific capabilities
    
    console.log(`Executing service ${service.name} with parameters:`, parameters)
    
    // Mock service execution based on category
    switch (service.category) {
      case 'analysis':
        return {
          analysis: `Analysis completed for ${JSON.stringify(parameters)}`,
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        }
      
      case 'content':
        return {
          content: `Generated content based on: ${parameters.prompt || 'default prompt'}`,
          wordCount: Math.floor(Math.random() * 1000) + 100,
          language: 'en',
        }
      
      case 'translation':
        return {
          translatedText: `[${parameters.targetLanguage || 'en'}] ${parameters.text}`,
          confidence: 0.92,
          detectedLanguage: parameters.sourceLanguage || 'auto',
        }
      
      default:
        return {
          result: 'Service executed successfully',
          serviceId: service.id,
          executedAt: new Date().toISOString(),
        }
    }
  }
}
