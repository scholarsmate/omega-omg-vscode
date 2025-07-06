// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OMGLanguageService } from './omg-language-service';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('OMG Language Support extension is now active!');

	// Initialize the language service
	const languageService = new OMGLanguageService();

	// Register language features for OMG files
	const omgSelector: vscode.DocumentSelector = { scheme: 'file', language: 'omg' };

	// Register diagnostics collection
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('omg');
	context.subscriptions.push(diagnosticCollection);

	// Update diagnostics when document changes
	const updateDiagnostics = (document: vscode.TextDocument) => {
		if (document.languageId === 'omg') {
			try {
				console.log(`Updating diagnostics for ${document.uri.fsPath}`);
				const diagnostics = languageService.provideDiagnostics(document);
				console.log(`Generated ${diagnostics.length} diagnostics`);
				diagnosticCollection.set(document.uri, diagnostics);
			} catch (error) {
				console.error('Error updating diagnostics:', error);
			}
		}
	};

	// Update diagnostics on document changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
		vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
		vscode.workspace.onDidSaveTextDocument(updateDiagnostics),
		vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri))
	);

	// Update diagnostics for all open OMG documents
	vscode.workspace.textDocuments.forEach(updateDiagnostics);

	// Force diagnostics update for the active editor if it's an OMG file
	if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'omg') {
		updateDiagnostics(vscode.window.activeTextEditor.document);
	}

	// Hover provider - uses the language service for all hover functionality
	const hoverProvider = vscode.languages.registerHoverProvider(omgSelector, {
		provideHover(document, position, token) {
			return languageService.provideHover(document, position);
		}
	});

	// Completion provider using the parser
	const completionProvider = vscode.languages.registerCompletionItemProvider(omgSelector, {
		provideCompletionItems(document, position, token, context) {
			try {
				return languageService.provideCompletionItems(document, position);
			} catch (error) {
				console.error('Error in completion provider:', error);
				return [];
			}
		}
	}, '.', '"', '[', '(', '{', '\\');

	// Definition provider using the parser
	const definitionProvider = vscode.languages.registerDefinitionProvider(omgSelector, {
		provideDefinition(document, position, token) {
			try {
				return languageService.provideDefinition(document, position);
			} catch (error) {
				console.error('Error in definition provider:', error);
				return undefined;
			}
		}
	});

	// Reference provider using the parser
	const referenceProvider = vscode.languages.registerReferenceProvider(omgSelector, {
		provideReferences(document, position, context, token) {
			try {
				return languageService.provideReferences(document, position);
			} catch (error) {
				console.error('Error in reference provider:', error);
				return [];
			}
		}
	});

	// Register all providers
	context.subscriptions.push(
		hoverProvider,
		completionProvider,
		definitionProvider,
		referenceProvider
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}