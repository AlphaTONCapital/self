/**
 * Aton Tool Registry - Inspired by teleton-agent architecture
 * Systematic tool management with scope filtering and categorization
 */

export interface Tool {
  name: string;
  description: string;
  category: 'telegram' | 'ton' | 'business' | 'memory' | 'security' | 'workspace' | 'plugin';
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any, context?: any) => Promise<any>;
  scope?: 'admin' | 'user' | 'public';
  priority?: number;
}

export interface ToolCategory {
  name: string;
  description: string;
  tools: Tool[];
  loadedCount: number;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private categories = new Map<string, ToolCategory>();
  private scopeFilter: string[] = ['public', 'user'];

  constructor(private context?: any) {
    this.initializeCategories();
  }

  private initializeCategories() {
    const categories = [
      { name: 'telegram', description: 'Telegram messaging and social operations' },
      { name: 'ton', description: 'TON blockchain and financial operations' },
      { name: 'business', description: 'AlphaTON business and executive functions' },
      { name: 'memory', description: 'Knowledge management and persistence' },
      { name: 'security', description: 'Security and access control' },
      { name: 'workspace', description: 'File operations and project management' },
      { name: 'plugin', description: 'External plugin tools' },
    ];

    categories.forEach(cat => {
      this.categories.set(cat.name, {
        ...cat,
        tools: [],
        loadedCount: 0
      });
    });
  }

  register(tool: Tool): void {
    // Validate tool
    if (!tool.name || !tool.description || !tool.execute) {
      throw new Error(`Invalid tool: ${tool.name}`);
    }

    // Check scope permissions
    if (tool.scope && !this.scopeFilter.includes(tool.scope)) {
      console.log(`🚫 Tool ${tool.name} blocked by scope filter`);
      return;
    }

    this.tools.set(tool.name, tool);
    
    // Add to category
    const category = this.categories.get(tool.category);
    if (category) {
      category.tools.push(tool);
      category.loadedCount++;
    }

    console.log(`✅ Tool registered: ${tool.name} (${tool.category})`);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getByCategory(categoryName: string): Tool[] {
    const category = this.categories.get(categoryName);
    return category?.tools || [];
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    this.categories.forEach((cat, name) => {
      byCategory[name] = cat.loadedCount;
    });

    return {
      total: this.tools.size,
      byCategory
    };
  }

  setScopeFilter(scopes: string[]): void {
    this.scopeFilter = scopes;
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();