import { AgentWallet } from './wallet'
import { ServiceRequest, Transaction } from '@atoncap/asf-core'

export interface PaymentConfig {
  wallet: AgentWallet
  escrowFee: string // Fee for escrow service (e.g., "0.1")
  minEscrowAmount: string // Minimum amount for escrow (e.g., "1.0")
}

export interface EscrowConfig {
  duration: number // Duration in seconds
  releaseConditions: 'manual' | 'automatic' | 'dispute'
  disputeResolution: 'oracle' | 'voting' | 'arbitration'
}

export class PaymentProcessor {
  private wallet: AgentWallet
  private config: PaymentConfig

  constructor(config: PaymentConfig) {
    this.wallet = config.wallet
    this.config = config
  }

  // Direct Payments (for simple services)
  async processDirectPayment(
    request: ServiceRequest,
    providerAddress: string
  ): Promise<Transaction> {
    const result = await this.wallet.sendTON(
      providerAddress,
      request.maxPrice,
      `Service payment: ${request.serviceId}`
    )

    const transaction: Transaction = {
      id: `payment_${request.id}`,
      requestId: request.id,
      fromAddress: await this.wallet.getAddress(),
      toAddress: providerAddress,
      amount: request.maxPrice,
      currency: 'TON',
      txHash: result.txHash,
      status: result.success ? 'confirmed' : 'failed',
      createdAt: new Date(),
      confirmedAt: result.success ? new Date() : undefined,
    }

    return transaction
  }

  // Escrow Payments (for complex services requiring guarantee)
  async createEscrowPayment(
    request: ServiceRequest,
    providerAddress: string,
    escrowConfig: EscrowConfig
  ): Promise<{
    transaction: Transaction
    escrowAddress: string
    releaseKey: string
  }> {
    const escrowResult = await this.wallet.createServicePayment({
      providerId: request.providerId,
      serviceId: request.serviceId,
      amount: request.maxPrice,
      escrowDuration: escrowConfig.duration,
    })

    const transaction: Transaction = {
      id: `escrow_${request.id}`,
      requestId: request.id,
      fromAddress: await this.wallet.getAddress(),
      toAddress: escrowResult.escrowAddress,
      amount: request.maxPrice,
      currency: 'TON',
      txHash: escrowResult.txHash,
      status: escrowResult.success ? 'confirmed' : 'failed',
      createdAt: new Date(),
      confirmedAt: escrowResult.success ? new Date() : undefined,
    }

    const releaseKey = this.generateReleaseKey(request.id, providerAddress)

    return {
      transaction,
      escrowAddress: escrowResult.escrowAddress,
      releaseKey,
    }
  }

  // Release escrow funds to provider after service completion
  async releaseEscrowPayment(
    escrowAddress: string,
    providerAddress: string,
    releaseKey: string,
    amount?: string
  ): Promise<Transaction> {
    const result = await this.wallet.releaseEscrow(escrowAddress, providerAddress)

    const transaction: Transaction = {
      id: `release_${Date.now()}`,
      requestId: this.extractRequestIdFromReleaseKey(releaseKey),
      fromAddress: escrowAddress,
      toAddress: providerAddress,
      amount: amount || '0', // Would get from escrow contract
      currency: 'TON',
      txHash: result.txHash,
      status: result.success ? 'confirmed' : 'failed',
      createdAt: new Date(),
      confirmedAt: result.success ? new Date() : undefined,
    }

    return transaction
  }

  // Partial payments for streaming or hourly services
  async processPartialPayment(
    request: ServiceRequest,
    providerAddress: string,
    amount: string,
    memo: string
  ): Promise<Transaction> {
    const result = await this.wallet.sendTON(
      providerAddress,
      amount,
      `Partial payment: ${memo}`
    )

    const transaction: Transaction = {
      id: `partial_${Date.now()}`,
      requestId: request.id,
      fromAddress: await this.wallet.getAddress(),
      toAddress: providerAddress,
      amount,
      currency: 'TON',
      txHash: result.txHash,
      status: result.success ? 'confirmed' : 'failed',
      createdAt: new Date(),
      confirmedAt: result.success ? new Date() : undefined,
    }

    return transaction
  }

