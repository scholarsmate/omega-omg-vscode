# OmegaOMG Language Support for VS Code

![OMG in VS Code – syntax highlighting, hovers, and diagnostics](images/OMG-VSCode.png)

Empower domain pattern authors and data engineers with fast, reliable authoring of Omega Object Matching Grammar (OMG) files directly inside Visual Studio Code. The OmegaOMG Language Support extension turns raw pattern text into a productive, validated, navigable editing experience.

---
## Core Value
Design richer linguistic and entity-matching grammars with confidence. Instant feedback (diagnostics + hovers) shrinks iteration loops, while smart completions reduce syntax friction and errors. Ship accurate pattern logic faster.

---
## Who It’s For
- **Data / Knowledge Engineers** building rule-driven extraction or resolution logic
- **Search & Matching Teams** curating controlled vocabularies and normalization layers
- **ML / NLP Practitioners** prototyping hybrid (symbolic + learned) pipelines
- **Platform & Tooling Engineers** standardizing internal pattern authoring workflows

---
## Key Capabilities
### 1. Intelligent Editing
- Full syntax highlighting (TextMate grammar) for all OMG tokens
- Context-aware autocomplete for keywords, import flags, resolver methods, rule names, list aliases, escapes, quantifiers
- Multiple trigger characters registered for fluid suggestions (`.["[(\\`)

### 2. Real-Time Assurance
- AST-backed parsing (custom lightweight parser) on every change
- Immediate surfacing of:
  - Syntax issues
  - Undefined rule references
  - Disallowed / unbounded quantifiers (`+`, `*`, `{n,}`)
  - Missing file references in `import` & `optional-tokens()` clauses
- Clear diagnostics in Problems panel with precise ranges

### 3. Deep Understanding at Cursor
- Rich hover cards for: list matches, named captures, character classes, quantifiers, anchors, resolver flags & methods, escape sequences, file paths (with existence check)
- Dual strategy: AST-derived semantics + regex fallback for resiliency

### 4. Focused Navigation (Single File)
- Go to Definition for rule names
- Find All References for identifiers within the current document

### 5. File Validation
- Inline verification of imported and optional token files (relative paths)
- Visual cues (squiggles + hover status) to catch environment/setup gaps early

### 6. Ergonomic Grammar Authoring
- Bounded quantifier guidance built-in
- Helpful completion metadata (detail + documentation fields)
- Consistent naming semantics for resolvers & rules

---
## Differentiators
| Area | OmegaOMG Extension Advantage |
|------|------------------------------|
| Parsing Depth | Maintains an AST to drive diagnostics & semantic hovers (not just regex coloring) |
| Resilience | Graceful fallback hover logic ensures context help even under partial parse states |
| Validation | Combines syntactic + semantic + filesystem checks inline |
| Extensibility Path | Clear separation (constants, parser, language service) for future feature growth |
| Author Velocity | Smart context completions reduce boilerplate & prevent common mistakes |

---
## Typical Workflow
1. Create or open a `.omg` file
2. Define `version` and any `import` sources
3. Add rules using `rule_name = pattern`
4. Refine with list matches `[[alias]]`, named captures, filters & quantifiers
5. Use hover + diagnostics to iteratively refine correctness
6. Add resolver logic via `resolver default uses exact` or rule-level `uses ... with flags`
7. Validate all references before committing

---
## Example Snippet
```omg
version 1.0

import "names.txt" as names with ignore-case, word-prefix
import "cities.txt" as cities with word-boundary

person_lives_in = (?P<who>[[names]]) " lives in " (?P<where>[[cities]])
```

Diagnostics highlight unresolved symbols or missing files instantly.

---
## Productivity Highlights
| Problem | Without Extension | With OmegaOMG Support |
|---------|-------------------|------------------------|
| Typos in flags | Silent failure later | Flag auto-complete & hovers |
| Undefined rules | Hard to notice | Immediate error diagnostic |
| Missing import files | Runtime surprises | Inline file existence check |
| Quantifier misuse | Subtle logic drift | Disallowed forms flagged |
| Cognitive load | Constant docs lookup | On-cursor semantic hover summaries |

---
## Roadmap (Planned Enhancements)
- Multi-file rule graph navigation (cross-file references)
- Snippet library for common pattern archetypes
- Configurable diagnostic severity levels
- Workspace-level caching for large grammar sets
- CI integration recipes (lint + validate OMG sources)

(Feedback-driven prioritization—open an issue to influence ordering.)

---
## Getting Started
```
git clone https://github.com/scholarsmate/omega-omg-vscode
cd omega-omg-vscode
npm install
npm run build
npm run install-local   # installs the generated VSIX into VS Code
# Press F5 in VS Code for development host debugging
```
Open any `.omg` file—features activate automatically.

---
## Extensibility & Contribution
Clearly separated modules: `omg-parser.ts` (syntax), `omg-language-service.ts` (features), `omg-constants.ts` (surface metadata). This structure enables targeted PRs (e.g., add a new flag, extend resolver methods, introduce multi-file indexing).

---
## Quality & Safety Principles
- Deterministic parser (no catastrophic backtracking)
- Controlled filesystem reads (only relative existence checks)
- No network calls or telemetry
- Minimal dependency surface for reliable builds

---
## Call to Action
Accelerate rule-centric matching development. Install the OmegaOMG Language Support extension and turn raw OMG text into a guided, high-confidence authoring workflow.

> Have a feature request or large deployment use case? Open an issue or start a discussion—your scenario can shape the roadmap.

---
**Transform pattern authoring from guesswork to guided engineering.**
