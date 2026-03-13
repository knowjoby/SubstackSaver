# SubstackSaver

A native Edge browser extension that enhances your Substack reading experience with quick-save, progress tracking, and organized bookmarking.

## Features

- **One-Click Save** - Save Substack articles instantly from the toolbar
- **Quick Tags** - Organize with color-coded tags
- **Progress Tracking** - Automatically saves your reading position
- **Reading Dashboard** - Clean interface to manage your saved articles
- **Search & Filter** - Find articles by title, author, or tags
- **Dark/Light Mode** - Follows your system theme
- **Edge Sync** - Access your reading list across devices

## Installation

1. Download or clone this repository
2. Open Edge and navigate to `edge://extensions`
3. Enable **Developer mode** (toggle in bottom-left)
4. Click **Load unpacked** and select the extension folder
5. Pin the extension to your toolbar

## Usage

### Saving Articles

1. Visit any Substack article
2. Click the SubstackSaver icon in the toolbar
3. (Optional) Select tags or folder
4. Click **Save to Reading List**

### Managing Saved Articles

Click **Open Dashboard** from the popup to view your reading list:
- Search by title, author, or tag
- Filter by: All, Unread, In Progress, Completed
- View as grid or list
- Add to favorites or delete

### Progress Tracking

The extension automatically tracks your reading position. When you return to a saved article, click to resume where you left off.

## Permissions

- `storage` - Save your reading list and settings
- `tabs` - Access current page information
- `contextMenus` - Right-click menu integration
- `scripting` - Extract article metadata

## Privacy

SubstackSaver stores all data locally on your device. Your reading list is synced only through your Microsoft account when signed in to Edge.

## License

MIT
