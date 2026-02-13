/**
 * Aton Memory Auto-Compaction System
 * Inspired by teleton-agent's context management
 * Preserves key information while reducing token usage
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface CompactionConfig {
  maxTokens: number;
  preserveRecent: number; // Days to preserve in full
  summaryRatio: number; // Compress to X% of original
  keywordWeights: Record<string, number>;
}

interface MemoryEntry {
  date: string;
  content: string;
  tokens: number;
  importance: number;
  compressed?: string;
}

export class AutoCompactionSystem {
  private config: CompactionConfig = {
    maxTokens: 50000, // Max tokens before compaction
    preserveRecent: 7, // Preserve last 7 days in full
    summaryRatio: 0.3, // Compress to 30%
    keywordWeights: {
      'AlphaTON': 2.0,
      'TON': 1.8,
      'executive': 1.5,
      'business': 1.3,
      'decision': 1.5,
      'meeting': 1.2,
      'revenue': 1.4,
      'partnership': 1.3,
      'security': 1.6,
      'urgent': 2.0
    }
  };

  private memoryDir: string;

  constructor(memoryDir: string = './memory') {
    this.memoryDir = memoryDir;
  }

  async estimateTokens(text: string): Promise<number> {
    // Rough estimation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }

  async calculateImportance(content: string): Promise<number> {
    let importance = 1.0;
    const lowerContent = content.toLowerCase();

    // Apply keyword weights
    Object.entries(this.config.keywordWeights).forEach(([keyword, weight]) => {
      const matches = (lowerContent.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      importance += matches * (weight - 1) * 0.1;
    });

    // Boost importance for structured content
    if (content.includes('##') || content.includes('- ')) importance *= 1.2;
    if (content.includes('URGENT') || content.includes('TODO')) importance *= 1.3;
    if (content.includes('Decision:') || content.includes('Action:')) importance *= 1.4;

    return Math.min(importance, 3.0); // Cap at 3x
  }

  async loadMemoryEntries(): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];
    
    try {
      // Load daily memory files
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.memoryDir);
      
      for (const file of files) {
        if (file.endsWith('.md') && file.match(/\d{4}-\d{2}-\d{2}/)) {
          const content = await readFile(join(this.memoryDir, file), 'utf-8');
          const tokens = await this.estimateTokens(content);
          const importance = await this.calculateImportance(content);
          
          entries.push({
            date: file.replace('.md', ''),
            content,
            tokens,
            importance
          });
        }
      }
    } catch (error) {
      console.log('📝 No existing memory files found, starting fresh');
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  async needsCompaction(): Promise<boolean> {
    const entries = await this.loadMemoryEntries();
    const totalTokens = entries.reduce((sum, entry) => sum + entry.tokens, 0);
    
    console.log(`🧠 Memory usage: ${totalTokens.toLocaleString()} tokens`);
    return totalTokens > this.config.maxTokens;
  }

  async compressEntry(entry: MemoryEntry): Promise<string> {
    // Simple compression strategy - extract key information
    const lines = entry.content.split('\n');
    const important = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Always preserve headers and structured content
      if (trimmed.startsWith('#') || 
          trimmed.startsWith('-') ||
          trimmed.includes(':') ||
          this.config.keywordWeights.some(keyword => 
            trimmed.toLowerCase().includes(keyword.toLowerCase()))) {
        important.push(trimmed);
      }
    }
    
    // If compression isn't effective enough, create a summary
    const compressed = important.join('\n');
    if (compressed.length > entry.content.length * this.config.summaryRatio) {
      return `## Summary for ${entry.date}\n${compressed.slice(0, Math.floor(entry.content.length * this.config.summaryRatio))}...\n[Compressed from ${entry.tokens} tokens]`;
    }
    
    return compressed;
  }

  async performCompaction(): Promise<void> {
    console.log('🗜️ Starting memory compaction...');
    
    const entries = await this.loadMemoryEntries();
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - this.config.preserveRecent);
    
    let compressedCount = 0;
    let tokensSaved = 0;
    
    for (const entry of entries) {
      const entryDate = new Date(entry.date);
      
      // Skip recent entries
      if (entryDate >= recentCutoff) {
        console.log(`⏩ Preserving recent: ${entry.date}`);
        continue;
      }
      
      // Compress older entries
      const compressed = await this.compressEntry(entry);
      const newTokens = await this.estimateTokens(compressed);
      
      if (newTokens < entry.tokens) {
        await writeFile(
          join(this.memoryDir, `${entry.date}.md`),
          `<!-- Auto-compressed on ${new Date().toISOString().split('T')[0]} -->\n${compressed}`
        );
        
        tokensSaved += entry.tokens - newTokens;
        compressedCount++;
        
        console.log(`🗜️ Compressed ${entry.date}: ${entry.tokens} → ${newTokens} tokens`);
      }
    }
    
    console.log(`✅ Compaction complete: ${compressedCount} files, ${tokensSaved.toLocaleString()} tokens saved`);
  }

  async getMemoryStats(): Promise<{
    totalFiles: number;
    totalTokens: number;
    compressedFiles: number;
    needsCompaction: boolean;
  }> {
    const entries = await this.loadMemoryEntries();
    const compressedFiles = entries.filter(e => e.content.includes('Auto-compressed')).length;
    
    return {
      totalFiles: entries.length,
      totalTokens: entries.reduce((sum, entry) => sum + entry.tokens, 0),
      compressedFiles,
      needsCompaction: await this.needsCompaction()
    };
  }
}

// Global instance
export const memoryCompaction = new AutoCompactionSystem();