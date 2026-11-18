#!/usr/bin/env node

import('../dist/index.js')
  .then((m) => m.runStdioServer())
  .catch((err) => {
    console.error('Failed to start DMPilot MCP server:', err);
    process.exit(1);
  });
