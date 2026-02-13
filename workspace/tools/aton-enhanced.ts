/**
 * Aton Enhanced System
 * Integration of teleton-agent inspired capabilities
 * 
 * New capabilities:
 * - Systematic tool registry and management
 * - Auto-compacting memory system  
 * - Multi-layer security framework
 * - Native TON wallet operations
 * - Extensible plugin architecture
 */

import { toolRegistry } from './registry.js';
import { memoryCompaction } from './memory/auto-compaction.js';
import { security } from './security/framework.js';
import { tonWallet } from './ton/wallet-service.js';
import { pluginSystem } from './plugins/system.js';

interface SystemStats {
  tools: {
    total: number;
    byCategory: Record<string, number>;
  };
  memory: {
    totalFiles: number;
    totalTokens: number;
    compressedFiles: number;
    needsCompaction: boolean;
  };
  security: {
    adminUsers: number;
    blockedUsers: number;
    allowlistedDomains: number;
    immutableFiles: number;
  };
  wallet: {
    address: string;
    balance: string;
    network: string;
    version: string;
    dailyLimits: any;
  };
  plugins: {
    totalPlugins: number;
    totalTools: number;
    pluginDetails: any[];
  };
}

export class AtonEnhancedSystem {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Aton Enhanced System...');
    console.log('   Inspired by teleton-agent architecture');
    console.log('');

