#!/usr/bin/env node

// This is a wrapper script that uses ts-node to execute the TypeScript file directly
// Set tsconfig path explicitly to avoid inheriting from current directory
process.env.TS_NODE_PROJECT = require('path').resolve(
  __dirname,
  'tsconfig.json',
)
require('ts-node/register')
require('./src/index.ts')
