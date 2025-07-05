// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// OMG language constants
const IMPORT_FLAGS = [
	'word-boundary',
	'word-prefix', 
	'word-suffix',
	'ignore-case',
	'ignore-punctuation',
	'elide-whitespace'
];

const RESOLVER_FLAGS = [
	'ignore-case',
	'ignore-punctuation',
	'optional-tokens'
];

const KEYWORDS = [
	'version',
	'import',
	'as',
	'with',
	'resolver',
	'default',
	'uses'
];

const ESCAPE_SEQUENCES = [
	'\\d', '\\D', '\\s', '\\S', '\\w', '\\W', '\\b', '\\B'
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('OMG Language Support extension is now active!');

	// Register language features for OMG files
	const omgSelector: vscode.DocumentSelector = { scheme: 'file', language: 'omg' };		// Hover provider for import flags and keywords
	const hoverProvider = vscode.languages.registerHoverProvider(omgSelector, {
		provideHover(document, position, token) {
			// Get the line text and character at position
			const line = document.lineAt(position).text;
			const charAtPosition = line.charAt(position.character);
			const prevChar = position.character > 0 ? line.charAt(position.character - 1) : '';
			
			// Handle escape sequences like \d, \w, etc.
			// Find all escape sequences on the line and check if cursor is on one of them
			const escapeRegex = /\\[a-zA-Z]/g;
			let escapeMatch;
			while ((escapeMatch = escapeRegex.exec(line)) !== null) {
				const startPos = escapeMatch.index;
				const endPos = escapeMatch.index + escapeMatch[0].length;
				
				if (position.character >= startPos && position.character < endPos) {
					const escapeSeq = escapeMatch[0];
					const escapeDoc = getEscapeDocumentation(escapeSeq);
					if (escapeDoc) {
						return new vscode.Hover(`**${escapeSeq}**: ${escapeDoc}`);
					}
				}
			}

			// Check for quantifiers like {2,5}, +, *, ?
			// Find all quantifiers on the line and check if cursor is on one of them
			const quantifierRegex = /\{(\d+)(,(\d+)?)?\}/g;
			let quantifierMatch;
			while ((quantifierMatch = quantifierRegex.exec(line)) !== null) {
				const startPos = quantifierMatch.index;
				const endPos = quantifierMatch.index + quantifierMatch[0].length;
				
				if (position.character >= startPos && position.character < endPos) {
					const min = quantifierMatch[1];
					const max = quantifierMatch[3];
					if (max) {
						return new vscode.Hover(`**{${min},${max}}**: Matches between ${min} and ${max} occurrences of the preceding element`);
					} else if (quantifierMatch[0].includes(',')) {
						return new vscode.Hover(`**{${min},}**: Matches ${min} or more occurrences of the preceding element`);
					} else {
						return new vscode.Hover(`**{${min}}**: Matches exactly ${min} occurrences of the preceding element`);
					}
				}
			}

			// Check for single character quantifiers (OMG only supports ? since + and * are open-ended)
			if (charAtPosition === '?') {
				return new vscode.Hover(`**?**: Matches zero or one occurrence of the preceding element (makes it optional)`);
			}

			// Check for quoted strings - determine context to show appropriate hover
			const quotedStringRegex = /"[^"]*"/g;
			let quotedMatch;
			while ((quotedMatch = quotedStringRegex.exec(line)) !== null) {
				const startPos = quotedMatch.index;
				const endPos = quotedMatch.index + quotedMatch[0].length;
				
				if (position.character >= startPos && position.character < endPos) {
					const quotedText = quotedMatch[0];
					const currentLine = line.trim();
					
					// Check context to determine what type of quoted string this is
					if (currentLine.startsWith('import ') && currentLine.includes(quotedText)) {
						return new vscode.Hover(`**Import Filename**: ${quotedText}\n\nSpecifies the external file to import as a match list`);
					} else if (currentLine.includes('optional-tokens') && currentLine.includes(quotedText)) {
						return new vscode.Hover(`**Optional Tokens Filename**: ${quotedText}\n\nSpecifies the external file containing tokens that are optional during resolution`);
					} else {
						// This is a string literal in a pattern
						return new vscode.Hover(`**String Literal**: Matches the exact text ${quotedText}`);
					}
				}
			}

			// Check for match list references in [[...]] syntax
			if (line.includes('[[')) {
				// Find all [[...]] patterns on the line and check if cursor is on one of them
				const bracketRegex = /\[\[([^\]]+)\]\]/g;
				let match;
				while ((match = bracketRegex.exec(line)) !== null) {
					const matchListName = match[1];
					const startPos = match.index; // Position at start of '[['
					const endPos = match.index + match[0].length; // Position after ']]'
					
					// Check if cursor is within this specific match list reference (including brackets)
					if (position.character >= startPos && position.character < endPos) {
						const matchLists = getMatchListNames(document);
						if (matchLists.includes(matchListName)) {
							const importLine = findImportForMatchList(document, matchListName);
							if (importLine !== -1) {
								const importStatement = document.lineAt(importLine).text.trim();
								return new vscode.Hover(`**Match List: [[${matchListName}]]**\n\nReferences the imported list '${matchListName}'\n\nImported on line ${importLine + 1}: \`${importStatement}\``);
							} else {
								return new vscode.Hover(`**Match List: [[${matchListName}]]**\n\nReferences the imported list '${matchListName}'`);
							}
						} else {
							return new vscode.Hover(`**Match List: [[${matchListName}]]**\n\n⚠️ Warning: Match list '${matchListName}' is not defined in any import statement`);
						}
					}
				}
			}

			// For word-based checks, we need to extract the word at the cursor position
			// Use a custom word pattern to include hyphens
			const range = document.getWordRangeAtPosition(position, /[\w-]+/);
			if (!range) { return null; }
			const word = document.getText(range);

			// Provide hover information for import flags
			const flagDescriptions: { [key: string]: string } = {
				'word-boundary': 'Matches only at word boundaries (\\b)',
				'word-prefix': 'Matches at the beginning of words',
				'word-suffix': 'Matches at the end of words',
				'line-start': 'Matches start at the start of a line',
				'line-end': 'Matches end at the end of a line',
				'ignore-case': 'Case-insensitive matching',
				'ignore-punctuation': 'Ignores punctuation during matching',
				'elide-whitespace': 'Removes whitespace before matching'
			};

			// Provide hover information for keywords
			const keywordDescriptions: { [key: string]: string } = {
				'version': 'Declares the OMG file format version (e.g., version 1.0)',
				'import': 'Imports an external file as a named list for pattern matching',
				'as': 'Assigns a name to an imported file',
				'with': 'Specifies flags for import or resolver statements',
				'resolver': 'Configures how patterns are resolved and processed',
				'default': 'Specifies the default resolver configuration',
				'uses': 'Specifies which resolver method to use'
			};

			// Check for resolver flags
			const resolverFlagDoc = getResolverFlagDocumentation(word);
			if (resolverFlagDoc) {
				return new vscode.Hover(`**${word}**: ${resolverFlagDoc}`);
			}

			// Check for resolution algorithms (word after 'uses')
			const currentLine = line.trim();
			if (currentLine.includes('uses ')) {
				const usesPattern = /uses\s+([a-zA-Z0-9_-]+)/;
				const usesMatch = currentLine.match(usesPattern);
				if (usesMatch && usesMatch[1] === word) {
					const algorithm = usesMatch[1];
					return new vscode.Hover(`**Resolution Algorithm: ${algorithm}**\n\nSpecifies the algorithm used for pattern resolution and matching`);
				}
			}

			// Check for import alias names (word after 'as')
			if (currentLine.startsWith('import ') && currentLine.includes(' as ')) {
				const asPattern = /import\s+"[^"]+"\s+as\s+([a-zA-Z0-9_]+)/;
				const asMatch = currentLine.match(asPattern);
				if (asMatch && asMatch[1] === word) {
					const aliasName = asMatch[1];
					const filenameMatch = currentLine.match(/import\s+"([^"]+)"/);
					const filename = filenameMatch ? filenameMatch[1] : 'unknown';
					return new vscode.Hover(`**Import Alias: ${aliasName}**\n\nAlias name for the imported list from "${filename}"\n\nUse in patterns as [[${aliasName}]]`);
				}
			}

			// Check for import flags
			if (flagDescriptions[word]) {
				return new vscode.Hover(`**${word}**: ${flagDescriptions[word]}`);
			}

			// Check for keywords
			if (keywordDescriptions[word]) {
				return new vscode.Hover(`**${word}**: ${keywordDescriptions[word]}`);
			}

			// Check for rule names (rule definitions only, not match lists)
			const ruleNames = getRuleNames(document);
			if (ruleNames.includes(word)) {
				// Find the line where this rule is defined
				const ruleDefinitionLine = findRuleDefinition(document, word);
				if (ruleDefinitionLine !== -1) {
					const ruleLine = document.lineAt(ruleDefinitionLine).text;
					const rulePattern = ruleLine.substring(ruleLine.indexOf('=') + 1).trim();
					// Truncate long patterns for display
					const displayPattern = rulePattern.length > 50 ? rulePattern.substring(0, 50) + '...' : rulePattern;
					return new vscode.Hover(`**Rule: ${word}**\n\nPattern: \`${displayPattern}\`\n\nDefined on line ${ruleDefinitionLine + 1}`);
				} else {
					return new vscode.Hover(`**Rule: ${word}**\n\nRule reference - click to go to definition`);
				}
			}

			return null;
		}
	});

	// Completion provider for OMG language elements
	const completionProvider = vscode.languages.registerCompletionItemProvider(omgSelector, {
		provideCompletionItems(document, position, token, context) {
			const line = document.lineAt(position).text;
			const beforeCursor = line.substring(0, position.character);
			
			const completions: vscode.CompletionItem[] = [];

			// Import flag completions
			if (beforeCursor.includes('with ') || beforeCursor.includes(', ')) {
				IMPORT_FLAGS.forEach(flag => {
					const item = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Enum);
					item.detail = 'Import Flag';
					item.documentation = getImportFlagDocumentation(flag);
					item.insertText = flag;
					completions.push(item);
				});
			}

			// Keyword completions
			if (beforeCursor.trim() === '' || /^\s*[a-zA-Z]*$/.test(beforeCursor)) {
				KEYWORDS.forEach(keyword => {
					const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
					item.detail = 'OMG Keyword';
					item.documentation = getKeywordDocumentation(keyword);
					completions.push(item);
				});
			}

			// Escape sequence completions
			if (beforeCursor.endsWith('\\')) {
				ESCAPE_SEQUENCES.forEach(escape => {
					const item = new vscode.CompletionItem(escape.substring(1), vscode.CompletionItemKind.Constant);
					item.detail = 'Escape Sequence';
					item.documentation = getEscapeDocumentation(escape);
					item.insertText = escape.substring(1); // Remove the backslash since it's already typed
					completions.push(item);
				});
			}

			// Resolver flag completions (for resolver statements)
			if (beforeCursor.includes('resolver') && (beforeCursor.includes('with ') || beforeCursor.includes(', '))) {
				RESOLVER_FLAGS.forEach(flag => {
					const item = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Enum);
					item.detail = 'Resolver Flag';
					item.documentation = getResolverFlagDocumentation(flag);
					completions.push(item);
				});
			}

			// Pattern snippets
			if (/^\s*[a-zA-Z0-9_]+\s*=\s*$/.test(beforeCursor)) {
				addPatternSnippets(completions);
			}

			// Rule reference completions (find defined rules in the document)
			const ruleNames = getRuleNames(document);
			if (beforeCursor.includes('[[') && !beforeCursor.includes(']]')) {
				// Add match list completions
				const matchLists = getMatchListNames(document);
				matchLists.forEach(matchListName => {
					const item = new vscode.CompletionItem(matchListName, vscode.CompletionItemKind.Variable);
					item.detail = 'Match List';
					item.documentation = `Reference to imported match list: ${matchListName}`;
					item.insertText = `${matchListName}]]`;
					completions.push(item);
				});
				
				// Add rule name completions
				ruleNames.forEach(ruleName => {
					const item = new vscode.CompletionItem(ruleName, vscode.CompletionItemKind.Variable);
					item.detail = 'Rule Reference';
					item.documentation = `Reference to rule: ${ruleName}`;
					item.insertText = `${ruleName}]]`;
					completions.push(item);
				});
			}

			// Resolution algorithm completions (after 'uses')
			if (beforeCursor.includes('uses ') && !beforeCursor.includes('resolver')) {
				const commonAlgorithms = ['default', 'custom', 'strict', 'fuzzy', 'weighted'];
				commonAlgorithms.forEach(algorithm => {
					const item = new vscode.CompletionItem(algorithm, vscode.CompletionItemKind.Method);
					item.detail = 'Resolution Algorithm';
					item.documentation = `${algorithm} resolution algorithm`;
					completions.push(item);
				});
			}

			return completions;
		}
	}, ' ', ',', '\\', '[');

	context.subscriptions.push(hoverProvider, completionProvider);
}

