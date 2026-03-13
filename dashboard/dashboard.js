(function() {
  var currentFilter = 'all';
  var currentStatus = 'all';
  var currentFolder = null;
  var currentView = 'grid';
  var searchQuery = '';
  var sortBy = 'savedAt';
  var sortOrder = 'desc';
  var articles = [];
  var allTags = {};
  var allFolders = {};
  var settings = {};
  var selectedArticles = [];
  var previewTimeout = null;

  var TAG_COLORS = [
    '#D13438', '#FF8C00', '#FFB900', '#107C10',
    '#008080', '#0078D4', '#881798', '#5C5C5C'
  ];

  var WORDS_PER_MINUTE = 200;

  function init() {
    storage.getSettings(function(s) {
      settings = s;
      utils.applyTheme(settings.theme || 'system');
      currentView = settings.defaultView || 'grid';
      
      utils.initThemeListener();
      
      loadData(function() {
        setupEventListeners();
        renderArticles();
        updateCounts();
        updateViewToggle();
        updateOfflineStatus();
      });
    });
  }

  function updateViewToggle() {
    var gridBtn = document.getElementById('gridViewBtn');
    var listBtn = document.getElementById('listViewBtn');
    if (currentView === 'grid') {
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
    } else {
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
    }
  }

  function loadData(callback) {
    storage.searchArticles('', { status: 'all', sortBy: sortBy, sortOrder: sortOrder }, function(results) {
      articles = results;
      storage.getTags(function(tags) {
        allTags = tags;
        storage.getFolders(function(folders) {
          allFolders = folders;
          renderFolders();
          if (callback) callback();
        });
      });
    });
  }

  function renderFolders() {
    var container = document.getElementById('foldersList');
    if (!container) return;
    
    var folders = Object.values(allFolders).sort(function(a, b) { return a.order - b.order; });
    
    if (folders.length === 0) {
      container.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 12px;">No folders yet</div>';
      return;
    }
    
    container.innerHTML = folders.map(function(folder) {
      return '<div class="folder-item" data-folder="' + utils.escapeHtml(folder.id) + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        '<span>' + utils.escapeHtml(folder.name) + '</span>' +
        '</div>';
    }).join('');
  }

  function setupEventListeners() {
    var searchInput = document.getElementById('searchInput');
    var gridViewBtn = document.getElementById('gridViewBtn');
    var listViewBtn = document.getElementById('listViewBtn');
    var settingsBtn = document.getElementById('settingsBtn');
    var closeSettings = document.getElementById('closeSettings');
    var settingsModal = document.getElementById('settingsModal');
    var themeSelect = document.getElementById('themeSelect');
    var exportEdgeBtn = document.getElementById('exportEdgeBtn');
    var importEdgeBtn = document.getElementById('importEdgeBtn');
    var importFile = document.getElementById('importFile');

    searchInput.addEventListener('input', utils.debounce(function(e) {
      searchQuery = e.target.value;
      renderArticles();
    }, 300));

    gridViewBtn.addEventListener('click', function() {
      currentView = 'grid';
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      renderArticles();
      storage.updateSettings({ defaultView: 'grid' });
    });

    listViewBtn.addEventListener('click', function() {
      currentView = 'list';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      renderArticles();
      storage.updateSettings({ defaultView: 'list' });
    });

    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
      item.addEventListener('click', function() {
        navItems.forEach(function(i) { i.classList.remove('active'); });
        item.classList.add('active');
        
        currentFilter = item.dataset.filter || 'all';
        currentFolder = null;
        selectedArticles = [];
        updateBulkActions();
        
        var folderItems = document.querySelectorAll('.folder-item');
        folderItems.forEach(function(f) { f.classList.remove('active'); });
        
        updatePageTitle();
        renderArticles();
      });
    });

    var foldersList = document.getElementById('foldersList');
    if (foldersList) {
      foldersList.addEventListener('click', function(e) {
        var folderItem = e.target.closest('.folder-item');
        var folderAction = e.target.closest('.folder-action-btn');
        
        if (folderAction) {
          e.stopPropagation();
          var action = folderAction.dataset.action;
          var folderId = folderAction.dataset.folder;
          
          if (action === 'rename') {
            showRenameFolderModal(folderId);
          } else if (action === 'delete') {
            deleteFolder(folderId);
          }
          return;
        }
        
        if (folderItem) {
          navItems.forEach(function(i) { i.classList.remove('active'); });
          folderItems.forEach(function(f) { f.classList.remove('active'); });
          folderItem.classList.add('active');
          
          currentFolder = folderItem.dataset.folder;
          currentFilter = 'folder';
          selectedArticles = [];
          updateBulkActions();
          
          updatePageTitle();
          renderArticles();
        }
      });
    }

    var filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(function(pill) {
      pill.addEventListener('click', function() {
        filterPills.forEach(function(p) { p.classList.remove('active'); });
        pill.classList.add('active');
        
        currentStatus = pill.dataset.status;
        renderArticles();
      });
    });

    var sortBtn = document.getElementById('sortBtn');
    var sortMenu = document.getElementById('sortMenu');
    
    if (sortBtn && sortMenu) {
      sortBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sortMenu.classList.toggle('open');
        var exportDropdown = document.getElementById('exportDropdown');
        if (exportDropdown) exportDropdown.classList.remove('open');
      });

      sortMenu.addEventListener('click', function(e) {
        var item = e.target.closest('.dropdown-item');
        if (item) {
          sortBy = item.dataset.sort;
          sortOrder = item.dataset.order;
          var dropdownItems = document.querySelectorAll('.dropdown-item');
          dropdownItems.forEach(function(i) { i.classList.remove('active'); });
          item.classList.add('active');
          sortMenu.classList.remove('open');
          updateSortLabel();
          renderArticles();
        }
      });
    }

    var exportBtn = document.getElementById('exportBtn');
    var exportDropdown = document.getElementById('exportDropdown');
    
    if (exportBtn && exportDropdown) {
      exportBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        exportDropdown.classList.toggle('open');
        if (sortMenu) sortMenu.classList.remove('open');
      });

      exportDropdown.addEventListener('click', function(e) {
        var option = e.target.closest('.export-option');
        if (option) {
          var format = option.dataset.format;
          exportArticles(format);
          exportDropdown.classList.remove('open');
        }
      });
    }

    document.addEventListener('click', function() {
      if (sortMenu) sortMenu.classList.remove('open');
      if (exportDropdown) exportDropdown.classList.remove('open');
    });

    var manageTagsBtn = document.getElementById('manageTagsBtn');
    if (manageTagsBtn) {
      manageTagsBtn.addEventListener('click', function() {
        document.getElementById('tagModal').classList.add('open');
        renderTagManagement();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', function() {
        settingsModal.classList.add('open');
        themeSelect.value = settings.theme || 'system';
      });
    }

    if (closeSettings) {
      closeSettings.addEventListener('click', function() {
        settingsModal.classList.remove('open');
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
          settingsModal.classList.remove('open');
        }
      });
    }

    var closeTagModal = document.getElementById('closeTagModal');
    if (closeTagModal) {
      closeTagModal.addEventListener('click', function() {
        document.getElementById('tagModal').classList.remove('open');
      });
    }

    var tagModal = document.getElementById('tagModal');
    if (tagModal) {
      tagModal.addEventListener('click', function(e) {
        if (e.target.id === 'tagModal') {
          document.getElementById('tagModal').classList.remove('open');
        }
      });
    }

    var closeFolderModal = document.getElementById('closeFolderModal');
    if (closeFolderModal) {
      closeFolderModal.addEventListener('click', function() {
        document.getElementById('folderModal').classList.remove('open');
      });
    }

    var folderModal = document.getElementById('folderModal');
    if (folderModal) {
      folderModal.addEventListener('click', function(e) {
        if (e.target.id === 'folderModal') {
          document.getElementById('folderModal').classList.remove('open');
        }
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (settingsModal && settingsModal.classList.contains('open')) {
          settingsModal.classList.remove('open');
        }
        var tagModal = document.getElementById('tagModal');
        if (tagModal && tagModal.classList.contains('open')) {
          tagModal.classList.remove('open');
        }
        var folderModalEl = document.getElementById('folderModal');
        if (folderModalEl && folderModalEl.classList.contains('open')) {
          folderModalEl.classList.remove('open');
        }
        var bulkTagModal = document.getElementById('bulkTagModal');
        if (bulkTagModal && bulkTagModal.classList.contains('open')) {
          bulkTagModal.classList.remove('open');
        }
        var bulkFolderModal = document.getElementById('bulkFolderModal');
        if (bulkFolderModal && bulkFolderModal.classList.contains('open')) {
          bulkFolderModal.classList.remove('open');
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllArticles();
      }

      if (e.key === 'Delete' && selectedArticles.length > 0) {
        e.preventDefault();
        bulkDelete();
      }
    });

    if (themeSelect) {
      themeSelect.addEventListener('change', function(e) {
        settings.theme = e.target.value;
        storage.updateSettings({ theme: settings.theme }, function() {
          utils.applyTheme(settings.theme);
        });
      });
    }

    if (exportEdgeBtn) {
      exportEdgeBtn.addEventListener('click', function() {
        storage.exportToEdgeCollections(function(collection) {
          var blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          
          var a = document.createElement('a');
          a.href = url;
          a.download = 'substack-saver-export.json';
          a.click();
          
          URL.revokeObjectURL(url);
          showToast('Exported successfully', 'success');
        });
      });
    }

    if (importEdgeBtn) {
      importEdgeBtn.addEventListener('click', function() {
        importFile.click();
      });
    }

    if (importFile) {
      importFile.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) {
          var reader = new FileReader();
          reader.onload = function(event) {
            try {
              var data = JSON.parse(event.target.result);
              storage.importFromEdgeCollections(data, function(err) {
                if (err) {
                  showToast('Import failed: ' + err.message, 'error');
                  return;
                }
                loadData(function() {
                  renderArticles();
                  updateCounts();
                  showToast('Import successful', 'success');
                });
              });
            } catch (err) {
              showToast('Invalid file format', 'error');
            }
          };
          reader.readAsText(file);
        }
      });
    }

    var closeBulk = document.getElementById('closeBulk');
    if (closeBulk) {
      closeBulk.addEventListener('click', function() {
        selectedArticles = [];
        updateBulkActions();
        renderArticles();
      });
    }

    var bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', bulkDelete);
    }
    
    var bulkTagBtn = document.getElementById('bulkTagBtn');
    if (bulkTagBtn) {
      bulkTagBtn.addEventListener('click', function() {
        renderBulkTagModal();
        document.getElementById('bulkTagModal').classList.add('open');
      });
    }

    var bulkFolderBtn = document.getElementById('bulkFolderBtn');
    if (bulkFolderBtn) {
      bulkFolderBtn.addEventListener('click', function() {
        renderBulkFolderModal();
        document.getElementById('bulkFolderModal').classList.add('open');
      });
    }

    var closeBulkTagModal = document.getElementById('closeBulkTagModal');
    if (closeBulkTagModal) {
      closeBulkTagModal.addEventListener('click', function() {
        document.getElementById('bulkTagModal').classList.remove('open');
      });
    }

    var cancelBulkTag = document.getElementById('cancelBulkTag');
    if (cancelBulkTag) {
      cancelBulkTag.addEventListener('click', function() {
        document.getElementById('bulkTagModal').classList.remove('open');
      });
    }

    var applyBulkTag = document.getElementById('applyBulkTag');
    if (applyBulkTag) {
      applyBulkTag.addEventListener('click', function() {
        var checkboxes = document.querySelectorAll('#bulkTagList input[type="checkbox"]:checked');
        var tagIds = [];
        checkboxes.forEach(function(cb) {
          tagIds.push(cb.dataset.tagId);
        });
        
        if (tagIds.length === 0) {
          showToast('Please select at least one tag', 'error');
          return;
        }

        storage.getArticles(function(articlesData) {
          selectedArticles.forEach(function(url) {
            var id = storage.hashCode(url);
            if (articlesData[id]) {
              var existingTags = articlesData[id].tags || [];
              tagIds.forEach(function(tagId) {
                if (existingTags.indexOf(tagId) === -1) {
                  existingTags.push(tagId);
                }
              });
              articlesData[id].tags = existingTags;
            }
          });

          var data = {};
          data[storage.STORAGE_KEYS.ARTICLES] = articlesData;
          chrome.storage.sync.set(data, function() {
            if (chrome.runtime.lastError) {
              chrome.storage.local.set(data, function() {});
            }
            document.getElementById('bulkTagModal').classList.remove('open');
            showToast('Tags added to ' + selectedArticles.length + ' article(s)', 'success');
            selectedArticles = [];
            updateBulkActions();
            loadData(function() {
              renderArticles();
            });
          });
        });
      });
    }

    var closeBulkFolderModal = document.getElementById('closeBulkFolderModal');
    if (closeBulkFolderModal) {
      closeBulkFolderModal.addEventListener('click', function() {
        document.getElementById('bulkFolderModal').classList.remove('open');
      });
    }

    var cancelBulkFolder = document.getElementById('cancelBulkFolder');
    if (cancelBulkFolder) {
      cancelBulkFolder.addEventListener('click', function() {
        document.getElementById('bulkFolderModal').classList.remove('open');
      });
    }

    var applyBulkFolder = document.getElementById('applyBulkFolder');
    if (applyBulkFolder) {
      applyBulkFolder.addEventListener('click', function() {
        var selected = document.querySelector('#bulkFolderList input[type="radio"]:checked');
        if (!selected) {
          showToast('Please select a folder', 'error');
          return;
        }

        var folderId = selected.dataset.folderId || null;
        
        storage.getArticles(function(articlesData) {
          selectedArticles.forEach(function(url) {
            var id = storage.hashCode(url);
            if (articlesData[id]) {
              articlesData[id].folder = folderId;
            }
          });

          var data = {};
          data[storage.STORAGE_KEYS.ARTICLES] = articlesData;
          chrome.storage.sync.set(data, function() {
            if (chrome.runtime.lastError) {
              chrome.storage.local.set(data, function() {});
            }
            document.getElementById('bulkFolderModal').classList.remove('open');
            var folderName = folderId && allFolders[folderId] ? allFolders[folderId].name : 'No folder';
            showToast('Moved ' + selectedArticles.length + ' article(s) to ' + folderName, 'success');
            selectedArticles = [];
            updateBulkActions();
            loadData(function() {
              renderArticles();
            });
          });
        });
      });
    }

    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
  }

  function updateOfflineStatus() {
    var indicator = document.getElementById('offlineIndicator');
    if (indicator) {
      if (navigator.onLine) {
        indicator.classList.remove('visible');
      } else {
        indicator.classList.add('visible');
      }
    }
  }

  function updateSortLabel() {
    var label = document.getElementById('sortLabel');
    if (label) {
      var sortMap = {
        'savedAt-desc': 'Newest',
        'savedAt-asc': 'Oldest',
        'title-asc': 'Title A-Z',
        'title-desc': 'Title Z-A',
        'author-asc': 'Author A-Z',
        'author-desc': 'Author Z-A'
      };
      var key = sortBy + '-' + sortOrder;
      label.textContent = 'Sort: ' + (sortMap[key] || 'Date');
    }
  }

  function selectAllArticles() {
    selectedArticles = [];
    var cards = document.querySelectorAll('.article-card');
    cards.forEach(function(card) {
      var url = decodeURIComponent(card.dataset.url);
      selectedArticles.push(url);
      card.classList.add('selected');
      var checkbox = card.querySelector('.article-checkbox');
      if (checkbox) checkbox.checked = true;
    });
    updateBulkActions();
  }

  function updateBulkActions() {
    var bulkActions = document.getElementById('bulkActions');
    var count = selectedArticles.length;
    
    var countEl = document.getElementById('selectedCount');
    if (countEl) countEl.textContent = count;
    
    if (count > 0 && bulkActions) {
      bulkActions.classList.add('visible');
    } else if (bulkActions) {
      bulkActions.classList.remove('visible');
    }
  }

  function bulkDelete() {
    if (selectedArticles.length === 0) return;
    
    var count = selectedArticles.length;
    if (!confirm('Delete ' + count + ' article(s) from your reading list?')) return;
    
    var deleted = 0;
    selectedArticles.forEach(function(url) {
      storage.deleteArticle(url, function() {
        deleted++;
        if (deleted === selectedArticles.length) {
          selectedArticles = [];
          updateBulkActions();
          loadData(function() {
            renderArticles();
            updateCounts();
            showToast('Deleted ' + count + ' article(s)', 'success');
          });
        }
      });
    });
  }

  function renderBulkTagModal() {
    var container = document.getElementById('bulkTagList');
    if (!container) return;
    
    var tags = Object.values(allTags);
    
    container.innerHTML = tags.map(function(tag) {
      return '<label class="checkbox" style="display: flex; margin-bottom: var(--space-sm);">' +
        '<input type="checkbox" data-tag-id="' + utils.escapeHtml(tag.id) + '">' +
        '<span class="tag-dot" style="background: ' + tag.color + '; width: 10px; height: 10px; border-radius: 50%;"></span>' +
        '<span>' + utils.escapeHtml(tag.name) + '</span>' +
        '</label>';
    }).join('');
  }

  function renderBulkFolderModal() {
    var container = document.getElementById('bulkFolderList');
    if (!container) return;
    
    var folders = Object.values(allFolders).sort(function(a, b) { return a.order - b.order; });
    
    var html = '<label class="checkbox" style="display: flex; margin-bottom: var(--space-sm);">' +
      '<input type="radio" name="folder" data-folder-id="" checked>' +
      '<span>No folder</span>' +
      '</label>';
    
    html += folders.map(function(folder) {
      return '<label class="checkbox" style="display: flex; margin-bottom: var(--space-sm);">' +
        '<input type="radio" name="folder" data-folder-id="' + utils.escapeHtml(folder.id) + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        '<span>' + utils.escapeHtml(folder.name) + '</span>' +
        '</label>';
    }).join('');
    
    container.innerHTML = html;
  }

  function renderTagManagement() {
    var container = document.getElementById('tagModalBody');
    if (!container) return;
    
    var tags = Object.values(allTags);
    
    var colorOptionsHtml = TAG_COLORS.map(function(color, idx) {
      return '<div class="color-option' + (idx === 0 ? ' selected' : '') + '" data-color="' + color + '" style="background: ' + color + ';"></div>';
    }).join('');

    var existingTagsHtml = tags.map(function(tag) {
      return '<div class="tag-item" data-tag-id="' + utils.escapeHtml(tag.id) + '">' +
        '<span class="tag-dot" style="background: ' + tag.color + '"></span>' +
        '<span>' + utils.escapeHtml(tag.name) + '</span>' +
        '<button class="btn-icon" data-action="edit" data-tag="' + utils.escapeHtml(tag.id) + '" style="margin-left: auto; width: 20px; height: 20px;">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' +
        '</button>' +
        '<button class="btn-icon" data-action="delete" data-tag="' + utils.escapeHtml(tag.id) + '" style="margin-left: 4px; width: 20px; height: 20px; color: var(--error);">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>' +
        '</div>';
    }).join('');

    container.innerHTML = '<div class="form-group">' +
      '<label>Create New Tag</label>' +
      '<div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm);">' +
      '<input type="text" class="input" id="newTagName" placeholder="Tag name...">' +
      '<button class="btn btn-primary" id="createTagBtn">Add</button>' +
      '</div>' +
      '<div class="color-picker-row" id="colorPicker">' + colorOptionsHtml + '</div>' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Existing Tags</label>' +
      '<div class="tag-list" id="existingTagsList">' + existingTagsHtml + '</div>' +
      '</div>';

    var colorPicker = document.getElementById('colorPicker');
    colorPicker.addEventListener('click', function(e) {
      var option = e.target.closest('.color-option');
      if (option) {
        var opts = colorPicker.querySelectorAll('.color-option');
        opts.forEach(function(o) { o.classList.remove('selected'); });
        option.classList.add('selected');
      }
    });

    var createTagBtn = document.getElementById('createTagBtn');
    if (createTagBtn) {
      createTagBtn.addEventListener('click', function() {
        var nameInput = document.getElementById('newTagName');
        var name = nameInput.value.trim();
        if (!name) return;
        
        var selectedColorEl = colorPicker.querySelector('.color-option.selected');
        var selectedColor = selectedColorEl ? selectedColorEl.dataset.color : TAG_COLORS[0];
        
        storage.createTag(name, selectedColor, function() {
          nameInput.value = '';
          storage.getTags(function(tags) {
            allTags = tags;
            renderTagManagement();
            showToast('Tag created', 'success');
          });
        });
      });
    }

    var existingTagsList = document.getElementById('existingTagsList');
    if (existingTagsList) {
      existingTagsList.addEventListener('click', function(e) {
        var editBtn = e.target.closest('[data-action="edit"]');
        var deleteBtn = e.target.closest('[data-action="delete"]');
        
        if (editBtn) {
          var tagId = editBtn.dataset.tag;
          showEditTagModal(tagId);
        } else if (deleteBtn) {
          var tagId = deleteBtn.dataset.tag;
          if (confirm('Delete this tag? It will be removed from all articles.')) {
            storage.deleteTag(tagId, function() {
              storage.getTags(function(tags) {
                allTags = tags;
                renderTagManagement();
                loadData(function() {
                  renderArticles();
                  showToast('Tag deleted', 'success');
                });
              });
            });
          }
        }
      });
    }

    var newTagName = document.getElementById('newTagName');
    if (newTagName) {
      newTagName.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          createTagBtn.click();
        }
      });
    }
  }

  function showEditTagModal(tagId) {
    var tag = allTags[tagId];
    if (!tag) return;

    var newName = prompt('Enter new tag name:', tag.name);
    if (newName && newName.trim() !== tag.name) {
      allTags[tagId].name = newName.trim();
      
      var data = {};
      data[storage.STORAGE_KEYS.TAGS] = allTags;
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {});
        }
        renderTagManagement();
        renderArticles();
        showToast('Tag renamed', 'success');
      });
    }
  }

  function showRenameFolderModal(folderId) {
    var folder = allFolders[folderId];
    if (!folder) return;

    var newName = prompt('Enter new folder name:', folder.name);
    if (newName && newName.trim() !== folder.name) {
      allFolders[folderId].name = newName.trim();
      
      var data = {};
      data[storage.STORAGE_KEYS.FOLDERS] = allFolders;
      chrome.storage.sync.set(data, function() {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(data, function() {});
        }
        loadData(function() {
          updatePageTitle();
          showToast('Folder renamed', 'success');
        });
      });
    }
  }

  function deleteFolder(folderId) {
    var folder = allFolders[folderId];
    if (!folder) return;

    if (confirm('Delete folder "' + folder.name + '"? Articles in this folder will be moved to root.')) {
      storage.deleteFolder(folderId, function() {
        storage.getFolders(function(folders) {
          allFolders = folders;
          loadData(function() {
            renderArticles();
            showToast('Folder deleted', 'success');
          });
        });
      });
    }
  }

  function calculateReadingTime(text) {
    var wordCount = text.split(/\s+/).length;
    var minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
    return minutes < 1 ? '1 min' : minutes + ' min read';
  }

  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = icons[type] +
      '<span class="toast-message">' + utils.escapeHtml(message) + '</span>' +
      '<span class="toast-close">&times;</span>';
    
    container.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', function() {
      toast.remove();
    });
    
    setTimeout(function() {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  }

  function exportArticles(format) {
    var filters = {
      status: currentStatus === 'all' ? null : currentStatus,
      sortBy: sortBy,
      sortOrder: sortOrder
    };

    if (currentFilter === 'favorites') {
      filters.favorites = true;
    } else if (currentFilter === 'folder' && currentFolder) {
      filters.folder = currentFolder;
    }

    storage.searchArticles(searchQuery, filters, function(results) {
      var content, filename, mimeType;

      if (format === 'json') {
        content = JSON.stringify(results, null, 2);
        filename = 'substack-articles.json';
        mimeType = 'application/json';
      } else if (format === 'html') {
        content = generateHtmlExport(results);
        filename = 'substack-articles.html';
        mimeType = 'text/html';
      } else if (format === 'markdown') {
        content = generateMarkdownExport(results);
        filename = 'substack-articles.md';
        mimeType = 'text/markdown';
      }

      var blob = new Blob([content], { type: mimeType });
      var url = URL.createObjectURL(blob);
      
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);
      showToast('Exported ' + results.length + ' article(s) as ' + format.toUpperCase(), 'success');
    });
  }

  function generateHtmlExport(articles) {
    var html = '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>SubstackSaver Export</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }\n    h1 { border-bottom: 2px solid #0078D4; padding-bottom: 10px; }\n    .article { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }\n    .article h2 { margin: 0 0 5px; }\n    .article a { color: #0078D4; text-decoration: none; }\n    .article .meta { color: #666; font-size: 14px; }\n  </style>\n</head>\n<body>\n  <h1>SubstackSaver Reading List</h1>\n  <p>' + articles.length + ' articles exported on ' + new Date().toLocaleDateString() + '</p>\n';
    
    articles.forEach(function(a) {
      html += '  <div class="article">\n    <h2><a href="' + utils.escapeHtml(a.url) + '" target="_blank">' + utils.escapeHtml(a.title) + '</a></h2>\n    <div class="meta">by ' + utils.escapeHtml(a.author || 'Unknown') + ' &bull; Saved ' + new Date(a.savedAt).toLocaleDateString() + '</div>\n  </div>\n';
    });
    
    html += '</body>\n</html>';
    return html;
  }

  function generateMarkdownExport(articles) {
    var md = '# SubstackSaver Reading List\n\n' + articles.length + ' articles exported on ' + new Date().toLocaleDateString() + '\n\n';
    
    articles.forEach(function(a) {
      var mdTitle = (a.title || '').replace(/\]/g, '\\]');
      md += '## [' + mdTitle + '](' + a.url + ')\n\nby ' + (a.author || 'Unknown') + ' &bull; Saved ' + new Date(a.savedAt).toLocaleDateString() + '\n\n---\n\n';
    });
    
    return md;
  }

  function updatePageTitle() {
    var titleEl = document.getElementById('pageTitle');
    if (!titleEl) return;
    
    if (currentFilter === 'all') {
      titleEl.textContent = 'All Articles';
    } else if (currentFilter === 'favorites') {
      titleEl.textContent = 'Favorites';
    } else if (currentFilter === 'folder' && currentFolder && allFolders[currentFolder]) {
      titleEl.textContent = allFolders[currentFolder].name;
    } else {
      titleEl.textContent = 'All Articles';
    }
  }

  function renderArticles() {
    var container = document.getElementById('articlesContainer');
    if (!container) return;
    
    var filters = {
      status: currentStatus === 'all' ? null : currentStatus,
      sortBy: sortBy,
      sortOrder: sortOrder
    };

    if (currentFilter === 'favorites') {
      filters.favorites = true;
    } else if (currentFilter === 'folder' && currentFolder) {
      filters.folder = currentFolder;
    }

    storage.searchArticles(searchQuery, filters, function(results) {
      articles = results;

      if (articles.length === 0) {
        container.innerHTML = '<div class="empty-state">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
          '</svg>' +
          '<h2>' + (searchQuery ? 'No matching articles' : 'No articles yet') + '</h2>' +
          '<p>' + (searchQuery ? 'Try adjusting your search or filters' : 'Save articles from Substack using the toolbar button to see them here.') + '</p>' +
          (!searchQuery ? '<div class="empty-actions"><button class="btn btn-primary" id="browseSubstack">Browse Substack</button></div>' : '') +
          '<div class="shortcut-hint">Press <kbd>Ctrl</kbd>+<kbd>F</kbd> to search | <kbd>Ctrl</kbd>+<kbd>A</kbd> to select all</div>' +
          '</div>';
        
        var browseSubstack = document.getElementById('browseSubstack');
        if (browseSubstack) {
          browseSubstack.addEventListener('click', function() {
            window.open('https://substack.com', '_blank');
          });
        }
        return;
      }

      var gridClass = currentView === 'grid' ? 'article-grid' : 'article-list';
      
      container.innerHTML = '<div class="' + gridClass + '" id="articlesList"></div>';
      
      var listEl = document.getElementById('articlesList');
      
      if (currentView === 'list') {
        listEl.classList.add('list-view');
      }

      listEl.innerHTML = articles.map(function(article) {
        var articleTags = (article.tags || []).slice(0, 3).map(function(tagId) { return allTags[tagId]; }).filter(Boolean);
        var extraTagsCount = Math.max(0, article.tags.length - 3);
        var readingTime = calculateReadingTime(article.title + ' ' + (article.excerpt || ''));
        var isSelected = selectedArticles.indexOf(article.url) !== -1;
        
        var tagsHtml = articleTags.map(function(tag) {
          return '<span class="tag-chip"><span class="tag-dot" style="background: ' + tag.color + '"></span>' + utils.escapeHtml(tag.name) + '</span>';
        }).join('');
        
        if (extraTagsCount > 0) {
          tagsHtml += '<span class="tag-chip">+' + extraTagsCount + '</span>';
        }
        
        var thumbnailHtml = article.thumbnail ? 
          '<img class="thumbnail" src="' + article.thumbnail + '" alt="">' :
          '<div class="thumbnail" style="background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))"></div>';
        
        var progressHtml = '';
        if (article.progress > 0) {
          progressHtml = '<div class="article-card-progress"><div class="progress-bar"><div class="progress-bar-fill" style="width: ' + article.progress + '%"></div></div></div>';
        }
        
        return '<article class="article-card ' + (currentView === 'list' ? 'list-view' : '') + ' ' + (isSelected ? 'selected' : '') + '" data-url="' + encodeURIComponent(article.url) + '">' +
          '<input type="checkbox" class="article-checkbox" ' + (isSelected ? 'checked' : '') + '>' +
          thumbnailHtml +
          '<div class="article-card-content">' +
          '<h3 class="article-card-title">' + utils.escapeHtml(utils.truncate(article.title, 80)) + '</h3>' +
          '<div class="article-card-author">by ' + utils.escapeHtml(article.author || 'Unknown') + '</div>' +
          '<div class="article-card-meta">' +
          '<div class="article-card-meta-left">' +
          '<div class="article-card-tags">' + tagsHtml + '</div>' +
          '<span class="reading-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + readingTime + '</span>' +
          '</div>' +
          '<span class="article-card-date">' + utils.formatDate(article.savedAt) + '</span>' +
          '</div>' +
          progressHtml +
          '</div>' +
          '<div class="article-card-actions">' +
          '<button class="action-btn favorite ' + (article.isFavorite ? 'selected' : '') + '" data-url="' + encodeURIComponent(article.url) + '" title="' + (article.isFavorite ? 'Remove from favorites' : 'Add to favorites') + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + (article.isFavorite ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '</button>' +
          '<button class="action-btn delete" data-url="' + encodeURIComponent(article.url) + '" title="Delete">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          '</button>' +
          '</div>' +
          '</article>';
      }).join('');

      listEl.querySelectorAll('.article-card').forEach(function(card) {
        var checkbox = card.querySelector('.article-checkbox');
        
        checkbox.addEventListener('change', function(e) {
          e.stopPropagation();
          var url = decodeURIComponent(card.dataset.url);
          
          if (checkbox.checked) {
            if (selectedArticles.indexOf(url) === -1) selectedArticles.push(url);
            card.classList.add('selected');
          } else {
            selectedArticles = selectedArticles.filter(function(u) { return u !== url; });
            card.classList.remove('selected');
          }
          
          updateBulkActions();
        });

        checkbox.addEventListener('click', function(e) {
          e.stopPropagation();
        });

        card.addEventListener('mouseenter', function(e) {
          var url = decodeURIComponent(card.dataset.url);
          var article = articles.find(function(a) { return a.url === url; });
          if (article) {
            showPreviewTooltip(e, article);
          }
        });

        card.addEventListener('mouseleave', function() {
          hidePreviewTooltip();
        });

        card.addEventListener('click', function(e) {
          if (e.target.closest('.action-btn') || e.target.closest('.article-checkbox')) return;
          
          var url = decodeURIComponent(card.dataset.url);
          var article = articles.find(function(a) { return a.url === url; });
          
          if (article && article.progress > 0) {
            var separator = url.indexOf('?') !== -1 ? '&' : '?';
            var progressUrl = url + separator + 'from=substacksaver&progress=' + article.progress;
            window.open(progressUrl, '_blank');
          } else {
            window.open(url, '_blank');
          }
        });
      });

      listEl.querySelectorAll('.action-btn.favorite').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var url = decodeURIComponent(btn.dataset.url);
          
          storage.getArticles(function(articlesData) {
            var id = storage.hashCode(url);
            if (articlesData[id]) {
              articlesData[id].isFavorite = !articlesData[id].isFavorite;
              
              var data = {};
              data[storage.STORAGE_KEYS.ARTICLES] = articlesData;
              chrome.storage.sync.set(data, function() {
                if (chrome.runtime.lastError) {
                  chrome.storage.local.set(data, function() {});
                }
                loadData(function() {
                  renderArticles();
                  updateCounts();
                });
              });
            }
          });
        });
      });

      listEl.querySelectorAll('.action-btn.delete').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var url = decodeURIComponent(btn.dataset.url);
          
          if (confirm('Delete this article from your reading list?')) {
            selectedArticles = selectedArticles.filter(function(u) { return u !== url; });
            updateBulkActions();
            storage.deleteArticle(url, function() {
              loadData(function() {
                renderArticles();
                updateCounts();
                showToast('Article deleted', 'success');
              });
            });
          }
        });
      });
    });
  }

  function showPreviewTooltip(e, article) {
    var tooltip = document.getElementById('previewTooltip');
    var readingTime = calculateReadingTime(article.title);
    
    document.getElementById('previewTitle').textContent = article.title;
    document.getElementById('previewAuthor').textContent = 'by ' + (article.author || 'Unknown');
    document.getElementById('previewExcerpt').textContent = article.excerpt || 'No preview available';
    document.getElementById('previewReadingTime').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + readingTime;
    document.getElementById('previewDate').textContent = utils.formatDate(article.savedAt);
    
    var rect = e.currentTarget.getBoundingClientRect();
    var left = rect.right + 10;
    var top = rect.top;
    
    if (left + 300 > window.innerWidth) {
      left = rect.left - 310;
    }
    
    if (top + 200 > window.innerHeight) {
      top = window.innerHeight - 210;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
  }

  function hidePreviewTooltip() {
    var tooltip = document.getElementById('previewTooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  function updateCounts() {
    storage.getArticles(function(allArticles) {
      var allCount = Object.keys(allArticles).length;
      
      var favCount = 0;
      Object.values(allArticles).forEach(function(a) {
        if (a.isFavorite) favCount++;
      });
      
      var countAll = document.getElementById('countAll');
      var countFavorites = document.getElementById('countFavorites');
      if (countAll) countAll.textContent = allCount;
      if (countFavorites) countFavorites.textContent = favCount;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
