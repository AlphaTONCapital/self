#!/usr/bin/env node

import { AgentMailClient } from 'agentmail';
import fs from 'fs';
import path from 'path';

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_INBOX = 'aton@agentmail.to';

// Recipients
const RECIPIENTS = [
    'w@alphaton.capital',
    'b@alphaton.capital', 
    'e@alphaton.capital',
    'l@alphaton.capital',
    'y@alphaton.capital'
];

// Mandatory CCs per company policy
const MANDATORY_CCS = [
    'l@alphaton.capital',
    'aton@alphaton.capital'
];

if (!AGENTMAIL_API_KEY) {
    console.error('Error: AGENTMAIL_API_KEY environment variable not set');
    process.exit(1);
}

function parseCSVReport(csvPath) {
    if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV report not found: ${csvPath}`);
    }
    
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    
    // Skip header, find total and recent entries
    let total = '0.000000';
    const dailyEntries = [];
    
    for (const line of lines.slice(1)) { // Skip header
        const [date, amount] = line.split(',');
        if (date === 'TOTAL') {
            total = amount;
        } else if (date && amount && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dailyEntries.push({ date, amount: parseFloat(amount) });
        }
    }
    
    // Sort by date descending to get recent entries
    dailyEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
        total: parseFloat(total),
        yesterday: dailyEntries[1]?.amount || 0, // [0] is today, [1] is yesterday
        recent7Days: dailyEntries.slice(0, 7)
    };
}

function formatHTMLEmail(data, csvPath) {
    const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
    });
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const recent7DaysHTML = data.recent7Days.map(entry => 
        `        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${entry.date}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${entry.amount.toFixed(6)} TON</td>
        </tr>`
    ).join('\n');
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>TON Validator Daily Report</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0088cc, #00aa44); padding: 20px; border-radius: 8px 8px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 24px;">📊 TON Validator Daily Report</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Cocoon AI Infrastructure</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">
        <h2 style="color: #0088cc; margin-top: 0;">📅 Report Summary</h2>
        <p><strong>Report Date:</strong> ${reportDate}</p>
        <p><strong>Validator Address:</strong> <code style="background: #e9ecef; padding: 2px 4px; border-radius: 3px;">UQDv45oWLTxhRLPMWvqrQl_dIKv4Eeagg7icY92V-Kvfv092</code></p>
    </div>
    
    <div style="background: white; padding: 20px; border: 1px solid #dee2e6;">
        <h2 style="color: #28a745; margin-top: 0;">💰 Key Metrics</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107;">
                <h3 style="margin: 0 0 10px 0; color: #856404;">Yesterday (${yesterdayStr})</h3>
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #856404;">${data.yesterday.toFixed(6)} TON</p>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
                <h3 style="margin: 0 0 10px 0; color: #155724;">Total Tracked</h3>
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #155724;">${data.total.toFixed(6)} TON</p>
            </div>
        </div>
    </div>
    
    <div style="background: white; padding: 20px; border: 1px solid #dee2e6;">
        <h2 style="color: #007bff; margin-top: 0;">📈 Recent 7-Day Performance</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Date</th>
                    <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: right;">TON Earned</th>
                </tr>
            </thead>
            <tbody>
${recent7DaysHTML}
            </tbody>
        </table>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #6c757d;">🔍 <a href="https://tonviewer.com/UQDv45oWLTxhRLPMWvqrQl_dIKv4Eeagg7icY92V-Kvfv092" style="color: #007bff; text-decoration: none;">View on TonViewer</a></p>
        <p style="margin: 0; font-size: 12px; color: #adb5bd;">🤖 Automated daily report from Aton | AlphaTON Capital</p>
    </div>
</body>
</html>`;
}

async function sendEmailReport(csvPath) {
    console.log('TON Email Sender - Starting...');
    console.log(`CSV Report: ${csvPath}`);
    console.log(`Recipients: ${RECIPIENTS.join(', ')}`);
    console.log(`Mandatory CCs: ${MANDATORY_CCS.join(', ')}`);
    
    // Parse CSV data
    let data;
    try {
        data = parseCSVReport(csvPath);
        console.log(`Parsed data: Total=${data.total} TON, Yesterday=${data.yesterday} TON`);
    } catch (error) {
        console.error(`Error parsing CSV: ${error.message}`);
        process.exit(1);
    }
    
    // Create email content
    const htmlBody = formatHTMLEmail(data, csvPath);
    const reportDate = new Date().toISOString().split('T')[0];
    const subject = `TON Validator Daily Report - ${reportDate} | ${data.yesterday.toFixed(2)} TON Yesterday`;
    
    // Prepare email payload
    const emailData = {
        to: RECIPIENTS,
        cc: MANDATORY_CCS,
        subject: subject,
        html: htmlBody,
        attachments: [
            {
                filename: `ton-earnings-${reportDate.replace(/-/g, '')}.csv`,
                content: fs.readFileSync(csvPath, 'base64'),
                contentType: 'text/csv',
                encoding: 'base64'
            }
        ]
    };
    
    // Send email via AgentMail
    console.log('Initializing AgentMail client...');
    const client = new AgentMailClient({ apiKey: AGENTMAIL_API_KEY });
    
    try {
        console.log('Sending email...');
        const result = await client.inboxes.messages.send(FROM_INBOX, emailData);
        
        if (result && result.messageId) {
            console.log(`✅ Email sent successfully`);
            console.log(`Message ID: ${result.messageId}`);
            console.log(`Thread ID: ${result.threadId}`);
            console.log(`Recipients: ${RECIPIENTS.length} primary, ${MANDATORY_CCS.length} CC`);
            
            // Log delivery for audit trail
            const deliveryLog = {
                timestamp: new Date().toISOString(),
                messageId: result.messageId,
                threadId: result.threadId,
                recipients: RECIPIENTS,
                ccs: MANDATORY_CCS,
                subject: subject,
                csvAttachment: path.basename(csvPath),
                status: 'success'
            };
            
            const logPath = '/tmp/ton-reports/email-delivery.log';
            fs.appendFileSync(logPath, JSON.stringify(deliveryLog) + '\n');
            
            return { success: true, messageId: result.messageId };
        } else {
            throw new Error(`No message ID returned from AgentMail API. Response: ${JSON.stringify(result)}`);
        }
        
    } catch (error) {
        console.error(`❌ Failed to send email: ${error.message}`);
        
        // Log failure
        const failureLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            recipients: RECIPIENTS,
            subject: subject,
            status: 'failed'
        };
        
        const logPath = '/tmp/ton-reports/email-delivery.log';
        fs.appendFileSync(logPath, JSON.stringify(failureLog) + '\n');
        
        process.exit(1);
    }
}

// Main execution
if (process.argv.length !== 3) {
    console.error('Usage: ton-email-sender.mjs <csv-report-path>');
    console.error('Example: ton-email-sender.mjs /tmp/ton-reports/ton-earnings-20260211_064701.csv');
    process.exit(1);
}

const csvPath = process.argv[2];
sendEmailReport(csvPath).then(result => {
    console.log('Email delivery completed successfully');
}).catch(error => {
    console.error('Email delivery failed:', error.message);
    process.exit(1);
});