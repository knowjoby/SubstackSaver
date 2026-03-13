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
    const hostname = new URL(url).hostname;
    return hostname.endsWith('substack.com') || hostname.endsWith('substack.email');
  } catch {
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
  chrome.contextMenus?.removeAll();

  chrome.contextMenus?.create({
    id: 'saveToSubstackSaver',
    title: 'Save to SubstackSaver',
    contexts: ['page', 'link'],
    documentUrlPatterns: ['*://*.substack.com/*']
  });

  chrome.contextMenus?.create({
    id: 'saveLinkToSubstackSaver',
    title: 'Save link to SubstackSaver',
    contexts: ['link'],
    documentUrlPatterns: ['*://*.substack.com/*']
  });
}

chrome.runtime?.onInstalled?.addListener(() => {
  initializeStorage();
  createContextMenus();
});

chrome.runtime?.onStartup?.addListener(() => {
  createContextMenus();
});

chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
  if (!tab?.url || !isSubstackUrl(tab.url)) return;

  if (info.menuItemId === 'saveToSubstackSaver') {
    const url = info.linkUrl || tab.url;
    
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
          title: ogTitle,
          author: author.replace(/^by\s+/i, ''),
          thumbnail: ogImage
        };
      }
    });

    const pageInfo = results[0]?.result || { title: tab.title, author: '', thumbnail: '' };
    
    await saveArticle({
      url: tab.url,
      title: pageInfo.title || tab.title,
      author: pageInfo.author || '',
      thumbnail: pageInfo.thumbnail || ''
    });

    chrome.tabs.sendMessage(tab.id, { action: 'saved' });
  }

  if (info.menuItemId === 'saveLinkToSubstackSaver' && info.linkUrl) {
    const linkUrl = info.linkUrl;
    
    await saveArticle({
      url: linkUrl,
      title: linkUrl.split('/').pop() || 'Substack Article',
      author: '',
      thumbnail: ''
    });
  }
});

chrome.action?.onClicked?.addListener(async (tab) => {
  if (tab?.url?.includes('dashboard.html')) return;
  
  const dashboardUrl = chrome.runtime?.getURL('dashboard/dashboard.html');
  if (tab?.id) {
    chrome.tabs.create({ url: dashboardUrl, index: tab.index + 1 });
  } else {
    chrome.tabs.create({ url: dashboardUrl });
  }
});

console.log('SubstackSaver: Background script loaded');
