import { Agent } from './agent'
import { ServiceRegistry } from './registry'
import { ASFClient } from './client'
import { AgentIdentity, ASFConfig } from './types'

// Default configuration for different networks
const DEFAULT_CONFIGS: Record<string, ASFConfig> = {
  testnet: {
    network: 'testnet',
    registryContract: 'EQTestRegistryContractAddress...',
    defaultTimeout: 30000,
    maxRetries: 3,
    endpoints: {
      ton: 'https://testnet.toncenter.com/api/v2/',
    },
  },
  mainnet: {
    network: 'mainnet', 
    registryContract: 'EQMainnetRegistryContractAddress...',
    defaultTimeout: 30000,
    maxRetries: 3,
    endpoints: {
      ton: 'https://toncenter.com/api/v2/',
    },
  },
}

// Agent Factory
export function createAgent(
  identity: Partial<AgentIdentity>,
  config?: Partial<ASFConfig>
): Agent {
  const finalConfig = {
    ...DEFAULT_CONFIGS.testnet,
    ...config,
  }

  return new Agent(identity, finalConfig)
}

// Registry Factory
export function createRegistry(config?: Partial<ASFConfig>): ServiceRegistry {
  const finalConfig = {
    ...DEFAULT_CONFIGS.testnet,
    ...config,
  }

  return new ServiceRegistry(finalConfig)
}

// Client Factory
export function createClient(config?: Partial<ASFConfig>): ASFClient {
  const finalConfig = {
    ...DEFAULT_CONFIGS.testnet,
    ...config,
  }

  return new ASFClient(finalConfig)
}

// Quick setup for common agent types
export function createDataAnalysisAgent(
  name: string,
  config?: Partial<ASFConfig>
): Agent {
  return createAgent({
    name,
    description: 'AI agent specialized in data analysis and insights',
    capabilities: ['data-analysis', 'statistics', 'visualization', 'reporting'],
  }, config)
}

export function createContentAgent(
  name: string,
  config?: Partial<ASFConfig>
): Agent {
  return createAgent({
    name,
    description: 'AI agent specialized in content creation and writing',
    capabilities: ['content-generation', 'copywriting', 'editing', 'SEO'],
  }, config)
}

export function createDeveloperAgent(
  name: string,
  config?: Partial<ASFConfig>
): Agent {
  return createAgent({
    name,
    description: 'AI agent specialized in software development',
    capabilities: ['coding', 'debugging', 'code-review', 'architecture'],
  }, config)
}

export function createTranslationAgent(
  name: string,
  languages: string[],
  config?: Partial<ASFConfig>
): Agent {
  return createAgent({
    name,
    description: `AI agent specialized in translation between ${languages.join(', ')}`,
    capabilities: ['translation', 'localization', ...languages.map(lang => `lang-${lang}`)],
  }, config)
}

export function createBlockchainAgent(
  name: string,
  config?: Partial<ASFConfig>
): Agent {
  return createAgent({
    name,
    description: 'AI agent specialized in blockchain and smart contract development',
    capabilities: ['smart-contracts', 'ton-development', 'blockchain-analysis', 'defi'],
  }, config)
}
