# Implementation Guide

## Architecture

```
SubstackSaver/
├── manifest.json          # Extension configuration (MV3)
├── popup/                # Toolbar popup UI
│   ├── popup.html
│   └── popup.js
├── dashboard/            # Reading list dashboard
│   ├── dashboard.html
│   └── dashboard.js
├── content/              # Content script for progress tracking
│   └── content.js
├── background/           # Service worker
│   └── background.js
├── shared/               # Shared utilities
│   ├── utils.js
│   ├── storage.js
│   └── styles/fluent.css
└── icons/                # Extension icons
```

## Data Model

### Article
```javascript
{
  id: string,           // URL hash
  url: string,
  title: string,
  author: string,
  thumbnail: string,
  savedAt: number,      // Unix timestamp
  progress: number,     // 0-100
  tags: string[],       // Tag IDs
  folder: string|null,  // Folder ID
  notes: string,
  isFavorite: boolean
}
```

### Tag
```javascript
{
  id: string,
  name: string,
  color: string          // Hex color
}
```

### Folder
```javascript
{
  id: string,
  name: string,
  order: number
}
```

## Key Components

### Popup (popup.js)
- `init()` - Initialize popup, check Substack URL
- `loadArticleInfo(tab)` - Scrape page metadata via executeScript
- `renderTagDropdown()` / `renderFolderDropdown()` - Render options
- Event handlers for save, tag selection, folder selection

### Dashboard (dashboard.js)
- `init()` - Load data, setup listeners
- `loadData()` - Fetch articles, tags, folders from storage
- `renderArticles()` - Render grid/list with filters
- Search debounced at 300ms
- Grid/List view toggle

### Content Script (content.js)
- `calculateProgress()` - Compute scroll percentage
- `saveProgress()` - Debounced (500ms) save to localStorage
- `restoreProgress()` - Scroll to saved position on load

### Background (background.js)
- `initializeStorage()` - Setup default tags/folders
- `createContextMenus()` - Right-click menu items
- Storage operations with sync/local fallback

## Storage Pattern

All storage uses try/catch with fallback:
```javascript
try {
  await chrome.storage.sync.set({ key: value });
} catch (e) {
  await chrome.storage.local.set({ key: value });
}
```

## Security

- All user data escaped with `escapeHtml()` before innerHTML
- Article input sanitized with `sanitizeInput()`
- URLs encoded in data attributes with `encodeURIComponent()`

## Theme System

Uses CSS custom properties with system preference detection:
```css
:root { --bg-primary: #FFFFFF; }
[data-theme="dark"] { --bg-primary: #1F1F1F; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg-primary: #1F1F1F; }
}
```

## Browser Support

- Microsoft Edge (Chromium)
- Manifest V3 required