    try {
      // Initialize all subsystems
      await this.initializeSubsystems();
      
      // Register core tools
      await this.registerCoreTools();
      
      // Display system status
      await this.displaySystemStatus();
      
      this.initialized = true;
      console.log('✅ Aton Enhanced System ready');
      console.log('');
      
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      throw error;
    }
  }

  private async initializeSubsystems(): Promise<void> {
    console.log('🔧 Initializing subsystems...');
    
    // Initialize TON wallet
    await tonWallet.initialize();
    
    // Initialize plugin system
    await pluginSystem.initializePlugins();
    
    // Check memory status
    const memoryStatus = await memoryCompaction.getMemoryStats();
    if (memoryStatus.needsCompaction) {
      console.log('🗜️ Memory compaction needed, running...');
      await memoryCompaction.performCompaction();
    }
    
    console.log('✅ Subsystems initialized');
  }

  private async registerCoreTools(): Promise<void> {
    console.log('🛠️ Registering core tools...');

    // Memory management tools
    toolRegistry.register({
      name: 'memory_compact',
      description: 'Compress old memory files to save context tokens',
      category: 'memory',
      scope: 'admin',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        await memoryCompaction.performCompaction();
        const stats = await memoryCompaction.getMemoryStats();
        return { success: true, data: stats };
      }
    });

    toolRegistry.register({
      name: 'memory_stats',
      description: 'Get memory usage statistics',
      category: 'memory',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        const stats = await memoryCompaction.getMemoryStats();
        return { success: true, data: stats };
      }
    });

    // TON wallet tools
    toolRegistry.register({
      name: 'ton_status',
      description: 'Get TON wallet status and balance',
      category: 'ton',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        const status = await tonWallet.getWalletStatus();
        return { success: true, data: status };
      }
    });

    toolRegistry.register({
      name: 'ton_send',
      description: 'Send TON tokens (requires admin approval)',
      category: 'ton',
      scope: 'admin',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address' },
          amount: { type: 'string', description: 'Amount in TON' },
          comment: { type: 'string', description: 'Optional comment' }
        },
        required: ['to', 'amount']
      },
      execute: async (params) => {
        const result = await tonWallet.sendTON({
          to: params.to,
          amount: params.amount,
          comment: params.comment,
          requireConfirmation: true
        });
        return result;
      }
    });

    // Security tools
    toolRegistry.register({
      name: 'security_status',
      description: 'Get security framework status',
      category: 'security',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        const status = security.getSecurityStatus();
        return { success: true, data: status };
      }
    });

    // System overview tool
    toolRegistry.register({
      name: 'system_status',
      description: 'Get comprehensive system status',
      category: 'workspace',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        const stats = await this.getSystemStats();
        return { success: true, data: stats };
      }
    });

    console.log('✅ Core tools registered');
  }

  async getSystemStats(): Promise<SystemStats> {
    const [memoryStats, walletStatus, pluginStats] = await Promise.all([
      memoryCompaction.getMemoryStats(),
      tonWallet.getWalletStatus(),
      pluginSystem.getPluginStats()
    ]);

    return {
      tools: toolRegistry.getStats(),
      memory: memoryStats,
      security: security.getSecurityStatus(),
      wallet: walletStatus,
      plugins: pluginStats
    };
  }

  private async displaySystemStatus(): Promise<void> {
    const stats = await this.getSystemStats();
    
    console.log('📊 System Status:');
    console.log('');
    console.log(`🛠️ Tools: ${stats.tools.total} total`);
    Object.entries(stats.tools.byCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} tools`);
    });
    console.log('');
    console.log(`🧠 Memory: ${stats.memory.totalFiles} files, ${stats.memory.totalTokens.toLocaleString()} tokens`);
    console.log(`   Compressed: ${stats.memory.compressedFiles} files`);
    console.log(`   Status: ${stats.memory.needsCompaction ? '⚠️ Needs compaction' : '✅ Optimal'}`);
    console.log('');
    console.log(`🔒 Security: ${stats.security.adminUsers} admins, ${stats.security.allowlistedDomains} domains`);
    console.log(`   Immutable files: ${stats.security.immutableFiles}`);
    console.log(`   Blocked users: ${stats.security.blockedUsers}`);
    console.log('');
    console.log(`💎 TON Wallet: ${stats.wallet.balance} TON`);
    console.log(`   Address: ${stats.wallet.address}`);
    console.log(`   Network: ${stats.wallet.network} (${stats.wallet.version})`);
    console.log(`   Daily limits: ${stats.wallet.dailyLimits.spent}/${stats.wallet.dailyLimits.limit} TON`);
    console.log('');
    console.log(`🔌 Plugins: ${stats.plugins.totalPlugins} loaded (${stats.plugins.totalTools} tools)`);
    stats.plugins.pluginDetails.forEach(plugin => {
      console.log(`   ${plugin.name} v${plugin.version}: ${plugin.toolCount} tools`);
    });
    console.log('');
  }

  async performMaintenance(): Promise<void> {
    console.log('🔧 Running system maintenance...');
    
    // Check if memory compaction is needed
    const memoryStats = await memoryCompaction.getMemoryStats();
    if (memoryStats.needsCompaction) {
      await memoryCompaction.performCompaction();
    }
    
    // TODO: Add other maintenance tasks
    // - Plugin health checks
    // - Security log rotation
    // - Wallet balance monitoring
    
    console.log('✅ Maintenance complete');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Tool execution with security validation
  async executeTool(toolName: string, params: any, context: any): Promise<any> {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not found` };
    }

    // Security validation
    const accessCheck = security.validateAccess(context, tool.category);
    if (!accessCheck.allowed) {
      return { success: false, error: accessCheck.reason };
    }

    // Content validation
    const contentCheck = security.validateContent(JSON.stringify(params));
    if (!contentCheck.safe) {
      security.logSecurityEvent(`Unsafe content in tool execution: ${toolName}`, {
        threats: contentCheck.threats,
        params
      });
      return { success: false, error: 'Content security violation' };
    }

    try {
      return await tool.execute(params, context);
    } catch (error: any) {
      console.error(`Tool execution error (${toolName}):`, error);
      return { success: false, error: error.message };
    }
  }
}

// Global enhanced system instance
export const atonEnhanced = new AtonEnhancedSystem();

// Auto-initialize when imported
atonEnhanced.initialize().catch(error => {
  console.error('Failed to initialize Aton Enhanced System:', error);
});