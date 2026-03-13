window.storage = {
  STORAGE_KEYS: {
    ARTICLES: 'articles',
    TAGS: 'tags',
    FOLDERS: 'folders',
    SETTINGS: 'settings'
  },

  sanitizeInput(str) {
    if (str == null) return '';
    return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  DEFAULT_TAGS: [
    { id: 'read', name: 'Read', color: '#107C10' },
    { id: 'later', name: 'Read Later', color: '#0078D4' },
    { id: 'important', name: 'Important', color: '#D13438' }
  ],

  DEFAULT_FOLDERS: [
    { id: 'reading-now', name: 'Reading Now', order: 0 },
    { id: 'archive', name: 'Archive', order: 1 },
    { id: 'favorites', name: 'Favorites', order: 2 }
  ],

  DEFAULT_SETTINGS: {
    theme: 'system',
    defaultView: 'grid',
    showProgress: true
  },

  async getStorage() {
    try {
      const result = await chrome.storage.sync.get(null);
      return result;
    } catch (e) {
      return await chrome.storage.local.get(null);
    }
  },

  async saveArticle(article) {
    const id = utils.hashCode(article.url);
    const articles = await this.getArticles();
    
    articles[id] = {
      id,
      url: article.url,
      title: this.sanitizeInput(article.title),
      author: this.sanitizeInput(article.author || ''),
      thumbnail: article.thumbnail || '',
      savedAt: Date.now(),
      progress: article.progress || 0,
      tags: article.tags || [],
      folder: article.folder || null,
      notes: this.sanitizeInput(article.notes || ''),
      isFavorite: article.isFavorite || false
    };

    try {
      await chrome.storage.sync.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
    } catch (e) {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
    }
    return articles[id];
  },

  async getArticles() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.ARTICLES);
      return result[this.STORAGE_KEYS.ARTICLES] || {};
    } catch (e) {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.ARTICLES);
      return result[this.STORAGE_KEYS.ARTICLES] || {};
    }
  },

  async getArticle(url) {
    const articles = await this.getArticles();
    const id = utils.hashCode(url);
    return articles[id] || null;
  },

  async updateArticleProgress(url, progress) {
    const articles = await this.getArticles();
    const id = utils.hashCode(url);
    if (articles[id]) {
      articles[id].progress = Math.min(100, Math.max(0, progress));
      try {
        await chrome.storage.sync.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
      } catch (e) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
      }
    }
    return articles[id];
  },

  async deleteArticle(url) {
    const articles = await this.getArticles();
    const id = utils.hashCode(url);
    delete articles[id];
    try {
      await chrome.storage.sync.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
    } catch (e) {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
    }
  },

  async isArticleSaved(url) {
    const article = await this.getArticle(url);
    return !!article;
  },

  async getTags() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.TAGS);
      let tags = result[this.STORAGE_KEYS.TAGS] || {};
      
      if (Object.keys(tags).length === 0) {
        tags = this.DEFAULT_TAGS.reduce((acc, tag) => {
          acc[tag.id] = tag;
          return acc;
        }, {});
        try {
          await chrome.storage.sync.set({ [this.STORAGE_KEYS.TAGS]: tags });
        } catch (e) {
          await chrome.storage.local.set({ [this.STORAGE_KEYS.TAGS]: tags });
        }
      }
      
      return tags;
    } catch (e) {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.TAGS);
      return result[this.STORAGE_KEYS.TAGS] || this.DEFAULT_TAGS.reduce((acc, tag) => {
        acc[tag.id] = tag;
        return acc;
      }, {});
    }
  },

  async createTag(name, color) {
    const tags = await this.getTags();
    const id = utils.generateId();
    tags[id] = { id, name, color };
    try {
      await chrome.storage.sync.set({ [this.STORAGE_KEYS.TAGS]: tags });
    } catch (e) {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.TAGS]: tags });
    }
    return tags[id];
  },

  async deleteTag(tagId) {
    const tags = await this.getTags();
    const articles = await this.getArticles();
    
    delete tags[tagId];
    
    Object.values(articles).forEach(article => {
      article.tags = article.tags.filter(t => t !== tagId);
    });

    try {
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.TAGS]: tags,
        [this.STORAGE_KEYS.ARTICLES]: articles
      });
    } catch (e) {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.TAGS]: tags,
        [this.STORAGE_KEYS.ARTICLES]: articles
      });
    }
  },

  async getFolders() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.FOLDERS);
      let folders = result[this.STORAGE_KEYS.FOLDERS] || {};
      
      if (Object.keys(folders).length === 0) {
        folders = this.DEFAULT_FOLDERS.reduce((acc, folder) => {
          acc[folder.id] = folder;
          return acc;
        }, {});
        try {
          await chrome.storage.sync.set({ [this.STORAGE_KEYS.FOLDERS]: folders });
        } catch (e) {
          await chrome.storage.local.set({ [this.STORAGE_KEYS.FOLDERS]: folders });
        }
      }
      
      return folders;
    } catch (e) {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.FOLDERS);
      return result[this.STORAGE_KEYS.FOLDERS] || this.DEFAULT_FOLDERS.reduce((acc, folder) => {
        acc[folder.id] = folder;
        return acc;
      }, {});
    }
  },

  async createFolder(name) {
    const folders = await this.getFolders();
    const id = utils.generateId();
    const order = Object.keys(folders).length;
    folders[id] = { id, name, order };
    await chrome.storage.sync.set({ [this.STORAGE_KEYS.FOLDERS]: folders });
    return folders[id];
  },

  async deleteFolder(folderId) {
    const folders = await this.getFolders();
    const articles = await this.getArticles();
    
    delete folders[folderId];
    
    Object.values(articles).forEach(article => {
      if (article.folder === folderId) {
        article.folder = null;
      }
    });

    await chrome.storage.sync.set({
      [this.STORAGE_KEYS.FOLDERS]: folders,
      [this.STORAGE_KEYS.ARTICLES]: articles
    });
  },

  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.SETTINGS);
      return { ...this.DEFAULT_SETTINGS, ...result[this.STORAGE_KEYS.SETTINGS] };
    } catch (e) {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.SETTINGS);
      return { ...this.DEFAULT_SETTINGS, ...result[this.STORAGE_KEYS.SETTINGS] };
    }
  },

  async updateSettings(settings) {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    try {
      await chrome.storage.sync.set({ [this.STORAGE_KEYS.SETTINGS]: updated });
    } catch (e) {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.SETTINGS]: updated });
    }
    return updated;
  },

  async searchArticles(query, filters = {}) {
    const articles = await this.getArticles();
    const tags = await this.getTags();
    const folders = await this.getFolders();
    
    let results = Object.values(articles);
    
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(article => 
        article.title.toLowerCase().includes(q) ||
        article.author.toLowerCase().includes(q) ||
        (tags[article.tags[0]]?.name || '').toLowerCase().includes(q)
      );
    }

    if (filters.status) {
      if (filters.status === 'unread') {
        results = results.filter(a => a.progress === 0);
      } else if (filters.status === 'in-progress') {
        results = results.filter(a => a.progress > 0 && a.progress < 100);
      } else if (filters.status === 'completed') {
        results = results.filter(a => a.progress >= 100);
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(a => 
        a.tags.some(t => filters.tags.includes(t))
      );
    }

    if (filters.folder) {
      results = results.filter(a => a.folder === filters.folder);
    }

    if (filters.favorites) {
      results = results.filter(a => a.isFavorite);
    }

    const sortBy = filters.sortBy || 'savedAt';
    const sortOrder = filters.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'progress') {
        comparison = a.progress - b.progress;
      } else {
        comparison = a.savedAt - b.savedAt;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return results;
  },

  async exportToEdgeCollections() {
    const articles = await this.getArticles();
    const tags = await this.getTags();
    
    const collection = {
      name: "SubstackSaver Export",
      items: Object.values(articles).map(article => ({
        title: article.title,
        url: article.url,
        notes: article.notes || '',
        tags: article.tags.map(t => tags[t]?.name || '').filter(Boolean)
      }))
    };

    return collection;
  },

  async importFromEdgeCollections(collectionData) {
    const articles = await this.getArticles();
    const tags = await this.getTags();
    const existingTagIds = Object.values(tags).map(t => t.name.toLowerCase());
    
    for (const item of collectionData.items || []) {
      const id = utils.hashCode(item.url);
      
      let articleTags = [];
      for (const tagName of item.tags || []) {
        const normalizedName = tagName.toLowerCase();
        const existingTag = Object.values(tags).find(t => t.name.toLowerCase() === normalizedName);
        if (existingTag) {
          articleTags.push(existingTag.id);
        }
      }

      articles[id] = {
        id,
        url: item.url,
        title: this.sanitizeInput(item.title),
        author: '',
        thumbnail: '',
        savedAt: Date.now(),
        progress: 0,
        tags: articleTags,
        folder: null,
        notes: this.sanitizeInput(item.notes || ''),
        isFavorite: false
      };
    }

    await chrome.storage.sync.set({ [this.STORAGE_KEYS.ARTICLES]: articles });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = storage;
}
