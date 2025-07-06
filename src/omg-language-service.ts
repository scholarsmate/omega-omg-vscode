/**
 * OMG Language Service
 * Provides advanced language features using the OMG parser
 */

import * as vscode from 'vscode';
import { OMGParser, ASTNode, ParseResult } from './omg-parser';
import {
    KEYWORDS,
    IMPORT_FLAGS,
    RESOLVER_FLAGS,
    ESCAPE_SEQUENCES,
    QUANTIFIERS,
    isKeyword,
    isImportFlag,
    isResolverFlag,
    isEscapeSequence,
    getKeywordDocumentation,
    getImportFlagDocumentation,
    getResolverFlagDocumentation,
    getEscapeSequenceDocumentation
} from './omg-constants';

export interface OMGDocument {
    uri: vscode.Uri;
    text: string;
    version: number;
    ast: ASTNode;
    errors: vscode.Diagnostic[];
}

export class OMGLanguageService {
    private documents: Map<string, OMGDocument> = new Map();
    private parser: OMGParser;

    constructor() {
        this.parser = new OMGParser('');
    }

    public updateDocument(document: vscode.TextDocument): OMGDocument {
        const uri = document.uri.toString();
        const text = document.getText();
        const version = document.version;

        // Parse the document
        this.parser = new OMGParser(text);
        const parseResult = this.parser.parse();

        // Convert parse errors to diagnostics
        const errors = parseResult.errors.map(error => 
            new vscode.Diagnostic(
                new vscode.Range(
                    error.line - 1, 
                    error.column - 1,
                    error.line - 1,
                    error.column - 1 + error.length
                ),
                error.message,
                vscode.DiagnosticSeverity.Error
            )
        );

        const omgDocument: OMGDocument = {
            uri: document.uri,
            text,
            version,
            ast: parseResult.ast,
            errors
        };

        this.documents.set(uri, omgDocument);
        return omgDocument;
    }

    public getDocument(uri: vscode.Uri): OMGDocument | undefined {
        return this.documents.get(uri.toString());
    }

