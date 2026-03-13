(function() {
  var PROGRESS_STORAGE_KEY = 'substacksaver_progress';
  var DEBOUNCE_DELAY = 500;
  
  var currentProgress = 0;
  var saveTimeout = null;
  var articleUrl = window.location.href.split('?')[0].split('#')[0];

  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function calculateProgress() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    if (docHeight <= 0) return 100;
    
    var progress = Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)));
    return progress;
  }

  function saveProgress(progress) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(function() {
      try {
        var key = PROGRESS_STORAGE_KEY + '_' + hashCode(articleUrl);
        var data = {};
        data[key] = {
          progress: progress,
          timestamp: Date.now()
        };
        chrome.storage.local.set(data, function() {
          // Saved
        });
      } catch (e) {
        console.log('SubstackSaver: Could not save progress', e);
      }
    }, DEBOUNCE_DELAY);
  }

  function getSavedProgress(callback) {
    try {
      var key = PROGRESS_STORAGE_KEY + '_' + hashCode(articleUrl);
      chrome.storage.local.get([key], function(result) {
        var data = result[key];
        callback(data ? data.progress : 0);
      });
    } catch (e) {
      callback(0);
    }
  }

  function scrollToProgress(progress) {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var targetScroll = (progress / 100) * docHeight;
    
    window.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }

  function restoreProgress() {
    var urlParams = new URLSearchParams(window.location.search);
    var progressParam = urlParams.get('progress');
    
    if (progressParam) {
      var progress = parseInt(progressParam, 10);
      if (!isNaN(progress)) {
        setTimeout(function() {
          scrollToProgress(progress);
          
          var cleanUrl = window.location.href.replace(/[?&]progress=\d+/g, '').replace(/[?&]from=substacksaver/g, '');
          window.history.replaceState({}, document.title, cleanUrl);
        }, 500);
      }
    } else {
      getSavedProgress(function(progress) {
        if (progress > 0) {
          scrollToProgress(progress);
        }
      });
    }
  }

  function init() {
    try {
      var hostname = window.location.hostname;
      if (hostname.indexOf('substack.com') === -1 && hostname.indexOf('substack.email') === -1) {
        return;
      }
    } catch (e) {
      return;
    }

    var isArticlePage = document.querySelector('article') || 
                        document.querySelector('[class*="post-content"]') ||
                        document.querySelector('.piece-content');

    if (!isArticlePage) {
      return;
    }

    restoreProgress();

    var ticking = false;
    
    window.addEventListener('scroll', function() {
      if (!ticking) {
        var self = this;
        requestAnimationFrame(function() {
          var progress = calculateProgress();
          
          if (progress !== currentProgress) {
            currentProgress = progress;
            saveProgress(progress);
          }
          
          ticking = false;
        });
        ticking = true;
      }
    });

    window.addEventListener('beforeunload', function() {
      var progress = calculateProgress();
      if (progress > 0) {
        try {
          var key = PROGRESS_STORAGE_KEY + '_' + hashCode(articleUrl);
          var data = {};
          data[key] = {
            progress: progress,
            timestamp: Date.now()
          };
          chrome.storage.local.set(data, function() {
            // Saved
          });
        } catch (e) {
          console.log('SubstackSaver: Could not save final progress', e);
        }
      }
    });

    console.log('SubstackSaver: Progress tracking initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
