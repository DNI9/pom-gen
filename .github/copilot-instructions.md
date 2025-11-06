# POM Generator - AI Agent Guide

## Project Overview

This is a Chrome extension that helps generate Page Object Model (POM) code from web elements, using Google's Gemini API for code generation.

## Architecture

### Key Components

- **Content Script** (`src/content/content.ts`):

  - Handles element selection and capture with visual overlay
  - Uses intelligent name generation based on element attributes
  - Manages real-time input capture for form fields
  - Element capture priority: name -> id -> placeholder -> aria-label -> value -> text content

- **Background Service** (`src/background/background.ts`):
  - Manages Gemini API communication
  - Handles POM code generation based on captured elements
  - Supports multiple output languages (Java, TypeScript, JavaScript)
  - Uses structured response schema for consistent output

### Data Flow

1. User captures elements via content script -> stored in chrome.storage.local
2. Elements bundled with template + language preference -> sent to Gemini API
3. Generated code returned as structured JSON with POM class and data model

## Development Patterns

### 1. Element Selection

```typescript
// Prefer robust selectors in this order:
1. CSS selectors with IDs (#elementId)
2. XPath fallback for complex selections
3. Relative selectors with structural context
```

### 2. Code Generation Templates

- Language-specific templates in `background.ts`
- Each includes:
  - Class/interface structure
  - Element locator patterns
  - Helper methods for interaction

### 3. State Management

- Uses Chrome storage for persistence
- Element data structured by URL
- Real-time updates for input values

## Integration Points

### External Dependencies

- Chrome Extension APIs:
  - `storage.local` for element persistence
  - `runtime.sendMessage` for component communication
- Google Gemini API for code generation

### File Structure Conventions

- `src/` - TypeScript source code
  - `background/` - Extension service workers
  - `content/` - Page injection scripts
  - `popup/` - Extension UI
  - `shared/` - Common types and utilities

## Common Development Tasks

### Adding New Features

1. Update types in `shared/types.ts`
2. Implement capture logic in content script
3. Add generation template in background script
4. Update UI in popup component

### Testing

- Manual testing through Chrome extension UI
- Load unpacked extension from `dist/` directory
- Test element capture on various web pages

## Build Pipeline

```bash
npm install   # Install dependencies
npm run build # Build extension (outputs to dist/)
```

- Uses webpack for bundling
- TypeScript compilation configured in `tsconfig.json`
