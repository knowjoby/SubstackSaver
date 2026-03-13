window.storage = {
  STORAGE_KEYS: {
    ARTICLES: 'articles',
    TAGS: 'tags',
    FOLDERS: 'folders',
    SETTINGS: 'settings'
  },

  hashCode: function(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },

  generateId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },

  sanitizeInput: function(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  DEFAULT_TAGS: [
    { id: 'read', name: 'Read', color: '#107C10' },
    { id: 'later', name: 'Read Later', color: '#0078D4' },
    { id: 'important', name: 'Important', color: '#D13438' }
  ],

  DEFAULT_FOLDERS: [],

  DEFAULT_SETTINGS: {
    theme: 'system',
    defaultView: 'grid',
    showProgress: true
  },

  getStorage: function(callback) {
    var self = this;
    chrome.storage.sync.get(null, function(result) {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(null, function(localResult) {
          callback(localResult || {});
        });
      } else {
        callback(result || {});
      }
    });
  },

  saveArticle: function(article, callback) {
    var self = this;
    var id = this.hashCode(article.url);
    
    this.getArticles(function(articles) {
      articles[id] = {
        id: id,
        url: article.url,
        title: self.sanitizeInput(article.title),
        author: self.sanitizeInput(article.author || ''),
        thumbnail: article.thumbnail || '',
        excerpt: self.sanitizeInput(article.excerpt || ''),
        savedAt: Date.now(),
        progress: article.progress || 0,
        tags: article.tags || [],
        folder: article.folder || null,
        notes: self.sanitizeInput(article.notes || ''),
        isFavorite: article.isFavorite || false
      };

      var data = {};
      data[self.STORAGE_KEYS.ARTICLES] = articles;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback(articles[id]);
          });
        } else {
          if (callback) callback(articles[id]);
        }
      });
    });
  },

  getArticles: function(callback) {
    var self = this;
    chrome.storage.sync.get(this.STORAGE_KEYS.ARTICLES, function(result) {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(self.STORAGE_KEYS.ARTICLES, function(localResult) {
          callback(localResult[self.STORAGE_KEYS.ARTICLES] || {});
        });
      } else {
        callback(result[self.STORAGE_KEYS.ARTICLES] || {});
      }
    });
  },

  getArticle: function(url, callback) {
    var self = this;
    this.getArticles(function(articles) {
      var id = self.hashCode(url);
      callback(articles[id] || null);
    });
  },

  updateArticleProgress: function(url, progress, callback) {
    var self = this;
    this.getArticles(function(articles) {
      var id = self.hashCode(url);
      if (articles[id]) {
        articles[id].progress = Math.min(100, Math.max(0, progress));
        
        var data = {};
        data[self.STORAGE_KEYS.ARTICLES] = articles;
        
        chrome.storage.sync.set(data, function() {
          if (chrome.runtime.lastError) {
            chrome.storage.local.set(data, function() {
              if (callback) callback(articles[id]);
            });
          } else {
            if (callback) callback(articles[id]);
          }
        });
      } else {
        if (callback) callback(null);
      }
    });
  },

  deleteArticle: function(url, callback) {
    var self = this;
    this.getArticles(function(articles) {
      var id = self.hashCode(url);
      delete articles[id];
      
      var data = {};
      data[self.STORAGE_KEYS.ARTICLES] = articles;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback();
          });
        } else {
          if (callback) callback();
        }
      });
    });
  },

  isArticleSaved: function(url, callback) {
    var self = this;
    this.getArticle(url, function(article) {
      callback(!!article);
    });
  },

  getTags: function(callback) {
    var self = this;
    chrome.storage.sync.get(this.STORAGE_KEYS.TAGS, function(result) {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(self.STORAGE_KEYS.TAGS, function(localResult) {
          var tags = localResult[self.STORAGE_KEYS.TAGS] || {};
          if (Object.keys(tags).length === 0) {
            tags = {};
            self.DEFAULT_TAGS.forEach(function(tag) {
              tags[tag.id] = tag;
            });
            var data = {};
            data[self.STORAGE_KEYS.TAGS] = tags;
            chrome.storage.local.set(data, function() {
              callback(tags);
            });
          } else {
            callback(tags);
          }
        });
      } else {
        var tags = result[self.STORAGE_KEYS.TAGS] || {};
        if (Object.keys(tags).length === 0) {
          tags = {};
          self.DEFAULT_TAGS.forEach(function(tag) {
            tags[tag.id] = tag;
          });
          var data = {};
          data[self.STORAGE_KEYS.TAGS] = tags;
          chrome.storage.sync.set(data, function() {
            if (chrome.runtime.lastError) {
              chrome.storage.local.set(data, function() {
                callback(tags);
              });
            } else {
              callback(tags);
            }
          });
        } else {
          callback(tags);
        }
      }
    });
  },

  createTag: function(name, color, callback) {
    var self = this;
    this.getTags(function(tags) {
      var id = self.generateId();
      tags[id] = { id: id, name: name, color: color };
      
      var data = {};
      data[self.STORAGE_KEYS.TAGS] = tags;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback(tags[id]);
          });
        } else {
          if (callback) callback(tags[id]);
        }
      });
    });
  },

  deleteTag: function(tagId, callback) {
    var self = this;
    var tagsData, articlesData;
    
    function doDelete() {
      delete tagsData[tagId];
      
      Object.keys(articlesData).forEach(function(key) {
        var article = articlesData[key];
        if (article.tags) {
          article.tags = article.tags.filter(function(t) { return t !== tagId; });
        }
      });

      var data = {};
      data[self.STORAGE_KEYS.TAGS] = tagsData;
      data[self.STORAGE_KEYS.ARTICLES] = articlesData;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback();
          });
        } else {
          if (callback) callback();
        }
      });
    }
    
    this.getTags(function(tags) {
      tagsData = tags;
      self.getArticles(function(articles) {
        articlesData = articles;
        doDelete();
      });
    });
  },

  getFolders: function(callback) {
    var self = this;
    chrome.storage.sync.get(this.STORAGE_KEYS.FOLDERS, function(result) {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(self.STORAGE_KEYS.FOLDERS, function(localResult) {
          var folders = localResult[self.STORAGE_KEYS.FOLDERS] || {};
          if (Object.keys(folders).length === 0) {
            folders = {};
            self.DEFAULT_FOLDERS.forEach(function(folder) {
              folders[folder.id] = folder;
            });
            var data = {};
            data[self.STORAGE_KEYS.FOLDERS] = folders;
            chrome.storage.local.set(data, function() {
              callback(folders);
            });
          } else {
            callback(folders);
          }
        });
      } else {
        var folders = result[self.STORAGE_KEYS.FOLDERS] || {};
        if (Object.keys(folders).length === 0) {
          folders = {};
          self.DEFAULT_FOLDERS.forEach(function(folder) {
            folders[folder.id] = folder;
          });
          var data = {};
          data[self.STORAGE_KEYS.FOLDERS] = folders;
          chrome.storage.sync.set(data, function() {
            if (chrome.runtime.lastError) {
              chrome.storage.local.set(data, function() {
                callback(folders);
              });
            } else {
              callback(folders);
            }
          });
        } else {
          callback(folders);
        }
      }
    });
  },

  createFolder: function(name, callback) {
    var self = this;
    this.getFolders(function(folders) {
      var id = self.generateId();
      var order = Object.keys(folders).length;
      folders[id] = { id: id, name: name, order: order };
      
      var data = {};
      data[self.STORAGE_KEYS.FOLDERS] = folders;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback(folders[id]);
          });
        } else {
          if (callback) callback(folders[id]);
        }
      });
    });
  },

  deleteFolder: function(folderId, callback) {
    var self = this;
    var foldersData, articlesData;
    
    function doDelete() {
      delete foldersData[folderId];
      
      Object.keys(articlesData).forEach(function(key) {
        var article = articlesData[key];
        if (article.folder === folderId) {
          article.folder = null;
        }
      });

      var data = {};
      data[self.STORAGE_KEYS.FOLDERS] = foldersData;
      data[self.STORAGE_KEYS.ARTICLES] = articlesData;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback();
          });
        } else {
          if (callback) callback();
        }
      });
    }
    
    this.getFolders(function(folders) {
      foldersData = folders;
      self.getArticles(function(articles) {
        articlesData = articles;
        doDelete();
      });
    });
  },

  getSettings: function(callback) {
    var self = this;
    chrome.storage.sync.get(this.STORAGE_KEYS.SETTINGS, function(result) {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(self.STORAGE_KEYS.SETTINGS, function(localResult) {
          var settings = localResult[self.STORAGE_KEYS.SETTINGS] || {};
          var merged = {};
          Object.keys(self.DEFAULT_SETTINGS).forEach(function(k) {
            merged[k] = self.DEFAULT_SETTINGS[k];
          });
          Object.keys(settings).forEach(function(k) {
            merged[k] = settings[k];
          });
          callback(merged);
        });
      } else {
        var settings = result[self.STORAGE_KEYS.SETTINGS] || {};
        var merged = {};
        Object.keys(self.DEFAULT_SETTINGS).forEach(function(k) {
          merged[k] = self.DEFAULT_SETTINGS[k];
        });
        Object.keys(settings).forEach(function(k) {
          merged[k] = settings[k];
        });
        callback(merged);
      }
    });
  },

  updateSettings: function(settings, callback) {
    var self = this;
    this.getSettings(function(current) {
      var updated = {};
      Object.keys(current).forEach(function(k) {
        updated[k] = current[k];
      });
      Object.keys(settings).forEach(function(k) {
        updated[k] = settings[k];
      });
      
      var data = {};
      data[self.STORAGE_KEYS.SETTINGS] = updated;
      
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {
            if (callback) callback(updated);
          });
        } else {
          if (callback) callback(updated);
        }
      });
    });
  },

  getAllProgressFromLocal: function(callback) {
    chrome.storage.local.get(null, function(all) {
      var progressData = {};
      if (all) {
        Object.keys(all).forEach(function(key) {
          if (key.indexOf('substacksaver_progress_') === 0) {
            var id = key.replace('substacksaver_progress_', '');
            progressData[id] = all[key].progress;
          }
        });
      }
      callback(progressData);
    });
  },

  searchArticles: function(query, filters, callback) {
    if (typeof filters === 'undefined') filters = {};
    var self = this;
    
    this.getArticles(function(articles) {
      self.getTags(function(tags) {
        self.getAllProgressFromLocal(function(allProgress) {
          var results = Object.keys(articles).map(function(key) {
            return articles[key];
          });
          
          results.forEach(function(article) {
            var id = self.hashCode(article.url);
            var localProgress = allProgress[id] || 0;
            if (localProgress > article.progress) {
              article.progress = localProgress;
            }
          });
          
          if (query) {
            var q = query.toLowerCase();
            results = results.filter(function(article) {
              var titleMatch = article.title && article.title.toLowerCase().indexOf(q) !== -1;
              var authorMatch = article.author && article.author.toLowerCase().indexOf(q) !== -1;
              return titleMatch || authorMatch;
            });
          }

          if (filters.status) {
            if (filters.status === 'unread') {
              results = results.filter(function(a) { return a.progress === 0; });
            } else if (filters.status === 'in-progress') {
              results = results.filter(function(a) { return a.progress > 0 && a.progress < 100; });
            } else if (filters.status === 'completed') {
              results = results.filter(function(a) { return a.progress >= 100; });
            }
          }

          if (filters.tags && filters.tags.length > 0) {
            results = results.filter(function(a) {
              return a.tags && a.tags.some(function(t) { return filters.tags.indexOf(t) !== -1; });
            });
          }

          if (filters.folder) {
            results = results.filter(function(a) { return a.folder === filters.folder; });
          }

          if (filters.favorites) {
            results = results.filter(function(a) { return a.isFavorite; });
          }

          var sortBy = filters.sortBy || 'savedAt';
          var sortOrder = filters.sortOrder || 'desc';
          
          results.sort(function(a, b) {
            var comparison = 0;
            if (sortBy === 'title') {
              comparison = (a.title || '').localeCompare(b.title || '');
            } else if (sortBy === 'author') {
              comparison = (a.author || '').localeCompare(b.author || '');
            } else if (sortBy === 'progress') {
              comparison = a.progress - b.progress;
            } else {
              comparison = a.savedAt - b.savedAt;
            }
            return sortOrder === 'desc' ? -comparison : comparison;
          });

          callback(results);
        });
      });
    });
  },

  exportToEdgeCollections: function(callback) {
    var self = this;
    this.getArticles(function(articles) {
      self.getTags(function(tags) {
        var items = Object.keys(articles).map(function(key) {
          var article = articles[key];
          var articleTags = [];
          if (article.tags) {
            article.tags.forEach(function(t) {
              if (tags[t] && tags[t].name) {
                articleTags.push(tags[t].name);
              }
            });
          }
          return {
            title: article.title,
            url: article.url,
            notes: article.notes || '',
            tags: articleTags
          };
        });
        
        callback({
          name: "SubstackSaver Export",
          items: items
        });
      });
    });
  },

  importFromEdgeCollections: function(collectionData, callback) {
    if (!collectionData || typeof collectionData !== 'object') {
      if (callback) callback(new Error('Invalid import data'));
      return;
    }
    
    var self = this;
    var items = Array.isArray(collectionData.items) ? collectionData.items : [];
    
    this.getArticles(function(articles) {
      self.getTags(function(tags) {
        items.forEach(function(item) {
          if (!item || typeof item !== 'object' || !item.url) {
            return;
          }
          
          var id = self.hashCode(item.url);
          
          var articleTags = [];
          if (Array.isArray(item.tags)) {
            item.tags.forEach(function(tagName) {
              if (typeof tagName !== 'string') return;
              var normalizedName = tagName.toLowerCase();
              Object.keys(tags).forEach(function(tid) {
                if (tags[tid].name.toLowerCase() === normalizedName) {
                  articleTags.push(tid);
                }
              });
            });
          }

          var existingArticle = articles[id];
          
          articles[id] = {
            id: id,
            url: String(item.url),
            title: self.sanitizeInput(item.title || existingArticle?.title || 'Untitled'),
            author: existingArticle?.author || '',
            thumbnail: existingArticle?.thumbnail || '',
            savedAt: existingArticle?.savedAt || Date.now(),
            progress: existingArticle?.progress || 0,
            tags: articleTags.length > 0 ? articleTags : (existingArticle?.tags || []),
            folder: existingArticle?.folder || null,
            notes: self.sanitizeInput(item.notes || existingArticle?.notes || ''),
            isFavorite: existingArticle?.isFavorite || false
          };
        });

        var data = {};
        data[self.STORAGE_KEYS.ARTICLES] = articles;
        
        chrome.storage.sync.set(data, function() {
          if (chrome.runtime.lastError) {
            chrome.storage.local.set(data, function() {
              if (callback) callback();
            });
          } else {
            if (callback) callback();
          }
        });
      });
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = storage;
}
