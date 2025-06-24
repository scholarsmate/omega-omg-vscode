const fs = require('fs');
const path = require('path');

// Clean build artifacts
const toDelete = [
    'out',
    'dist'
];

// Clean .vsix files
const files = fs.readdirSync('.');
const vsixFiles = files.filter(file => file.endsWith('.vsix'));

console.log('🧹 Cleaning build artifacts...');

// Delete directories
toDelete.forEach(dir => {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`✅ Removed ${dir}/`);
    }
});

// Delete .vsix files
vsixFiles.forEach(file => {
    fs.unlinkSync(file);
    console.log(`✅ Removed ${file}`);
});

console.log('✨ Clean completed!');
