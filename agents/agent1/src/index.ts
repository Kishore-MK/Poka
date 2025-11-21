import * as dotenv from "dotenv";
import chalk from "chalk";
import boxen from "boxen";
import { serve } from '@hono/node-server';
import app from './agent/agent-server.js';

dotenv.config();

// Start Hono server in background
const port = Number(process.env.AGENT_PORT || 3000);
serve({
  fetch: app.fetch,
  port,
});

console.log(chalk.green(`✅ Agent HTTP server started on port ${port}`));

// Display welcome banner
console.clear();
console.log(
  boxen(
    chalk.bold.cyan('🤖 ERC-8004 AI Agent Server\n') +
    chalk.gray('Blockchain-powered autonomous agent with\n') +
    chalk.gray('Identity, Reputation, Validation & Intent systems\n\n') +
    chalk.yellow('Status: ') + chalk.green('Online') + '\n' +
    chalk.yellow('Port: ') + chalk.white(port),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  )
);