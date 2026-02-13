/**
 * Aton TON Wallet Service
 * Native blockchain operations for autonomous executive functions
 */

import { TonClient, Address, toNano, fromNano } from '@ton/ton';
import { mnemonicToWalletKey, mnemonicNew } from '@ton/crypto';
import { WalletContractV4, WalletContractV5R1 } from '@ton/ton';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

interface WalletConfig {
  mnemonic: string[];
  version: 'v4' | 'v5r1';
  testnet: boolean;
}

interface TransactionRequest {
  to: string;
  amount: string; // In TON
  comment?: string;
  requireConfirmation?: boolean;
}

interface TokenBalance {
  symbol: string;
  balance: string;
  jettonAddress?: string;
  jettonWallet?: string;
}

export class TonWalletService {
  private client: TonClient;
  private wallet?: WalletContractV4 | WalletContractV5R1;
  private keyPair?: any;
  private config?: WalletConfig;
  
  // Financial operation limits (safety measures)
  private readonly DAILY_LIMIT_TON = '100'; // 100 TON daily limit
  private readonly SINGLE_TX_LIMIT_TON = '50'; // 50 TON single transaction limit
  private dailySpent = '0';
  private lastResetDate = '';

  constructor(testnet: boolean = false) {
    this.client = new TonClient({
      endpoint: testnet 
        ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
        : 'https://toncenter.com/api/v2/jsonRPC'
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.loadWallet();
      console.log('💎 TON wallet initialized');
      const address = await this.getAddress();
      const balance = await this.getBalance();
      console.log(`📍 Address: ${address}`);
      console.log(`💰 Balance: ${balance} TON`);
    } catch (error) {
      console.log('⚠️ No wallet found, creating new wallet...');
      await this.createWallet();
    }
  }

  private async loadWallet(): Promise<void> {
    const walletPath = './tools/ton/wallet.json';
    
    if (!existsSync(walletPath)) {
      throw new Error('Wallet file not found');
    }

    const walletData = await readFile(walletPath, 'utf-8');
    this.config = JSON.parse(walletData);
    
    if (!this.config?.mnemonic) {
      throw new Error('Invalid wallet configuration');
    }

    this.keyPair = await mnemonicToWalletKey(this.config.mnemonic);
    
    // Use V5R1 for better gas efficiency and features
    if (this.config.version === 'v5r1') {
      this.wallet = WalletContractV5R1.create({ 
        publicKey: this.keyPair.publicKey, 
        workchain: 0 
      });
    } else {
      this.wallet = WalletContractV4.create({ 
        publicKey: this.keyPair.publicKey, 
        workchain: 0 
      });
    }
  }

  private async createWallet(): Promise<void> {
    console.log('🔐 Generating new wallet...');
    
    const mnemonic = await mnemonicNew(24); // 24-word mnemonic for security
    this.keyPair = await mnemonicToWalletKey(mnemonic);
    
    // Create V5R1 wallet (latest version)
    this.wallet = WalletContractV5R1.create({ 
      publicKey: this.keyPair.publicKey, 
      workchain: 0 
    });

    this.config = {
      mnemonic: mnemonic,
      version: 'v5r1',
      testnet: false
    };

    // Save wallet securely
    const walletPath = './tools/ton/wallet.json';
    await writeFile(walletPath, JSON.stringify(this.config, null, 2), { mode: 0o600 });
    
    console.log('✅ New wallet created');
    console.log('📍 Address:', this.wallet.address.toString());
    console.log('🔑 Mnemonic saved to wallet.json (keep secure!)');
    console.log('⚠️ Fund this wallet to enable operations');
  }

  async getAddress(): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    return this.wallet.address.toString();
  }

  async getBalance(): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    
    try {
      const balance = await this.client.getBalance(this.wallet.address);
      return fromNano(balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  }

  async getJettonBalances(): Promise<TokenBalance[]> {
    // TODO: Implement jetton balance fetching
    // This would require querying jetton master contracts
    return [];
  }

  private checkDailyLimits(amount: string): { allowed: boolean; reason?: string } {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily counter if new day
    if (this.lastResetDate !== today) {
      this.dailySpent = '0';
      this.lastResetDate = today;
    }

    // Check single transaction limit
    if (parseFloat(amount) > parseFloat(this.SINGLE_TX_LIMIT_TON)) {
      return { 
        allowed: false, 
        reason: `Single transaction limit exceeded (${this.SINGLE_TX_LIMIT_TON} TON)` 
      };
    }

    // Check daily limit
    const newDailyTotal = parseFloat(this.dailySpent) + parseFloat(amount);
    if (newDailyTotal > parseFloat(this.DAILY_LIMIT_TON)) {
      return { 
        allowed: false, 
        reason: `Daily limit would be exceeded (${this.DAILY_LIMIT_TON} TON)` 
      };
    }

    return { allowed: true };
  }

  async sendTON(request: TransactionRequest): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.wallet || !this.keyPair) {
      return { success: false, error: 'Wallet not initialized' };
    }

    try {
      // Validate address
      Address.parse(request.to);
    } catch {
      return { success: false, error: 'Invalid recipient address' };
    }

    // Check limits
    const limitCheck = this.checkDailyLimits(request.amount);
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.reason };
    }

    // Require confirmation for significant amounts
    if (request.requireConfirmation && parseFloat(request.amount) > 10) {
      console.log(`⚠️ Large transaction requires confirmation: ${request.amount} TON to ${request.to}`);
      return { success: false, error: 'Confirmation required for large transaction' };
    }

    try {
      const walletContract = this.client.open(this.wallet);
      const seqno = await walletContract.getSeqno();

      // Create transfer
      await walletContract.sendTransfer({
        secretKey: this.keyPair.secretKey,
        seqno: seqno,
        messages: [{
          to: Address.parse(request.to),
          value: toNano(request.amount),
          body: request.comment || '',
          bounce: false
        }]
      });

      // Update daily spending
      this.dailySpent = (parseFloat(this.dailySpent) + parseFloat(request.amount)).toString();

      console.log(`💸 Sent ${request.amount} TON to ${request.to}`);
      return { success: true }; // TODO: Return actual tx hash

    } catch (error: any) {
      console.error('Transaction failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getTransactionHistory(limit: number = 10): Promise<any[]> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    
    try {
      const transactions = await this.client.getTransactions(this.wallet.address, { limit });
      return transactions.map(tx => ({
        hash: tx.hash().toString('hex'),
        time: tx.now,
        amount: fromNano(tx.inMessage?.info.value.coins || 0),
        from: tx.inMessage?.info.src?.toString(),
        comment: tx.inMessage?.body ? 'Has body' : undefined
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  async getDailySpendingSummary(): Promise<{
    spent: string;
    limit: string;
    remaining: string;
    resetTime: string;
  }> {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailySpent = '0';
      this.lastResetDate = today;
    }

    const remaining = (parseFloat(this.DAILY_LIMIT_TON) - parseFloat(this.dailySpent)).toString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      spent: this.dailySpent,
      limit: this.DAILY_LIMIT_TON,
      remaining: remaining,
      resetTime: tomorrow.toISOString()
    };
  }

  async getWalletStatus(): Promise<{
    address: string;
    balance: string;
    network: string;
    version: string;
    dailyLimits: any;
  }> {
    const address = await this.getAddress();
    const balance = await this.getBalance();
    const dailyLimits = await this.getDailySpendingSummary();

    return {
      address,
      balance,
      network: this.config?.testnet ? 'testnet' : 'mainnet',
      version: this.config?.version || 'unknown',
      dailyLimits
    };
  }
}

// Global wallet service instance
export const tonWallet = new TonWalletService();