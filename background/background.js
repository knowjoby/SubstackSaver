const STORAGE_KEYS = {
  ARTICLES: 'articles',
  TAGS: 'tags',
  FOLDERS: 'folders',
  SETTINGS: 'settings'
};

const DEFAULT_TAGS = [
  { id: 'read', name: 'Read', color: '#107C10' },
  { id: 'later', name: 'Read Later', color: '#0078D4' },
  { id: 'important', name: 'Important', color: '#D13438' }
];

const DEFAULT_FOLDERS = [];

const DEFAULT_SETTINGS = {
  theme: 'system',
  defaultView: 'grid',
  showProgress: true
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
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

async function saveArticle(article) {
  const id = hashCode(article.url);
  
  let articles = {};
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.ARTICLES);
    articles = result[STORAGE_KEYS.ARTICLES] || {};
  } catch (e) {
    const localResult = await chrome.storage.local.get(STORAGE_KEYS.ARTICLES);
    articles = localResult[STORAGE_KEYS.ARTICLES] || {};
  }
  
  articles[id] = {
    id,
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

  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.ARTICLES]: articles });
  } catch (e) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ARTICLES]: articles });
  }
  
  return articles[id];
}

async function deleteArticle(url) {
  const id = hashCode(url);
  
  let articles = {};
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.ARTICLES);
    articles = result[STORAGE_KEYS.ARTICLES] || {};
  } catch (e) {
    const localResult = await chrome.storage.local.get(STORAGE_KEYS.ARTICLES);
    articles = localResult[STORAGE_KEYS.ARTICLES] || {};
  }
  
  delete articles[id];

  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.ARTICLES]: articles });
  } catch (e) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ARTICLES]: articles });
  }
}

async function isArticleSaved(url) {
  const id = hashCode(url);
  
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.ARTICLES);
    return !!(result[STORAGE_KEYS.ARTICLES] || {})[id];
  } catch (e) {
    const localResult = await chrome.storage.local.get(STORAGE_KEYS.ARTICLES);
    return !!((localResult[STORAGE_KEYS.ARTICLES] || {})[id]);
  }
}

async function initializeStorage() {
  try {
    const tagsResult = await chrome.storage.sync.get(STORAGE_KEYS.TAGS);
    let tags = tagsResult[STORAGE_KEYS.TAGS] || {};
    
    if (Object.keys(tags).length === 0) {
      tags = DEFAULT_TAGS.reduce((acc, tag) => {
        acc[tag.id] = tag;
        return acc;
      }, {});
      await chrome.storage.sync.set({ [STORAGE_KEYS.TAGS]: tags });
    }

    const foldersResult = await chrome.storage.sync.get(STORAGE_KEYS.FOLDERS);
    let folders = foldersResult[STORAGE_KEYS.FOLDERS] || {};
    
    if (Object.keys(folders).length === 0) {
      folders = DEFAULT_FOLDERS.reduce((acc, folder) => {
        acc[folder.id] = folder;
        return acc;
      }, {});
      await chrome.storage.sync.set({ [STORAGE_KEYS.FOLDERS]: folders });
    }

    const settingsResult = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    let settings = settingsResult[STORAGE_KEYS.SETTINGS] || {};
    
    if (Object.keys(settings).length === 0) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
    }
  } catch (e) {
    console.log('SubstackSaver: Using local storage');
  }
}

function createContextMenus() {
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll();
  }

  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'saveToSubstackSaver',
      title: 'Save to SubstackSaver',
      contexts: ['page', 'link'],
      documentUrlPatterns: ['*://*.substack.com/*']
    });

    chrome.contextMenus.create({
      id: 'saveLinkToSubstackSaver',
      title: 'Save link to SubstackSaver',
      contexts: ['link'],
      documentUrlPatterns: ['*://*.substack.com/*']
    });
  }
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
    if (!tab || !tab.url || !isSubstackUrl(tab.url)) return;

    if (info.menuItemId === 'saveToSubstackSaver') {
      var url = info.linkUrl || tab.url;
      
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
        var pageInfo = results && results[0] && results[0].result ? results[0].result : { title: tab.title, author: '', thumbnail: '' };
        
        saveArticle({
          url: tab.url,
          title: pageInfo.title || tab.title,
          author: pageInfo.author || '',
          thumbnail: pageInfo.thumbnail || ''
        });

        chrome.tabs.sendMessage(tab.id, { action: 'saved' });
      });
    }

    if (info.menuItemId === 'saveLinkToSubstackSaver' && info.linkUrl) {
      var linkUrl = info.linkUrl;
      
      saveArticle({
        url: linkUrl,
        title: linkUrl.split('/').pop() || 'Substack Article',
        author: '',
        thumbnail: ''
      });
    }
  });
}

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(function(tab) {
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
  });
}

console.log('SubstackSaver: Background script loaded');
