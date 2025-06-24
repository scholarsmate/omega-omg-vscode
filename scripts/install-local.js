#!/usr/bin/env node
// Install the locally built .vsix file
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get package info
const packageJson = require('../package.json');
const version = packageJson.version;
const name = packageJson.name;

// Construct .vsix filename
const vsixFile = `${name}-${version}.vsix`;

// Check if file exists
if (!fs.existsSync(vsixFile)) {
    console.error(`❌ ${vsixFile} not found. Run 'npm run build' first.`);
    process.exit(1);
}

// Install the extension
try {
    console.log(`📦 Installing ${vsixFile}...`);
    execSync(`code --install-extension "${vsixFile}"`, { stdio: 'inherit' });
    console.log(`✅ Successfully installed ${name} v${version}`);
    console.log(`🔧 Reload VS Code to activate the extension`);
} catch (error) {
    console.error(`❌ Failed to install extension: ${error.message}`);
    process.exit(1);
}