    public provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        try {
            const omgDoc = this.updateDocument(document);
            const line = position.line + 1; // Convert to 1-based
            const column = position.character + 1; // Convert to 1-based

            // Try AST-based hover first
            const node = OMGParser.findNodeAt(omgDoc.ast, line, column);
            if (node) {
                const hoverText = this.getHoverText(node, omgDoc.text);
                if (hoverText) {
                    return new vscode.Hover(hoverText);
                }
            }

            // Fall back to regex-based hover for reliability
            return this.provideRegexBasedHover(document, position);
        } catch (error) {
            console.error('Error in provideHover:', error);
            // Always fall back to regex-based hover if AST fails
            return this.provideRegexBasedHover(document, position);
        }
    }

    private provideRegexBasedHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        // Get the line text and character at position
        const line = document.lineAt(position).text;
        const charAtPosition = line.charAt(position.character);
        
        // Handle named captures (?P<name>...)
        const namedCaptureRegex = /\(\?P<([^>]+)>/g;
        let namedCaptureMatch;
        while ((namedCaptureMatch = namedCaptureRegex.exec(line)) !== null) {
            const startPos = namedCaptureMatch.index;
            const endPos = namedCaptureMatch.index + namedCaptureMatch[0].length;
            
            if (position.character >= startPos && position.character < endPos) {
                const captureName = namedCaptureMatch[1];
                
                // Check if hovering over different parts
                const nameStartPos = startPos + 4; // after "(?P<"
                const nameEndPos = nameStartPos + captureName.length;
                
                if (position.character >= nameStartPos && position.character < nameEndPos) {
                    return new vscode.Hover(`**Named Capture Name**: "${captureName}"\n\nThis capture will store the matched text under the name "${captureName}" for later reference in processing results.`);
                } else {
                    return new vscode.Hover(`**Named Capture Syntax**: \`(?P<${captureName}>...)\`\n\nCaptures the matched pattern and stores it with the name "${captureName}". The captured text can be referenced by name in processing results.`);
                }
            }
        }
        
        // Handle escape sequences like \d, \w, etc.
        const escapeRegex = /\\[a-zA-Z]/g;
        let escapeMatch;
        while ((escapeMatch = escapeRegex.exec(line)) !== null) {
            const startPos = escapeMatch.index;
            const endPos = escapeMatch.index + escapeMatch[0].length;
            
            if (position.character >= startPos && position.character < endPos) {
                const escapeSeq = escapeMatch[0];
                return new vscode.Hover(`**${escapeSeq}**: ${getEscapeSequenceDocumentation(escapeSeq)}`);
            }
        }

        // Check for quantifiers like {2,5}, +, *, ?
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

        // Check for quoted strings FIRST - determine context to show appropriate hover
        const quotedStringRegex = /"[^"]*"/g;
        let quotedMatch;
        while ((quotedMatch = quotedStringRegex.exec(line)) !== null) {
            const startPos = quotedMatch.index;
            const endPos = quotedMatch.index + quotedMatch[0].length;
            
            if (position.character >= startPos && position.character <= endPos) {
                const quotedString = quotedMatch[0];
                
                // Check if this is in an import statement context
                if (line.includes('import') && line.includes('as')) {
                    if (line.indexOf('import') < startPos) {
                        const filePath = this.extractFilePath(quotedString);
                        const fileExistsInfo = this.getFileExistenceInfo(document.uri, filePath);
                        return new vscode.Hover(`**Import Path**: ${quotedString} - Path to the file or resource being imported${fileExistsInfo}`);
                    }
                }
                
                // Check if this is in a resolver context
                if (line.includes('uses') || line.includes('resolver')) {
                    // Check if this is specifically an optional-tokens file
                    if (line.includes('optional-tokens')) {
                        const filePath = this.extractFilePath(quotedString);
                        const fileExistsInfo = this.getFileExistenceInfo(document.uri, filePath);
                        return new vscode.Hover(`**Optional-Tokens File**: ${quotedString} - File containing optional tokens for pattern matching${fileExistsInfo}`);
                    }
                    return new vscode.Hover(`**Configuration Value**: ${quotedString} - Configuration parameter for the resolver`);
                }
                
                // Default string literal
                return new vscode.Hover(`**String Literal**: ${quotedString} - Matches the exact text content`);
            }
        }

        // Check for single character quantifiers
        if (charAtPosition === '?') {
            return new vscode.Hover(`**?**: Matches zero or one occurrence of the preceding element (makes it optional)`);
        }
        
        // Check for invalid quantifiers that are not allowed in OMG
        if (charAtPosition === '+') {
            // Check if we're not inside a character class
            if (!this.isInsideCharacterClass(line, position.character)) {
                return new vscode.Hover(`**(Invalid)**: Open-ended '+' quantifier not allowed in OMG. Use bounded quantifiers like {1,10} instead.`);
            }
        }
        
        if (charAtPosition === '*') {
            // Check if we're notinside a character class
            if (!this.isInsideCharacterClass(line, position.character)) {
                return new vscode.Hover(`**(Invalid)**: Open-ended '*' quantifier not allowed in OMG. Use bounded quantifiers like {0,10} instead.`);
            }
        }

        // Check for match lists [[...]]
        const matchListRegex = /\[\[([^\]]+)\]\]/g;
        let matchListMatch;
        while ((matchListMatch = matchListRegex.exec(line)) !== null) {
            const startPos = matchListMatch.index;
            const endPos = matchListMatch.index + matchListMatch[0].length;
            
            if (position.character >= startPos && position.character <= endPos) {
                const listName = matchListMatch[1].trim();
                return new vscode.Hover(`**Match List**: [[${listName}]] - Matches any item from the imported list '${listName}'`);
            }
        }

        // Check for character classes [...]
        const charClassRegex = /\[([^\]]*)\]/g;
        let charClassMatch;
        while ((charClassMatch = charClassRegex.exec(line)) !== null) {
            const startPos = charClassMatch.index;
            const endPos = charClassMatch.index + charClassMatch[0].length;
            
            if (position.character >= startPos && position.character < endPos) {
                const content = charClassMatch[1];
                const hoverText = this.getCharClassRegexHoverText(content);
                return new vscode.Hover(hoverText);
            }
        }

        // Check for identifiers that could be rule names or imported aliases
        const wordRange = document.getWordRangeAtPosition(position);
        if (wordRange) {
            const word = document.getText(wordRange);
            
            // Check if this word appears after "uses" - it's likely a resolver algorithm
            const usesRegex = /uses\s+(\w+)/g;
            let usesMatch;
            while ((usesMatch = usesRegex.exec(line)) !== null) {
                if (usesMatch[1] === word) {
                    return new vscode.Hover(`**Resolution Algorithm**: ${word} - Specifies how pattern matching should be resolved`);
                }
            }
            
            // Check if this word appears after "as" - it's likely an import alias
            const asRegex = /as\s+(\w+)/g;
            let asMatch;
            while ((asMatch = asRegex.exec(line)) !== null) {
                if (asMatch[1] === word) {
                    return new vscode.Hover(`**Import Alias**: ${word} - Local name for the imported resource`);
                }
            }
            
            // Check if this is a filename
            if (word.includes('.') && /\.(txt|csv|json|yaml|yml|xml|omg)$/i.test(word)) {
                return new vscode.Hover(`**Filename**: ${word} - Reference to an external file`);
            }
            
            // Check if this is a rule name
            const ruleRegex = new RegExp(`^\\s*${word}\\s*=`, 'gm');
            if (ruleRegex.test(document.getText())) {
                return new vscode.Hover(`**Rule Name**: ${word} - Reference to a defined pattern matching rule`);
            }
            
            // Check if this is a keyword
            if (isKeyword(word)) {
                return new vscode.Hover(`**Keyword**: ${word} - ${getKeywordDocumentation(word)}`);
            }
            
            // Check if this is an import flag
            if (isImportFlag(word)) {
                return new vscode.Hover(`**Import Flag**: ${word} - ${getImportFlagDocumentation(word)}`);
            }
            
            // Check if this is a resolver flag
            if (isResolverFlag(word)) {
                return new vscode.Hover(`**Resolver Flag**: ${word} - ${getResolverFlagDocumentation(word)}`);
            }
        }

        return undefined;
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const omgDoc = this.updateDocument(document);
        const line = position.line + 1; // Convert to 1-based
        const column = position.character + 1; // Convert to 1-based

        const node = OMGParser.findNodeAt(omgDoc.ast, line, column);
        const completions: vscode.CompletionItem[] = [];

        // Get context-aware completions
        if (node) {
            completions.push(...this.getContextualCompletions(node, omgDoc));
        }

        // Add general completions
        completions.push(...this.getGeneralCompletions());

        return completions;
    }

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Definition | undefined {
        const omgDoc = this.updateDocument(document);
        const line = position.line + 1; // Convert to 1-based
        const column = position.character + 1; // Convert to 1-based

        const node = OMGParser.findNodeAt(omgDoc.ast, line, column);
        if (!node) {
            return undefined;
        }

        // Handle rule references
        if (node.type === 'identifier' && node.value) {
            const ruleDefinitions = OMGParser.findNodesOfType(omgDoc.ast, 'rule_def');
            for (const ruleDef of ruleDefinitions) {
                if (ruleDef.children && ruleDef.children[0] && 
                    ruleDef.children[0].type === 'identifier' && 
                    ruleDef.children[0].value === node.value) {
                    
                    return new vscode.Location(
                        document.uri,
                        new vscode.Range(
                            ruleDef.line - 1,
                            ruleDef.column - 1,
                            ruleDef.line - 1,
                            ruleDef.column - 1 + ruleDef.length
                        )
                    );
                }
            }
        }

        return undefined;
    }

    public provideReferences(document: vscode.TextDocument, position: vscode.Position): vscode.Location[] {
        const omgDoc = this.updateDocument(document);
        const line = position.line + 1; // Convert to 1-based
        const column = position.character + 1; // Convert to 1-based

        const node = OMGParser.findNodeAt(omgDoc.ast, line, column);
        if (!node || node.type !== 'identifier' || !node.value) {
            return [];
        }

        const references: vscode.Location[] = [];
        const identifierNodes = OMGParser.findNodesOfType(omgDoc.ast, 'identifier');

        for (const identifierNode of identifierNodes) {
            if (identifierNode.value === node.value) {
                references.push(new vscode.Location(
                    document.uri,
                    new vscode.Range(
                        identifierNode.line - 1,
                        identifierNode.column - 1,
                        identifierNode.line - 1,
                        identifierNode.column - 1 + identifierNode.length
                    )
                ));
            }
        }

        return references;
    }

    public provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const omgDoc = this.updateDocument(document);
        const diagnostics = [...omgDoc.errors];

        // Add semantic validation
        const semanticDiagnostics = this.validateSemantics(omgDoc);
        diagnostics.push(...semanticDiagnostics);

        console.log(`Total diagnostics for ${document.uri.fsPath}: ${diagnostics.length}`);
        for (const diagnostic of diagnostics) {
            console.log(`- ${diagnostic.message} at line ${diagnostic.range.start.line + 1}`);
        }

        return diagnostics;
    }

    private getHoverText(node: ASTNode, text: string): string | undefined {
        switch (node.type) {
            case 'version_stmt':
                return '**Version Declaration**: Specifies the OMG language version';
            
            case 'import_stmt':
                return '**Import Statement**: Imports an external match list or rule set';
            
            case 'rule_def':
                if (node.children && node.children[0]) {
                    const ruleName = node.children[0].value;
                    return `**Rule Definition**: ${ruleName}`;
                }
                return '**Rule Definition**: Defines a pattern matching rule';
            
            case 'uses_clause':
                return '**Uses Clause**: Specifies a resolver for pattern matching';
            
            case 'list_match':
                if (node.children && node.children[0]) {
                    const listName = node.children[0].value;
                    return `**List Match**: Matches against list [[${listName}]]`;
                }
                return '**List Match**: Matches against an imported list';
            
            case 'filter_expr':
                return this.getFilterExprHoverText(node);
            
            case 'named_capture':
                return this.getNamedCaptureHoverText(node);
            
            case 'group_expr':
                return '**Group Expression**: Groups sub-expressions';
            
            case 'quantifier':
            case 'exact_range':
            case 'range':
                return this.getQuantifierHoverText(node, text);
            
            case 'qmark':
                return '**? Quantifier**: Matches zero or one occurrence (makes optional)';
            
            case 'escape':
                return this.getEscapeHoverText(node.value);
            
            case 'anchor':
                return node.value === '^' ? 
                    '**^ Anchor**: Matches the start of a line' : 
                    '**$ Anchor**: Matches the end of a line';
            
            case 'dot':
                return '**. (Dot)**: Matches any single character';
            
            case 'charclass':
                return this.getCharClassHoverText(node);
            
            case 'string':
                return '**String Literal**: Matches the exact text';
            
            case 'identifier':
                return this.getIdentifierHoverText(node, text);
            
            case 'import_flag':
                return this.getImportFlagHoverText(node.value);
            
            case 'resolver_flag':
                return this.getResolverFlagHoverText(node.value);
            
            case 'resolver_method':
                return this.getResolverMethodHoverText(node);
            
            default:
                return undefined;
        }
    }

    private getQuantifierHoverText(node: ASTNode, text: string): string {
        if (node.type === 'exact_range' && node.children && node.children[0]) {
            const count = node.children[0].value;
            return `**{${count}}**: Matches exactly ${count} occurrences`;
        }
        
        if (node.type === 'range' && node.children && node.children.length >= 2) {
            const min = node.children[0].value;
            const max = node.children[1].value;
            return `**{${min},${max}}**: Matches between ${min} and ${max} occurrences`;
        }
        
        return '**Quantifier**: Specifies how many times to match';
    }

    private getEscapeHoverText(escape: string): string {
        return `**${escape}**: ${getEscapeSequenceDocumentation(escape)}`;
    }

    private getIdentifierHoverText(node: ASTNode, text: string): string | undefined {
        // Check if this identifier is a rule name
        const ruleDefinitions = OMGParser.findNodesOfType(node, 'rule_def');
        for (const ruleDef of ruleDefinitions) {
            if (ruleDef.children && ruleDef.children[0] && 
                ruleDef.children[0].type === 'identifier' && 
                ruleDef.children[0].value === node.value) {
                return `**Rule Reference**: ${node.value}`;
            }
        }

        // Check if this is a list name
        const listMatches = OMGParser.findNodesOfType(node, 'list_match');
        for (const listMatch of listMatches) {
            if (listMatch.children && listMatch.children[0] && 
                listMatch.children[0].type === 'identifier' && 
                listMatch.children[0].value === node.value) {
                return `**List Reference**: ${node.value}`;
            }
        }

        return `**Identifier**: ${node.value}`;
    }

    private getImportFlagHoverText(flag: string): string {
        return `**Import Flag**: ${getImportFlagDocumentation(flag)}`;
    }

    private getResolverFlagHoverText(flag: string): string {
        return `**Resolver Flag**: ${getResolverFlagDocumentation(flag)}`;
    }

    private getResolverMethodHoverText(node: ASTNode): string {
        if (node.children && node.children[0]) {
            const methodName = node.children[0].value;
            const methodMap: { [key: string]: string } = {
                'exact': 'Requires exact string matching',
                'fuzzy': 'Allows fuzzy string matching',
                'phonetic': 'Uses phonetic matching algorithms',
                'semantic': 'Uses semantic/meaning-based matching',
                'regex': 'Uses regular expression matching',
                'custom': 'Uses a custom matching algorithm'
            };

            return `**Resolver Method**: ${methodMap[methodName] || methodName}`;
        }

        return '**Resolver Method**: Specifies the matching algorithm';
    }

    private getFilterExprHoverText(node: ASTNode): string {
        if (node.children && node.children.length >= 2) {
            const filterName = node.children[0].value;
            const filterArg = node.children[1].value;
            
            // Common filter types
            const filterMap: { [key: string]: string } = {
                'contains': 'Filters list items that contain the specified text',
                'startsWith': 'Filters list items that start with the specified text',
                'endsWith': 'Filters list items that end with the specified text',
                'matches': 'Filters list items that match the specified pattern',
                'length': 'Filters list items by length',
                'regex': 'Filters list items using regular expression',
                'range': 'Filters list items within a specified range',
                'exclude': 'Excludes list items that match the criteria'
            };

            const description = filterMap[filterName] || 'Applies a filter to the list items';
            return `**Filter Expression**: ${filterName}(${filterArg}) - ${description}`;
        }

        return '**Filter Expression**: Applies filtering criteria to list matches';
    }

    private getNamedCaptureHoverText(node: ASTNode): string {
        if (node.children && node.children.length >= 1) {
            const captureName = node.children[0].value;
            
            // Get a description of what's being captured
            let captureDescription = '';
            if (node.children.length >= 2) {
                const capturedExpr = node.children[1];
                captureDescription = this.getExpressionDescription(capturedExpr);
            }

            const nameInfo = captureName ? `"${captureName}"` : 'a name';
            const exprInfo = captureDescription ? ` that matches ${captureDescription}` : '';
            
            // Provide usage context information
            const usageInfo = captureName ? 
                `\n\n**Usage**: The captured text will be available as \`${captureName}\` in processing results and can be referenced in subsequent operations.` : 
                `\n\n**Usage**: The captured text can be referenced by name in processing results.`;
            
            return `**Named Capture**: Captures text as ${nameInfo}${exprInfo}.${usageInfo}`;
        }

        return '**Named Capture**: Captures the matched text with a specific name for later reference. Use the syntax \`(?P<name>pattern)\` to create named captures.';
    }

    private getExpressionDescription(node: ASTNode): string {
        switch (node.type) {
            case 'list_match':
                if (node.children && node.children[0]) {
                    const listName = node.children[0].value;
                    // Check if it has a filter
                    if (node.children.length > 1) {
                        const filterDesc = this.getFilterDescription(node.children[1]);
                        return `filtered items from list [[${listName}]] (${filterDesc})`;
                    }
                    return `items from list [[${listName}]]`;
                }
                return 'list items';
            
            case 'string':
                return `the literal text ${node.value}`;
            
            case 'charclass':
                return this.getCharClassDescription(node);
            
            case 'escape':
                const escapeMap: { [key: string]: string } = {
                    '\\d': 'digits (0-9)',
                    '\\D': 'non-digit characters',
                    '\\s': 'whitespace characters (space, tab, newline)',
                    '\\S': 'non-whitespace characters',
                    '\\w': 'word characters (letters, digits, underscore)',
                    '\\W': 'non-word characters'
                };
                return escapeMap[node.value] || 'escaped characters';
            
            case 'dot':
                return 'any single character';
            
            case 'identifier':
                return `rule "${node.value}"`;
            
            case 'group_expr':
                if (node.children && node.children[0]) {
                    return `grouped expression (${this.getExpressionDescription(node.children[0])})`;
                }
                return 'a grouped expression';
            
            case 'alt':
                if (node.children && node.children.length > 1) {
                    const alternatives = node.children.map(child => this.getExpressionDescription(child)).join(' OR ');
                    return `one of: ${alternatives}`;
                }
                return 'one of several alternatives';
            
            case 'concat':
                if (node.children && node.children.length > 1) {
                    const sequence = node.children.map(child => this.getExpressionDescription(child)).join(', then ');
                    return `sequence: ${sequence}`;
                }
                return 'a sequence of patterns';
            
            case 'quantified':
                if (node.children && node.children[0]) {
                    const baseDesc = this.getExpressionDescription(node.children[0]);
                    const quantDesc = node.children[1] ? this.getQuantifierDescription(node.children[1]) : 'repeated';
                    return `${baseDesc} (${quantDesc})`;
                }
                return 'repeated patterns';
            
            case 'named_capture':
                if (node.children && node.children.length >= 2) {
                    const name = node.children[0].value;
                    const expr = this.getExpressionDescription(node.children[1]);
                    return `named capture "${name}" containing ${expr}`;
                }
                return 'a named capture';
            
            default:
                return 'a pattern';
        }
    }

    private getFilterDescription(filterNode: ASTNode): string {
        if (filterNode.type === 'filter_expr' && filterNode.children && filterNode.children.length >= 2) {
            const method = filterNode.children[0].value;
            const arg = filterNode.children[1].value;
            return `${method} filter with argument ${arg}`;
        }
        return 'filtered';
    }

    private getQuantifierDescription(quantifierNode: ASTNode): string {
        switch (quantifierNode.type) {
            case 'qmark':
                return 'optional (0 or 1 times)';
            case 'exact_range':
                if (quantifierNode.children && quantifierNode.children[0]) {
                    const count = quantifierNode.children[0].value;
                    return `exactly ${count} times`;
                }
                return 'exact count';
            case 'range':
                if (quantifierNode.children && quantifierNode.children.length >= 2) {
                    const min = quantifierNode.children[0].value;
                    const max = quantifierNode.children[1].value;
                    return `${min} to ${max} times`;
                }
                return 'range of repetitions';
            default:
                return 'repeated';
        }
    }

    private getContextualCompletions(node: ASTNode, omgDoc: OMGDocument): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Add rule name completions in expression context
        if (this.isInExpressionContext(node)) {
            const ruleDefinitions = OMGParser.findNodesOfType(omgDoc.ast, 'rule_def');
            for (const ruleDef of ruleDefinitions) {
                if (ruleDef.children && ruleDef.children[0] && ruleDef.children[0].value) {
                    const completion = new vscode.CompletionItem(
                        ruleDef.children[0].value,
                        vscode.CompletionItemKind.Reference
                    );
                    completion.detail = 'Rule reference';
                    completion.documentation = 'Reference to a defined rule';
                    completions.push(completion);
                }
            }
        }

        // Add list name completions in list match context
        if (this.isInListMatchContext(node)) {
            const importStatements = OMGParser.findNodesOfType(omgDoc.ast, 'import_stmt');
            for (const importStmt of importStatements) {
                if (importStmt.children && importStmt.children.length >= 2 && 
                    importStmt.children[1].value) {
                    const completion = new vscode.CompletionItem(
                        importStmt.children[1].value,
                        vscode.CompletionItemKind.Module
                    );
                    completion.detail = 'Imported list';
                    completion.documentation = 'Reference to an imported list';
                    completions.push(completion);
                }
            }
        }

        // Add resolver method completions
        if (this.isInResolverContext(node)) {
            const resolverMethods = [
                'exact', 'fuzzy', 'phonetic', 'semantic', 'regex', 'custom'
            ];
            for (const method of resolverMethods) {
                const completion = new vscode.CompletionItem(
                    method,
                    vscode.CompletionItemKind.Method
                );
                completion.detail = 'Resolver method';
                completions.push(completion);
            }
        }

        // Add filter method completions in filter expression context
        if (this.isInFilterContext(node)) {
            const filterMethods = [
                'contains', 'startsWith', 'endsWith', 'matches', 
                'length', 'regex', 'range', 'exclude'
            ];
            for (const method of filterMethods) {
                const completion = new vscode.CompletionItem(
                    method,
                    vscode.CompletionItemKind.Function
                );
                completion.detail = 'Filter method';
                completion.documentation = this.getFilterMethodDocumentation(method);
                completions.push(completion);
            }
        }

        return completions;
    }

    private getGeneralCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Keywords
        for (const keyword of KEYWORDS) {
            const completion = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            completion.detail = 'OMG keyword';
            completions.push(completion);
        }

        // Import flags
        for (const flag of IMPORT_FLAGS) {
            const completion = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Property);
            completion.detail = 'Import flag';
            completions.push(completion);
        }

        // Resolver flags
        for (const flag of RESOLVER_FLAGS) {
            const completion = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Property);
            completion.detail = 'Resolver flag';
            completions.push(completion);
        }

        // Escape sequences
        for (const escape of ESCAPE_SEQUENCES) {
            const completion = new vscode.CompletionItem(escape, vscode.CompletionItemKind.Constant);
            completion.detail = 'Escape sequence';
            completion.insertText = escape;
            completions.push(completion);
        }

        // Quantifiers
        for (const quantifier of QUANTIFIERS) {
            const completion = new vscode.CompletionItem(quantifier.label, vscode.CompletionItemKind.Operator);
            completion.detail = quantifier.detail;
            completions.push(completion);
        }

        return completions;
    }

    private isInExpressionContext(node: ASTNode): boolean {
        // Check if we're in a context where rule references are valid
        return ['alt', 'concat', 'quantified', 'group_expr'].includes(node.type);
    }

    private isInListMatchContext(node: ASTNode): boolean {
        // Check if we're inside a list match [[...]]
        return node.type === 'list_match' || this.hasAncestorOfType(node, 'list_match');
    }

    private isInResolverContext(node: ASTNode): boolean {
        // Check if we're in a resolver method context
        return node.type === 'resolver_method' || this.hasAncestorOfType(node, 'uses_clause');
    }

    private isInFilterContext(node: ASTNode): boolean {
        // Check if we're in a filter expression context
        return node.type === 'filter_expr' || this.hasAncestorOfType(node, 'filter_expr');
    }

    private hasAncestorOfType(node: ASTNode, type: string): boolean {
        // This is a simplified check - in a real implementation, 
        // we'd need to track parent relationships
        return false;
    }

    private getFilterMethodDocumentation(method: string): string {
        const filterDocs: { [key: string]: string } = {
            'contains': 'Filters list items that contain the specified substring',
            'startsWith': 'Filters list items that start with the specified prefix',
            'endsWith': 'Filters list items that end with the specified suffix',
            'matches': 'Filters list items that match the specified pattern',
            'length': 'Filters list items by their character length',
            'regex': 'Filters list items using a regular expression pattern',
            'range': 'Filters list items within a specified numeric or alphabetic range',
            'exclude': 'Excludes list items that match the specified criteria'
        };
        return filterDocs[method] || 'Applies a filter to list items';
    }

    private validateSemantics(omgDoc: OMGDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        // Check for undefined rule references
        const identifierNodes = OMGParser.findNodesOfType(omgDoc.ast, 'identifier');
        const ruleDefinitions = OMGParser.findNodesOfType(omgDoc.ast, 'rule_def');
        const definedRules = new Set(
            ruleDefinitions
                .filter(rule => rule.children && rule.children[0])
                .map(rule => rule.children![0].value)
        );

        for (const identifier of identifierNodes) {
            if (identifier.value && !definedRules.has(identifier.value)) {
                // Check if it's not a built-in or imported identifier
                if (!this.isBuiltInIdentifier(identifier.value) && 
                    !this.isImportedIdentifier(identifier.value, omgDoc.ast)) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(
                            identifier.line - 1,
                            identifier.column - 1,
                            identifier.line - 1,
                            identifier.column - 1 + identifier.length
                        ),
                        `Undefined rule reference: ${identifier.value}`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }
        }

        // Check for unbounded quantifiers (not allowed in OMG)
        const quantifierNodes = OMGParser.findNodesOfType(omgDoc.ast, 'quantifier');
        for (const quantifier of quantifierNodes) {
            if (quantifier.type === 'range' && quantifier.children && quantifier.children.length === 1) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(
                        quantifier.line - 1,
                        quantifier.column - 1,
                        quantifier.line - 1,
                        quantifier.column - 1 + quantifier.length
                    ),
                    'Unbounded quantifiers are not allowed in OMG',
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        // Check for open-ended quantifiers like + and * which are not allowed in OMG
        diagnostics.push(...this.validateQuantifiers(omgDoc));

        // Check for file existence in imports and optional-tokens
        diagnostics.push(...this.validateFileReferences(omgDoc));

        return diagnostics;
    }

    private validateQuantifiers(omgDoc: OMGDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = omgDoc.text;
        const lines = text.split('\n');

        // Check for + and * quantifiers which are not allowed in OMG
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            // Find + quantifiers
            const plusMatches = [...line.matchAll(/\+/g)];
            for (const match of plusMatches) {
                const column = match.index!;
                // Check if it's actually being used as a quantifier (not in a string or comment)
                if (this.isQuantifierContext(line, column)) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(lineIndex, column, lineIndex, column + 1),
                        'Open-ended quantifier "+" is not allowed in OMG. Use bounded quantifiers like {1,10} instead.',
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }

            // Find * quantifiers
            const starMatches = [...line.matchAll(/\*/g)];
            for (const match of starMatches) {
                const column = match.index!;
                // Check if it's actually being used as a quantifier (not in a string or comment)
                if (this.isQuantifierContext(line, column)) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(lineIndex, column, lineIndex, column + 1),
                        'Open-ended quantifier "*" is not allowed in OMG. Use bounded quantifiers like {0,10} instead.',
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }
        }

        return diagnostics;
    }

    private isQuantifierContext(line: string, position: number): boolean {
        // Skip if we're in a comment
        const commentIndex = line.indexOf('#');
        if (commentIndex !== -1 && position > commentIndex) {
            return false;
        }

        // Skip if we're in a string literal
        const beforePosition = line.substring(0, position);
        const afterPosition = line.substring(position);
        
        // Count quotes before and after to determine if we're inside a string
        const quotesBefore = (beforePosition.match(/"/g) || []).length;
        const quotesAfter = (afterPosition.match(/"/g) || []).length;
        
        // If odd number of quotes before, we're inside a string
        if (quotesBefore % 2 === 1) {
            return false;
        }

        // Check if we're inside a character class [...]
        if (this.isInsideCharacterClass(line, position)) {
            return false;
        }

        // Check if there's a valid pattern element before the quantifier
        const precedingChar = line.charAt(position - 1);
        if (precedingChar === '' || precedingChar === ' ' || precedingChar === '\t') {
            return false;
        }

        // Check if it's preceded by a valid quantifiable element
        const validPrecedingElements = /[a-zA-Z0-9\])\}.]$/;
        const precedingText = line.substring(0, position);
        
        return validPrecedingElements.test(precedingText);
    }

    private isInsideCharacterClass(line: string, position: number): boolean {
        // Count unescaped [ and ] brackets before the position
        let bracketCount = 0;
        let i = 0;
        
        while (i < position) {
            const char = line.charAt(i);
            
            // Skip escaped characters
            if (char === '\\' && i + 1 < line.length) {
                i += 2;
                continue;
            }
            
            // Skip quoted strings
            if (char === '"') {
                i++;
                while (i < line.length && line.charAt(i) !== '"') {
                    if (line.charAt(i) === '\\' && i + 1 < line.length) {
                        i += 2;
                    } else {
                        i++;
                    }
                }
                if (i < line.length) {
                    i++; // Skip closing quote
                }
                continue;
            }
            
            if (char === '[') {
                bracketCount++;
            } else if (char === ']') {
                bracketCount--;
            }
            
            i++;
        }
        
        // If bracketCount > 0, we're inside a character class
        return bracketCount > 0;
    }

    private isBuiltInIdentifier(name: string): boolean {
        // List of built-in identifiers that don't need to be defined
        const builtIns = ['exact', 'fuzzy', 'phonetic', 'semantic', 'regex', 'custom'];
        return builtIns.includes(name);
    }

    private isImportedIdentifier(name: string, ast: ASTNode): boolean {
        const importStatements = OMGParser.findNodesOfType(ast, 'import_stmt');
        for (const importStmt of importStatements) {
            if (importStmt.children && importStmt.children.length >= 2 && 
                importStmt.children[1].value === name) {
                return true;
            }
        }
        return false;
    }

    private getCharClassHoverText(node: ASTNode): string {
        if (!node.children || node.children.length === 0) {
            return '**Character Class**: Matches any character in the set';
        }

        const items = node.children;
        const descriptions: string[] = [];
        let hasRanges = false;
        let hasEscapes = false;
        let hasSpecialChars = false;
        let isNegated = false;

        // Check if this is a negated character class (starts with ^)
        if (items.length > 0 && items[0].type === 'char' && items[0].value === '^') {
            isNegated = true;
            descriptions.push('**Negated Character Class**: Matches any character NOT in the set');
        } else {
            descriptions.push('**Character Class**: Matches any character in the set');
        }

        // Analyze the character class contents
        const startIndex = isNegated ? 1 : 0;
        const contentItems = items.slice(startIndex);
        const ranges: string[] = [];
        const literals: string[] = [];
        const escapes: string[] = [];

        for (const item of contentItems) {
            switch (item.type) {
                case 'char_range':
                    hasRanges = true;
                    ranges.push(item.value);
                    break;
                case 'escape':
                    hasEscapes = true;
                    escapes.push(item.value);
                    break;
                case 'char':
                    if (this.isSpecialChar(item.value)) {
                        hasSpecialChars = true;
                    }
                    literals.push(item.value);
                    break;
            }
        }

        // Build detailed description
        const parts: string[] = [];
        
        if (ranges.length > 0) {
            const rangeDesc = ranges.map(r => this.getRangeDescription(r)).join(', ');
            parts.push(`**Ranges**: ${rangeDesc}`);
        }

        if (escapes.length > 0) {
            const escapeDesc = escapes.map(e => this.getEscapeDescription(e)).join(', ');
            parts.push(`**Escape Sequences**: ${escapeDesc}`);
        }

        if (literals.length > 0) {
            const literalDesc = literals.length <= 10 ? 
                `"${literals.join('')}"` : 
                `"${literals.slice(0, 10).join('')}..." (${literals.length} characters)`;
            parts.push(`**Literal Characters**: ${literalDesc}`);
        }

        if (parts.length > 0) {
            descriptions.push('\n**Contents**:');
            descriptions.push(...parts.map(p => `• ${p}`));
        }

        // Add usage examples
        if (isNegated) {
            descriptions.push('\n**Examples**:');
            descriptions.push('• `[^abc]` - matches any character except a, b, or c');
            descriptions.push('• `[^0-9]` - matches any non-digit character');
        } else {
            descriptions.push('\n**Examples**:');
            descriptions.push('• `[abc]` - matches a, b, or c');
            descriptions.push('• `[a-z]` - matches any lowercase letter');
            descriptions.push('• `[0-9]` - matches any digit');
        }

        return descriptions.join('\n');
    }

    private isSpecialChar(char: string): boolean {
        return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(char);
    }

    private getRangeDescription(range: string): string {
        const parts = range.split('-');
        if (parts.length === 3) {
            const start = parts[0];
            const end = parts[2];
            
            if (/[a-z]/.test(start) && /[a-z]/.test(end)) {
                return `${start}-${end} (lowercase letters)`;
            } else if (/[A-Z]/.test(start) && /[A-Z]/.test(end)) {
                return `${start}-${end} (uppercase letters)`;
            } else if (/[0-9]/.test(start) && /[0-9]/.test(end)) {
                return `${start}-${end} (digits)`;
            } else {
                return `${start}-${end}`;
            }
        }
        return range;
    }

    private getEscapeDescription(escape: string): string {
        const escapeMap: { [key: string]: string } = {
            '\\d': 'digits (0-9)',
            '\\D': 'non-digits',
            '\\s': 'whitespace',
            '\\S': 'non-whitespace',
            '\\w': 'word characters (a-z, A-Z, 0-9, _)',
            '\\W': 'non-word characters',
            '\\b': 'word boundary',
            '\\B': 'non-word boundary',
            '\\t': 'tab character',
            '\\n': 'newline character',
            '\\r': 'carriage return',
            '\\\\': 'literal backslash',
            '\\]': 'literal closing bracket',
            '\\[': 'literal opening bracket',
            '\\-': 'literal hyphen'
        };
        return escapeMap[escape] || escape;
    }

    private getCharClassRegexHoverText(content: string): string {
        if (!content) {
            return '**Character Class**: `[]` - Empty character class (matches nothing)';
        }

        const isNegated = content.startsWith('^');
        const actualContent = isNegated ? content.slice(1) : content;
        
        if (!actualContent) {
            return isNegated ? 
                '**Negated Character Class**: `[^]` - Matches any character' : 
                '**Character Class**: `[]` - Empty character class (matches nothing)';
        }

        // Analyze the content
        const parts: string[] = [];
        let i = 0;
        
        while (i < actualContent.length) {
            if (i + 2 < actualContent.length && actualContent[i + 1] === '-') {
                // Character range
                const start = actualContent[i];
                const end = actualContent[i + 2];
                if (/[a-z]/.test(start) && /[a-z]/.test(end)) {
                    parts.push(`${start}-${end} (lowercase letters)`);
                } else if (/[A-Z]/.test(start) && /[A-Z]/.test(end)) {
                    parts.push(`${start}-${end} (uppercase letters)`);
                } else if (/[0-9]/.test(start) && /[0-9]/.test(end)) {
                    parts.push(`${start}-${end} (digits)`);
                } else {
                    parts.push(`${start}-${end}`);
                }
                i += 3;
            } else if (actualContent[i] === '\\' && i + 1 < actualContent.length) {
                // Escape sequence
                const escape = actualContent.slice(i, i + 2);
                parts.push(this.getEscapeDescription(escape));
                i += 2;
            } else {
                // Single character
                parts.push(`"${actualContent[i]}"`);
                i++;
            }
        }

        const description = parts.length <= 5 ? 
            parts.join(', ') : 
            `${parts.slice(0, 5).join(', ')} and ${parts.length - 5} more`;

        const classType = isNegated ? 'Negated Character Class' : 'Character Class';
        const matchDescription = isNegated ? 
            `Matches any character EXCEPT: ${description}` : 
            `Matches any of: ${description}`;

        return `**${classType}**: \`[${content}]\`\n\n${matchDescription}`;
    }

    private getCharClassDescription(node: ASTNode): string {
        if (!node.children || node.children.length === 0) {
            return 'characters from a character class';
        }

        const items = node.children;
        let isNegated = false;
        
        // Check if this is a negated character class
        if (items.length > 0 && items[0].type === 'char' && items[0].value === '^') {
            isNegated = true;
        }

        const startIndex = isNegated ? 1 : 0;
        const contentItems = items.slice(startIndex);
        
        if (contentItems.length === 0) {
            return isNegated ? 'any character (negated empty class)' : 'no characters (empty class)';
        }

        const parts: string[] = [];
        
        for (const item of contentItems) {
            switch (item.type) {
                case 'char_range':
                    parts.push(this.getRangeDescription(item.value));
                    break;
                case 'escape':
                    parts.push(this.getEscapeDescription(item.value));
                    break;
                case 'char':
                    parts.push(`"${item.value}"`);
                    break;
            }
        }

        const description = parts.length <= 3 ? 
            parts.join(', ') : 
            `${parts.slice(0, 3).join(', ')} and ${parts.length - 3} more`;
        
        return isNegated ? 
            `any character except ${description}` : 
            `any of: ${description}`;
    }

    private validateFileReferences(omgDoc: OMGDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const sourceDir = this.getSourceDirectory(omgDoc.uri);
        
        console.log(`Validating file references in ${omgDoc.uri.fsPath}, sourceDir: ${sourceDir}`);

        // Also try regex-based parsing as fallback for import statements
        const text = omgDoc.text;
        const lines = text.split('\n');
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            // Look for import statements using regex
            const importRegex = /import\s+"([^"]+)"\s+as\s+\w+/g;
            let match;
            
            while ((match = importRegex.exec(line)) !== null) {
                const filePath = match[1];
                const startColumn = match.index + match[0].indexOf('"');
                const endColumn = startColumn + filePath.length + 2; // include quotes
                
                console.log(`Regex found import file: ${filePath} at line ${lineIndex + 1}`);
                
                if (!this.fileExists(sourceDir, filePath)) {
                    console.log(`Import file not found: ${filePath}`);
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(lineIndex, startColumn, lineIndex, endColumn),
                        `Import file not found: ${filePath}`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.code = 'missing-import-file';
                    diagnostic.source = 'OMG';
                    diagnostics.push(diagnostic);
                }
            }
            
            // Look for optional-tokens statements using regex
            const optionalTokensRegex = /optional-tokens\s*\(\s*"([^"]+)"\s*\)/g;
            let optionalMatch;
            
            while ((optionalMatch = optionalTokensRegex.exec(line)) !== null) {
                const filePath = optionalMatch[1];
                const startColumn = optionalMatch.index + optionalMatch[0].indexOf('"');
                const endColumn = startColumn + filePath.length + 2; // include quotes
                
                console.log(`Regex found optional-tokens file: ${filePath} at line ${lineIndex + 1}`);
                
                if (!this.fileExists(sourceDir, filePath)) {
                    console.log(`Optional-tokens file not found: ${filePath}`);
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(lineIndex, startColumn, lineIndex, endColumn),
                        `Optional-tokens file not found: ${filePath}`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.code = 'missing-optional-tokens-file';
                    diagnostic.source = 'OMG';
                    diagnostics.push(diagnostic);
                }
            }
        }

        // Validate import file references using AST
        const importStatements = OMGParser.findNodesOfType(omgDoc.ast, 'import_stmt');
        console.log(`Found ${importStatements.length} import statements via AST`);
        
        for (const importStmt of importStatements) {
            if (importStmt.children && importStmt.children[0] && importStmt.children[0].type === 'string') {
                const filePath = this.extractFilePath(importStmt.children[0].value);
                console.log(`AST found import file: ${filePath}`);
                
                if (filePath && !this.fileExists(sourceDir, filePath)) {
                    console.log(`Import file not found: ${filePath}`);
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(
                            importStmt.children[0].line - 1,
                            importStmt.children[0].column - 1,
                            importStmt.children[0].line - 1,
                            importStmt.children[0].column - 1 + importStmt.children[0].length
                        ),
                        `Import file not found: ${filePath}`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.code = 'missing-import-file';
                    diagnostic.source = 'OMG';
                    diagnostics.push(diagnostic);
                }
            }
        }

        // Validate optional-tokens file references using AST
        const optionalTokensDiagnostics = this.validateOptionalTokensFiles(omgDoc.ast, sourceDir);
        diagnostics.push(...optionalTokensDiagnostics);

        console.log(`File validation generated ${diagnostics.length} diagnostics`);
        return diagnostics;
    }

    private validateOptionalTokensFiles(ast: ASTNode, sourceDir: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        console.log(`Validating optional-tokens files via AST...`);
        
        // Find all resolver flags that contain optional-tokens
        const resolverFlags = OMGParser.findNodesOfType(ast, 'resolver_flag');
        console.log(`Found ${resolverFlags.length} resolver flags via AST`);
        
        for (const flag of resolverFlags) {
            if (flag.value && flag.value.includes('optional-tokens')) {
                console.log(`Processing resolver flag: ${flag.value}`);
                // Extract file paths from optional-tokens clause
                const fileReferences = this.extractOptionalTokensFiles(flag);
                console.log(`Extracted ${fileReferences.length} file references from flag`);
                
                for (const fileRef of fileReferences) {
                    console.log(`Checking optional-tokens file: ${fileRef.filePath}`);
                    if (!this.fileExists(sourceDir, fileRef.filePath)) {
                        console.log(`Optional-tokens file not found: ${fileRef.filePath}`);
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(
                                fileRef.line - 1,
                                fileRef.column - 1,
                                fileRef.line - 1,
                                fileRef.column - 1 + fileRef.length
                            ),
                            `Optional-tokens file not found: ${fileRef.filePath}`,
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.code = 'missing-optional-tokens-file';
                        diagnostic.source = 'OMG';
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }

        console.log(`AST optional-tokens validation generated ${diagnostics.length} diagnostics`);
        return diagnostics;
    }

    private getSourceDirectory(uri: vscode.Uri): string {
        const path = require('path');
        if (uri.scheme === 'file') {
            return path.dirname(uri.fsPath);
        }
        // For non-file URIs, we can't validate file existence
        return '';
    }

    private extractFilePath(quotedPath: string): string | null {
        // Remove quotes from the file path
        const match = quotedPath.match(/^"([^"]*)"$/);
        return match ? match[1] : null;
    }

    private extractOptionalTokensFiles(flag: ASTNode): Array<{filePath: string, line: number, column: number, length: number}> {
        const files: Array<{filePath: string, line: number, column: number, length: number}> = [];
        
        console.log(`Extracting optional-tokens files from flag: ${flag.value}`);
        
        // Parse optional-tokens("file1.txt", "file2.txt") syntax
        if (flag.value) {
            const match = flag.value.match(/optional-tokens\s*\(\s*([^)]+)\s*\)/);
            if (match) {
                console.log(`Found optional-tokens match: ${match[1]}`);
                const argsString = match[1];
                const fileMatches = [...argsString.matchAll(/"([^"]+)"/g)];
                console.log(`Found ${fileMatches.length} file matches in args`);
                
                for (const fileMatch of fileMatches) {
                    const filePath = fileMatch[1];
                    const fileRef = {
                        filePath: filePath,
                        line: flag.line,
                        column: flag.column + (fileMatch.index || 0),
                        length: fileMatch[0].length
                    };
                    files.push(fileRef);
                    console.log(`Extracted file: ${filePath} at line ${fileRef.line}, column ${fileRef.column}`);
                }
            } else {
                console.log(`No optional-tokens match found in: ${flag.value}`);
            }
        }
        
        return files;
    }

    private fileExists(sourceDir: string, filePath: string): boolean {
        if (!sourceDir) {
            // Can't validate file existence for non-file URIs
            return true;
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.resolve(sourceDir, filePath);
            return fs.existsSync(fullPath);
        } catch (error) {
            // If we can't check file existence, don't report false positives
            console.warn('Error checking file existence:', error);
            return true;
        }
    }

    private getFileExistenceInfo(sourceUri: vscode.Uri, filePath: string | null): string {
        if (!filePath) {
            return '';
        }

        const sourceDir = this.getSourceDirectory(sourceUri);
        if (!sourceDir) {
            return ''; // Can't validate non-file URIs
        }

        const exists = this.fileExists(sourceDir, filePath);
        return exists ? '\n\n✅ **File exists**' : '\n\n⚠️  **File not found**';
    }
}
