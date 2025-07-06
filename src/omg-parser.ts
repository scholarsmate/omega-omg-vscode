/**
 * OMG Language Parser
 * A lightweight parser for the OMG DSL based on the Lark grammar
 */

export interface ParseResult {
    ast: ASTNode;
    errors: ParseError[];
}

export interface ParseError {
    message: string;
    line: number;
    column: number;
    length: number;
}

export interface ASTNode {
    type: string;
    value?: any;
    children?: ASTNode[];
    line: number;
    column: number;
    length: number;
}

export interface Position {
    line: number;
    column: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export class OMGParser {
    private text: string;
    private position: number;
    private line: number;
    private column: number;
    private errors: ParseError[] = [];

    constructor(text: string) {
        this.text = text;
        this.position = 0;
        this.line = 1;
        this.column = 1;
    }

    parse(): ParseResult {
        this.errors = [];
        try {
            const ast = this.parseRoot();
            return { ast, errors: this.errors };
        } catch (error) {
            this.errors.push({
                message: error instanceof Error ? error.message : 'Unknown parsing error',
                line: this.line,
                column: this.column,
                length: 1
            });
            // Return minimal AST on error
            return {
                ast: {
                    type: 'root',
                    children: [],
                    line: 1,
                    column: 1,
                    length: this.text.length
                },
                errors: this.errors
            };
        }
    }

    private parseRoot(): ASTNode {
        const startPos = this.getCurrentPosition();
        const children: ASTNode[] = [];

        this.skipWhitespace();

        // Parse version statement
        if (this.peek() !== null) {
            const versionStmt = this.parseVersionStatement();
            if (versionStmt) {
                children.push(versionStmt);
            }
        }

        // Parse import statements
        while (this.peek() !== null && this.peekWord() === 'import') {
            const importStmt = this.parseImportStatement();
            if (importStmt) {
                children.push(importStmt);
            }
        }

        // Parse optional default resolver
        if (this.peek() !== null && this.peekWord() === 'resolver') {
            const resolverStmt = this.parseResolverDefault();
            if (resolverStmt) {
                children.push(resolverStmt);
            }
        }

        // Parse rule definitions
        while (this.peek() !== null) {
            const ruleStmt = this.parseRuleDefinition();
            if (ruleStmt) {
                children.push(ruleStmt);
            } else {
                break;
            }
        }

        return {
            type: 'root',
            children,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseVersionStatement(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (!this.consumeWord('version')) {
            return null;
        }

        this.skipWhitespace();

        const versionLiteral = this.parseVersionLiteral();
        if (!versionLiteral) {
            this.addError('Expected version literal after "version"');
            return null;
        }

        return {
            type: 'version_stmt',
            children: [versionLiteral],
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseImportStatement(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (!this.consumeWord('import')) {
            return null;
        }

        this.skipWhitespace();

        const stringLiteral = this.parseString();
        if (!stringLiteral) {
            this.addError('Expected string literal after "import"');
            return null;
        }

        this.skipWhitespace();

        if (!this.consumeWord('as')) {
            this.addError('Expected "as" after import string');
            return null;
        }

        this.skipWhitespace();

        const identifier = this.parseIdentifier();
        if (!identifier) {
            this.addError('Expected identifier after "as"');
            return null;
        }

        this.skipWhitespace();

        // Parse optional import options
        const children = [stringLiteral, identifier];
        if (this.consumeWord('with')) {
            this.skipWhitespace();
            const importOpts = this.parseImportOptions();
            if (importOpts) {
                children.push(importOpts);
            }
        }

        return {
            type: 'import_stmt',
            children,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseResolverDefault(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (!this.consumeWord('resolver')) {
            return null;
        }

        this.skipWhitespace();

        if (!this.consumeWord('default')) {
            this.addError('Expected "default" after "resolver"');
            return null;
        }

        this.skipWhitespace();

        if (!this.consumeWord('uses')) {
            this.addError('Expected "uses" after "resolver default"');
            return null;
        }

        this.skipWhitespace();

        const usesClause = this.parseUsesClause();
        if (!usesClause) {
            this.addError('Expected uses clause after "uses"');
            return null;
        }

        return {
            type: 'resolver_default',
            children: [usesClause],
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseRuleDefinition(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        this.skipWhitespace();
        
        const identifier = this.parseIdentifier();
        if (!identifier) {
            return null;
        }

        this.skipWhitespace();

        if (!this.consume('=')) {
            this.addError('Expected "=" after rule name');
            return null;
        }

        this.skipWhitespace();

        const expression = this.parseExpression();
        if (!expression) {
            this.addError('Expected expression after "="');
            return null;
        }

        this.skipWhitespace();

        const children = [identifier, expression];

        // Parse optional uses clause
        if (this.peekWord() === 'uses') {
            this.consumeWord('uses');
            this.skipWhitespace();
            const usesClause = this.parseUsesClause();
            if (usesClause) {
                children.push(usesClause);
            }
        }

        return {
            type: 'rule_def',
            children,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseExpression(): ASTNode | null {
        return this.parseAlternation();
    }

    private parseAlternation(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const left = this.parseConcatenation();
        if (!left) {
            return null;
        }

        const alternatives = [left];

        while (this.peek() === '|') {
            this.consume('|');
            this.skipWhitespace();
            const right = this.parseConcatenation();
            if (right) {
                alternatives.push(right);
            }
        }

        if (alternatives.length === 1) {
            return alternatives[0];
        }

        return {
            type: 'alt',
            children: alternatives,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseConcatenation(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const elements: ASTNode[] = [];

        while (true) {
            this.skipWhitespace();
            const element = this.parseQuantifiedExpression();
            if (!element) {
                break;
            }
            elements.push(element);
        }

        if (elements.length === 0) {
            return null;
        }

        if (elements.length === 1) {
            return elements[0];
        }

        return {
            type: 'concat',
            children: elements,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseQuantifiedExpression(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const primary = this.parsePrimaryExpression();
        if (!primary) {
            return null;
        }

        this.skipWhitespace();

        const quantifier = this.parseQuantifier();
        if (!quantifier) {
            return primary;
        }

        return {
            type: 'quantified',
            children: [primary, quantifier],
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parsePrimaryExpression(): ASTNode | null {
        this.skipWhitespace();

        // Try parsing different primary expressions
        return this.parseGroupExpression() ||
               this.parseNamedCapture() ||
               this.parseListMatch() ||
               this.parseRegexAtom();
    }

    private parseGroupExpression(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (!this.consume('(')) {
            return null;
        }

        this.skipWhitespace();

        const expr = this.parseExpression();
        if (!expr) {
            this.addError('Expected expression in group');
            return null;
        }

        this.skipWhitespace();

        if (!this.consume(')')) {
            this.addError('Expected closing parenthesis');
            return null;
        }

        return {
            type: 'group_expr',
            children: [expr],
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseNamedCapture(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (!this.consumeString('(?P<')) {
            return null;
        }

        const identifier = this.parseIdentifier();
        if (!identifier) {
            this.addError('Expected identifier in named capture');
            return null;
        }

        if (!this.consume('>')) {
            this.addError('Expected ">" after named capture identifier');
            return null;
        }

        this.skipWhitespace();

        const expr = this.parseExpression();
        if (!expr) {
            this.addError('Expected expression in named capture');
            return null;
        }

        if (!this.consume(')')) {
            this.addError('Expected closing parenthesis in named capture');
            return null;
        }

        return {
            type: 'named_capture',
            children: [identifier, expr],
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseListMatch(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (!this.consumeString('[[')) {
            return null;
        }

        this.skipWhitespace();

        const identifier = this.parseIdentifier();
        if (!identifier) {
            this.addError('Expected identifier in list match');
            return null;
        }

        const children = [identifier];

        this.skipWhitespace();

        // Parse optional filter expression
        if (this.consume(':')) {
            this.skipWhitespace();
            const filterExpr = this.parseFilterExpression();
            if (filterExpr) {
                children.push(filterExpr);
            }
        }

        this.skipWhitespace();

        if (!this.consumeString(']]')) {
            this.addError('Expected "]]" to close list match');
            return null;
        }

        return {
            type: 'list_match',
            children,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseRegexAtom(): ASTNode | null {
        // Try parsing different regex atoms
        return this.parseEscape() ||
               this.parseAnchor() ||
               this.parseDot() ||
               this.parseCharClass() ||
               this.parseString() ||
               this.parseIdentifier();
    }

    private parseQuantifier(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (this.consume('?')) {
            return {
                type: 'qmark',
                line: startPos.line,
                column: startPos.column,
                length: 1
            };
        }

        if (this.consume('{')) {
            const min = this.parseNumber();
            if (!min) {
                this.addError('Expected number in quantifier');
                return null;
            }

            const children = [min];

            if (this.consume(',')) {
                const max = this.parseNumber();
                if (max) {
                    children.push(max);
                    if (!this.consume('}')) {
                        this.addError('Expected "}" to close range quantifier');
                        return null;
                    }
                    return {
                        type: 'range',
                        children,
                        line: startPos.line,
                        column: startPos.column,
                        length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                    };
                } else {
                    // {n,} format - not allowed in OMG
                    this.addError('Open-ended quantifiers not allowed in OMG');
                    return null;
                }
            } else {
                if (!this.consume('}')) {
                    this.addError('Expected "}" to close exact quantifier');
                    return null;
                }
                return {
                    type: 'exact_range',
                    children,
                    line: startPos.line,
                    column: startPos.column,
                    length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                };
            }
        }

        return null;
    }

    // Helper parsing methods
    private parseVersionLiteral(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const match = this.text.slice(this.position).match(/^[0-9]+\.[0-9]+/);
        if (match) {
            this.position += match[0].length;
            this.column += match[0].length;
            return {
                type: 'version_literal',
                value: match[0],
                line: startPos.line,
                column: startPos.column,
                length: match[0].length
            };
        }
        return null;
    }

    private parseString(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        if (this.consume('"')) {
            let value = '';
            while (this.peek() !== null && this.peek() !== '"') {
                if (this.peek() === '\\') {
                    this.advance();
                    const escaped = this.peek();
                    if (escaped !== null) {
                        value += '\\' + escaped;
                        this.advance();
                    }
                } else {
                    value += this.peek();
                    this.advance();
                }
            }
            if (this.consume('"')) {
                return {
                    type: 'string',
                    value: '"' + value + '"',
                    line: startPos.line,
                    column: startPos.column,
                    length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                };
            }
        }
        return null;
    }

    private parseIdentifier(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const match = this.text.slice(this.position).match(/^[a-zA-Z0-9_]+\.?[a-zA-Z0-9_]*/);
        if (match) {
            this.position += match[0].length;
            this.column += match[0].length;
            return {
                type: 'identifier',
                value: match[0],
                line: startPos.line,
                column: startPos.column,
                length: match[0].length
            };
        }
        return null;
    }

    private parseNumber(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const match = this.text.slice(this.position).match(/^\d+/);
        if (match) {
            this.position += match[0].length;
            this.column += match[0].length;
            return {
                type: 'number',
                value: parseInt(match[0], 10),
                line: startPos.line,
                column: startPos.column,
                length: match[0].length
            };
        }
        return null;
    }

    private parseEscape(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const match = this.text.slice(this.position).match(/^\\[dDsSwWbB\\\]\[-]/);
        if (match) {
            this.position += match[0].length;
            this.column += match[0].length;
            return {
                type: 'escape',
                value: match[0],
                line: startPos.line,
                column: startPos.column,
                length: match[0].length
            };
        }
        return null;
    }

    private parseAnchor(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        if (this.consume('^') || this.consume('$')) {
            return {
                type: 'anchor',
                value: this.text.charAt(this.position - 1),
                line: startPos.line,
                column: startPos.column,
                length: 1
            };
        }
        return null;
    }

    private parseDot(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        if (this.consume('.')) {
            return {
                type: 'dot',
                line: startPos.line,
                column: startPos.column,
                length: 1
            };
        }
        return null;
    }

    private parseCharClass(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        if (this.consume('[')) {
            const items: ASTNode[] = [];
            while (this.peek() !== null && this.peek() !== ']') {
                const item = this.parseCharClassItem();
                if (item) {
                    items.push(item);
                } else {
                    this.advance();
                }
            }
            if (this.consume(']')) {
                return {
                    type: 'charclass',
                    children: items,
                    line: startPos.line,
                    column: startPos.column,
                    length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                };
            }
        }
        return null;
    }

    private parseCharClassItem(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        // Check for character range
        if (this.isLetter(this.peek()) && this.text.charAt(this.position + 1) === '-' && this.isLetter(this.text.charAt(this.position + 2))) {
            const start = this.peek();
            this.advance();
            this.advance(); // consume '-'
            const end = this.peek();
            this.advance();
            return {
                type: 'char_range',
                value: start + '-' + end,
                line: startPos.line,
                column: startPos.column,
                length: 3
            };
        }

        // Check for escape sequence
        const escape = this.parseEscape();
        if (escape) {
            return escape;
        }

        // Regular character
        const char = this.peek();
        if (char !== null && char !== ']' && char !== '\\') {
            this.advance();
            return {
                type: 'char',
                value: char,
                line: startPos.line,
                column: startPos.column,
                length: 1
            };
        }

        return null;
    }

    private parseImportOptions(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const flags: ASTNode[] = [];

        const flag = this.parseImportFlag();
        if (flag) {
            flags.push(flag);
        }

        while (this.consume(',')) {
            this.skipWhitespace();
            const nextFlag = this.parseImportFlag();
            if (nextFlag) {
                flags.push(nextFlag);
            }
        }

        if (flags.length === 0) {
            return null;
        }

        return {
            type: 'import_opts',
            children: flags,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseImportFlag(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const flags = ['ignore-case', 'ignore-punctuation', 'elide-whitespace', 'word-boundary', 'word-prefix', 'word-suffix', 'line-start', 'line-end'];
        
        for (const flag of flags) {
            if (this.consumeWord(flag)) {
                return {
                    type: 'import_flag',
                    value: flag,
                    line: startPos.line,
                    column: startPos.column,
                    length: flag.length
                };
            }
        }
        return null;
    }

    private parseUsesClause(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const children: ASTNode[] = [];

        // Parse optional resolver scope
        if (this.peekWord() === 'resolver' || this.peekWord() === 'default') {
            const scope = this.parseResolverScope();
            if (scope) {
                children.push(scope);
            }
        }

        // Parse resolver method
        const method = this.parseResolverMethod();
        if (method) {
            children.push(method);
        }

        // Parse optional 'with' clause
        if (this.peekWord() === 'with') {
            this.consumeWord('with');
            this.skipWhitespace();
            const withClause = this.parseResolverWith();
            if (withClause) {
                children.push(withClause);
            }
        }

        if (children.length === 0) {
            return null;
        }

        return {
            type: 'uses_clause',
            children,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseResolverScope(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (this.consumeWord('default')) {
            this.skipWhitespace();
            if (this.consumeWord('resolver')) {
                return {
                    type: 'resolver_scope',
                    value: 'default resolver',
                    line: startPos.line,
                    column: startPos.column,
                    length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                };
            }
        } else if (this.consumeWord('resolver')) {
            return {
                type: 'resolver_scope',
                value: 'resolver',
                line: startPos.line,
                column: startPos.column,
                length: 8
            };
        }
        return null;
    }

    private parseResolverMethod(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        const identifier = this.parseIdentifier();
        if (!identifier) {
            return null;
        }

        const children = [identifier];

        this.skipWhitespace();

        // Parse optional argument list
        if (this.consume('(')) {
            this.skipWhitespace();
            const args = this.parseResolverArgList();
            if (args) {
                children.push(args);
            }
            if (!this.consume(')')) {
                this.addError('Expected closing parenthesis for resolver method');
            }
        }

        return {
            type: 'resolver_method',
            children,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseResolverArgList(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const args: ASTNode[] = [];

        const arg = this.parseResolverArg();
        if (arg) {
            args.push(arg);
        }

        while (this.consume(',')) {
            this.skipWhitespace();
            const nextArg = this.parseResolverArg();
            if (nextArg) {
                args.push(nextArg);
            }
        }

        if (args.length === 0) {
            return null;
        }

        return {
            type: 'resolver_arg_list',
            children: args,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseResolverArg(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        // Try identifier = string format first
        const identifier = this.parseIdentifier();
        if (identifier) {
            this.skipWhitespace();
            if (this.consume('=')) {
                this.skipWhitespace();
                const string = this.parseString();
                if (string) {
                    return {
                        type: 'resolver_arg',
                        children: [identifier, string],
                        line: startPos.line,
                        column: startPos.column,
                        length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                    };
                }
            }
            // Reset position if we failed to parse identifier = string
            this.position = this.getPositionFromLineColumn(startPos.line, startPos.column);
            this.line = startPos.line;
            this.column = startPos.column;
        }

        // Try just string
        const string = this.parseString();
        if (string) {
            return {
                type: 'resolver_arg',
                children: [string],
                line: startPos.line,
                column: startPos.column,
                length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
            };
        }

        return null;
    }

    private parseResolverWith(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        const flags: ASTNode[] = [];

        const flag = this.parseResolverFlag();
        if (flag) {
            flags.push(flag);
        }

        while (this.consume(',')) {
            this.skipWhitespace();
            const nextFlag = this.parseResolverFlag();
            if (nextFlag) {
                flags.push(nextFlag);
            }
        }

        if (flags.length === 0) {
            return null;
        }

        return {
            type: 'resolver_with',
            children: flags,
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    private parseResolverFlag(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        if (this.consumeWord('ignore-case')) {
            return {
                type: 'resolver_flag',
                value: 'ignore-case',
                line: startPos.line,
                column: startPos.column,
                length: 11
            };
        }

        if (this.consumeWord('ignore-punctuation')) {
            return {
                type: 'resolver_flag',
                value: 'ignore-punctuation',
                line: startPos.line,
                column: startPos.column,
                length: 18
            };
        }

        if (this.consumeWord('optional-tokens')) {
            this.skipWhitespace();
            if (this.consume('(')) {
                const tokens: ASTNode[] = [];
                this.skipWhitespace();
                
                const token = this.parseString();
                if (token) {
                    tokens.push(token);
                }

                while (this.consume(',')) {
                    this.skipWhitespace();
                    const nextToken = this.parseString();
                    if (nextToken) {
                        tokens.push(nextToken);
                    }
                }

                if (this.consume(')')) {
                    return {
                        type: 'optional_tokens_clause',
                        children: tokens,
                        line: startPos.line,
                        column: startPos.column,
                        length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
                    };
                }
            }
        }

        return null;
    }

    private parseFilterExpression(): ASTNode | null {
        const startPos = this.getCurrentPosition();
        
        const identifier = this.parseIdentifier();
        if (!identifier) {
            return null;
        }

        this.skipWhitespace();

        if (!this.consume('(')) {
            return null;
        }

        this.skipWhitespace();

        const string = this.parseString();
        if (!string) {
            this.addError('Expected string in filter expression');
            return null;
        }

        if (!this.consume(')')) {
            this.addError('Expected closing parenthesis in filter expression');
            return null;
        }

        return {
            type: 'filter_expr',
            children: [identifier, string],
            line: startPos.line,
            column: startPos.column,
            length: this.position - this.getPositionFromLineColumn(startPos.line, startPos.column)
        };
    }

    // Utility methods
    private peek(): string | null {
        if (this.position >= this.text.length) {
            return null;
        }
        return this.text.charAt(this.position);
    }

    private advance(): string | null {
        if (this.position >= this.text.length) {
            return null;
        }
        const char = this.text.charAt(this.position);
        this.position++;
        if (char === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return char;
    }

    private consume(expected: string): boolean {
        if (this.peek() === expected) {
            this.advance();
            return true;
        }
        return false;
    }

    private consumeString(expected: string): boolean {
        if (this.text.slice(this.position, this.position + expected.length) === expected) {
            for (let i = 0; i < expected.length; i++) {
                this.advance();
            }
            return true;
        }
        return false;
    }

    private consumeWord(expected: string): boolean {
        const wordMatch = this.text.slice(this.position).match(/^[a-zA-Z0-9_-]+/);
        if (wordMatch && wordMatch[0] === expected) {
            for (let i = 0; i < expected.length; i++) {
                this.advance();
            }
            return true;
        }
        return false;
    }

    private peekWord(): string | null {
        const wordMatch = this.text.slice(this.position).match(/^[a-zA-Z0-9_-]+/);
        return wordMatch ? wordMatch[0] : null;
    }

    private skipWhitespace(): void {
        while (this.peek() !== null && /\s/.test(this.peek()!)) {
            this.advance();
        }
    }

    private isLetter(char: string | null): boolean {
        return char !== null && /[a-zA-Z]/.test(char);
    }

    private getCurrentPosition(): Position {
        return { line: this.line, column: this.column };
    }

    private getPositionFromLineColumn(line: number, column: number): number {
        let pos = 0;
        let currentLine = 1;
        let currentColumn = 1;
        
        while (pos < this.text.length && (currentLine < line || (currentLine === line && currentColumn < column))) {
            if (this.text.charAt(pos) === '\n') {
                currentLine++;
                currentColumn = 1;
            } else {
                currentColumn++;
            }
            pos++;
        }
        
        return pos;
    }

    private addError(message: string): void {
        this.errors.push({
            message,
            line: this.line,
            column: this.column,
            length: 1
        });
    }

    // Public utility methods for AST navigation
    public static findNodeAt(ast: ASTNode, line: number, column: number): ASTNode | null {
        if (ast.line === line && column >= ast.column && column < ast.column + ast.length) {
            // Check children first for more specific matches
            if (ast.children) {
                for (const child of ast.children) {
                    const childMatch = this.findNodeAt(child, line, column);
                    if (childMatch) {
                        return childMatch;
                    }
                }
            }
            return ast;
        }
        return null;
    }

    public static findNodesOfType(ast: ASTNode, nodeType: string): ASTNode[] {
        const results: ASTNode[] = [];
        
        if (ast.type === nodeType) {
            results.push(ast);
        }
        
        if (ast.children) {
            for (const child of ast.children) {
                results.push(...this.findNodesOfType(child, nodeType));
            }
        }
        
        return results;
    }

    public static getNodeText(ast: ASTNode, text: string): string {
        const startPos = this.getPositionFromLineColumn(ast.line, ast.column, text);
        return text.slice(startPos, startPos + ast.length);
    }

    private static getPositionFromLineColumn(line: number, column: number, text: string): number {
        let pos = 0;
        let currentLine = 1;
        let currentColumn = 1;
        
        while (pos < text.length && (currentLine < line || (currentLine === line && currentColumn < column))) {
            if (text.charAt(pos) === '\n') {
                currentLine++;
                currentColumn = 1;
            } else {
                currentColumn++;
            }
            pos++;
        }
        
        return pos;
    }
}
