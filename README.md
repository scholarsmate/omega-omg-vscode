# OMG Language Support

A Visual Studio Code extension that provides syntax highlighting and language support for OMG (Object Matching Grammar) files.

## Features

- **Syntax Highlighting**: Full syntax highlighting for OMG language files (`.omg`)
- **Code Completion**: Intelligent autocomplete for:
  - **Import flags**: `word-boundary`, `word-prefix`, `word-suffix`, `ignore-case`, `ignore-punctuation`, `elide-whitespace`
  - **Keywords**: `version`, `import`, `as`, `with`, `resolver`, `default`, `uses`
  - **Escape sequences**: `\d`, `\D`, `\s`, `\S`, `\w`, `\W`, `\b`, `\B`
  - **Rule references**: Autocomplete for defined rules in `[[...]]` syntax
  - **Pattern snippets**: Pre-built patterns for common constructs
  - **Resolver flags**: Flags for resolver configuration
- **Hover Support**: Detailed documentation for import flags and keywords
- **Language Features**: 
  - Comment highlighting (`#` comments)
  - String literal highlighting
  - Pattern matching syntax
  - Rule definitions
  - Named captures and groups
  - Quantifiers and ranges
  - Character classes and escapes

## Language Elements Supported

- Version declarations (`version 1.0`)
- Import statements with flags (`import "file.txt" as name with word-prefix, word-suffix`)
- Rule definitions (`rule_name = pattern`)
- Resolver statements (`resolver default uses method`)
- Pattern expressions with quantifiers, groups, and alternatives
- List matches (`[[list_name]]`) with optional filters
- Named captures (`(?P<name>pattern)`)
- Character classes (`[a-zA-Z]`)
- Anchors (`^` and `$`)
- Escape sequences (`\d`, `\w`, `\s`, etc.)

## Requirements

- Visual Studio Code 1.100.0 or higher

## Installation

1. Clone or download this extension
2. Open the extension folder in VS Code
3. Press `F5` to launch a new Extension Development Host window
4. Open a `.omg` file to see syntax highlighting in action

## Quick Start for Developers

**Build and install locally:**
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Install for testing
npm run install-local
```

**Test with example files:**
```bash
# Open example OMG files to test syntax highlighting
code examples/sample.omg
code examples/completion-test.omg
```

**Development workflow:**
```bash
# Watch mode for continuous development
npm run watch

# Clean build artifacts
npm run clean

