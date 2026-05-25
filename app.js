class JobBoard {
  constructor() {
    this.jobs = [];
    this.filtered = [];
    this.companies = new Set();
    this.cities = new Set();
    this.favs = new Set();
    this.filters = { keyword: '', company: '', city: '', workMode: '', salary: '', sort: 'posted-desc' };
    this.init();
  }

  async init() {
    this.loadFavs();
    await this.load();
    this.populateDrops();
    this.run();
    this.on();
  }

  async load() {
    try {
      const r = await fetch('./data/jobs.json');
      const d = await r.json();
      this.jobs = d.jobs || [];
      document.getElementById('last-updated').textContent = new Date(d.lastUpdated).toLocaleString();
      document.getElementById('sources-count').textContent = d.sourcesScanned || '?';
      document.getElementById('fetch-duration').textContent = d.fetchDuration || '?';
    } catch (e) {
      this.jobs = [];
      document.getElementById('jobs-container').innerHTML = '<div class="no-results"><p>Failed to load jobs.</p></div>';
    }
  }

  populateDrops() {
    this.jobs.forEach(j => {
      if (j.company) this.companies.add(j.company);
      if (j.city && j.city !== 'Unknown') this.cities.add(j.city);
    });
    
    ['company', 'city'].forEach(id => {
      const sel = document.getElementById(id);
      const set = id === 'company' ? this.companies : this.cities;
      [...set].sort().forEach(v => {
        sel.appendChild(new Option(v, v));
      });
    });
  }

  run() {
    this.filtered = this.jobs.filter(j => {
      const kw = this.filters.keyword.toLowerCase();
      if (kw) {
        const txt = [j.title, j.company, j.snippet || '', (j.skills || []).join(' ')].join(' ').toLowerCase();
        if (!txt.includes(kw)) return false;
      }
      if (this.filters.company && j.company !== this.filters.company) return false;
      if (this.filters.city && j.city !== this.filters.city) return false;
      if (this.filters.workMode && j.workMode !== this.filters.workMode) return false;
      if (this.filters.salary && (!j.salaryRaw || j.salaryRaw < parseInt(this.filters.salary))) return false;
      return true;
    });

    const [f, o] = this.filters.sort.split('-');
    this.filtered.sort((a, b) => {
      let va, vb;
      if (f === 'posted') { va = new Date(a.postedAt); vb = new Date(b.postedAt); }
      else if (f === 'salary') { va = a.salaryRaw || 0; vb = b.salaryRaw || 0; }
      else { va = a.company.toLowerCase(); vb = b.company.toLowerCase(); }
      const cmp = va < vb ? -1 : va > vb ? 1 : 1;
      return o === 'desc' ? -cmp : cmp;
    });

    this.render();
  }

  render() {
    const c = document.getElementById('jobs-container');
    const no = document.getElementById('no-results');

    if (this.filtered.length === 0) {
      c.innerHTML = '';
      no.style.display = 'block';
    } else {
      no.style.display = 'none';
      c.innerHTML = this.filtered.map(j => {
        const fav = this.favs.has(j.id);
        const isNew = !this.isRead(j.id);
        const days = Math.floor((Date.now() - new Date(j.postedAt)) / 86400000);
        const age = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;

        return `
          <div class="job-row ${isNew ? 'new' : ''}" data-id="${j.id}">
            <span class="company">${j.company}</span>
            <span class="title">${j.title}</span>
            <span class="meta">${j.city} • ${j.workMode}</span>
            <span class="salary">${j.salary || '—'}</span>
            <span class="posted">${age}</span>
            <span class="actions">
              <a href="${j.url}" target="_blank" class="apply-btn">Apply</a>
              <button class="fav-btn ${fav ? 'favorited' : ''}" title="${fav ? 'Unsave' : 'Save'}">★</button>
            </span>
          </div>
        `;
      }).join('');
    }

    this.stats();
    this.bindRow();
  }

  stats() {
    const nc = this.filtered.filter(j => !this.isRead(j.id)).length;
    document.getElementById('job-count').textContent = this.filtered.length;
    document.getElementById('new-count').textContent = nc;
    document.getElementById('favorite-count').textContent = this.favs.size;
  }

  isRead(id) { return JSON.parse(localStorage.getItem('read') || '[]').includes(id); }
  markRead(id) {
    const r = JSON.parse(localStorage.getItem('read') || '[]');
    if (!r.includes(id)) { r.push(id); localStorage.setItem('read', JSON.stringify(r)); }
  }

  loadFavs() { this.favs = new Set(JSON.parse(localStorage.getItem('favs') || '[]')); }
  toggleFav(id) {
    this.favs.has(id) ? this.favs.delete(id) : this.favs.add(id);
    localStorage.setItem('favs', JSON.stringify([...this.favs]));
    this.run();
  }

  on() {
    ['keyword'].forEach(id => {
      document.getElementById(id).addEventListener('input', e => {
        this.filters[id] = e.target.value;
        this.debounceRun();
      });
    });
    ['company', 'city', 'work-mode', 'salary', 'sort'].forEach(id => {
      document.getElementById(id).addEventListener('change', e => {
        this.filters[id.replace('-', '')] = e.target.value;
        this.run();
      });
    });
    document.getElementById('clear-filters').addEventListener('click', () => {
      this.filters = { keyword: '', company: '', city: '', workMode: '', salary: '', sort: 'posted-desc' };
      document.querySelectorAll('.filters-bar input, .filters-bar select').forEach(el => { if (el.tagName === 'INPUT') el.value = ''; else el.selectedIndex = 0; });
      this.run();
    });
  }

  bindRow() {
    document.querySelectorAll('.job-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        this.markRead(row.dataset.id);
        row.classList.remove('new');
        this.stats();
      });
    });
    document.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleFav(btn.closest('.job-row').dataset.id);
      });
    });
  }

  debounceRun = this.debounce(() => this.run(), 250);
  debounce(fn, w) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), w); }; }
}

document.addEventListener('DOMContentLoaded', () => new JobBoard());