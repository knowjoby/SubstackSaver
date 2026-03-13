(function() {
  const TAG_COLORS = [
    '#D13438', '#FF8C00', '#FFB900', '#107C10',
    '#008080', '#0078D4', '#881798', '#5C5C5C'
  ];
  
  let currentArticle = null;
  let selectedTags = [];
  let selectedFolder = null;
  let allTags = {};
  let allFolders = {};

  async function init() {
    const settings = await storage.getSettings();
    utils.applyTheme(settings.theme || 'system');
    
    await loadTagsAndFolders();
    
    const tab = await utils.getActiveTab();
    
    if (!tab || !utils.isSubstackUrl(tab.url)) {
      showNotSubstack();
      return;
    }

    await loadArticleInfo(tab);
    setupEventListeners();
  }

  function showNotSubstack() {
    document.getElementById('notSubstack').style.display = 'block';
    document.getElementById('saveContent').style.display = 'none';
  }

  async function loadTagsAndFolders() {
    allTags = await storage.getTags();
    allFolders = await storage.getFolders();
    
    renderTagDropdown();
    renderFolderDropdown();
  }

  async function loadArticleInfo(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const getMeta = (prop) => 
            document.querySelector(`meta[property="${prop}"]`)?.content ||
            document.querySelector(`meta[name="${prop}"]`)?.content;
          
          const ogTitle = getMeta('og:title') || document.title;
          const ogImage = getMeta('og:image');
          const author = 
            document.querySelector('meta[name="author"]')?.content ||
            document.querySelector('[class*="author"]')?.textContent?.trim() ||
            document.querySelector('a[href*="/@"]')?.textContent?.trim() ||
            '';
          
          return {
            title: ogTitle || '',
            author: (author || '').replace(/^by\s+/i, ''),
            thumbnail: ogImage || ''
          };
        }
      });

      const info = results[0]?.result || { title: tab.title, author: '', thumbnail: '' };
      
      currentArticle = {
        url: tab.url,
        title: info.title || tab.title,
        author: info.author || '',
        thumbnail: info.thumbnail || ''
      };

      document.getElementById('articleTitle').textContent = currentArticle.title;
      document.getElementById('articleAuthor').textContent = currentArticle.author;
      
      const thumb = document.getElementById('thumbnail');
      if (info.thumbnail) {
        thumb.src = info.thumbnail;
        thumb.style.display = 'block';
      } else {
        thumb.style.display = 'none';
      }

      const existingArticle = await storage.getArticle(tab.url);
      if (existingArticle) {
        selectedTags = [...(existingArticle.tags || [])];
        selectedFolder = existingArticle.folder;
        
        document.getElementById('saveBtn').innerHTML = `
          <span class="btn-text">✓ Saved</span>
        `;
        document.getElementById('saveBtn').classList.add('saved');
        
        if (existingArticle.progress > 0) {
          document.getElementById('progressSection').style.display = 'block';
          document.getElementById('progressText').textContent = `${existingArticle.progress}%`;
          document.getElementById('progressFill').style.width = `${existingArticle.progress}%`;
        }
      }

      renderSelectedTags();
      renderSelectedFolder();

    } catch (e) {
      console.error('Error loading article info:', e);
      document.getElementById('articleTitle').textContent = tab.title;
    }
  }

  function renderTagDropdown() {
    const menu = document.getElementById('tagDropdownMenu');
    const tags = Object.values(allTags);
    
    let html = tags.map(tag => `
      <div class="tag-option ${selectedTags.includes(tag.id) ? 'selected' : ''}" data-tag-id="${utils.escapeHtml(tag.id)}">
        <span class="tag-dot" style="background: ${tag.color}"></span>
        <span>${utils.escapeHtml(tag.name)}</span>
      </div>
    `).join('');

    html += `
      <div class="new-tag-input">
        <input type="text" class="input" id="newTagInput" placeholder="New tag...">
      </div>
    `;
    
    menu.innerHTML = html;
  }

  function renderFolderDropdown() {
    const menu = document.getElementById('folderDropdownMenu');
    const folders = Object.values(allFolders).sort((a, b) => a.order - b.order);
    
    const html = `
      <div class="folder-option ${!selectedFolder ? 'selected' : ''}" data-folder-id="">
        <span>No folder</span>
      </div>
    ` + folders.map(folder => `
      <div class="folder-option ${selectedFolder === folder.id ? 'selected' : ''}" data-folder-id="${utils.escapeHtml(folder.id)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>${utils.escapeHtml(folder.name)}</span>
      </div>
    `).join('');

    menu.innerHTML = html;
  }

  function renderSelectedTags() {
    const container = document.getElementById('selectedTags');
    
    if (selectedTags.length === 0) {
      container.innerHTML = '<span style="color: var(--text-secondary); font-size: 12px;">Select tags...</span>';
      return;
    }

    container.innerHTML = selectedTags.map(tagId => {
      const tag = allTags[tagId];
      if (!tag) return '';
      return `
        <span class="tag-chip">
          <span class="tag-dot" style="background: ${utils.escapeHtml(tag.color)}"></span>
          ${utils.escapeHtml(tag.name)}
        </span>
      `;
    }).join('');
  }

  function renderSelectedFolder() {
    const folderText = selectedFolder && allFolders[selectedFolder] 
      ? allFolders[selectedFolder].name 
      : 'No folder';
    document.getElementById('selectedFolder').textContent = folderText;
  }

  function setupEventListeners() {
    const tagBtn = document.getElementById('tagDropdownBtn');
    const tagMenu = document.getElementById('tagDropdownMenu');
    const folderBtn = document.getElementById('folderDropdownBtn');
    const folderMenu = document.getElementById('folderDropdownMenu');
    const saveBtn = document.getElementById('saveBtn');

    tagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tagMenu.classList.toggle('open');
      folderMenu.classList.remove('open');
    });

    folderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      folderMenu.classList.toggle('open');
      tagMenu.classList.remove('open');
    });

    document.addEventListener('click', () => {
      tagMenu.classList.remove('open');
      folderMenu.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        tagMenu.classList.remove('open');
        folderMenu.classList.remove('open');
      }
    });

    tagMenu.addEventListener('click', async (e) => {
      const tagOption = e.target.closest('.tag-option');
      if (tagOption) {
        const tagId = tagOption.dataset.tagId;
        const index = selectedTags.indexOf(tagId);
        
        if (index > -1) {
          selectedTags.splice(index, 1);
        } else {
          selectedTags.push(tagId);
        }
        
        renderTagDropdown();
        renderSelectedTags();
        return;
      }

      const newTagInput = e.target.closest('#newTagInput');
      if (newTagInput) return;
    });

    folderMenu.addEventListener('click', (e) => {
      const folderOption = e.target.closest('.folder-option');
      if (folderOption) {
        selectedFolder = folderOption.dataset.folderId || null;
        renderFolderDropdown();
        renderSelectedFolder();
      }
    });

    const newTagInput = document.getElementById('newTagInput');

    newTagInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && newTagInput.value.trim()) {
        const name = newTagInput.value.trim();
        const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
        
        const newTag = await storage.createTag(name, color);
        allTags[newTag.id] = newTag;
        selectedTags.push(newTag.id);
        
        renderTagDropdown();
        renderSelectedTags();
        newTagInput.value = '';
      }
    });

    saveBtn.addEventListener('click', async () => {
      if (!currentArticle) return;
      
      const isSaved = document.getElementById('saveBtn').classList.contains('saved');
      
      if (isSaved) {
        await storage.deleteArticle(currentArticle.url);
        document.getElementById('saveBtn').classList.remove('saved');
        document.getElementById('saveBtn').innerHTML = '<span class="btn-text">Save to Reading List</span>';
        selectedTags = [];
        selectedFolder = null;
        renderSelectedTags();
        renderSelectedFolder();
      } else {
        saveBtn.classList.add('loading');
        
        try {
          await storage.saveArticle({
            ...currentArticle,
            tags: selectedTags,
            folder: selectedFolder
          });
          
          saveBtn.classList.remove('loading');
          saveBtn.classList.add('saved');
          document.getElementById('saveBtn').innerHTML = '<span class="btn-text">✓ Saved</span>';
        } catch (e) {
          saveBtn.classList.remove('loading');
          console.error('Failed to save:', e);
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
