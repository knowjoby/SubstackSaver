(function() {
  let currentArticle = null;
  let isSaving = false;

  async function init() {
    const settings = await storage.getSettings();
    utils.applyTheme(settings.theme || 'system');
    
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
        document.getElementById('saveBtn').innerHTML = '<span class="btn-text">✓ Saved</span>';
        document.getElementById('saveBtn').classList.add('saved');
        
        if (existingArticle.progress > 0) {
          document.getElementById('progressSection').style.display = 'block';
          document.getElementById('progressText').textContent = `${existingArticle.progress}%`;
          document.getElementById('progressFill').style.width = `${existingArticle.progress}%`;
        }
      }

    } catch (e) {
      console.error('Error loading article info:', e);
      document.getElementById('articleTitle').textContent = tab.title;
    }
  }

  function setupEventListeners() {
    const saveBtn = document.getElementById('saveBtn');

    saveBtn.addEventListener('click', async () => {
      if (isSaving || !currentArticle) return;
      
      isSaving = true;
      const isSaved = saveBtn.classList.contains('saved');
      
      if (isSaved) {
        await storage.deleteArticle(currentArticle.url);
        saveBtn.classList.remove('saved');
        saveBtn.innerHTML = '<span class="btn-text">Save to Reading List</span>';
      } else {
        saveBtn.classList.add('loading');
        
        try {
          await storage.saveArticle({
            url: currentArticle.url,
            title: currentArticle.title,
            author: currentArticle.author,
            thumbnail: currentArticle.thumbnail
          });
          
          saveBtn.classList.remove('loading');
          saveBtn.classList.add('saved');
          saveBtn.innerHTML = '<span class="btn-text">✓ Saved</span>';
        } catch (e) {
          saveBtn.classList.remove('loading');
          console.error('Failed to save:', e);
        }
      }
      
      isSaving = false;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
