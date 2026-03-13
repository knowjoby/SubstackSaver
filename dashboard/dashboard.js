(function() {
  let currentFilter = 'all';
  let currentStatus = 'all';
  let currentFolder = null;
  let currentView = 'grid';
  let searchQuery = '';
  let sortBy = 'savedAt';
  let sortOrder = 'desc';
  let articles = [];
  let allTags = {};
  let allFolders = {};
  let settings = {};
  let selectedArticles = new Set();
  let previewTimeout = null;

  const TAG_COLORS = [
    '#D13438', '#FF8C00', '#FFB900', '#107C10',
    '#008080', '#0078D4', '#881798', '#5C5C5C'
  ];

  const WORDS_PER_MINUTE = 200;

  async function init() {
    settings = await storage.getSettings();
    utils.applyTheme(settings.theme || 'system');
    currentView = settings.defaultView || 'grid';
    
    await loadData();
    setupEventListeners();
    renderArticles();
    updateCounts();
    updateViewToggle();
    updateOfflineStatus();
  }

  function updateViewToggle() {
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    if (currentView === 'grid') {
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
    } else {
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
    }
  }

  async function loadData() {
    articles = await storage.searchArticles('', { status: 'all', sortBy, sortOrder });
    allTags = await storage.getTags();
    allFolders = {};
  }

  function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettings = document.getElementById('closeSettings');
    const settingsModal = document.getElementById('settingsModal');
    const themeSelect = document.getElementById('themeSelect');
    const exportEdgeBtn = document.getElementById('exportEdgeBtn');
    const importEdgeBtn = document.getElementById('importEdgeBtn');
    const importFile = document.getElementById('importFile');

    searchInput.addEventListener('input', utils.debounce((e) => {
      searchQuery = e.target.value;
      renderArticles();
    }, 300));

    gridViewBtn.addEventListener('click', () => {
      currentView = 'grid';
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      renderArticles();
      storage.updateSettings({ defaultView: 'grid' });
    });

    listViewBtn.addEventListener('click', () => {
      currentView = 'list';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      renderArticles();
      storage.updateSettings({ defaultView: 'list' });
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        currentFilter = 'all';
        currentFolder = null;
        selectedArticles.clear();
        updateBulkActions();
        
        document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
        
        updatePageTitle();
        renderArticles();
      });
    });

    document.getElementById('foldersList').addEventListener('click', (e) => {
      const folderItem = e.target.closest('.folder-item');
      const folderAction = e.target.closest('.folder-action-btn');
      
      if (folderAction) {
        e.stopPropagation();
        const action = folderAction.dataset.action;
        const folderId = folderAction.dataset.folder;
        
        if (action === 'rename') {
          showRenameFolderModal(folderId);
        } else if (action === 'delete') {
          deleteFolder(folderId);
        }
        return;
      }
      
      if (folderItem) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
        folderItem.classList.add('active');
        
        currentFolder = folderItem.dataset.folder;
        currentFilter = 'folder';
        selectedArticles.clear();
        updateBulkActions();
        
        updatePageTitle();
        renderArticles();
      }
    });

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        currentStatus = pill.dataset.status;
        renderArticles();
      });
    });

    const sortBtn = document.getElementById('sortBtn');
    const sortMenu = document.getElementById('sortMenu');
    
    sortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sortMenu.classList.toggle('open');
      document.getElementById('exportDropdown').classList.remove('open');
    });

    sortMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item) {
        sortBy = item.dataset.sort;
        sortOrder = item.dataset.order;
        document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        sortMenu.classList.remove('open');
        updateSortLabel();
        renderArticles();
      }
    });

    const exportBtn = document.getElementById('exportBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('open');
      sortMenu.classList.remove('open');
    });

    exportDropdown.addEventListener('click', async (e) => {
      const option = e.target.closest('.export-option');
      if (option) {
        const format = option.dataset.format;
        await exportArticles(format);
        exportDropdown.classList.remove('open');
      }
    });

    document.addEventListener('click', () => {
      sortMenu.classList.remove('open');
      exportDropdown.classList.remove('open');
    });

    document.getElementById('manageTagsBtn').addEventListener('click', () => {
      document.getElementById('tagModal').classList.add('open');
      renderTagManagement();
    });

    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('open');
      themeSelect.value = settings.theme || 'system';
    });

    closeSettings.addEventListener('click', () => {
      settingsModal.classList.remove('open');
    });

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('open');
      }
    });

    document.getElementById('closeTagModal').addEventListener('click', () => {
      document.getElementById('tagModal').classList.remove('open');
    });

    document.getElementById('tagModal').addEventListener('click', (e) => {
      if (e.target.id === 'tagModal') {
        document.getElementById('tagModal').classList.remove('open');
      }
    });

    document.getElementById('closeFolderModal').addEventListener('click', () => {
      document.getElementById('folderModal').classList.remove('open');
    });

    document.getElementById('folderModal').addEventListener('click', (e) => {
      if (e.target.id === 'folderModal') {
        document.getElementById('folderModal').classList.remove('open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (settingsModal.classList.contains('open')) {
          settingsModal.classList.remove('open');
        }
        if (document.getElementById('tagModal').classList.contains('open')) {
          document.getElementById('tagModal').classList.remove('open');
        }
        if (document.getElementById('folderModal').classList.contains('open')) {
          document.getElementById('folderModal').classList.remove('open');
        }
        if (document.getElementById('bulkTagModal').classList.contains('open')) {
          document.getElementById('bulkTagModal').classList.remove('open');
        }
        if (document.getElementById('bulkFolderModal').classList.contains('open')) {
          document.getElementById('bulkFolderModal').classList.remove('open');
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllArticles();
      }

      if (e.key === 'Delete' && selectedArticles.size > 0) {
        e.preventDefault();
        bulkDelete();
      }
    });

    themeSelect.addEventListener('change', async (e) => {
      settings.theme = e.target.value;
      await storage.updateSettings({ theme: settings.theme });
      utils.applyTheme(settings.theme);
    });

    exportEdgeBtn.addEventListener('click', async () => {
      const collection = await storage.exportToEdgeCollections();
      const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'substack-saver-export.json';
      a.click();
      
      URL.revokeObjectURL(url);
      showToast('Exported successfully', 'success');
    });

    importEdgeBtn.addEventListener('click', () => {
      importFile.click();
    });

    importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target.result);
            await storage.importFromEdgeCollections(data);
            await loadData();
            renderArticles();
            updateCounts();
            showToast('Import successful', 'success');
          } catch (err) {
            showToast('Invalid file format', 'error');
          }
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('closeBulk').addEventListener('click', () => {
      selectedArticles.clear();
      updateBulkActions();
      renderArticles();
    });

    document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDelete);
    
    document.getElementById('bulkTagBtn').addEventListener('click', () => {
      renderBulkTagModal();
      document.getElementById('bulkTagModal').classList.add('open');
    });

    document.getElementById('bulkFolderBtn').addEventListener('click', () => {
      renderBulkFolderModal();
      document.getElementById('bulkFolderModal').classList.add('open');
    });

    document.getElementById('closeBulkTagModal').addEventListener('click', () => {
      document.getElementById('bulkTagModal').classList.remove('open');
    });

    document.getElementById('cancelBulkTag').addEventListener('click', () => {
      document.getElementById('bulkTagModal').classList.remove('open');
    });

    document.getElementById('applyBulkTag').addEventListener('click', async () => {
      const checkboxes = document.querySelectorAll('#bulkTagList input[type="checkbox"]:checked');
      const tagIds = Array.from(checkboxes).map(cb => cb.dataset.tagId);
      
      if (tagIds.length === 0) {
        showToast('Please select at least one tag', 'error');
        return;
      }

      const articlesData = await storage.getArticles();
      for (const url of selectedArticles) {
        const id = utils.hashCode(url);
        if (articlesData[id]) {
          const existingTags = articlesData[id].tags || [];
          const newTags = [...new Set([...existingTags, ...tagIds])];
          articlesData[id].tags = newTags;
        }
      }

      try {
        await chrome.storage.sync.set({ articles: articlesData });
      } catch (err) {
        await chrome.storage.local.set({ articles: articlesData });
      }

      document.getElementById('bulkTagModal').classList.remove('open');
      showToast(`Tags added to ${selectedArticles.size} article(s)`, 'success');
      selectedArticles.clear();
      updateBulkActions();
      await loadData();
      renderArticles();
    });

    document.getElementById('closeBulkFolderModal').addEventListener('click', () => {
      document.getElementById('bulkFolderModal').classList.remove('open');
    });

    document.getElementById('cancelBulkFolder').addEventListener('click', () => {
      document.getElementById('bulkFolderModal').classList.remove('open');
    });

    document.getElementById('applyBulkFolder').addEventListener('click', async () => {
      const selected = document.querySelector('#bulkFolderList input[type="radio"]:checked');
      if (!selected) {
        showToast('Please select a folder', 'error');
        return;
      }

      const folderId = selected.dataset.folderId || null;
      const articlesData = await storage.getArticles();
      
      for (const url of selectedArticles) {
        const id = utils.hashCode(url);
        if (articlesData[id]) {
          articlesData[id].folder = folderId;
        }
      }

      try {
        await chrome.storage.sync.set({ articles: articlesData });
      } catch (err) {
        await chrome.storage.local.set({ articles: articlesData });
      }

      document.getElementById('bulkFolderModal').classList.remove('open');
      const folderName = folderId && allFolders[folderId] ? allFolders[folderId].name : 'No folder';
      showToast(`Moved ${selectedArticles.size} article(s) to ${folderName}`, 'success');
      selectedArticles.clear();
      updateBulkActions();
      await loadData();
      renderArticles();
    });

    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
  }

  function updateOfflineStatus() {
    const indicator = document.getElementById('offlineIndicator');
    if (navigator.onLine) {
      indicator.classList.remove('visible');
    } else {
      indicator.classList.add('visible');
    }
  }

  function updateSortLabel() {
    const label = document.getElementById('sortLabel');
    const sortMap = {
      'savedAt-desc': 'Newest',
      'savedAt-asc': 'Oldest',
      'title-asc': 'Title A-Z',
      'title-desc': 'Title Z-A',
      'author-asc': 'Author A-Z',
      'author-desc': 'Author Z-A'
    };
    label.textContent = `Sort: ${sortMap[`${sortBy}-${sortOrder}`] || 'Date'}`;
  }

  function selectAllArticles() {
    const cards = document.querySelectorAll('.article-card');
    cards.forEach(card => {
      const url = decodeURIComponent(card.dataset.url);
      selectedArticles.add(url);
      card.classList.add('selected');
    });
    updateBulkActions();
  }

  function updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    const count = selectedArticles.size;
    
    document.getElementById('selectedCount').textContent = count;
    
    if (count > 0) {
      bulkActions.classList.add('visible');
    } else {
      bulkActions.classList.remove('visible');
    }
  }

  async function bulkDelete() {
    if (selectedArticles.size === 0) return;
    
    const count = selectedArticles.size;
    if (!confirm(`Delete ${count} article(s) from your reading list?`)) return;
    
    for (const url of selectedArticles) {
      await storage.deleteArticle(url);
    }
    
    selectedArticles.clear();
    updateBulkActions();
    await loadData();
    renderArticles();
    updateCounts();
    showToast(`Deleted ${count} article(s)`, 'success');
  }

  function renderBulkTagModal() {
    const container = document.getElementById('bulkTagList');
    const tags = Object.values(allTags);
    
    container.innerHTML = tags.map(tag => `
      <label class="checkbox" style="display: flex; margin-bottom: var(--space-sm);">
        <input type="checkbox" data-tag-id="${utils.escapeHtml(tag.id)}">
        <span class="tag-dot" style="background: ${tag.color}; width: 10px; height: 10px; border-radius: 50%;"></span>
        <span>${utils.escapeHtml(tag.name)}</span>
      </label>
    `).join('');
  }

  function renderBulkFolderModal() {
    const container = document.getElementById('bulkFolderList');
    const folders = Object.values(allFolders).sort((a, b) => a.order - b.order);
    
    container.innerHTML = `
      <label class="checkbox" style="display: flex; margin-bottom: var(--space-sm);">
        <input type="radio" name="folder" data-folder-id="" checked>
        <span>No folder</span>
      </label>
    ` + folders.map(folder => `
      <label class="checkbox" style="display: flex; margin-bottom: var(--space-sm);">
        <input type="radio" name="folder" data-folder-id="${utils.escapeHtml(folder.id)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>${utils.escapeHtml(folder.name)}</span>
      </label>
    `).join('');
  }

  function renderTagManagement() {
    const container = document.getElementById('tagModalBody');
    const tags = Object.values(allTags);
    
    container.innerHTML = `
      <div class="form-group">
        <label>Create New Tag</label>
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm);">
          <input type="text" class="input" id="newTagName" placeholder="Tag name...">
          <button class="btn btn-primary" id="createTagBtn">Add</button>
        </div>
        <div class="color-picker-row" id="colorPicker"></div>
      </div>
      <div class="form-group">
        <label>Existing Tags</label>
        <div class="tag-list" id="existingTagsList">
          ${tags.map(tag => `
            <div class="tag-item" data-tag-id="${utils.escapeHtml(tag.id)}">
              <span class="tag-dot" style="background: ${tag.color}"></span>
              <span>${utils.escapeHtml(tag.name)}</span>
              <button class="btn-icon" data-action="edit" data-tag="${utils.escapeHtml(tag.id)}" style="margin-left: auto; width: 20px; height: 20px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              <button class="btn-icon" data-action="delete" data-tag="${utils.escapeHtml(tag.id)}" style="margin-left: 4px; width: 20px; height: 20px; color: var(--error);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const colorPicker = document.getElementById('colorPicker');
    colorPicker.innerHTML = TAG_COLORS.map(color => `
      <div class="color-option ${color === TAG_COLORS[0] ? 'selected' : ''}" data-color="${color}" 
           style="background: ${color};"></div>
    `).join('');

    colorPicker.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (option) {
        colorPicker.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
      }
    });

    document.getElementById('createTagBtn').addEventListener('click', async () => {
      const nameInput = document.getElementById('newTagName');
      const name = nameInput.value.trim();
      if (!name) return;
      
      const selectedColor = colorPicker.querySelector('.color-option.selected')?.dataset.color || TAG_COLORS[0];
      await storage.createTag(name, selectedColor);
      
      nameInput.value = '';
      allTags = await storage.getTags();
      renderTagManagement();
      showToast('Tag created', 'success');
    });

    document.getElementById('existingTagsList').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-action="edit"]');
      const deleteBtn = e.target.closest('[data-action="delete"]');
      
      if (editBtn) {
        const tagId = editBtn.dataset.tag;
        showEditTagModal(tagId);
      } else if (deleteBtn) {
        const tagId = deleteBtn.dataset.tag;
        if (confirm('Delete this tag? It will be removed from all articles.')) {
          await storage.deleteTag(tagId);
          allTags = await storage.getTags();
          renderTagManagement();
          await loadData();
          renderArticles();
          showToast('Tag deleted', 'success');
        }
      }
    });

    document.getElementById('newTagName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('createTagBtn').click();
      }
    });
  }

  function showEditTagModal(tagId) {
    const tag = allTags[tagId];
    if (!tag) return;

    const newName = prompt('Enter new tag name:', tag.name);
    if (newName && newName.trim() !== tag.name) {
      allTags[tagId].name = newName.trim();
      
      chrome.storage.sync.set({ tags: allTags }).catch(() => {
        chrome.storage.local.set({ tags: allTags });
      }).then(() => {
        renderTagManagement();
        renderArticles();
        showToast('Tag renamed', 'success');
      });
    }
  }

  function showRenameFolderModal(folderId) {
    const folder = allFolders[folderId];
    if (!folder) return;

    const newName = prompt('Enter new folder name:', folder.name);
    if (newName && newName.trim() !== folder.name) {
      allFolders[folderId].name = newName.trim();
      
      chrome.storage.sync.set({ folders: allFolders }).catch(() => {
        chrome.storage.local.set({ folders: allFolders });
      }).then(() => {
        loadData();
        updatePageTitle();
        showToast('Folder renamed', 'success');
      });
    }
  }

  async function deleteFolder(folderId) {
    const folder = allFolders[folderId];
    if (!folder) return;

    if (confirm(`Delete folder "${folder.name}"? Articles in this folder will be moved to root.`)) {
      try {
        await storage.deleteFolder(folderId);
        allFolders = await storage.getFolders();
        await loadData();
        renderArticles();
        showToast('Folder deleted', 'success');
      } catch (e) {
        console.error('Failed to delete folder:', e);
        showToast('Failed to delete folder', 'error');
      }
    }
  }

  function calculateReadingTime(text) {
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
    return minutes < 1 ? '1 min' : `${minutes} min read`;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
      ${icons[type]}
      <span class="toast-message">${utils.escapeHtml(message)}</span>
      <span class="toast-close">&times;</span>
    `;
    
    container.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  }

  async function exportArticles(format) {
    const articlesData = await storage.searchArticles(searchQuery, {
      status: currentStatus === 'all' ? null : currentStatus,
      favorites: currentFilter === 'favorites' ? true : null,
      folder: currentFilter === 'folder' && currentFolder ? currentFolder : null,
      sortBy,
      sortOrder
    });

    let content, filename, mimeType;

    if (format === 'json') {
      content = JSON.stringify(articlesData, null, 2);
      filename = 'substack-articles.json';
      mimeType = 'application/json';
    } else if (format === 'html') {
      content = generateHtmlExport(articlesData);
      filename = 'substack-articles.html';
      mimeType = 'text/html';
    } else if (format === 'markdown') {
      content = generateMarkdownExport(articlesData);
      filename = 'substack-articles.md';
      mimeType = 'text/markdown';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast(`Exported ${articlesData.length} article(s) as ${format.toUpperCase()}`, 'success');
  }

  function generateHtmlExport(articles) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SubstackSaver Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { border-bottom: 2px solid #0078D4; padding-bottom: 10px; }
    .article { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
    .article h2 { margin: 0 0 5px; }
    .article a { color: #0078D4; text-decoration: none; }
    .article .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>SubstackSaver Reading List</h1>
  <p>${articles.length} articles exported on ${new Date().toLocaleDateString()}</p>
  ${articles.map(a => `
  <div class="article">
    <h2><a href="${a.url}" target="_blank">${utils.escapeHtml(a.title)}</a></h2>
    <div class="meta">by ${utils.escapeHtml(a.author || 'Unknown')} &bull; Saved ${new Date(a.savedAt).toLocaleDateString()}</div>
  </div>`).join('')}
</body>
</html>`;
  }

  function generateMarkdownExport(articles) {
    return `# SubstackSaver Reading List

${articles.length} articles exported on ${new Date().toLocaleDateString()}

${articles.map(a => `## [${a.title}](${a.url})

by ${a.author || 'Unknown'} &bull; Saved ${new Date(a.savedAt).toLocaleDateString()}

---`).join('\n\n')}
`;
  }

  function updatePageTitle() {
    const titleEl = document.getElementById('pageTitle');
    
    if (currentFilter === 'all') {
      titleEl.textContent = 'All Articles';
    } else if (currentFilter === 'favorites') {
      titleEl.textContent = 'Favorites';
    } else if (currentFilter === 'folder' && currentFolder && allFolders[currentFolder]) {
      titleEl.textContent = allFolders[currentFolder].name;
    } else {
      titleEl.textContent = 'All Articles';
    }
  }

  async function renderArticles() {
    const container = document.getElementById('articlesContainer');
    const filters = {
      status: currentStatus === 'all' ? null : currentStatus,
      sortBy,
      sortOrder
    };

    if (currentFilter === 'favorites') {
      filters.favorites = true;
    } else if (currentFilter === 'folder' && currentFolder) {
      filters.folder = currentFolder;
    }

    const results = await storage.searchArticles(searchQuery, filters);
    articles = results;

    if (articles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <h2>${searchQuery ? 'No matching articles' : 'No articles yet'}</h2>
          <p>${searchQuery ? 'Try adjusting your search or filters' : 'Save articles from Substack using the toolbar button to see them here.'}</p>
          ${!searchQuery ? `
          <div class="empty-actions">
            <button class="btn btn-primary" id="browseSubstack">
              Browse Substack
            </button>
          </div>
          <div class="shortcut-hint">
            Press <kbd>Ctrl</kbd>+<kbd>F</kbd> to search | <kbd>Ctrl</kbd>+<kbd>A</kbd> to select all
          </div>
          ` : ''}
        </div>
      `;
      
      document.getElementById('browseSubstack')?.addEventListener('click', () => {
        window.open('https://substack.com', '_blank');
      });
      return;
    }

    const gridClass = currentView === 'grid' ? 'article-grid' : 'article-list';
    
    container.innerHTML = `<div class="${gridClass}" id="articlesList"></div>`;
    
    const listEl = document.getElementById('articlesList');
    
    if (currentView === 'list') {
      listEl.classList.add('list-view');
    }

    listEl.innerHTML = articles.map(article => {
      const tags = (article.tags || []).slice(0, 3).map(tagId => allTags[tagId]).filter(Boolean);
      const extraTagsCount = Math.max(0, article.tags.length - 3);
      const readingTime = calculateReadingTime(article.title + ' ' + (article.excerpt || ''));
      const isSelected = selectedArticles.has(article.url);
      
      return `
        <article class="article-card ${currentView === 'list' ? 'list-view' : ''} ${isSelected ? 'selected' : ''}" data-url="${encodeURIComponent(article.url)}">
          <input type="checkbox" class="article-checkbox" ${isSelected ? 'checked' : ''}>
          ${article.thumbnail ? 
            `<img class="thumbnail" src="${article.thumbnail}" alt="">` :
            `<div class="thumbnail" style="background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))"></div>`
          }
          <div class="article-card-content">
            <h3 class="article-card-title">${utils.escapeHtml(utils.truncate(article.title, 80))}</h3>
            <div class="article-card-author">by ${utils.escapeHtml(article.author || 'Unknown')}</div>
            <div class="article-card-meta">
              <div class="article-card-meta-left">
                <div class="article-card-tags">
                  ${tags.map(tag => `
                    <span class="tag-chip">
                      <span class="tag-dot" style="background: ${tag.color}"></span>
                      ${utils.escapeHtml(tag.name)}
                    </span>
                  `).join('')}
                  ${extraTagsCount > 0 ? `<span class="tag-chip">+${extraTagsCount}</span>` : ''}
                </div>
                <span class="reading-time">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  ${readingTime}
                </span>
              </div>
              <span class="article-card-date">${utils.formatDate(article.savedAt)}</span>
            </div>
            ${article.progress > 0 ? `
              <div class="article-card-progress">
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${article.progress}%"></div>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="article-card-actions">
            <button class="action-btn favorite ${article.isFavorite ? 'selected' : ''}" data-url="${encodeURIComponent(article.url)}" title="${article.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${article.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            <button class="action-btn delete" data-url="${encodeURIComponent(article.url)}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    listEl.querySelectorAll('.article-card').forEach(card => {
      const checkbox = card.querySelector('.article-checkbox');
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const url = decodeURIComponent(card.dataset.url);
        
        if (checkbox.checked) {
          selectedArticles.add(url);
          card.classList.add('selected');
        } else {
          selectedArticles.delete(url);
          card.classList.remove('selected');
        }
        
        updateBulkActions();
      });

      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      card.addEventListener('mouseenter', (e) => {
        const url = decodeURIComponent(card.dataset.url);
        const article = articles.find(a => a.url === url);
        if (article) {
          showPreviewTooltip(e, article);
        }
      });

      card.addEventListener('mouseleave', () => {
        hidePreviewTooltip();
      });

      card.addEventListener('click', async (e) => {
        if (e.target.closest('.action-btn') || e.target.closest('.article-checkbox')) return;
        
        const url = decodeURIComponent(card.dataset.url);
        const article = articles.find(a => a.url === url);
        
        if (article && article.progress > 0) {
          const separator = url.includes('?') ? '&' : '?';
          const progressUrl = `${url}${separator}from=substacksaver&progress=${article.progress}`;
          window.open(progressUrl, '_blank');
        } else {
          window.open(url, '_blank');
        }
      });
    });

    listEl.querySelectorAll('.action-btn.favorite').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = decodeURIComponent(btn.dataset.url);
        
        const articlesData = await storage.getArticles();
        const id = utils.hashCode(url);
        if (articlesData[id]) {
          articlesData[id].isFavorite = !articlesData[id].isFavorite;
          try {
            await chrome.storage.sync.set({ articles: articlesData });
          } catch (err) {
            await chrome.storage.local.set({ articles: articlesData });
          }
          await loadData();
          renderArticles();
          updateCounts();
        }
      });
    });

    listEl.querySelectorAll('.action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = decodeURIComponent(btn.dataset.url);
        
        if (confirm('Delete this article from your reading list?')) {
          selectedArticles.delete(url);
          updateBulkActions();
          await storage.deleteArticle(url);
          await loadData();
          renderArticles();
          updateCounts();
          showToast('Article deleted', 'success');
        }
      });
    });
  }

  function showPreviewTooltip(e, article) {
    const tooltip = document.getElementById('previewTooltip');
    const readingTime = calculateReadingTime(article.title);
    
    document.getElementById('previewTitle').textContent = article.title;
    document.getElementById('previewAuthor').textContent = `by ${article.author || 'Unknown'}`;
    document.getElementById('previewExcerpt').textContent = article.excerpt || 'No preview available';
    document.getElementById('previewReadingTime').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      ${readingTime}
    `;
    document.getElementById('previewDate').textContent = utils.formatDate(article.savedAt);
    
    const rect = e.currentTarget.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    
    if (left + 300 > window.innerWidth) {
      left = rect.left - 310;
    }
    
    if (top + 200 > window.innerHeight) {
      top = window.innerHeight - 210;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add('visible');
  }

  function hidePreviewTooltip() {
    document.getElementById('previewTooltip').classList.remove('visible');
  }

  async function updateCounts() {
    const allArticles = await storage.getArticles();
    const allCount = Object.keys(allArticles).length;
    
    const favCount = Object.values(allArticles).filter(a => a.isFavorite).length;
    
    document.getElementById('countAll').textContent = allCount;
    document.getElementById('countFavorites').textContent = favCount;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
