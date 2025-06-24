#!/usr/bin/env node

/**
 * Version Sync Script
 * Ensures package.json version and git tags are synchronized
 */

const fs = require('fs');
const { execSync } = require('child_process');

function getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
}

function getLatestTag() {
    try {
        return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim().replace(/^v/, '');
    } catch (error) {
        return null;
    }
}

function getAllTags() {
    try {
        const tags = execSync('git tag', { encoding: 'utf8' }).trim();
        return tags ? tags.split('\n').map(tag => tag.replace(/^v/, '')) : [];
    } catch (error) {
        return [];
    }
}

function updateVersion(newVersion) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ Updated package.json version to ${newVersion}`);
}

function createTag(version) {
    const tagName = `v${version}`;
    execSync(`git tag ${tagName}`, { stdio: 'inherit' });
    console.log(`✅ Created tag ${tagName}`);
}

function checkSync() {
    const packageVersion = getCurrentVersion();
    const latestTag = getLatestTag();
    
    console.log(`📦 Package.json version: ${packageVersion}`);
    console.log(`🏷️  Latest tag: ${latestTag || 'none'}`);
    
    if (!latestTag) {
        console.log('ℹ️  No tags found - this appears to be a new repository');
        return { inSync: false, packageVersion, latestTag: null };
    }
    
    const inSync = packageVersion === latestTag;
    console.log(inSync ? '✅ Versions are synchronized' : '❌ Versions are NOT synchronized');
    
    return { inSync, packageVersion, latestTag };
}

function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'check') {
        checkSync();
    } else if (command === 'sync') {
        const { inSync, packageVersion, latestTag } = checkSync();
        
        if (inSync) {
            console.log('✅ Already synchronized, no action needed');
            return;
        }
        
        if (!latestTag) {
            console.log(`🚀 Creating initial tag v${packageVersion}`);
            createTag(packageVersion);
            return;
        }
        
        console.log('\n🤔 Which version should be the source of truth?');
        console.log(`1. Use package.json version (${packageVersion}) - will create new tag`);
        console.log(`2. Use latest tag version (${latestTag}) - will update package.json`);
        
        const choice = args[1];
        if (choice === 'package' || choice === '1') {
            createTag(packageVersion);
        } else if (choice === 'tag' || choice === '2') {
            updateVersion(latestTag);
        } else {
            console.log('\n❓ Usage: npm run version:sync [package|tag]');
            console.log('  - package: Use package.json version as source of truth');
            console.log('  - tag: Use git tag version as source of truth');
        }
    } else if (command === 'release') {
        const versionType = args[1] || 'patch';
        const { packageVersion } = checkSync();
        
        console.log(`\n🚀 Creating ${versionType} release from ${packageVersion}`);
        
        // Update version in package.json
        execSync(`npm version ${versionType} --no-git-tag-version`, { stdio: 'inherit' });
        
        // Get new version
        const newVersion = getCurrentVersion();
        console.log(`📦 New version: ${newVersion}`);
        
        // Create and push tag
        createTag(newVersion);
        console.log('\n✅ Release prepared! Push the tag to trigger release workflow:');
        console.log(`   git push origin v${newVersion}`);
        
    } else {
        console.log('📋 Version Sync Utility');
        console.log('');
        console.log('Commands:');
        console.log('  check              - Check if versions are synchronized');
        console.log('  sync [package|tag] - Synchronize versions');
        console.log('  release [patch|minor|major] - Create new release with version bump');
        console.log('');
        console.log('Examples:');
        console.log('  npm run version:check');
        console.log('  npm run version:sync package');
        console.log('  npm run version:release patch');
    }
}

if (require.main === module) {
    main();
}
