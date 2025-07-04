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
	const omgSelector: vscode.DocumentSelector = { scheme: 'file', language: 'omg' };

	// Hover provider for import flags and keywords
	const hoverProvider = vscode.languages.registerHoverProvider(omgSelector, {
		provideHover(document, position, token) {
			const range = document.getWordRangeAtPosition(position);
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

			if (flagDescriptions[word]) {
				return new vscode.Hover(`**${word}**: ${flagDescriptions[word]}`);
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
				ruleNames.forEach(ruleName => {
					const item = new vscode.CompletionItem(ruleName, vscode.CompletionItemKind.Variable);
					item.detail = 'Rule Reference';
					item.documentation = `Reference to rule: ${ruleName}`;
					item.insertText = `${ruleName}]]`;
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
		'uses': 'Specifies which resolver method to use'
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

// This method is called when your extension is deactivated
export function deactivate() {}
