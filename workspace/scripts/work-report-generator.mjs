#!/usr/bin/env node

/**
 * Automated Work Report Generator v2
 * Sends 6-hourly progress reports to Logan via AgentMail
 * Built by Aton Crux - AlphaTON Capital
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const REPORT_INTERVAL_HOURS = 6;
const STATE_FILE = 'logs/work-report-state.json';
const RECIPIENT = 'l@alphaton.capital';

class WorkReportGenerator {
  constructor() {
    this.state = this.loadState();
    this.currentTime = new Date();
    this.reportPeriodStart = new Date(this.state.lastReportTime);
  }

  loadState() {
    if (existsSync(STATE_FILE)) {
      try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      } catch (e) {
        console.error('Error loading state file:', e.message);
      }
    }
    
    return {
      lastReportTime: Date.now() - (REPORT_INTERVAL_HOURS * 60 * 60 * 1000),
      totalCommitsReported: 0,
      totalLinesReported: 0
    };
  }

  saveState(newState) {
    writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
  }

  shouldGenerateReport() {
    const hoursSinceLastReport = (this.currentTime - this.reportPeriodStart) / (1000 * 60 * 60);
    return hoursSinceLastReport >= REPORT_INTERVAL_HOURS;
  }

  async getRecentCommits() {
    const commits = [];
    const projects = [
      'projects/active/ton-utilities',
      'projects/active/lilypad',
      'projects/active/tact-docs-contribution'
    ];

    const sinceTime = new Date(this.reportPeriodStart).toISOString();

    for (const project of projects) {
      if (!existsSync(project)) continue;

      try {
        const gitLog = execSync(
          `cd ${project} && git log --since="${sinceTime}" --pretty=format:"%H|%s|%an|%ad" --date=iso`,
          { encoding: 'utf8' }
        ).trim();

        if (gitLog) {
          const projectCommits = gitLog.split('\n').map(line => {
            const [hash, subject, author, date] = line.split('|');
            return {
              project: path.basename(project),
              hash: hash.substring(0, 8),
              subject,
              author,
              date,
              projectPath: project
            };
          });
          commits.push(...projectCommits);
        }
      } catch (e) {
        // No commits in this timeframe for this project
      }
    }

    return commits.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async generateReport() {
    const commits = await this.getRecentCommits();
    const periodHours = Math.round((this.currentTime - this.reportPeriodStart) / (1000 * 60 * 60));
    
    let report = '# Aton Work Report - ' + this.currentTime.toISOString().split('T')[0] + '\n\n';
    report += '**Period:** ' + this.reportPeriodStart.toISOString() + ' - ' + this.currentTime.toISOString() + '\n';
    report += '**Duration:** ' + periodHours + ' hours\n\n';

    // Executive Summary
    report += '## Executive Summary\n\n';
    report += '- **Commits:** ' + commits.length + '\n';
    report += '- **Projects Active:** TON Utilities, Lilypad, Tact Docs\n';
    
    if (commits.length > 0) {
      report += '- **Status:** 🚀 Productive period with significant contributions\n\n';
      
      report += '## Recent Contributions\n\n';
      for (const commit of commits) {
        report += '### ' + commit.project + ': ' + commit.subject + '\n';
        report += '- **Hash:** `' + commit.hash + '`\n';
        report += '- **Date:** ' + new Date(commit.date).toLocaleString() + '\n\n';
      }
    } else {
      report += '- **Status:** 💤 Quiet period - monitoring and maintenance\n\n';
    }

    report += '## Performance Metrics\n\n';
    report += '- **Commits this period:** ' + commits.length + '\n';
    report += '- **Total commits reported:** ' + (this.state.totalCommitsReported + commits.length) + '\n';
    report += '- **Report frequency:** Every ' + REPORT_INTERVAL_HOURS + ' hours\n\n';

    report += '---\n';
    report += '*Automated report from Aton Crux - AlphaTON Capital*\n';
    report += '*Generated at: ' + this.currentTime.toISOString() + '*';

    return { report, commits };
  }

  async sendReport(report) {
    const subject = 'Aton Work Report - ' + this.currentTime.toISOString().split('T')[0];
    
    try {
      execSync(`node tools/send-email.mjs --to "${RECIPIENT}" --subject "${subject}" --body "${report}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ Work report sent to ' + RECIPIENT);
      return true;
    } catch (e) {
      console.error('❌ Failed to send work report:', e.message);
      return false;
    }
  }

  async run() {
    if (!this.shouldGenerateReport()) {
      const hoursRemaining = REPORT_INTERVAL_HOURS - Math.round((this.currentTime - this.reportPeriodStart) / (1000 * 60 * 60));
      console.log('⏰ Next report due in ' + hoursRemaining + ' hours');
      return;
    }

    console.log('🔄 Generating work report for last ' + REPORT_INTERVAL_HOURS + ' hours...');
    
    const { report, commits } = await this.generateReport();
    const sent = await this.sendReport(report);
    
    if (sent) {
      const newState = {
        lastReportTime: this.currentTime.getTime(),
        totalCommitsReported: this.state.totalCommitsReported + commits.length,
        totalLinesReported: this.state.totalLinesReported
      };
      this.saveState(newState);
      console.log('✅ Work report cycle complete');
    }
  }
}

// Run the report generator
const generator = new WorkReportGenerator();
generator.run().catch(console.error);