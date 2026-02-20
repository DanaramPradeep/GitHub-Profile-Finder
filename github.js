'use strict';

// ── Language colors (subset of GitHub's linguist) ──────────────
const LANG_COLORS = {
  JavaScript:  '#f1e05a',
  TypeScript:  '#3178c6',
  Python:      '#3572A5',
  HTML:        '#e34c26',
  CSS:         '#563d7c',
  Java:        '#b07219',
  Go:          '#00ADD8',
  Rust:        '#dea584',
  'C++':       '#f34b7d',
  C:           '#555555',
  Ruby:        '#701516',
  PHP:         '#4F5D95',
  Swift:       '#F05138',
  Kotlin:      '#A97BFF',
  Dart:        '#00B4AB',
  Shell:       '#89e051',
  Vue:         '#41b883',
  Svelte:      '#ff3e00',
  Lua:         '#000080',
  Scala:       '#c22d40',
  'C#':        '#178600',
  Dockerfile:  '#384d54',
  SCSS:        '#c6538c',
  R:           '#198CE7',
  MATLAB:      '#e16737',
};

function langColor(lang) {
  return LANG_COLORS[lang] || '#6e7681';
}

// ── DOM refs ────────────────────────────────────────────────────
const input     = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const statusDot = document.getElementById('status-dot');
const statusMsg = document.getElementById('status-msg');
const loader    = document.getElementById('loader');
const result    = document.getElementById('result');
const errorBox  = document.getElementById('error-box');

// ── State ───────────────────────────────────────────────────────
let currentUser = null;

// ── Search trigger ──────────────────────────────────────────────
searchBtn.addEventListener('click', doSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

// Also support pressing Enter at page load (autofocus)
input.focus();

async function doSearch() {
  const username = input.value.trim().replace(/^@/, '');
  if (!username) { showError('Enter a GitHub username.'); return; }

  reset();
  setStatus('loading', `Scanning user: ${username}`);
  loader.classList.add('active');
  searchBtn.disabled = true;

  try {
    const [user, repos] = await Promise.all([
      fetchUser(username),
      fetchRepos(username),
    ]);
    currentUser = user;
    renderProfile(user, repos);
    setStatus('ok', `Found: ${user.login} — ${repos.length} repos loaded`);
  } catch (err) {
    showError(err.message || 'Network error — check your connection.');
    setStatus('error', err.message || 'Error');
  } finally {
    loader.classList.remove('active');
    searchBtn.disabled = false;
  }
}

// ── GitHub API ──────────────────────────────────────────────────
async function fetchUser(username) {
  const res = await fetch(`https://api.github.com/users/${username}`);
  if (res.status === 404) throw new Error(`User "${username}" not found.`);
  if (res.status === 403) throw new Error('API rate limit hit — try again in a minute.');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

async function fetchRepos(username) {
  const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
  if (!res.ok) return [];
  const repos = await res.json();
  // Sort by stars desc, take top 12
  return repos
    .filter(r => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 12);
}

// ── Render ──────────────────────────────────────────────────────
function renderProfile(user, repos) {
  // Profile section
  document.getElementById('avatar').src   = user.avatar_url;
  document.getElementById('avatar').alt   = user.login;
  document.getElementById('name').textContent  = user.name || user.login;
  document.getElementById('login').textContent = `@${user.login}`;
  document.getElementById('bio').textContent   = user.bio || '— No bio provided —';
  document.getElementById('profile-link').href = user.html_url;

  // Meta
  document.getElementById('meta-location').textContent = user.location || 'Unknown location';
  document.getElementById('meta-company').textContent  = user.company  || 'No company';
  document.getElementById('meta-blog').textContent     = user.blog     || '—';
  if (user.blog) {
    document.getElementById('meta-blog').href = user.blog.startsWith('http') ? user.blog : 'https://' + user.blog;
  }
  document.getElementById('meta-joined').textContent   = formatDate(user.created_at);

  // Stats
  document.getElementById('stat-repos').textContent    = fmtNum(user.public_repos);
  document.getElementById('stat-followers').textContent= fmtNum(user.followers);
  document.getElementById('stat-following').textContent= fmtNum(user.following);
  document.getElementById('stat-gists').textContent    = fmtNum(user.public_gists);

  // Animate stats with counting
  ['stat-repos','stat-followers','stat-following','stat-gists'].forEach(id => {
    const el  = document.getElementById(id);
    const end = parseInt(el.textContent.replace(/[^0-9]/g,''), 10);
    countUp(el, end);
  });

  // Repos
  const reposGrid = document.getElementById('repos-grid');
  reposGrid.innerHTML = repos.length
    ? repos.map((r, i) => repoCard(r, i)).join('')
    : '<p style="color:var(--text-dim);font-size:12px;">No public repositories found.</p>';

  result.classList.add('active');
}

function repoCard(repo, i) {
  const lang      = repo.language || '';
  const color     = langColor(lang);
  const stars     = fmtNum(repo.stargazers_count);
  const forks     = fmtNum(repo.forks_count);
  const desc      = repo.description || 'No description.';
  const delay     = (i * 0.04).toFixed(2) + 's';

  return `
    <a class="repo-card" href="${repo.html_url}" target="_blank" rel="noopener"
       style="animation-delay:${delay}">
      <div class="repo-name">${escHtml(repo.name)}</div>
      <div class="repo-desc">${escHtml(desc)}</div>
      <div class="repo-footer">
        ${lang ? `
          <span class="repo-stat">
            <span class="lang-dot" style="background:${color}"></span>
            ${escHtml(lang)}
          </span>` : ''}
        <span class="repo-stat">⭐ ${stars}</span>
        <span class="repo-stat">🍴 ${forks}</span>
      </div>
    </a>
  `;
}

// ── Helpers ─────────────────────────────────────────────────────

function setStatus(type, msg) {
  statusDot.className = 'status-dot';
  if (type === 'loading') statusDot.classList.add('loading');
  if (type === 'error')   statusDot.classList.add('error');
  statusMsg.textContent = msg;
}

function showError(msg) {
  document.getElementById('error-code').textContent = '// ERROR';
  document.getElementById('error-msg').textContent  = msg;
  errorBox.classList.add('active');
}

function reset() {
  result.classList.remove('active');
  errorBox.classList.remove('active');
  document.getElementById('repos-grid').innerHTML = '';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtNum(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function countUp(el, end) {
  if (end === 0 || isNaN(end)) return;
  const duration = 800;
  const start    = Date.now();
  const from     = 0;

  function step() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const val = Math.floor(from + (end - from) * easeOut(progress));
    el.textContent = fmtNum(val);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = fmtNum(end);
  }
  requestAnimationFrame(step);
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
