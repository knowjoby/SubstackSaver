# SubstackSaver - Edge Browser Extension Specification

## 1. Project Overview

**Project Name:** SubstackSaver
**Type:** Edge Browser Extension (Manifest V3)
**Core Functionality:** A native-feeling Edge extension that enhances Substack bookmarking with quick-save, progress tracking, and organized reading lists with Edge sync support.
**Target Users:** Substack readers who want to save, organize, and track their reading progress across articles.

---

## 2. UI/UX Specification

### 2.1 Layout Structure

**Popup (Toolbar Button)**
- Dimensions: 320px width × auto height
- Sections: Header, Save Button, Tag Selector, Quick Actions
- Opens on toolbar icon click

**Dashboard (New Tab/Side Panel)**
- Full-page layout with sidebar navigation
- Sidebar: 240px fixed width
- Main content: Fluid width with max-width 1200px
- Sections: Header with search, Filter bar, Article grid/list

**Context Menu**
- Native Edge context menu integration
- Options: "Save to SubstackSaver", "Add Tag", "Save to Folder"

### 2.2 Visual Design

**Color Palette - Light Mode**
- Background Primary: `#FFFFFF`
- Background Secondary: `#F3F3F3`
- Background Tertiary: `#E5E5E5`
- Accent Primary: `#0078D4` (Edge Blue)
- Accent Hover: `#106EBE`
- Text Primary: `#1A1A1A`
- Text Secondary: `#5C5C5C`
- Border: `#E0E0E0`
- Success: `#107C10`
- Warning: `#FFB900`
- Error: `#D13438`

**Color Palette - Dark Mode**
- Background Primary: `#1F1F1F`
- Background Secondary: `#2D2D2D`
- Background Tertiary: `#3D3D3D`
- Accent Primary: `#60CDFF`
- Accent Hover: `#4CC2FF`
- Text Primary: `#FFFFFF`
- Text Secondary: `#A0A0A0`
- Border: `#404040`
- Success: `#6CCB5F`
- Warning: `#FCE100`
- Error: `#FF99A4`

**Tag Colors (8 options)**
- Red: `#D13438`
- Orange: `#FF8C00`
- Yellow: `#FFB900`
- Green: `#107C10`
- Teal: `#008080`
- Blue: `#0078D4`
- Purple: `#881798`
- Gray: `#5C5C5C`

**Typography**
- Font Family: `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif`
- Heading 1: 24px, Semibold (600)
- Heading 2: 18px, Semibold (600)
- Body: 14px, Regular (400)
- Caption: 12px, Regular (400)
- Monospace: `"Cascadia Code", "Consolas", monospace`

**Spacing System**
- Base unit: 4px
- XS: 4px
- SM: 8px
- MD: 12px
- LG: 16px
- XL: 24px
- XXL: 32px

**Visual Effects**
- Card shadows: `0 2px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)`
- Elevated shadows: `0 8px 16px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.12)`
- Border radius: 4px (buttons), 8px (cards), 12px (panels)
- Transitions: 150ms ease-out for interactions
- Acrylic/Mica backdrop: Available in dashboard sidebar

### 2.3 Components

**Toolbar Button (Popup)**
- Save button: Primary accent color, full width, 36px height
- Tag dropdown: Custom select with colored dots, max 5 visible + "More"
- States: Default, Hover (darker), Active (pressed), Loading (spinner), Success (checkmark)
- Quick tags: Display 5 most-used tags

**Article Card**
- Thumbnail: 160px × 90px (16:9), placeholder gradient if none
- Title: 2 lines max, ellipsis overflow
- Author: 1 line, secondary text color
- Tags: Colored dots, max 3 visible + count
- Progress bar: 4px height, accent color fill
- Actions: Delete (hover reveal), Edit tags

**Search Bar**
- Icon prefix (magnifying glass)
- Placeholder: "Search by title, author, or tag..."
- Clear button on input
- Live filtering as user types

**Filter Pills**
- Horizontal scrollable container
- Options: All, Unread, In Progress, Completed
- Tag filter: Multi-select dropdown
- Sort: Date Added, Progress, Title

**Sidebar Navigation**
- Logo/App name at top
- Navigation items: All Articles, Folders, Tags, Settings
- Folder tree with expand/collapse
- Add folder button at bottom
- Sync status indicator

---

## 3. Functionality Specification

### 3.1 Core Features

**One-Click Save Button**
- Click toolbar icon → popup opens with current page info
- Auto-detect Substack article: title, author, URL, thumbnail
- Single click "Save" button to bookmark
- Show success confirmation (checkmark animation)
- If already saved, show "Saved" state with option to unsave

