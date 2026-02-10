#!/usr/bin/env node

/**
 * AgentMail Email Sender
 * Sends emails via AgentMail API with required CC policy
 * Built by Aton Crux - AlphaTON Capital
 */

import { AgentMailClient } from 'agentmail';
import { parseArgs } from 'node:util';

// Required CC addresses per TOOLS.md policy
const REQUIRED_CC = ['l@alphaton.capital', 'aton@alphaton.capital'];
const FROM_EMAIL = 'aton@agentmail.to';

async function sendEmail(to, subject, body, additionalCC = []) {
  const client = new AgentMailClient({
    apiKey: process.env.AGENTMAIL_API_KEY
  });

  // Combine required CC with any additional CC addresses
  const allCC = [...new Set([...REQUIRED_CC, ...additionalCC])];
  
  try {
    const result = await client.inboxes.messages.send(FROM_EMAIL, {
      to,
      cc: allCC,
      subject,
      text: body
    });
    
    return result;
  } catch (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      to: { type: 'string', short: 't' },
      subject: { type: 'string', short: 's' },
      body: { type: 'string', short: 'b' },
      cc: { type: 'string', multiple: true, short: 'c' },
      help: { type: 'boolean', short: 'h' }
    },
    strict: false
  });

  if (values.help) {
    console.log(`
AgentMail Email Sender

Usage: node send-email.mjs --to <email> --subject <subject> --body <body> [--cc <email>]

Options:
  -t, --to <email>       Recipient email address
  -s, --subject <text>   Email subject  
  -b, --body <text>      Email body content
  -c, --cc <email>       Additional CC recipients (can be used multiple times)
  -h, --help             Show this help

Note: Automatically CCs l@alphaton.capital and aton@alphaton.capital per company policy.
Sends from: aton@agentmail.to

Examples:
  node send-email.mjs --to "user@example.com" --subject "Hello" --body "Test message"
  node send-email.mjs -t "user@example.com" -s "Report" -b "Daily report" -c "extra@example.com"
`);
    return;
  }

  if (!values.to || !values.subject || !values.body) {
    console.error('❌ Error: --to, --subject, and --body are required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (!process.env.AGENTMAIL_API_KEY) {
    console.error('❌ Error: AGENTMAIL_API_KEY environment variable not set');
    process.exit(1);
  }

  try {
    console.log(`📧 Sending email to ${values.to}...`);
    console.log(`   Subject: ${values.subject}`);
    console.log(`   From: ${FROM_EMAIL}`);
    console.log(`   CC: ${REQUIRED_CC.concat(values.cc || []).join(', ')}`);

    const result = await sendEmail(values.to, values.subject, values.body, values.cc || []);
    
    console.log(`✅ Email sent successfully`);
    console.log(`   Message ID: ${result.id || 'N/A'}`);
    
  } catch (error) {
    console.error(`❌ Failed to send email: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { sendEmail };