function getImportFlagDocumentation(flag: string): string {
	const docs: { [key: string]: string } = {
		'word-boundary': 'Matches only at word boundaries. Equivalent to \\b in regex.',
		'word-prefix': 'Matches patterns only at the beginning of words.',
		'word-suffix': 'Matches patterns only at the end of words.',
		'line-start': 'Matches patterns that start at the start of a line.',
		'line-end': 'Matches patterns at the end of a line.',
		'ignore-case': 'Performs case-insensitive pattern matching.',
		'ignore-punctuation': 'Ignores punctuation characters during matching.',
		'elide-whitespace': 'Removes whitespace before performing pattern matching.'
	};
	return docs[flag] || '';
}

function getKeywordDocumentation(keyword: string): string {
	const docs: { [key: string]: string } = {
		'version': 'Declares the OMG file format version (e.g., version 1.0)',
		'import': 'Imports an external file as a named list for pattern matching',
		'as': 'Assigns a name to an imported file',
		'with': 'Specifies flags for import or resolver statements',
		'resolver': 'Configures how patterns are resolved and processed',
		'default': 'Specifies the default resolver configuration',
		'uses': 'Specifies which resolver method to use',
		'optional-tokens': 'Specifies tokens that are optional during resolution'
	};
	return docs[keyword] || '';
}

