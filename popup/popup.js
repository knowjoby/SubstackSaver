(function() {
  var currentArticle = null;
  var isSaving = false;

  function init() {
    storage.getSettings().then(function(settings) {
      utils.applyTheme(settings.theme || 'system');
    });
    
    utils.getActiveTab().then(function(tab) {
      if (!tab || !utils.isSubstackUrl(tab.url)) {
        showNotSubstack();
        return;
      }
      loadArticleInfo(tab).then(function() {
        setupEventListeners();
      });
    });
  }

  function showNotSubstack() {
    document.getElementById('notSubstack').style.display = 'block';
    document.getElementById('saveContent').style.display = 'none';
  }

  function loadArticleInfo(tab) {
    return new Promise(function(resolve, reject) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: function() {
          var getMeta = function(prop) {
            var el = document.querySelector('meta[property="' + prop + '"]');
            if (el) return el.content;
            el = document.querySelector('meta[name="' + prop + '"]');
            return el ? el.content : null;
          };
          
          var ogTitle = getMeta('og:title') || document.title;
          var ogImage = getMeta('og:image');
          var author = '';
          var authorEl = document.querySelector('meta[name="author"]');
          if (authorEl) author = authorEl.content;
          if (!author) {
            var authorLink = document.querySelector('a[href*="/@"]');
            if (authorLink) author = authorLink.textContent.trim();
          }
          
          return {
            title: ogTitle || '',
            author: author ? author.replace(/^by\s+/i, '') : '',
            thumbnail: ogImage || ''
          };
        }
      }, function(results) {
        try {
          var info = results && results[0] && results[0].result ? results[0].result : { title: tab.title, author: '', thumbnail: '' };
          
          currentArticle = {
            url: tab.url,
            title: info.title || tab.title,
            author: info.author || '',
            thumbnail: info.thumbnail || ''
          };

          document.getElementById('articleTitle').textContent = currentArticle.title;
          document.getElementById('articleAuthor').textContent = currentArticle.author;
          
          var thumb = document.getElementById('thumbnail');
          if (info.thumbnail) {
            thumb.src = info.thumbnail;
            thumb.style.display = 'block';
          } else {
            thumb.style.display = 'none';
          }

          storage.getArticle(tab.url).then(function(existingArticle) {
            if (existingArticle) {
              document.getElementById('saveBtn').innerHTML = '<span class="btn-text">✓ Saved</span>';
              document.getElementById('saveBtn').classList.add('saved');
              
              if (existingArticle.progress > 0) {
                document.getElementById('progressSection').style.display = 'block';
                document.getElementById('progressText').textContent = existingArticle.progress + '%';
                document.getElementById('progressFill').style.width = existingArticle.progress + '%';
              }
            }
            resolve();
          });
        } catch (e) {
          console.error('Error loading article info:', e);
          document.getElementById('articleTitle').textContent = tab.title;
          resolve();
        }
      });
    });
  }

  function setupEventListeners() {
    var saveBtn = document.getElementById('saveBtn');

    saveBtn.addEventListener('click', function() {
      if (isSaving || !currentArticle) return;
      
      isSaving = true;
      var isSaved = saveBtn.classList.contains('saved');
      
      if (isSaved) {
        storage.deleteArticle(currentArticle.url).then(function() {
          saveBtn.classList.remove('saved');
          saveBtn.innerHTML = '<span class="btn-text">Save to Reading List</span>';
          isSaving = false;
        });
      } else {
        saveBtn.classList.add('loading');
        
        storage.saveArticle({
          url: currentArticle.url,
          title: currentArticle.title,
          author: currentArticle.author,
          thumbnail: currentArticle.thumbnail
        }).then(function() {
          saveBtn.classList.remove('loading');
          saveBtn.classList.add('saved');
          saveBtn.innerHTML = '<span class="btn-text">✓ Saved</span>';
          isSaving = false;
        }).catch(function(e) {
          saveBtn.classList.remove('loading');
          console.error('Failed to save:', e);
          isSaving = false;
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
