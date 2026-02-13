/**
 * Aton Plugin System
 * Extensible architecture for adding new capabilities
 * Inspired by teleton-agent's plugin SDK
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';
import { Tool, toolRegistry } from '../registry.js';

interface PluginManifest {
  name: string;
  version: string;
  sdkVersion: string;
  description?: string;
  author?: string;
  dependencies?: string[];
}

interface PluginSDK {
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };
  config: any; // Sanitized app config
  pluginConfig: any; // Plugin-specific config
  ton: {
    getAddress: () => Promise<string>;
    getBalance: () => Promise<string>;
    sendTON: (to: string, amount: string, comment?: string) => Promise<any>;
  };
  telegram: {
    sendMessage: (chatId: string, text: string) => Promise<any>;
    editMessage: (chatId: string, messageId: number, text: string) => Promise<any>;
  };
  memory: {
    store: (key: string, value: any) => Promise<void>;
    retrieve: (key: string) => Promise<any>;
    search: (query: string) => Promise<any[]>;
  };
}

interface LoadedPlugin {
  manifest: PluginManifest;
  tools: Tool[];
  filePath: string;
  loadedAt: Date;
}

export class PluginSystem {
  private plugins = new Map<string, LoadedPlugin>();
  private pluginDir = './tools/plugins';
  private sdk: PluginSDK;

  constructor() {
    this.sdk = this.createSDK();
  }

  private createSDK(): PluginSDK {
    return {
      log: {
        info: (msg: string) => console.log(`🔌 Plugin: ${msg}`),
        warn: (msg: string) => console.warn(`⚠️ Plugin: ${msg}`),
        error: (msg: string) => console.error(`❌ Plugin: ${msg}`),
        debug: (msg: string) => console.debug(`🐛 Plugin: ${msg}`)
      },
      config: {
        // Sanitized config - no API keys or sensitive data
        agent: {
          name: 'Aton',
          version: '1.0.0'
        }
      },
      pluginConfig: {}, // Will be populated per plugin
      ton: {
        getAddress: async () => {
          const { tonWallet } = await import('../ton/wallet-service.js');
          return tonWallet.getAddress();
        },
        getBalance: async () => {
          const { tonWallet } = await import('../ton/wallet-service.js');
          return tonWallet.getBalance();
        },
        sendTON: async (to: string, amount: string, comment?: string) => {
          const { tonWallet } = await import('../ton/wallet-service.js');
          return tonWallet.sendTON({ to, amount, comment, requireConfirmation: true });
        }
      },
      telegram: {
        sendMessage: async (chatId: string, text: string) => {
          // TODO: Integrate with actual Telegram service
          console.log(`📨 Would send to ${chatId}: ${text}`);
          return { success: true };
        },
        editMessage: async (chatId: string, messageId: number, text: string) => {
          console.log(`✏️ Would edit message ${messageId} in ${chatId}: ${text}`);
          return { success: true };
        }
      },
      memory: {
        store: async (key: string, value: any) => {
          // TODO: Implement persistent plugin storage
          console.log(`💾 Plugin memory store: ${key}`);
        },
        retrieve: async (key: string) => {
          console.log(`🔍 Plugin memory retrieve: ${key}`);
          return null;
        },
        search: async (query: string) => {
          console.log(`🔎 Plugin memory search: ${query}`);
          return [];
        }
      }
    };
  }

  async initializePlugins(): Promise<void> {
    if (!existsSync(this.pluginDir)) {
      console.log('📁 Creating plugins directory...');
      await require('fs/promises').mkdir(this.pluginDir, { recursive: true });
      await this.createExamplePlugin();
      return;
    }

    console.log('🔌 Loading plugins...');
    await this.loadAllPlugins();
    
    const pluginCount = this.plugins.size;
    const toolCount = Array.from(this.plugins.values())
      .reduce((sum, plugin) => sum + plugin.tools.length, 0);
    
    console.log(`✅ ${pluginCount} plugins loaded, ${toolCount} tools registered`);
  }

  private async createExamplePlugin(): Promise<void> {
    const examplePlugin = `/**
 * Example Plugin for Aton
 * Demonstrates the plugin SDK capabilities
 */

export const manifest = {
  name: "example",
  version: "1.0.0",
  sdkVersion: "1.0.0",
  description: "Example plugin demonstrating SDK usage",
  author: "Aton"
};