  // Subscription payments for ongoing services
  async createSubscription(
    providerId: string,
    serviceId: string,
    amount: string,
    interval: 'daily' | 'weekly' | 'monthly',
    duration: number // Number of intervals
  ): Promise<{
    subscriptionId: string
    nextPayment: Date
    totalAmount: string
  }> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Calculate next payment date
    const nextPayment = new Date()
    switch (interval) {
      case 'daily':
        nextPayment.setDate(nextPayment.getDate() + 1)
        break
      case 'weekly':
        nextPayment.setDate(nextPayment.getDate() + 7)
        break
      case 'monthly':
        nextPayment.setMonth(nextPayment.getMonth() + 1)
        break
    }

    const totalAmount = (parseFloat(amount) * duration).toString()

    console.log(`Created subscription ${subscriptionId} for ${totalAmount} TON`)

    return {
      subscriptionId,
      nextPayment,
      totalAmount,
    }
  }

  // Refunds and disputes
  async processRefund(
    originalTransaction: Transaction,
    refundAmount: string,
    reason: string
  ): Promise<Transaction> {
    const result = await this.wallet.sendTON(
      originalTransaction.fromAddress,
      refundAmount,
      `Refund: ${reason}`
    )

    const refundTransaction: Transaction = {
      id: `refund_${originalTransaction.id}`,
      requestId: originalTransaction.requestId,
      fromAddress: await this.wallet.getAddress(),
      toAddress: originalTransaction.fromAddress,
      amount: refundAmount,
      currency: 'TON',
      txHash: result.txHash,
      status: result.success ? 'confirmed' : 'failed',
      createdAt: new Date(),
      confirmedAt: result.success ? new Date() : undefined,
    }

    return refundTransaction
  }

  // Payment validation and verification
  async verifyPayment(txHash: string): Promise<{
    verified: boolean
    amount?: string
    from?: string
    to?: string
    timestamp?: Date
  }> {
    try {
      // In a real implementation, this would query the TON blockchain
      // For now, return mock verification
      return {
        verified: true,
        amount: '10.5',
        from: 'EQSender...',
        to: 'EQRecipient...',
        timestamp: new Date(),
      }
    } catch (error) {
      console.error('Failed to verify payment:', error)
      return { verified: false }
    }
  }

  // Fee calculation
  calculateServiceFee(amount: string, serviceType: 'escrow' | 'direct' | 'subscription'): string {
    const baseAmount = parseFloat(amount)
    let feeRate = 0.01 // 1% default

    switch (serviceType) {
      case 'escrow':
        feeRate = 0.025 // 2.5% for escrow services
        break
      case 'direct':
        feeRate = 0.005 // 0.5% for direct payments
        break
      case 'subscription':
        feeRate = 0.02 // 2% for subscription management
        break
    }

    const fee = baseAmount * feeRate
    return Math.max(fee, 0.01).toFixed(9) // Minimum fee of 0.01 TON
  }

  // Payment analytics
  async getPaymentHistory(agentId: string, limit = 50): Promise<Transaction[]> {
    return await this.wallet.getTransactionHistory(limit)
  }

  async getPaymentStats(agentId: string): Promise<{
    totalPaid: string
    totalReceived: string
    transactionCount: number
    avgTransactionValue: string
    successRate: number
  }> {
    const history = await this.getPaymentHistory(agentId)
    const walletAddress = await this.wallet.getAddress()

    const outgoing = history.filter(tx => tx.fromAddress === walletAddress)
    const incoming = history.filter(tx => tx.toAddress === walletAddress)
    const confirmed = history.filter(tx => tx.status === 'confirmed')

    const totalPaid = outgoing.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
    const totalReceived = incoming.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
    const avgTransactionValue = history.length > 0 
      ? history.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) / history.length
      : 0

    return {
      totalPaid: totalPaid.toFixed(9),
      totalReceived: totalReceived.toFixed(9),
      transactionCount: history.length,
      avgTransactionValue: avgTransactionValue.toFixed(9),
      successRate: history.length > 0 ? (confirmed.length / history.length) * 100 : 0,
    }
  }

  // Private helper methods
  private generateReleaseKey(requestId: string, providerAddress: string): string {
    return `release_${requestId}_${providerAddress}_${Date.now()}`
  }

  private extractRequestIdFromReleaseKey(releaseKey: string): string {
    const parts = releaseKey.split('_')
    return parts.length >= 3 ? parts[1] : ''
  }
}
