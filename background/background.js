var STORAGE_KEYS = {
  ARTICLES: 'articles',
  TAGS: 'tags',
  FOLDERS: 'folders',
  SETTINGS: 'settings'
};

var DEFAULT_TAGS = [
  { id: 'read', name: 'Read', color: '#107C10' },
  { id: 'later', name: 'Read Later', color: '#0078D4' },
  { id: 'important', name: 'Important', color: '#D13438' }
];

var DEFAULT_FOLDERS = [];

var DEFAULT_SETTINGS = {
  theme: 'system',
  defaultView: 'grid',
  showProgress: true
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function hashCode(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function isSubstackUrl(url) {
  if (!url) return false;
  try {
    var hostname = new URL(url).hostname;
    return hostname.indexOf('substack.com') !== -1 || hostname.indexOf('substack.email') !== -1;
  } catch (e) {
    return false;
  }
}

function saveArticle(article, callback) {
  var id = hashCode(article.url);
  
  chrome.storage.sync.get(STORAGE_KEYS.ARTICLES, function(result) {
    var articles = {};
    if (!chrome.runtime.lastError && result[STORAGE_KEYS.ARTICLES]) {
      articles = result[STORAGE_KEYS.ARTICLES];
    }
    
    articles[id] = {
      id: id,
      url: article.url,
      title: article.title,
      author: article.author || '',
      thumbnail: article.thumbnail || '',
      savedAt: Date.now(),
      progress: article.progress || 0,
      tags: article.tags || [],
      folder: article.folder || null,
      notes: article.notes || '',
      isFavorite: article.isFavorite || false
    };

    var data = {};
    data[STORAGE_KEYS.ARTICLES] = articles;
    
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
}

function deleteArticle(url, callback) {
  var id = hashCode(url);
  
  chrome.storage.sync.get(STORAGE_KEYS.ARTICLES, function(result) {
    var articles = {};
    if (!chrome.runtime.lastError && result[STORAGE_KEYS.ARTICLES]) {
      articles = result[STORAGE_KEYS.ARTICLES];
    }
    
    delete articles[id];

    var data = {};
    data[STORAGE_KEYS.ARTICLES] = articles;
    
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
}

function isArticleSaved(url, callback) {
  var id = hashCode(url);
  
  chrome.storage.sync.get(STORAGE_KEYS.ARTICLES, function(result) {
    var articles = {};
    if (!chrome.runtime.lastError && result[STORAGE_KEYS.ARTICLES]) {
      articles = result[STORAGE_KEYS.ARTICLES];
    }
    callback(!!articles[id]);
  });
}

function initializeStorage() {
  chrome.storage.sync.get(STORAGE_KEYS.TAGS, function(result) {
    if (chrome.runtime.lastError) {
      console.log('SubstackSaver: Using local storage');
      return;
    }
    
    var tags = result[STORAGE_KEYS.TAGS] || {};
    
    if (Object.keys(tags).length === 0) {
      tags = {};
      DEFAULT_TAGS.forEach(function(tag) {
        tags[tag.id] = tag;
      });
      var data = {};
      data[STORAGE_KEYS.TAGS] = tags;
      chrome.storage.sync.set(data, function() {});
    }

    chrome.storage.sync.get(STORAGE_KEYS.FOLDERS, function(foldersResult) {
      var folders = foldersResult[STORAGE_KEYS.FOLDERS] || {};
      
      if (Object.keys(folders).length === 0) {
        folders = {};
        DEFAULT_FOLDERS.forEach(function(folder) {
          folders[folder.id] = folder;
        });
        var data = {};
        data[STORAGE_KEYS.FOLDERS] = folders;
        chrome.storage.sync.set(data, function() {});
      }

      chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, function(settingsResult) {
        var settings = settingsResult[STORAGE_KEYS.SETTINGS] || {};
        
        if (Object.keys(settings).length === 0) {
          var data = {};
          data[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS;
          chrome.storage.sync.set(data, function() {});
        }
      });
    });
  });
}

function createContextMenus() {
  if (!chrome.contextMenus) return;

  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: 'saveToSubstackSaver',
      title: 'Save to SubstackSaver',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.substack.com/*']
    });

    chrome.contextMenus.create({
      id: 'saveLinkToSubstackSaver',
      title: 'Save link to SubstackSaver',
      contexts: ['link'],
      documentUrlPatterns: ['*://*.substack.com/*']
    });
  });
}

if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(function() {
    initializeStorage();
    createContextMenus();
  });
}

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(function() {
    createContextMenus();
  });
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (!tab || !tab.url) return;
    
    var pageUrl = tab.url;
    var linkUrl = info.linkUrl;
    
    if (info.menuItemId === 'saveToSubstackSaver') {
      var url = linkUrl || pageUrl;
      if (!isSubstackUrl(url)) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: function() {
          function getMeta(prop) {
            var el = document.querySelector('meta[property="' + prop + '"]');
            if (el) return el.content;
            el = document.querySelector('meta[name="' + prop + '"]');
            return el ? el.content : null;
          }
          
          var ogTitle = getMeta('og:title') || document.title;
          var ogImage = getMeta('og:image');
          var authorEl = document.querySelector('meta[name="author"]');
          var author = authorEl ? authorEl.content : '';
          if (!author) {
            var authorLink = document.querySelector('a[href*="/@"]');
            if (authorLink) author = authorLink.textContent ? authorLink.textContent.trim() : '';
          }
          
          return {
            title: ogTitle || '',
            author: author ? author.replace(/^by\s+/i, '') : '',
            thumbnail: ogImage || ''
          };
        }
      }, function(results) {
        if (chrome.runtime.lastError) {
          console.error('Script execution error:', chrome.runtime.lastError.message);
          return;
        }
        
        var pageInfo = results && results[0] && results[0].result ? results[0].result : { title: tab.title, author: '', thumbnail: '' };
        
        saveArticle({
          url: tab.url,
          title: pageInfo.title || tab.title,
          author: pageInfo.author || '',
          thumbnail: pageInfo.thumbnail || ''
        }, function() {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'saved' });
          }
        });
      });
    }

    if (info.menuItemId === 'saveLinkToSubstackSaver' && info.linkUrl && isSubstackUrl(info.linkUrl)) {
      var savedLinkUrl = info.linkUrl;

      saveArticle({
        url: savedLinkUrl,
        title: savedLinkUrl.split('/').pop() || 'Substack Article',
        author: '',
        thumbnail: ''
      }, function() {});
    }
  });
}

var toolbarClickHandler = function(tab) {
  if (tab && tab.url && tab.url.indexOf('dashboard.html') !== -1) return;
  
  var dashboardUrl = '';
  if (chrome.runtime && chrome.runtime.getURL) {
    dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
  }
  if (tab && tab.id) {
    chrome.tabs.create({ url: dashboardUrl, index: tab.index + 1 });
  } else {
    chrome.tabs.create({ url: dashboardUrl });
  }
};

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(toolbarClickHandler);
} else if (chrome.browserAction && chrome.browserAction.onClicked) {
  chrome.browserAction.onClicked.addListener(toolbarClickHandler);
}

console.log('SubstackSaver: Background script loaded');