export const tools = (sdk) => [
  {
    name: "example_hello",
    description: "Say hello from the plugin",
    category: "plugin",
    parameters: {
      type: "object",
      properties: {
        name: { 
          type: "string", 
          description: "Name to greet" 
        }
      },
      required: ["name"]
    },
    execute: async (params) => {
      const address = await sdk.ton.getAddress();
      const balance = await sdk.ton.getBalance();
      
      sdk.log.info(\`Saying hello to \${params.name}\`);
      
      return {
        success: true,
        message: \`Hello \${params.name}! I'm Aton, autonomous executive of AlphaTON Capital.\\n\\nMy TON address: \${address}\\nBalance: \${balance} TON\\n\\nI can help with business operations, TON blockchain interactions, and executive decisions.\`,
        data: {
          address,
          balance,
          timestamp: new Date().toISOString()
        }
      };
    }
  },
  
  {
    name: "example_status",
    description: "Get plugin and system status",
    category: "plugin", 
    parameters: {
      type: "object",
      properties: {},
      required: []
    },
    execute: async (params) => {
      const tonStatus = {
        address: await sdk.ton.getAddress(),
        balance: await sdk.ton.getBalance()
      };
      
      return {
        success: true,
        message: "Plugin system operational",
        data: {
          plugin: manifest,
          ton: tonStatus,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      };
    }
  }
];`;

    const pluginPath = join(this.pluginDir, 'example.js');
    await require('fs/promises').writeFile(pluginPath, examplePlugin);
    console.log('📝 Created example plugin');
  }

  private async loadAllPlugins(): Promise<void> {
    try {
      const files = await readdir(this.pluginDir);
      
      for (const file of files) {
        const filePath = join(this.pluginDir, file);
        
        if (extname(file) === '.js' || (file.includes('.') === false && existsSync(join(filePath, 'index.js')))) {
          await this.loadPlugin(filePath);
        }
      }
    } catch (error) {
      console.error('Error loading plugins:', error);
    }
  }

  private async loadPlugin(filePath: string): Promise<void> {
    try {
      // Dynamic import for ES modules
      const pluginPath = `file://${join(process.cwd(), filePath)}`;
      const plugin = await import(pluginPath);
      
      if (!plugin.manifest) {
        console.warn(`⚠️ Plugin ${filePath} missing manifest, skipping`);
        return;
      }

      const manifest = plugin.manifest as PluginManifest;
      
      // Validate SDK version compatibility
      if (manifest.sdkVersion !== '1.0.0') {
        console.warn(`⚠️ Plugin ${manifest.name} SDK version mismatch: ${manifest.sdkVersion} (expected 1.0.0)`);
      }

      // Load plugin-specific config
      const pluginSDK = { 
        ...this.sdk, 
        pluginConfig: this.getPluginConfig(manifest.name) 
      };

      // Get tools
      let tools: Tool[] = [];
      if (typeof plugin.tools === 'function') {
        tools = plugin.tools(pluginSDK);
      } else if (Array.isArray(plugin.tools)) {
        tools = plugin.tools;
      } else {
        console.warn(`⚠️ Plugin ${manifest.name} has no valid tools export`);
        return;
      }

      // Validate and register tools
      for (const tool of tools) {
        if (!tool.category) tool.category = 'plugin';
        if (!tool.scope) tool.scope = 'user';
        
        try {
          toolRegistry.register(tool);
        } catch (error) {
          console.error(`❌ Failed to register tool ${tool.name}:`, error);
        }
      }

      // Store loaded plugin
      this.plugins.set(manifest.name, {
        manifest,
        tools,
        filePath,
        loadedAt: new Date()
      });

      console.log(`🔌 Plugin "${manifest.name}": ${tools.length} tools registered`);

    } catch (error) {
      console.error(`❌ Failed to load plugin ${filePath}:`, error);
    }
  }

  private getPluginConfig(pluginName: string): any {
    // TODO: Load plugin-specific config from main config file
    return {};
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginByName(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  async reloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.error(`Plugin ${name} not found`);
      return false;
    }

    // Unregister existing tools
    for (const tool of plugin.tools) {
      // TODO: Implement tool unregistration
    }

    // Remove from plugins map
    this.plugins.delete(name);

    // Reload
    await this.loadPlugin(plugin.filePath);
    return this.plugins.has(name);
  }

  getPluginStats(): {
    totalPlugins: number;
    totalTools: number;
    pluginDetails: Array<{
      name: string;
      version: string;
      toolCount: number;
      loadedAt: Date;
    }>;
  } {
    const plugins = Array.from(this.plugins.values());
    
    return {
      totalPlugins: plugins.length,
      totalTools: plugins.reduce((sum, p) => sum + p.tools.length, 0),
      pluginDetails: plugins.map(p => ({
        name: p.manifest.name,
        version: p.manifest.version,
        toolCount: p.tools.length,
        loadedAt: p.loadedAt
      }))
    };
  }
}

// Global plugin system
export const pluginSystem = new PluginSystem();