# Prepare for release
npm run release
```

All build operations use npm scripts for cross-platform compatibility.

## Usage

Create a file with the `.omg` extension and start writing OMG patterns. The extension will automatically provide syntax highlighting and code completion. Check the [`examples/`](examples/) directory for sample OMG files demonstrating various language features.

### Code Completion Features:

1. **Import Flag Completion**: Type `with ` after an import statement and press `Ctrl+Space`
2. **Keyword Completion**: Start typing at the beginning of a line and press `Ctrl+Space`
3. **Escape Sequence Completion**: Type `\` and press `Ctrl+Space`
4. **Rule Reference Completion**: Type `[[` and press `Ctrl+Space` to see available rules
5. **Pattern Snippets**: Type `rule_name = ` and press `Ctrl+Space` for pattern templates

Example (see [`examples/sample.omg`](examples/sample.omg) for more):
```omg
version 1.0

import "names.txt" as names with word-prefix, word-suffix
import "locations.txt" as places with word-boundary

person_pattern = [[names]] " lives in " [[places]]
```

### Completion Triggers:
- **Space** - After keywords like `with`, `uses`
- **Comma** - For multiple flags/parameters
- **Backslash** - For escape sequences
- **Opening bracket** - For rule references (`[[`)

## Developer Instructions

> **Cross-Platform Development**: All command-line instructions work in any terminal environment. On Windows, you can use PowerShell, Command Prompt, Git Bash, or WSL. The npm commands are consistent across all platforms.

### Prerequisites

Before building the extension, ensure you have the following installed:
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** package manager (included with Node.js)
- **Visual Studio Code** - [Download here](https://code.visualstudio.com/)

### Setting Up the Development Environment

1. **Clone or download the repository:**
   ```bash
   git clone <repository-url>
   cd omg_syntax
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install the Visual Studio Code Extension Manager (vsce) globally:**
   ```bash
   npm install -g @vscode/vsce
   ```

### Building the Extension

#### Quick Build with npm scripts

The project includes convenient npm scripts for building:

```bash
# Compile TypeScript and build the extension
npm run compile

# Package the extension into a .vsix file
npm run vsix

# Build and package in one command
npm run build

# Clean previous builds
npm run clean
```

#### Manual step-by-step build

1. **Clean previous builds:**
   ```bash
   rm -rf out *.vsix
   ```

2. **Compile TypeScript:**
   ```bash
   npx tsc -p ./
   ```

3. **Bundle with webpack** (for optimized builds):
   ```bash
   npx webpack --mode production
   ```

4. **Package the extension:**
   ```bash
   npx vsce package
   ```

### Development Workflow

1. **Make changes** to the source code (`src/extension.ts`, `syntaxes/omg.tmLanguage.json`, etc.)

2. **Test changes** by pressing `F5` to launch Extension Development Host:
   - Opens a new VS Code window with your extension loaded
   - Open a `.omg` file to test syntax highlighting and completion

3. **Use VS Code tasks** for quick building:
   - Press `Ctrl+Shift+P` → "Tasks: Run Task" → "Build OMG Extension"
   - Or use the keyboard shortcut `Ctrl+Shift+B`

4. **Available npm scripts:**
   ```bash
   npm run compile      # Compile TypeScript with webpack
   npm run watch        # Watch mode for continuous compilation
   npm run build        # Full build (compile + package)
   npm run test         # Run tests with linting
   npm run clean        # Clean build artifacts
   npm run release      # Prepare release package
   ```

5. **Version management:**
   ```bash
   npm run version:patch    # Increment patch version
   npm run version:minor    # Increment minor version
   npm run version:major    # Increment major version
   ```

6. **Publishing:**
   ```bash
   npm run publish:patch    # Version bump + publish (patch)
   npm run publish:minor    # Version bump + publish (minor)
   npm run publish:major    # Version bump + publish (major)
   ```

### Installing the Built Extension

After building, you'll have a `.vsix` file (e.g., `omg-language-support-0.0.1.vsix`).

#### Via Command Line:
```bash
code --install-extension omg-language-support-0.0.1.vsix
```

#### Via VS Code UI:
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X`)
3. Click the "..." menu in the Extensions view
4. Select "Install from VSIX..."
5. Choose your `.vsix` file

### Version Management and Publishing

The extension includes comprehensive version management and publishing tools:

#### Quick Version Updates:
```bash
# Update version numbers
npm run version:patch    # 0.0.1 → 0.0.2 (bug fixes)
npm run version:minor    # 0.1.0 → 0.2.0 (new features)
npm run version:major    # 1.0.0 → 2.0.0 (breaking changes)
```

#### One-Command Publishing:
```bash
# Update version and publish in one step
npm run publish:patch    # Increment patch version and publish
npm run publish:minor    # Increment minor version and publish  
npm run publish:major    # Increment major version and publish
```

#### Publishing with npm scripts:

```bash
# Check status and prepare release
npm run release

# Publish with version increment
npm run publish:patch    # Bug fixes
npm run publish:minor    # New features  
npm run publish:major    # Breaking changes

# Manual version control
npm run version:patch    # Just bump version
npm run publish          # Publish current version
```

#### Publishing Setup (First Time Only):

1. **Create Publisher Account:**
   - Visit [VS Code Marketplace](https://marketplace.visualstudio.com/manage)
   - Create a publisher account

2. **Get Personal Access Token:**
   - Go to [Azure DevOps](https://dev.azure.com/)
   - Create a Personal Access Token with Marketplace permissions

3. **Login with vsce:**
   ```bash
   npm run publish
   # or
   vsce login <publisher-name>
   ```

4. **Update Publisher in package.json:**
   ```json
   {
     "publisher": "your-publisher-name"
   }
   ```

#### Publishing Workflow:

The npm publishing scripts automatically:
- ✅ **Run linting** and tests
- ✅ **Update version** number in package.json
- ✅ **Build optimized package** with webpack
- ✅ **Create .vsix file**
- ✅ **Publish to marketplace**
- ✅ **Provide marketplace link**

### Automated Publishing with GitHub Actions

This repository includes comprehensive GitHub Actions workflows for automated CI/CD:

- **🚀 Automatic releases** when version tags are pushed
- **📦 VS Code Marketplace publishing** with proper authentication  
- **🧪 Pre-release versions** for testing (alpha/beta/rc)
- **🔍 Continuous integration** with linting and testing
- **🛡️ Security scanning** and dependency monitoring

**Quick Release:**
```bash
git tag v1.0.0
git push origin v1.0.0
# Automatically creates GitHub release AND publishes to marketplace
```

See [`.github/ACTIONS_SETUP.md`](.github/ACTIONS_SETUP.md) for detailed setup instructions and workflow documentation.

### Project Structure

```
omg_syntax/
├── src/
│   ├── extension.ts              # Main extension logic with completion providers
│   └── test/
│       └── extension.test.ts     # Unit tests
├── scripts/
│   └── install-local.js          # Local installation helper
├── syntaxes/
│   └── omg.tmLanguage.json      # TextMate grammar for syntax highlighting
├── language-configuration.json   # Language configuration (brackets, comments)
├── package.json                 # Extension manifest and dependencies
├── tsconfig.json                # TypeScript configuration
├── webpack.config.js            # Webpack bundling configuration
├── DEVELOPER.md                 # Detailed developer documentation
├── *.omg                        # Test files for development
└── README.md                    # This file
```

### Debugging the Extension

1. **Open the project** in VS Code
2. **Set breakpoints** in `src/extension.ts`
3. **Press F5** to launch Extension Development Host
4. **Open a `.omg` file** in the new window to trigger the extension
5. **Check the Debug Console** for output and errors

### Troubleshooting Build Issues

**Common Problems and Solutions:**

- **"vsce: command not found"**
  ```bash
  npm install -g @vscode/vsce
  ```

- **TypeScript compilation errors**
  ```bash
  npm run compile
  # Fix any reported errors in src/extension.ts
  ```

- **Missing dependencies**
  ```bash
  rm -rf node_modules
  npm install
  ```

- **Extension not loading in Development Host**
  - Check VS Code Developer Tools (`Help` → `Toggle Developer Tools`)
  - Look for errors in the Console tab
  - Verify `package.json` has correct `activationEvents`

- **Command not found errors**
  ```bash
  # For Node.js on Linux
  sudo apt install nodejs npm  # Ubuntu/Debian
  
  # For Node.js on macOS
  brew install node           # macOS with Homebrew
  
  # For vsce (all platforms)
  npm install -g @vscode/vsce
  ```

- **npm command failures**
  - Ensure you're in the correct directory (`cd d:\omgseek\omg_syntax`)
  - Try clearing npm cache: `npm cache clean --force`
  - Reinstall dependencies: `Remove-Item node_modules -Recurse -Force && npm install`

**Verifying the Build:**

After building, verify the `.vsix` file contains:
- Compiled JavaScript files in `out/` directory
- Grammar files in `syntaxes/` directory
- `package.json` with correct metadata
- Language configuration files
- All necessary assets

### Performance Considerations

- The extension uses **webpack** for bundling to reduce file size
- **Lazy loading** is implemented for completion providers
- **Regex patterns** in the grammar are optimized for performance
- **Rule discovery** is cached to avoid repeated file parsing

## Extension Settings

This extension does not currently contribute any VS Code settings through `contributes.configuration`. All functionality works out of the box with default configurations.

**Default Behaviors:**
- Syntax highlighting is automatically enabled for `.omg` files
- Code completion triggers on space, comma, backslash, and bracket characters
- Hover documentation appears when hovering over import flags and keywords
- File associations are automatically configured for `.omg` extension

If you need to customize the extension behavior, you can modify the standard VS Code editor settings that affect all language extensions:

- `editor.quickSuggestions` - Controls when quick suggestions show
- `editor.suggestOnTriggerCharacters` - Enable/disable completion triggers
- `editor.hover.enabled` - Enable/disable hover information

## Known Issues

- **Rule reference completion**: Currently only discovers rules defined in the same file. Cross-file rule references are not yet supported.
- **Import file validation**: The extension does not validate that imported files exist or contain valid content.
- **Syntax error detection**: Real-time syntax error detection and reporting is not implemented.
- **Symbol navigation**: Go-to-definition and find-all-references for rules are not yet available.

**Reporting Issues:**
If you encounter bugs or have feature requests, please file an issue with:
- VS Code version
- Extension version
- Sample `.omg` file that reproduces the issue
- Expected vs. actual behavior

## Release Notes

### 0.0.1 (Current)

**Initial Release Features:**
- ✅ Complete syntax highlighting for OMG language
- ✅ Intelligent code completion for import flags, keywords, and patterns
- ✅ Hover documentation for language elements
- ✅ Support for all OMG language constructs including `word-prefix` and `word-suffix` flags
- ✅ TextMate grammar with comprehensive pattern matching
- ✅ Language configuration for brackets, comments, and auto-closing pairs
- ✅ Build system with webpack bundling and automated packaging

**Import Flags Supported:**
- `word-boundary` - Match at word boundaries
- `word-prefix` - Match at word prefixes  
- `word-suffix` - Match at word suffixes
- `ignore-case` - Case-insensitive matching
- `ignore-punctuation` - Ignore punctuation in matches
- `elide-whitespace` - Collapse whitespace in matches

**Language Elements:**
- Version declarations (`version 1.0`)
- Import statements with multiple flag support
- Rule definitions with pattern expressions
- Resolver configurations (`resolver default uses method`)
- List matches with optional filters (`[[name:filter]]`)
- Named captures (`(?P<name>pattern)`)
- Character classes and escape sequences
- Quantifiers and grouping constructs

---

## Following extension guidelines

This extension follows the VS Code extension best practices and guidelines.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
