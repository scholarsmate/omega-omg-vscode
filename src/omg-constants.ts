/**
 * OMG Language Constants
 * Shared constants for the OMG language extension
 */

export const KEYWORDS = [
    'version',
    'import',
    'as',
    'with',
    'resolver',
    'default',
    'uses'
] as const;

export const IMPORT_FLAGS = [
    'word-boundary',
    'word-prefix',
    'word-suffix',
    'ignore-case',
    'ignore-punctuation',
    'elide-whitespace',
    'line-start',
    'line-end'
] as const;

export const RESOLVER_FLAGS = [
    'ignore-case',
    'ignore-punctuation',
    'optional-tokens'
] as const;

export const ESCAPE_SEQUENCES = [
    '\\d', '\\D', '\\s', '\\S', '\\w', '\\W', '\\b', '\\B'
] as const;

export const QUANTIFIERS = [
    { label: '?', detail: 'Optional (zero or one)' },
    { label: '{n}', detail: 'Exactly n times' },
    { label: '{n,m}', detail: 'Between n and m times' }
] as const;

/**
 * Documentation for OMG keywords
 */
export const KEYWORD_DOCUMENTATION: { [key: string]: string } = {
    'version': 'Specifies the OMG language version',
    'import': 'Imports external match lists or rule definitions',
    'as': 'Provides an alias for imported resources',
    'with': 'Specifies additional options or flags',
    'resolver': 'Defines or references a resolution strategy',
    'default': 'Specifies the default resolver for the document',
    'uses': 'Specifies which resolver algorithm to use'
};

/**
 * Documentation for import flags
 */
export const IMPORT_FLAG_DOCUMENTATION: { [key: string]: string } = {
    'word-boundary': 'Matches only occur at word boundaries',
    'word-prefix': 'Matches only occur at the beginning of words',
    'word-suffix': 'Matches only occur at the end of words',
    'ignore-case': 'Case-insensitive matching',
    'ignore-punctuation': 'Ignores punctuation characters during matching',
    'elide-whitespace': 'Treats whitespace as optional during matching',
    'line-start': 'Matches only at the start of lines',
    'line-end': 'Matches only at the end of lines'
};

/**
 * Documentation for resolver flags
 */
export const RESOLVER_FLAG_DOCUMENTATION: { [key: string]: string } = {
    'ignore-case': 'Case-insensitive resolution',
    'ignore-punctuation': 'Ignores punctuation during resolution',
    'optional-tokens': 'Treats specified tokens as optional during resolution'
};

/**
 * Documentation for escape sequences
 */
export const ESCAPE_SEQUENCE_DOCUMENTATION: { [key: string]: string } = {
    '\\d': 'Matches any digit (0-9)',
    '\\D': 'Matches any non-digit character',
    '\\s': 'Matches any whitespace character',
    '\\S': 'Matches any non-whitespace character',
    '\\w': 'Matches any word character (a-z, A-Z, 0-9, _)',
    '\\W': 'Matches any non-word character',
    '\\b': 'Matches a word boundary',
    '\\B': 'Matches a non-word boundary'
};

/**
 * Helper functions for working with OMG language elements
 */
export function isKeyword(word: string): boolean {
    return KEYWORDS.includes(word as any);
}

export function isImportFlag(word: string): boolean {
    return IMPORT_FLAGS.includes(word as any);
}

export function isResolverFlag(word: string): boolean {
    return RESOLVER_FLAGS.includes(word as any);
}

export function isEscapeSequence(word: string): boolean {
    return ESCAPE_SEQUENCES.includes(word as any);
}

export function getKeywordDocumentation(keyword: string): string {
    return KEYWORD_DOCUMENTATION[keyword] || 'OMG language keyword';
}

export function getImportFlagDocumentation(flag: string): string {
    return IMPORT_FLAG_DOCUMENTATION[flag] || 'Import processing flag';
}

export function getResolverFlagDocumentation(flag: string): string {
    return RESOLVER_FLAG_DOCUMENTATION[flag] || 'Resolver processing flag';
}

export function getEscapeSequenceDocumentation(escape: string): string {
    return ESCAPE_SEQUENCE_DOCUMENTATION[escape] || 'Escape sequence';
}
