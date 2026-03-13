window.utils = {
  generateId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
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

  getDomain: function(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  },

  isSubstackUrl: function(url) {
    if (!url) return false;
    try {
      var parsedUrl = new URL(url);
      return parsedUrl.hostname.indexOf('substack.com') !== -1;
    } catch (e) {
      return false;
    }
  },

  escapeHtml: function(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  formatDate: function(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    
    var yearPart = date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: yearPart
    });
  },

  truncate: function(str, length) {
    if (!str) return '';
    if (length === undefined) length = 60;
    return str.length > length ? str.substring(0, length) + '...' : str;
  },

  debounce: function(fn, delay) {
    if (delay === undefined) delay = 300;
    var timeout;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  },

  throttle: function(fn, limit) {
    if (limit === undefined) limit = 100;
    var inThrottle;
    return function() {
      var context = this;
      var args = arguments;
      if (!inThrottle) {
        fn.apply(context, args);
        inThrottle = true;
        setTimeout(function() { inThrottle = false; }, limit);
      }
    };
  },

  getActiveTab: function(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        callback(tabs[0]);
      } else {
        callback(null);
      }
    });
  },

  getTheme: function(callback) {
    chrome.storage.sync.get(['settings'], function(result) {
      var theme = 'system';
      if (result && result.settings && result.settings.theme) {
        theme = result.settings.theme;
      }
      callback(theme);
    });
  },

  applyTheme: function(theme) {
    var root = document.documentElement;
    if (theme === 'system') {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  },

  initThemeListener: function() {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var self = this;
    mq.addEventListener('change', function() {
      chrome.storage.sync.get(['settings'], function(result) {
        if (result && result.settings && result.settings.theme === 'system') {
          self.applyTheme('system');
        }
      });
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = utils;
}