function getEscapeDocumentation(escape: string): string {
	const docs: { [key: string]: string } = {
		'\\d': 'Matches any digit (0-9)',
		'\\D': 'Matches any non-digit character',
		'\\s': 'Matches any whitespace character',
		'\\S': 'Matches any non-whitespace character',
		'\\w': 'Matches any word character (a-z, A-Z, 0-9, _)',
		'\\W': 'Matches any non-word character',
		'\\b': 'Matches a word boundary',
		'\\B': 'Matches a non-word boundary'
	};
	return docs[escape] || '';
}

function getResolverFlagDocumentation(flag: string): string {
	const docs: { [key: string]: string } = {
		'ignore-case': 'Case-insensitive resolution',
		'ignore-punctuation': 'Ignores punctuation during resolution',
		'optional-tokens': 'Specifies tokens that are optional during resolution'
	};
	return docs[flag] || '';
}

function addPatternSnippets(completions: vscode.CompletionItem[]) {
	// List match snippet
	const listMatch = new vscode.CompletionItem('List Match', vscode.CompletionItemKind.Snippet);
	listMatch.insertText = new vscode.SnippetString('[[${1:listName}]]');
	listMatch.documentation = 'Insert a list match pattern';
	completions.push(listMatch);

	// Named capture snippet
	const namedCapture = new vscode.CompletionItem('Named Capture', vscode.CompletionItemKind.Snippet);
	namedCapture.insertText = new vscode.SnippetString('(?P<${1:name}>${2:pattern})');
	namedCapture.documentation = 'Insert a named capture group';
	completions.push(namedCapture);

	// Quantifier snippets
	const quantified = new vscode.CompletionItem('Quantified Pattern', vscode.CompletionItemKind.Snippet);
	quantified.insertText = new vscode.SnippetString('${1:pattern}{${2:min},${3:max}}');
	quantified.documentation = 'Insert a quantified pattern with min/max range';
	completions.push(quantified);

	// Character class snippet
	const charClass = new vscode.CompletionItem('Character Class', vscode.CompletionItemKind.Snippet);
	charClass.insertText = new vscode.SnippetString('[${1:a-zA-Z0-9}]');
	charClass.documentation = 'Insert a character class pattern';
	completions.push(charClass);

	// Anchored pattern snippet
	const anchored = new vscode.CompletionItem('Anchored Pattern', vscode.CompletionItemKind.Snippet);
	anchored.insertText = new vscode.SnippetString('^${1:pattern}$');
	anchored.documentation = 'Insert an anchored pattern (line start to end)';
	completions.push(anchored);
}