**Quick-Tag Dropdown**
- Display dropdown with tag options on save
- Create new tag inline
- Show color picker for new tags
- Remember last 5 used tags for quick access
- Multi-select capability

**Reading List Dashboard**
- Open via toolbar button → "Open Dashboard" link
- Opens in new tab at `dashboard.html`
- Grid view (default) or list view toggle
- Infinite scroll pagination (20 items per load)
- Empty state with illustration and CTA

**Progress Tracking**
- Content script injected on Substack pages
- Track scroll position as percentage
- Auto-save position on scroll stop (debounced 500ms)
- Visual indicator in popup: "You've read 45%"
- Resume reading button opens article at saved position

**Organization**
- Tags: Create, edit, delete, merge
- Folders: Create, rename, delete, drag-drop articles
- Color-coded tags with 8 preset colors
- Default folders: "Reading Now", "Archive", "Favorites"
- Bulk actions: Select multiple, move, tag, delete

**Search and Filter**
- Full-text search across title, author, tags
- Filter by: Read status, Tags, Folders, Date range
- Sort by: Date added, Progress, Title (A-Z/Z-A)
- Save filter presets

**Edge Collections Export**
- Export button in settings
- Format: Edge Collections JSON
- Include: Title, URL, notes, tags as collection items
- Import from Edge Collections option

### 3.2 User Interactions

**First Run**
1. Welcome modal explaining features
2. Request sync permission (optional)
3. Create first folder (optional)
4. Tutorial tooltip on toolbar icon

**Save Article Flow**
1. Click toolbar icon
2. Popup shows article preview
3. (Optional) Select tags from dropdown
4. (Optional) Select folder
5. Click Save
6. Success animation, popup closes

**Resume Reading Flow**
1. Open dashboard
2. Click article card or "Continue" button
3. Article opens in current tab
4. Scroll position restored automatically

### 3.3 Data Handling

**Storage**
- Use `chrome.storage.sync` for cross-device sync
- Fallback to `chrome.storage.local` if sync unavailable
- Data structure:
```json
{
  "articles": {
    "[url_hash]": {
      "id": "string",
      "url": "string",
      "title": "string",
      "author": "string",
      "thumbnail": "string",
      "savedAt": "timestamp",
      "progress": "number (0-100)",
      "tags": ["string"],
      "folder": "string | null",
      "notes": "string",
      "isFavorite": "boolean"
    }
  },
  "tags": {
    "[tag_id]": {
      "id": "string",
      "name": "string",
      "color": "string"
    }
  },
  "folders": {
    "[folder_id]": {
      "id": "string",
      "name": "string",
      "order": "number"
    }
  },
  "settings": {
    "theme": "system | light | dark",
    "defaultView": "grid | list",
    "showProgress": "boolean"
  }
}
```

### 3.4 Edge Integration

**Fluent Design System**
- Use Segoe UI Variable font
- Implement Mica/Acrylic effects where supported
- Edge-specific CSS custom properties
- Smooth animations matching Edge

**Dark/Light Mode**
- Auto-detect system preference
- Manual override in settings
- Instant theme switching

**Context Menu**
- Right-click on page: "Save to SubstackSaver"
- Right-click on link: "Save link to SubstackSaver"
- Right-click on article card: Quick actions

**Edge Sync**
- Use chrome.storage.sync for all data
- Automatic conflict resolution (latest wins)
- Sync status indicator in UI

---

## 4. Technical Architecture

### 4.1 File Structure
```
edge-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── dashboard/
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.js
├── content/
│   └── content.js
├── background/
│   └── background.js
├── shared/
│   ├── storage.js
│   ├── utils.js
│   └── styles/
│       ├── variables.css
│       └── fluent.css
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── _locales/
    └── en/
        └── messages.json
```

### 4.2 Permissions Required
- `storage` - For saving bookmarks and settings
- `tabs` - For reading active tab info
- `contextMenus` - For right-click menu
- `scripting` - For content script injection
- `activeTab` - For current page access

---

## 5. Acceptance Criteria

### 5.1 Core Functionality
- [ ] Toolbar button opens popup with article info
- [ ] Save button adds article to storage
- [ ] Tags can be created and assigned
- [ ] Dashboard displays all saved articles
- [ ] Search filters articles in real-time
- [ ] Progress tracking saves scroll position
- [ ] Dark/light mode toggles correctly

### 5.2 Visual Checkpoints
- [ ] Popup matches Fluent Design spec
- [ ] Dashboard has proper sidebar layout
- [ ] Cards display all required info
- [ ] Animations are smooth (150ms)
- [ ] Dark mode colors are correct

### 5.3 Edge Integration
- [ ] Context menu items appear on right-click
- [ ] Sync works across devices (when signed in)
- [ ] Extension follows Edge UX patterns
