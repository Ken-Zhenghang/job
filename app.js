// Daily Push – Enhanced frontend
class JobBoard {
  constructor() {
    this.jobs = [];
    this.filteredJobs = [];
    this.companies = new Set();
    this.cities = new Set();
    this.favorites = new Set();
    this.viewMode = 'grid';
    this.filters = {
      keyword: '',
      company: [],
      city: '',
      workMode: '',
      salary: '',
      posted: '30',
      sort: 'posted-desc'
    };

    this.init();
  }

  async init() {
    this.loadFavorites();
    await this.loadData();
    this.renderFilters();
    this.renderJobs();
    this.attachEvents();
    this.updateStats();
  }

  async loadData() {
    try {
      const response = await fetch('./data/jobs.json');
      const data = await response.json();
      this.jobs = data.jobs || [];
      this.updateMeta(data);
      this.extractOptions();
    } catch (err) {
      console.error('Failed to load jobs:', err);
      this.jobs = [];
      document.getElementById('jobs-container').innerHTML = `
        <div class="no-results">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Failed to load jobs</h3>
          <p>Check your connection or try refreshing the page.</p>
        </div>
      `;
    }
  }

  updateMeta(data) {
    if (data.lastUpdated) {
      const date = new Date(data.lastUpdated);
      const formatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      document.getElementById('last-updated').textContent = formatted;
    }
    if (data.sourcesScanned) {
      document.getElementById('sources-count').textContent = data.sourcesScanned;
    }
    if (data.fetchDuration) {
      document.getElementById('fetch-duration').textContent = data.fetchDuration;
    }
  }

  extractOptions() {
    this.companies.clear();
    this.cities.clear();
    this.jobs.forEach(job => {
      if (job.company) this.companies.add(job.company);
      if (job.city && job.city !== 'Unknown') this.cities.add(job.city);
    });
  }