function getRuleNames(document: vscode.TextDocument): string[] {
	const ruleNames: string[] = [];
	const ruleRegex = /^([a-zA-Z0-9_.]+)\s*=/gm;
	
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text;
		const match = ruleRegex.exec(line);
		if (match) {
			ruleNames.push(match[1]);
		}
		ruleRegex.lastIndex = 0; // Reset regex for next line
	}
	
	return ruleNames;
}

function findRuleDefinition(document: vscode.TextDocument, ruleName: string): number {
	const ruleRegex = new RegExp(`^\\s*${ruleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'gm');
	
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text;
		if (ruleRegex.test(line)) {
			return i;
		}
		ruleRegex.lastIndex = 0; // Reset regex for next line
	}
	
	return -1; // Not found
}

function getMatchListNames(document: vscode.TextDocument): string[] {
	const matchLists: string[] = [];
	const importRegex = /import\s+"[^"]+"\s+as\s+([a-zA-Z0-9_]+)/g;
	
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text;
		let match;
		while ((match = importRegex.exec(line)) !== null) {
			matchLists.push(match[1]);
		}
		importRegex.lastIndex = 0; // Reset regex for next line
	}
	
	return matchLists;
}

function findImportForMatchList(document: vscode.TextDocument, matchListName: string): number {
	const importRegex = new RegExp(`import\\s+"[^"]+"\\s+as\\s+${matchListName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
	
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text;
		if (importRegex.test(line)) {
			return i;
		}
		importRegex.lastIndex = 0; // Reset regex for next line
	}
	
	return -1; // Not found
}

// This method is called when your extension is deactivated
export function deactivate() {}
