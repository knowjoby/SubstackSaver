(function() {
  let currentFilter = 'all';
  let currentStatus = 'all';
  let currentFolder = null;
  let currentView = 'grid';
  let searchQuery = '';
  let articles = [];
  let allTags = {};
  let allFolders = {};
  let settings = {};

  async function init() {
    settings = await storage.getSettings();
    utils.applyTheme(settings.theme || 'system');
    
    await loadData();
    setupEventListeners();
    renderArticles();
    updateCounts();
  }

  async function loadData() {
    articles = await storage.searchArticles('', { status: 'all' });
    allTags = await storage.getTags();
    allFolders = await storage.getFolders();
    
    const foldersList = document.getElementById('foldersList');
    const sortedFolders = Object.values(allFolders).sort((a, b) => a.order - b.order);
    
    foldersList.innerHTML = sortedFolders.map(folder => `
      <div class="folder-item" data-folder="${utils.escapeHtml(folder.id)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>${utils.escapeHtml(folder.name)}</span>
      </div>
    `).join('');
  }

  function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettings = document.getElementById('closeSettings');
    const settingsModal = document.getElementById('settingsModal');
    const themeSelect = document.getElementById('themeSelect');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
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
    });

    listViewBtn.addEventListener('click', () => {
      currentView = 'list';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      renderArticles();
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        currentFilter = item.dataset.filter;
        currentFolder = null;
        
        document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
        
        updatePageTitle();
        renderArticles();
      });
    });

    document.getElementById('foldersList').addEventListener('click', (e) => {
      const folderItem = e.target.closest('.folder-item');
      if (folderItem) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
        folderItem.classList.add('active');
        
        currentFolder = folderItem.dataset.folder;
        currentFilter = 'folder';
        
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsModal.classList.contains('open')) {
        settingsModal.classList.remove('open');
      }
    });

    themeSelect.addEventListener('change', async (e) => {
      settings.theme = e.target.value;
      await storage.updateSettings({ theme: settings.theme });
      utils.applyTheme(settings.theme);
    });

    exportBtn.addEventListener('click', async () => {
      const collection = await storage.exportToEdgeCollections();
      const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'substack-saver-export.json';
      a.click();
      
      URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => {
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
            alert('Import successful!');
          } catch (err) {
            alert('Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    });
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
      status: currentStatus === 'all' ? null : currentStatus
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
          <h2>No articles yet</h2>
          <p>Save articles from Substack using the toolbar button to see them here.</p>
          <button class="btn btn-primary" id="browseSubstack">
            Browse Substack
          </button>
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
      
      return `
        <article class="article-card ${currentView === 'list' ? 'list-view' : ''}" data-url="${encodeURIComponent(article.url)}">
          ${article.thumbnail ? 
            `<img class="thumbnail" src="${article.thumbnail}" alt="">` :
            `<div class="thumbnail" style="background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))"></div>`
          }
          <div class="article-card-content">
            <h3 class="article-card-title">${utils.escapeHtml(utils.truncate(article.title, 80))}</h3>
            <div class="article-card-author">by ${utils.escapeHtml(article.author || 'Unknown')}</div>
            <div class="article-card-meta">
              <div class="article-card-tags">
                ${tags.map(tag => `
                  <span class="tag-chip">
                    <span class="tag-dot" style="background: ${tag.color}"></span>
                    ${utils.escapeHtml(tag.name)}
                  </span>
                `).join('')}
                ${extraTagsCount > 0 ? `<span class="tag-chip">+${extraTagsCount}</span>` : ''}
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
            <button class="action-btn favorite" data-url="${encodeURIComponent(article.url)}" title="${article.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
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
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.action-btn')) return;
        
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
          await storage.deleteArticle(url);
          await loadData();
          renderArticles();
          updateCounts();
        }
      });
    });
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
