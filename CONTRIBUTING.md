# Contributing to SubstackSaver

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test locally by loading unpacked in Edge
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/substacksaver.git
cd substacksaver

# Load in Edge
edge://extensions → Developer mode → Load unpacked
```

## Code Style

- Use ES6+ features
- IIFE wrap for popup/dashboard scripts
- CSS variables for theming (see `shared/styles/fluent.css`)
- Escape all user data before innerHTML

## Testing

1. Load unpacked in Edge
2. Visit Substack articles
3. Test: save, tags, folders, search, progress tracking
4. Check console for errors
