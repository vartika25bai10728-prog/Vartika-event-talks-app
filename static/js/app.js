// BigQuery Release Hub - Client Logic

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = []; // Master list of parsed individual release note items
    let filteredNotes = []; // Current filtered list
    let selectedNote = null; // Currently selected item
    let currentFilter = 'all';
    
    // Progress circle setup
    const circle = document.getElementById('char-progress-circle');
    const circumference = 11 * 2 * Math.PI; // radius is 11
    if (circle) {
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
    }

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const statusText = document.getElementById('status-text');
    
    // Theme initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggleIcon) {
            themeToggleIcon.className = 'fa-solid fa-moon';
        }
    } else {
        document.body.classList.remove('light-theme');
        if (themeToggleIcon) {
            themeToggleIcon.className = 'fa-solid fa-sun';
        }
    }
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    const feedList = document.getElementById('feed-list');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterTabsContainer = document.getElementById('filter-tabs-container');
    const retryBtn = document.getElementById('retry-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    // Details Panel Elements
    const detailsEmptyState = document.getElementById('details-empty-state');
    const detailsContent = document.getElementById('details-content');
    const detailTag = document.getElementById('detail-tag');
    const detailDate = document.getElementById('detail-date');
    const detailHtmlContent = document.getElementById('detail-html-content');
    const detailSourceLink = document.getElementById('detail-source-link');
    
    // Tweet Composer Elements
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const resetTweetBtn = document.getElementById('reset-tweet-btn');
    const copyTweetBtn = document.getElementById('copy-tweet-btn');
    const tweetBtn = document.getElementById('tweet-btn');
    
    // Toast Notification
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // 1. Fetch data from flask backend
    async function fetchReleaseNotes() {
        showLoading(true);
        try {
            const response = await fetch('/api/release-notes');
            const data = await response.json();
            
            if (data.success) {
                processFeedData(data.entries);
                updateStatusText('Feed updated successfully');
                showLoading(false);
            } else {
                throw new Error(data.error || 'Server returned an error');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showError(error.message);
        }
    }

    // 2. Parse Atom Feed entries into individual updates
    function processFeedData(entries) {
        releaseNotes = [];
        
        entries.forEach(entry => {
            const parsedItems = parseContent(entry);
            releaseNotes.push(...parsedItems);
        });
        
        // Calculate and display stats
        calculateStats();
        
        // Apply current filter/search
        filterAndRender();
    }

    // Parse HTML string and break down into individual components
    function parseContent(entry) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(entry.content, 'text/html');
        const items = [];
        
        const children = Array.from(doc.body.children);
        const hasH3 = children.some(el => el.tagName === 'H3');
        
        // Date mapping
        const dateStr = entry.title || 'Unknown Date';
        
        if (!hasH3) {
            // Entire element is a General update
            return [{
                id: `${entry.id}-general`,
                date: dateStr,
                rawDate: entry.updated,
                link: entry.link,
                type: 'General',
                html: entry.content,
                text: doc.body.textContent.trim()
            }];
        }
        
        let currentType = 'General';
        let currentHTML = '';
        let currentText = '';
        
        children.forEach(child => {
            if (child.tagName === 'H3') {
                if (currentHTML.trim()) {
                    items.push({
                        id: `${entry.id}-${items.length}`,
                        date: dateStr,
                        rawDate: entry.updated,
                        link: entry.link,
                        type: normalizeType(currentType),
                        html: currentHTML,
                        text: currentText.trim().replace(/\s+/g, ' ')
                    });
                }
                currentType = child.textContent.trim();
                currentHTML = '';
                currentText = '';
            } else {
                currentHTML += child.outerHTML;
                currentText += child.textContent + ' ';
            }
        });
        
        // Push remaining item
        if (currentHTML.trim()) {
            items.push({
                id: `${entry.id}-${items.length}`,
                date: dateStr,
                rawDate: entry.updated,
                link: entry.link,
                type: normalizeType(currentType),
                html: currentHTML,
                text: currentText.trim().replace(/\s+/g, ' ')
            });
        }
        
        return items;
    }

    // Normalize category tags for visual styling & filtering
    function normalizeType(type) {
        const t = type.toLowerCase();
        if (t.includes('feature')) return 'Feature';
        if (t.includes('issue') || t.includes('fix') || t.includes('bug')) return 'Issue';
        if (t.includes('deprecation') || t.includes('remove')) return 'Deprecation';
        return 'General';
    }

    // 3. Filtering and Searching logic
    function filterAndRender() {
        const query = searchInput.value.toLowerCase().trim();
        
        filteredNotes = releaseNotes.filter(item => {
            // Type Filter
            const matchesType = currentFilter === 'all' || 
                (currentFilter === 'Other' && item.type === 'General') || 
                (item.type === currentFilter);
            
            // Search Query
            const matchesSearch = !query || 
                item.date.toLowerCase().includes(query) || 
                item.type.toLowerCase().includes(query) || 
                item.text.toLowerCase().includes(query);
                
            return matchesType && matchesSearch;
        });

        renderFeed();
    }

    // 4. Render feed to DOM
    function renderFeed() {
        feedList.innerHTML = '';
        
        if (filteredNotes.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Group by Date for cleaner presentation
        let lastDate = '';
        
        filteredNotes.forEach(item => {
            if (item.date !== lastDate) {
                lastDate = item.date;
                const dateHeader = document.createElement('div');
                dateHeader.className = 'release-date-header';
                dateHeader.innerText = item.date;
                feedList.appendChild(dateHeader);
            }
            
            const card = document.createElement('div');
            card.className = `note-card ${item.type}`;
            if (selectedNote && selectedNote.id === item.id) {
                card.classList.add('selected');
            }
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${item.type}">${item.type}</span>
                    <div class="card-header-actions">
                        <span class="card-date">${formatShortDate(item.rawDate)}</span>
                        <button class="btn-card-copy" title="Copy update to clipboard">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${item.text}
                </div>
            `;
            
            // Setup card copy button listener
            const copyBtn = card.querySelector('.btn-card-copy');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop click from selecting card
                    navigator.clipboard.writeText(item.text)
                        .then(() => {
                            const icon = copyBtn.querySelector('i');
                            icon.className = 'fa-solid fa-check';
                            copyBtn.classList.add('success');
                            showToast('Note copied to clipboard!');
                            
                            setTimeout(() => {
                                icon.className = 'fa-regular fa-copy';
                                copyBtn.classList.remove('success');
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('Failed to copy card text:', err);
                            showToast('Failed to copy note.');
                        });
                });
            }
            
            card.addEventListener('click', () => selectReleaseNote(item, card));
            feedList.appendChild(card);
        });
    }

    // Select release note and open in details sidebar
    function selectReleaseNote(item, cardElement) {
        selectedNote = item;
        
        // Update styling of note cards
        document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
        if (cardElement) {
            cardElement.classList.add('selected');
        }
        
        // Update details card content
        detailTag.className = `badge ${item.type}`;
        detailTag.innerText = item.type;
        detailDate.innerText = item.date;
        detailHtmlContent.innerHTML = item.html;
        detailSourceLink.href = item.link;
        
        // Show details workspace and hide empty state
        detailsEmptyState.style.display = 'none';
        detailsContent.style.display = 'flex';
        
        // Prefill default tweet template
        generateDefaultTweet();
    }

    // 5. Statistics management
    function calculateStats() {
        const total = releaseNotes.length;
        const features = releaseNotes.filter(n => n.type === 'Feature').length;
        const issues = releaseNotes.filter(n => n.type === 'Issue').length;
        const deprecations = releaseNotes.filter(n => n.type === 'Deprecation').length;
        
        document.getElementById('count-total').innerText = total;
        document.getElementById('count-features').innerText = features;
        document.getElementById('count-issues').innerText = issues;
        document.getElementById('count-deprecations').innerText = deprecations;
    }

    // 6. Tweet Generation & Composer
    function generateDefaultTweet() {
        if (!selectedNote) return;
        
        const date = selectedNote.date;
        const type = selectedNote.type;
        const text = selectedNote.text;
        const link = selectedNote.link;
        
        // Construct prefix & suffix
        const emoji = type === 'Feature' ? '🚀' : type === 'Issue' ? '⚠️' : type === 'Deprecation' ? '🚫' : '📢';
        const prefix = `${emoji} BigQuery Update (${date})\n[${type}] `;
        const suffix = `\n\nRead details: ${link}\n#GoogleCloud #BigQuery`;
        
        // Calculate max description text space
        const maxLen = 280 - prefix.length - suffix.length;
        let bodyText = text;
        
        if (bodyText.length > maxLen) {
            bodyText = bodyText.slice(0, maxLen - 3) + '...';
        }
        
        const fullTweet = prefix + bodyText + suffix;
        tweetTextarea.value = fullTweet;
        updateCharCount();
    }

    function updateCharCount() {
        const length = tweetTextarea.value.length;
        const remaining = 280 - length;
        charCount.innerText = remaining;
        
        // Update character counter warnings
        charCount.className = 'char-count-text';
        if (remaining <= 40 && remaining > 0) {
            charCount.classList.add('warning');
        } else if (remaining <= 0) {
            charCount.classList.add('danger');
        }
        
        // Update svg circle
        if (circle) {
            const percent = Math.min(length / 280, 1.0);
            const offset = circumference - (percent * circumference);
            circle.style.strokeDashoffset = offset;
            
            // Set circle color
            if (remaining <= 0) {
                circle.style.stroke = '#ef4444'; // Red
            } else if (remaining <= 40) {
                circle.style.stroke = '#f59e0b'; // Yellow
            } else {
                circle.style.stroke = '#1d9bf0'; // Twitter Blue
            }
        }
    }

    // 7. Event Listeners
    
    // Theme Toggle click
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            
            if (themeToggleIcon) {
                themeToggleIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            }
            
            if (selectedNote) {
                updateCharCount();
            }
            showToast(`Theme switched to ${isLight ? 'Light' : 'Dark'} Mode`);
        });
    }
    
    // Export CSV Button click
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportToCSV();
        });
    }

    // Refresh Button click
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Retry Button click
    retryBtn.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Reset Filters Button click
    resetFiltersBtn.addEventListener('click', () => {
        resetFilters();
    });

    // Reset Tweet Composer
    resetTweetBtn.addEventListener('click', () => {
        generateDefaultTweet();
    });

    // Realtime search inputs
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim().length > 0) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        filterAndRender();
    });

    // Clear Search Input
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        filterAndRender();
        searchInput.focus();
    });

    // Category Tabs filtering
    filterTabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-tab')) {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-type');
            filterAndRender();
        }
    });

    // Copy Tweet button
    copyTweetBtn.addEventListener('click', () => {
        tweetTextarea.select();
        navigator.clipboard.writeText(tweetTextarea.value)
            .then(() => {
                showToast('Tweet copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                showToast('Failed to copy tweet.');
            });
    });

    // Tweet/Post to X button
    tweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const url = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(url, '_blank');
    });

    // Textarea manual modifications
    tweetTextarea.addEventListener('input', updateCharCount);

    // Close mobile side drawer
    const closePanelBtn = document.getElementById('close-panel-btn');
    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', () => {
            detailsContent.style.display = 'none';
            detailsEmptyState.style.display = 'flex';
            document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
            selectedNote = null;
        });
    }

    // Helper functions
    function resetFilters() {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        currentFilter = 'all';
        document.querySelectorAll('.filter-tab').forEach(t => {
            t.classList.remove('active');
            if (t.getAttribute('data-type') === 'all') {
                t.classList.add('active');
            }
        });
        filterAndRender();
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loadingOverlay.style.display = 'flex';
            errorState.style.display = 'none';
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
            if (exportCsvBtn) exportCsvBtn.disabled = true;
            updateStatusText('Updating feed...');
        } else {
            loadingOverlay.style.display = 'none';
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
            if (exportCsvBtn) exportCsvBtn.disabled = false;
        }
    }

    // Export currently filtered release notes to CSV
    function exportToCSV() {
        if (filteredNotes.length === 0) {
            showToast('No data to export.');
            return;
        }
        
        // CSV Headers
        const headers = ['Date', 'Type', 'Description', 'Link'];
        
        // Helper to escape values containing commas, quotes, or newlines
        const escapeCSV = (text) => {
            if (text == null) return '';
            const stringified = text.toString();
            return '"' + stringified.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ') + '"';
        };
        
        // Construct CSV rows
        const rows = [
            headers.join(','),
            ...filteredNotes.map(item => [
                escapeCSV(item.date),
                escapeCSV(item.type),
                escapeCSV(item.text),
                escapeCSV(item.link)
            ].join(','))
        ];
        
        const csvContent = rows.join('\r\n');
        
        // Create Blob and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('CSV Exported successfully!');
    }

    function showError(message) {
        showLoading(false);
        errorState.style.display = 'flex';
        errorMessage.innerText = message || 'Could not connect to the BigQuery Release Feed.';
        updateStatusText('Failed to update feed');
    }

    function updateStatusText(text) {
        const timeNow = new Date().toLocaleTimeString();
        statusText.innerHTML = `<span class="pulse-dot"></span> ${text} (${timeNow})`;
    }

    function showToast(message) {
        toastMessage.innerText = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Format ISO string or UTC string to readable date for cards
    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    // Init fetch
    fetchReleaseNotes();
});
