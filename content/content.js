(function() {
  const PROGRESS_STORAGE_KEY = 'substacksaver_progress';
  const DEBOUNCE_DELAY = 500;
  
  let currentProgress = 0;
  let saveTimeout = null;
  let articleUrl = window.location.href.split('?')[0];

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function calculateProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    if (docHeight <= 0) return 100;
    
    const progress = Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)));
    return progress;
  }

  function saveProgress(progress) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
      try {
        await chrome.storage.local.set({
          [`${PROGRESS_STORAGE_KEY}_${hashCode(articleUrl)}`]: {
            progress: progress,
            timestamp: Date.now()
          }
        });
      } catch (e) {
        console.log('SubstackSaver: Could not save progress', e);
      }
    }, DEBOUNCE_DELAY);
  }

  function getSavedProgress() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([`${PROGRESS_STORAGE_KEY}_${hashCode(articleUrl)}`], (result) => {
          const data = result[`${PROGRESS_STORAGE_KEY}_${hashCode(articleUrl)}`];
          resolve(data ? data.progress : 0);
        });
      } catch (e) {
        resolve(0);
      }
    });
  }

  function scrollToProgress(progress) {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const targetScroll = (progress / 100) * docHeight;
    
    window.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }

  function restoreProgress() {
    const urlParams = new URLSearchParams(window.location.search);
    const progressParam = urlParams.get('progress');
    
    if (progressParam) {
      const progress = parseInt(progressParam, 10);
      if (!isNaN(progress)) {
        setTimeout(() => {
          scrollToProgress(progress);
          
          const cleanUrl = window.location.href.replace(/[?&]progress=\d+/g, '').replace(/[?&]from=substacksaver/g, '');
          window.history.replaceState({}, document.title, cleanUrl);
        }, 500);
      }
    } else {
      getSavedProgress().then(progress => {
        if (progress > 0) {
          scrollToProgress(progress);
        }
      });
    }
  }

  function init() {
    try {
      const hostname = window.location.hostname;
      if (!hostname.endsWith('substack.com') && !hostname.endsWith('substack.email')) {
        return;
      }
    } catch (e) {
      return;
    }

    const isArticlePage = document.querySelector('article') || 
                          document.querySelector('[class*="post-content"]') ||
                          document.querySelector('.piece-content');

    if (!isArticlePage) {
      return;
    }

    restoreProgress();

    let ticking = false;
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const progress = calculateProgress();
          
          if (progress !== currentProgress) {
            currentProgress = progress;
            saveProgress(progress);
          }
          
          ticking = false;
        });
        
        ticking = true;
      }
    });

    window.addEventListener('beforeunload', () => {
      const progress = calculateProgress();
      if (progress > 0) {
        try {
          chrome.storage.local.set({
            [`${PROGRESS_STORAGE_KEY}_${hashCode(articleUrl)}`]: {
              progress: progress,
              timestamp: Date.now()
            }
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