  renderFilters() {
    const companySelect = document.getElementById('company');
    const citySelect = document.getElementById('city');

    // Companies (multi-select)
    companySelect.innerHTML = '<option value="">All companies</option>';
    [...this.companies].sort().forEach(company => {
      const option = document.createElement('option');
      option.value = company;
      option.textContent = company;
      companySelect.appendChild(option);
    });

    // Cities
    citySelect.innerHTML = '<option value="">All cities</option>';
    [...this.cities].sort().forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option);
    });
  }

  applyFilters() {
    this.filteredJobs = this.jobs.filter(job => {
      // Keyword
      const kw = this.filters.keyword.toLowerCase();
      if (kw && !(
        job.title.toLowerCase().includes(kw) ||
        job.company.toLowerCase().includes(kw) ||
        (job.snippet && job.snippet.toLowerCase().includes(kw)) ||
        (job.skills && job.skills.some(s => s.toLowerCase().includes(kw)))
      )) return false;

      // Company
      if (this.filters.company.length > 0 && !this.filters.company.includes(job.company)) {
        return false;
      }

      // City
      if (this.filters.city && job.city !== this.filters.city) {
        return false;
      }

      // Work mode
      if (this.filters.workMode && job.workMode !== this.filters.workMode) {
        return false;
      }

      // Salary
      if (this.filters.salary && (!job.salaryRaw || job.salaryRaw < parseInt(this.filters.salary))) {
        return false;
      }

      // Posted within
      if (this.filters.posted) {
        const days = parseInt(this.filters.posted);
        if (days < 365) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          if (new Date(job.postedAt) < cutoff) return false;
        }
      }

      return true;
    });

    this.sortJobs();
  }

  sortJobs() {
    const [field, order] = this.filters.sort.split('-');
    this.filteredJobs.sort((a, b) => {
      let valA, valB;

      if (field === 'posted') {
        valA = new Date(a.postedAt);
        valB = new Date(b.postedAt);
      } else if (field === 'salary') {
        valA = a.salaryRaw || 0;
        valB = b.salaryRaw || 0;
      } else if (field === 'company') {
        valA = a.company.toLowerCase();
        valB = b.company.toLowerCase();
      }

      const compare = valA < valB ? -1 : valA > valB ? 1 : 0;
      return order === 'desc' ? -compare : compare;
    });
  }

  renderJobs() {
    this.applyFilters();
    const container = document.getElementById('jobs-container');
    const noResults = document.getElementById('no-results');

    if (this.filteredJobs.length === 0) {
      container.style.display = 'none';
      noResults.style.display = 'block';
      return;
    }

    container.style.display = 'grid';
    noResults.style.display = 'none';

    container.className = this.viewMode === 'grid' ? 'jobs-grid' : 'jobs-list';
    container.innerHTML = this.filteredJobs.map(job => this.renderJobCard(job)).join('');

    this.updateStats();
    this.attachCardEvents();
  }

  renderJobCard(job) {
    const isNew = this.isJobNew(job);
    const isFavorited = this.favorites.has(job.id);
    const salaryDisplay = job.salary ? `<span class="job-salary">${job.salary}</span>` : '';
    const skills = job.skills && job.skills.length > 0
      ? `<div class="job-skills">${job.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>`
      : '';

    return `
      <div class="job-card ${isNew ? 'new' : ''}" data-id="${job.id}">
        <div class="job-card-header">
          <div>
            <div class="job-company">${job.company}</div>
            <div class="job-title">${job.title}</div>
            <div class="job-meta">
              <span><i class="fas fa-map-marker-alt"></i> ${job.city}, ${job.state}</span>
              <span><i class="fas fa-laptop-house"></i> ${job.workMode}</span>
              ${salaryDisplay}
              <span><i class="fas fa-calendar"></i> ${this.formatDate(job.postedAt)}</span>
            </div>
          </div>
          <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" title="${isFavorited ? 'Remove from saved' : 'Save job'}">
            <i class="fas fa-star"></i>
          </button>
        </div>
        <div class="job-card-body">
          <p class="job-snippet">${job.snippet || 'No description available.'}</p>
          ${skills}
          <div class="job-actions">
            <a href="${job.url}" target="_blank" class="job-link">
              <i class="fas fa-external-link-alt"></i> Apply
            </a>
            <small>via ${job.source.split(':')[0]}</small>
          </div>
        </div>
      </div>
    `;
  }

  formatDate(iso) {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  isJobNew(job) {
    const readIds = JSON.parse(localStorage.getItem('readJobs') || '[]');
    return !readIds.includes(job.id);
  }

  markAsRead(jobId) {
    const readIds = JSON.parse(localStorage.getItem('readJobs') || '[]');
    if (!readIds.includes(jobId)) {
      readIds.push(jobId);
      localStorage.setItem('readJobs', JSON.stringify(readIds));
    }
  }

  loadFavorites() {
    const saved = JSON.parse(localStorage.getItem('favorites') || '[]');
    this.favorites = new Set(saved);
    this.renderFavorites();
  }

  toggleFavorite(jobId) {
    if (this.favorites.has(jobId)) {
      this.favorites.delete(jobId);
    } else {
      this.favorites.add(jobId);
    }
    localStorage.setItem('favorites', JSON.stringify([...this.favorites]));
    this.renderFavorites();
    this.updateStats();
    this.showToast(this.favorites.has(jobId) ? 'Job saved' : 'Job removed');
  }

  renderFavorites() {
    const list = document.getElementById('favorites-list');
    if (this.favorites.size === 0) {
      list.innerHTML = '<p class="empty-hint">No saved jobs yet</p>';
      return;
    }

    const favoriteJobs = this.jobs.filter(j => this.favorites.has(j.id));
    list.innerHTML = favoriteJobs.map(job => `
      <div class="favorite-item">
        <span class="favorite-title" title="${job.company} – ${job.title}">
          ${job.company}: ${job.title}
        </span>
        <button class="favorite-remove" data-id="${job.id}" title="Remove">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.favorite-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(btn.dataset.id);
      });
    });

    list.querySelectorAll('.favorite-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-remove')) {
          const jobId = item.querySelector('.favorite-remove').dataset.id;
          const jobCard = document.querySelector(`.job-card[data-id="${jobId}"]`);
          if (jobCard) {
            jobCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            jobCard.style.animation = 'pulse 1s';
            setTimeout(() => jobCard.style.animation = '', 1000);
          }
        }
      });
    });
  }

  updateStats() {
    const newCount = this.filteredJobs.filter(j => this.isJobNew(j)).length;
    document.getElementById('job-count').textContent = this.filteredJobs.length;
    document.getElementById('new-count').textContent = newCount;
    document.getElementById('favorite-count').textContent = this.favorites.size;
  }

  attachEvents() {
    // Keyword input
    document.getElementById('keyword').addEventListener('input', (e) => {
      this.filters.keyword = e.target.value;
      this.debouncedRender();
    });

    // Company multi-select
    document.getElementById('company').addEventListener('change', (e) => {
      const selected = Array.from(e.target.selectedOptions).map(opt => opt.value).filter(v => v);
      this.filters.company = selected;
      this.renderJobs();
    });

    // Single selects
    ['city', 'work-mode', 'salary', 'posted', 'sort'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        this.filters[id.replace('-', '')] = e.target.value;
        this.renderJobs();
      });
    });

    // Buttons
    document.getElementById('apply-filters').addEventListener('click', () => this.renderJobs());
    document.getElementById('clear-filters').addEventListener('click', () => this.clearFilters());

    document.getElementById('mark-all-read').addEventListener('click', () => this.markAllRead());
    document.getElementById('export-favorites').addEventListener('click', () => this.exportFavorites());

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.dataset.view;
        this.renderJobs();
      });
    });
  }

  attachCardEvents() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const jobId = e.target.closest('.job-card').dataset.id;
        this.toggleFavorite(jobId);
        btn.classList.toggle('favorited');
      });
    });

    document.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn') && !e.target.closest('.job-link')) {
          const jobId = card.dataset.id;
          this.markAsRead(jobId);
          card.classList.remove('new');
          this.updateStats();
        }
      });
    });
  }

  clearFilters() {
    this.filters = {
      keyword: '',
      company: [],
      city: '',
      workMode: '',
      salary: '',
      posted: '30',
      sort: 'posted-desc'
    };
    document.getElementById('keyword').value = '';
    document.getElementById('company').selectedIndex = 0;
    document.getElementById('city').selectedIndex = 0;
    document.getElementById('work-mode').selectedIndex = 0;
    document.getElementById('salary').selectedIndex = 0;
    document.getElementById('posted').value = '30';
    document.getElementById('sort').value = 'posted-desc';
    this.renderJobs();
  }

  markAllRead() {
    this.filteredJobs.forEach(job => this.markAsRead(job.id));
    document.querySelectorAll('.job-card.new').forEach(card => card.classList.remove('new'));
    this.updateStats();
    this.showToast('All jobs marked as read');
  }

  exportFavorites() {
    const favoriteJobs = this.jobs.filter(j => this.favorites.has(j.id));
    const exportData = {
      exportedAt: new Date().toISOString(),
      count: favoriteJobs.length,
      jobs: favoriteJobs.map(j => ({
        company: j.company,
        title: j.title,
        city: j.city,
        workMode: j.workMode,
        salary: j.salary,
        postedAt: j.postedAt,
        url: j.url,
        source: j.source
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-push-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`Exported ${favoriteJobs.length} saved jobs`);
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  debouncedRender = this.debounce(() => this.renderJobs(), 300);

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.jobBoard = new JobBoard();
});