import { Address } from '@ton/core'

// Address validation and utilities
export function isValidTONAddress(address: string): boolean {
  try {
    Address.parse(address)
    return true
  } catch {
    return false
  }
}

export function formatTONAddress(address: string, format: 'raw' | 'user_friendly' = 'user_friendly'): string {
  try {
    const addr = Address.parse(address)
    return format === 'raw' ? addr.toRawString() : addr.toString()
  } catch {
    return address
  }
}

// Amount conversion utilities
export function tonToNanoTON(amount: string): string {
  const ton = parseFloat(amount)
  return (ton * 1_000_000_000).toString()
}

export function nanoTONToTON(nanoAmount: string): string {
  const nano = parseFloat(nanoAmount)
  return (nano / 1_000_000_000).toFixed(9)
}

export function formatTONAmount(amount: string, decimals = 4): string {
  const num = parseFloat(amount)
  return num.toFixed(decimals) + ' TON'
}

// Transaction utilities
export function generateMockTxHash(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 16)
  return `tx_${timestamp}_${random}`
}

export function isTransactionHash(hash: string): boolean {
  // Basic validation for transaction hash format
  return /^[a-zA-Z0-9_]+$/.test(hash) && hash.length >= 10
}

// Contract utilities
export function generateContractAddress(type: 'escrow' | 'registry' | 'service'): string {
  const prefix = type === 'escrow' ? 'EQEscrow' : 
                 type === 'registry' ? 'EQRegistry' : 'EQService'
  const suffix = Math.random().toString(36).substr(2, 20)
  return `${prefix}${suffix}...`
}

// Time utilities
export function parseISO8601Duration(duration: string): number {
  // Parse ISO 8601 duration (e.g., "PT1H30M" = 1.5 hours = 5400 seconds)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  return hours * 3600 + minutes * 60 + seconds
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
  return `${hours}h ${minutes}m ${remainingSeconds}s`
}

// Service pricing utilities
export function calculateServiceCost(
  basePrice: string,
  usage: {
    requests?: number
    hours?: number
    dataPoints?: number
  },
  billing: 'per-request' | 'per-hour' | 'per-result' | 'per-month'
): string {
  const base = parseFloat(basePrice)
  
  switch (billing) {
    case 'per-request':
      return ((usage.requests || 1) * base).toFixed(9)
    case 'per-hour':
      return ((usage.hours || 1) * base).toFixed(9)
    case 'per-result':
      return ((usage.dataPoints || 1) * base).toFixed(9)
    case 'per-month':
      return base.toFixed(9)
    default:
      return base.toFixed(9)
  }
}

export function compareServicePrices(
  serviceA: { amount: string; billing: string },
  serviceB: { amount: string; billing: string },
  expectedUsage: { requests?: number; hours?: number }
): {
  cheaper: 'A' | 'B' | 'equal'
  difference: string
  costA: string
  costB: string
} {
  const costA = calculateServiceCost(serviceA.amount, expectedUsage, serviceA.billing as any)
  const costB = calculateServiceCost(serviceB.amount, expectedUsage, serviceB.billing as any)
  
  const numA = parseFloat(costA)
  const numB = parseFloat(costB)
  
  let cheaper: 'A' | 'B' | 'equal'
  let difference: string
  
  if (numA < numB) {
    cheaper = 'A'
    difference = (numB - numA).toFixed(9)
  } else if (numB < numA) {
    cheaper = 'B'
    difference = (numA - numB).toFixed(9)
  } else {
    cheaper = 'equal'
    difference = '0'
  }
  
  return {
    cheaper,
    difference,
    costA,
    costB,
  }
}

// Reputation utilities
export function calculateReputationChange(
  event: {
    type: 'service_completed' | 'service_cancelled' | 'quality_rating' | 'dispute_resolved'
    quality?: number // 1-5 rating
    onTime?: boolean
    disputed?: boolean
  }
): number {
  let change = 0
  
  switch (event.type) {
    case 'service_completed':
      change = event.onTime ? 2 : 1
      if (event.quality) {
        change += (event.quality - 3) * 2 // +4 for 5-star, -4 for 1-star
      }
      break
      
    case 'service_cancelled':
      change = event.disputed ? -5 : -3
      break
      
    case 'quality_rating':
      if (event.quality) {
        change = (event.quality - 3) * 3 // More weight for direct ratings
      }
      break
      
    case 'dispute_resolved':
      change = event.disputed ? -10 : 5
      break
  }
  
  // Clamp between -10 and +10
  return Math.max(-10, Math.min(10, change))
}

export function getReputationTier(score: number): {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  description: string
  benefits: string[]
} {
  if (score >= 90) {
    return {
      tier: 'platinum',
      description: 'Elite Agent',
      benefits: ['Premium listing placement', 'Reduced fees', 'Priority support', 'Verified badge'],
    }
  } else if (score >= 75) {
    return {
      tier: 'gold',
      description: 'Trusted Agent',
      benefits: ['Higher visibility', 'Lower escrow requirements', 'Verified badge'],
    }
  } else if (score >= 60) {
    return {
      tier: 'silver',
      description: 'Reliable Agent',
      benefits: ['Standard listing', 'Normal fees'],
    }
  } else {
    return {
      tier: 'bronze',
      description: 'New Agent',
      benefits: ['Basic listing', 'Standard support'],
    }
  }
}

// Network and configuration utilities
export function getNetworkEndpoints(network: 'mainnet' | 'testnet') {
  return network === 'mainnet' ? {
    ton: 'https://toncenter.com/api/v2/',
    tonapi: 'https://tonapi.io',
    explorer: 'https://tonscan.org',
  } : {
    ton: 'https://testnet.toncenter.com/api/v2/',
    tonapi: 'https://testnet.tonapi.io',
    explorer: 'https://testnet.tonscan.org',
  }
}

export function buildExplorerUrl(
  network: 'mainnet' | 'testnet',
  type: 'address' | 'transaction',
  value: string
): string {
  const baseUrl = network === 'mainnet' ? 'https://tonscan.org' : 'https://testnet.tonscan.org'
  return `${baseUrl}/${type}/${value}`
}

// Error handling utilities
export class ASFError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ASFError'
  }
}

export function isASFError(error: unknown): error is ASFError {
  return error instanceof ASFError
}

export function handleTONError(error: unknown): ASFError {
  if (isASFError(error)) return error
  
  if (error instanceof Error) {
    if (error.message.includes('insufficient funds')) {
      return new ASFError('Insufficient TON balance', 'INSUFFICIENT_FUNDS')
    }
    if (error.message.includes('invalid address')) {
      return new ASFError('Invalid TON address', 'INVALID_ADDRESS')
    }
    if (error.message.includes('network')) {
      return new ASFError('Network error', 'NETWORK_ERROR')
    }
  }
  
  return new ASFError('Unknown TON error', 'UNKNOWN_ERROR', { original: error })
}
