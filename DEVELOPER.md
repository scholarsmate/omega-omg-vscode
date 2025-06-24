# Developer Guide - OMG Language Support Extension

## Quick Start

### Building the Extension

The fastest way to build the extension:

```bash
# Build and package the extension
npm run build
```

Or step by step:

```bash
# Install dependencies
npm install

# Compile and create .vsix package
npm run compile
npm run vsix
```

### Installing the Built Extension

```bash
# Install the generated .vsix file
code --install-extension omg-language-support-0.0.1.vsix

# Or use the npm script
npm run install-local
```

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/scholarsmate/omega-omg-vscode
cd omega-omg-vscode

# Install dependencies
npm install
```

### 2. Development Mode

```bash
# Start watch mode for automatic compilation
npm run watch
```

**Press F5 in VS Code** to launch Extension Development Host for testing.

### 3. Available npm Commands

#### Building
```bash
npm run compile      # Compile TypeScript with webpack
npm run package      # Create optimized production build
npm run vsix         # Create .vsix package
npm run build        # Full build (compile + package)
npm run clean        # Clean build artifacts
```

#### Development
```bash
npm run watch        # Watch mode for continuous compilation
npm run test         # Run tests with linting
npm run lint         # Run ESLint only
```

#### Version Management
```bash
npm run version:patch    # Increment patch version (0.0.1 → 0.0.2)
npm run version:minor    # Increment minor version (0.1.0 → 0.2.0)
npm run version:major    # Increment major version (1.0.0 → 2.0.0)
```

#### Installation & Publishing
```bash
npm run install-local    # Install built .vsix locally
npm run release         # Clean + build + prepare for release
npm run publish         # Publish current version
npm run publish:patch   # Version bump + publish (patch)
npm run publish:minor   # Version bump + publish (minor)
npm run publish:major   # Version bump + publish (major)
```

In VS Code:
- Press `F5` to launch Extension Development Host
- Open `.omg` files to test syntax highlighting and completion
- Make changes to `src/extension.ts` - they'll auto-compile in watch mode
- Reload the Extension Development Host window (`Ctrl+R`) to test changes

### 3. Testing

```bash
# Run all tests
npm test

# Lint the code
npm run lint
```

### 4. Building for Distribution

```bash
# Create production build and .vsix package
npm run vsix
```

## Project Structure

```
omega-omg-vscode/
├── src/
│   ├── extension.ts              # Main extension logic & completion providers
│   └── test/
│       └── extension.test.ts     # Unit tests
├── examples/
│   ├── sample.omg               # Basic OMG language examples
│   ├── test.omg                 # Test file for syntax highlighting
│   └── completion-test.omg      # Test file for code completion
├── syntaxes/
│   └── omg.tmLanguage.json      # TextMate grammar for syntax highlighting
├── language-configuration.json   # Language configuration (brackets, comments)
├── package.json                 # Extension manifest & dependencies
├── scripts/
│   ├── clean.js                 # Build artifact cleanup
│   └── install-local.js         # Local installation helper
├── LICENSE                      # MIT license
└── README.md                    # Project documentation
```

## Key Files

- **`src/extension.ts`**: Contains all extension logic including:
  - Completion providers for import flags, keywords, patterns
  - Hover providers for documentation
  - Rule name discovery and completion
  
- **`syntaxes/omg.tmLanguage.json`**: TextMate grammar defining:
  - Syntax highlighting rules
  - Token scopes and patterns
  - Import flag recognition (including `word-prefix`, `word-suffix`)
  
- **`language-configuration.json`**: VS Code language features:
  - Comment definitions (`#`)
  - Bracket matching
  - Auto-closing pairs

## Adding New Features

### Adding Completion Items

Edit `src/extension.ts` and modify the `completionProvider`:

```typescript
// Add new completion items
const newItems = ['new-flag', 'another-option'];
newItems.forEach(item => {
    const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Enum);
    completionItem.documentation = 'Description of the new item';
    completions.push(completionItem);
});
```

### Adding Syntax Highlighting

Edit `syntaxes/omg.tmLanguage.json` and add new patterns:

```json
{
    "name": "new.element.omg",
    "match": "\\b(new-keyword)\\b",
    "captures": {
        "1": { "name": "keyword.new.omg" }
    }
}
```

### Testing Changes

1. Make your changes
2. Run `npm run compile` or have watch mode running
3. Press `F5` to launch Extension Development Host
4. Test with files in the `examples/` directory
5. Reload the window (`Ctrl+R`) to see changes

## Distribution

The built `.vsix` file can be:
- Installed locally: `code --install-extension omg-language-support-0.0.1.vsix`
- Shared with users for manual installation
- Published to VS Code Marketplace (requires publisher account)

## Troubleshooting

### Common Issues

- **Compilation errors**: Run `npm run compile` to see TypeScript errors
- **Extension not loading**: Check VS Code Developer Console (`Help > Toggle Developer Tools`)
- **Syntax highlighting not working**: Verify TextMate grammar syntax in `syntaxes/omg.tmLanguage.json`
- **Completion not triggering**: Check trigger characters in completion provider registration

### Debug Mode

Use VS Code's built-in debugging:
1. Set breakpoints in `src/extension.ts`
2. Press `F5` to launch Extension Development Host in debug mode
3. Use the Debug Console to inspect variables and execution flow
