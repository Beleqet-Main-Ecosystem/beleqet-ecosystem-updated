const API_BASE = window.location.origin;
const BELEQET_BOT_USERNAME = 'BeleqetJobs_Bot';

const tg = window.Telegram && window.Telegram.WebApp;

let STATE = {
  lang: 'am',
  creators: [],
  filtered: [],
};

const STRINGS = {
  am: { lang_label: 'English', title: 'ተወዳጅ ቲክቶከርዎን ይምረጡ', vote: 'ድምጽ ስጥ', voted: 'ተመርጧል', not_registered: 'ድምጽ ከመስጠትዎ በፊት መመዝገብ አለቦት።' },
  en: { lang_label: 'አማርኛ', title: 'Choose your favourite creator', vote: 'Vote', voted: 'Voted', not_registered: 'You must be registered before voting.' },
};

function init() {
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) { try { tg.setHeaderColor('#145e44'); } catch (e) { } }
    if (tg.setBackgroundColor) { try { tg.setBackgroundColor('#ffffff'); } catch (e) { } }
  }

  document.getElementById('lang-toggle').addEventListener('click', toggleLang);
  document.getElementById('search').addEventListener('input', onSearch);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  document.getElementById('terms-link').addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Terms and Conditions — see the pinned Telegram post for full rules.');
  });

  const promo = document.getElementById('promo-card');
  promo.addEventListener('click', (e) => {
    e.preventDefault();
    const url = `https://t.me/${BELEQET_BOT_USERNAME}?start=from_sgs_challenge`;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  });

  checkAdmin();

  document.getElementById('admin-add-btn').addEventListener('click', () => openAdminModal(null));
  document.getElementById('admin-cancel-btn').addEventListener('click', () => {
    document.getElementById('admin-modal').style.display = 'none';
  });
  document.getElementById('admin-save-btn').addEventListener('click', saveCreator);
  document.getElementById('admin-reset-btn').addEventListener('click', resetVotes);

  // Registration modal listeners
  document.getElementById('reg-role').addEventListener('change', (e) => {
    const role = e.target.value;
    document.getElementById('reg-employer-fields').style.display = role === 'employer' ? 'block' : 'none';
    document.getElementById('reg-candidate-fields').style.display = role === 'candidate' ? 'block' : 'none';
  });
  document.getElementById('reg-cancel-btn').addEventListener('click', () => {
    document.getElementById('register-modal').style.display = 'none';
  });
  document.getElementById('reg-submit-btn').addEventListener('click', submitRegistration);

  loadCreators();
}

async function loadCreators() {
  const loadingEl = document.getElementById('loading');
  try {
    const initQuery = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? `?uid=${tg.initDataUnsafe.user.id}` : '';
    const res = await fetch(`${API_BASE}/api/challenge/creators${initQuery}`);
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    STATE.creators = data.creators || [];
    STATE.filtered = STATE.creators;
    document.getElementById('stat-votes').textContent = formatNum(data.total_votes || 0);
    document.getElementById('stat-views').textContent = formatNum(data.total_views || 0);
    renderCreators();
    renderWinners();
  } catch (err) {
    loadingEl.textContent = 'Could not load creators. Pull to refresh.';
  }
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function renderCreators() {
  const listEl = document.getElementById('creators-list');
  const loadingEl = document.getElementById('loading');
  loadingEl.style.display = 'none';
  if (!STATE.filtered.length) {
    listEl.innerHTML = '<div class="empty">No creators match your search.</div>';
    return;
  }
  listEl.innerHTML = STATE.filtered.map((c, i) => renderCreatorRow(c, i)).join('');
  listEl.querySelectorAll('.vote-btn').forEach((btn) => {
    btn.addEventListener('click', () => castVote(btn.dataset.id, btn));
  });
}

function renderCreatorRow(c, index = 0) {
  const s = STRINGS[STATE.lang] || STRINGS.en;
  const voted = c.voted_by_me;
  const anyVoted = STATE.creators.some(x => x.voted_by_me);
  return `<div class="creator-row" style="animation-delay: ${index * 0.05}s">
    <img class="avatar" src="${c.avatar_url || placeholderAvatar(c.name)}" alt="">
    <div class="creator-info">
      <b>${escapeHtml(c.name)}</b>
      <span>@${escapeHtml(c.handle)}</span>
      <span class="vote-count">${formatNum(c.votes)} votes</span>
    </div>
    <button class="vote-btn ${voted ? 'voted' : ''}" data-id="${c.id}" ${anyVoted ? 'disabled' : ''}>
      ${voted ? '✓ ' + s.voted : '🗳️ ' + s.vote}
    </button>
  </div>`;
}

function renderWinners() {
  const el = document.getElementById('winners-list');
  const ranked = STATE.creators.slice().sort((a, b) => b.votes - a.votes).slice(0, 10);
  if (!ranked.length) { el.innerHTML = '<div class="empty">Leaderboard will appear once voting opens.</div>'; return; }
  el.innerHTML = ranked.map((c, i) => `<div class="creator-row" style="animation-delay: ${i * 0.05}s">
    <span class="rank-badge">${i + 1}</span>
    <img class="avatar" src="${c.avatar_url || placeholderAvatar(c.name)}" alt="">
    <div class="creator-info"><b>${escapeHtml(c.name)}</b><span>@${escapeHtml(c.handle)}</span></div>
    <span class="vote-count" style="margin-top:0;">${formatNum(c.votes)}</span>
  </div>`).join('');
}

async function castVote(creatorId, btn) {
  btn.disabled = true;
  try {
    const initData = tg ? tg.initData : '';
    const res = await fetch(`${API_BASE}/api/challenge/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, creator_id: creatorId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.not_registered) {
        document.getElementById('register-modal').style.display = 'flex';
      } else {
        showToast(data.error || 'Could not register your vote.');
      }
      btn.disabled = false;
      return;
    }
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    const creator = STATE.creators.find((c) => String(c.id) === String(creatorId));
    if (creator) { creator.votes = data.votes; creator.voted_by_me = true; }
    renderCreators();
    renderWinners();
    showToast('Vote recorded! ✅');
  } catch (err) {
    showToast('Network error — try again.');
    btn.disabled = false;
  }
}

function onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  STATE.filtered = !q ? STATE.creators : STATE.creators.filter(
    (c) => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q)
  );
  renderCreators();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
}

function toggleLang() {
  STATE.lang = STATE.lang === 'am' ? 'en' : 'am';
  document.getElementById('lang-label').textContent = STRINGS[STATE.lang].lang_label;
  document.querySelector('.hero-text h1').textContent = STRINGS[STATE.lang].title;
  renderCreators();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function placeholderAvatar(name) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1B2A4D&color=E8A33D&bold=true`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function checkAdmin() {
  if (!tg || !tg.initData) return;
  try {
    const res = await fetch(`${API_BASE}/api/challenge/admin/check`, {
      method: 'POST',
      headers: { 'X-Init-Data': tg.initData }
    });
    const data = await res.json();
    if (data.is_admin) {
      STATE.isAdmin = true;
      document.getElementById('tab-admin').style.display = 'block';
      loadAdminCreators();
    }
  } catch (e) { }
}

async function loadAdminCreators() {
  try {
    const res = await fetch(`${API_BASE}/api/challenge/admin/creators`, {
      headers: { 'X-Init-Data': tg ? tg.initData : '' }
    });
    const data = await res.json();
    STATE.adminCreators = data.creators || [];
    STATE.adminStats = data.stats || {};
    renderAdminCreators();
  } catch (e) { showToast('Admin fetch failed'); }
}

function renderAdminCreators() {
  const listEl = document.getElementById('admin-list');
  const s = STATE.adminStats || {};

  let html = `
    <div style="background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:15px; margin-bottom:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      <div>
        <span style="font-size:10px; color:var(--muted); text-transform:uppercase; font-weight:bold;">Total Voters</span>
        <div style="font-size:18px; font-weight:bold; color:var(--accent-deep);">${s.total_voters || 0}</div>
      </div>
      <div>
        <span style="font-size:10px; color:var(--muted); text-transform:uppercase; font-weight:bold;">Total Votes</span>
        <div style="font-size:18px; font-weight:bold; color:var(--accent-deep);">${s.total_votes || 0}</div>
      </div>
      <div>
        <span style="font-size:10px; color:var(--muted); text-transform:uppercase; font-weight:bold;">Active Creators</span>
        <div style="font-size:18px; font-weight:bold; color:var(--accent-deep);">${s.active_creators || 0} / ${s.total_creators || 0}</div>
      </div>
    </div>
  `;

  html += (STATE.adminCreators || []).map(c => `
    <div class="creator-row" style="opacity: ${c.is_active ? 1 : 0.6}; flex-wrap: wrap;">
      <div class="creator-info" style="flex:1; min-width: 150px;">
        <b>${escapeHtml(c.name)} ${c.is_active ? '' : '<span style="color:var(--muted); font-weight:normal;">(Hidden)</span>'}</b>
        <span>@${escapeHtml(c.handle)} - <strong style="color:var(--accent-deep);">${c.votes} votes</strong></span>
      </div>
      <div style="display:flex; gap: 5px;">
        <button class="vote-btn" onclick="openAdminModal(${c.id})" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1; font-size:12px; padding: 5px 10px;">Edit</button>
        <button class="vote-btn" onclick="deleteCreator(${c.id})" style="background:#fee2e2; color:#ef4444; border-color:#fca5a5; font-size:12px; padding: 5px 10px;">Del</button>
      </div>
    </div>
  `).join('');
  listEl.innerHTML = html;
}

window.openAdminModal = function (id) {
  const m = document.getElementById('admin-modal');
  document.getElementById('modal-title').textContent = id ? 'Edit Creator' : 'Add Creator';
  const c = id ? STATE.adminCreators.find(x => x.id === id) : { name: '', handle: '', avatar_url: '', tiktok_url: '', is_active: 1 };
  document.getElementById('edit-id').value = id || '';
  document.getElementById('edit-name').value = c.name;
  document.getElementById('edit-handle').value = c.handle;
  document.getElementById('edit-avatar').value = c.avatar_url || '';
  document.getElementById('edit-tiktok').value = c.tiktok_url || '';
  document.getElementById('edit-active').checked = !!c.is_active;
  document.getElementById('edit-avatar-file').value = ''; // Reset file input

  const preview = document.getElementById('edit-avatar-preview');
  if (c.avatar_url && !c.avatar_url.startsWith('Will upload')) {
    preview.src = c.avatar_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    preview.src = '';
  }

  m.style.display = 'flex';
};

async function saveCreator() {
  const id = document.getElementById('edit-id').value;
  const fileInput = document.getElementById('edit-avatar-file');
  let avatar_url = document.getElementById('edit-avatar').value;

  if (fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
      const upRes = await fetch(`${API_BASE}/api/challenge/admin/upload`, {
        method: 'POST',
        headers: { 'X-Init-Data': tg ? tg.initData : '' },
        body: formData
      });
      const upData = await upRes.json();
      if (upRes.ok) {
        avatar_url = upData.url;
      } else {
        showToast('Image upload failed');
        return;
      }
    } catch (e) {
      showToast('Image upload error');
      return;
    }
  } else if (avatar_url.startsWith('Will upload:')) {
    avatar_url = ''; // fallback in case of bugs
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_BASE}/api/challenge/admin/creators/${id}` : `${API_BASE}/api/challenge/admin/creators`;

  const payload = {
    name: document.getElementById('edit-name').value,
    handle: document.getElementById('edit-handle').value,
    avatar_url: avatar_url,
    tiktok_url: document.getElementById('edit-tiktok').value,
    is_active: document.getElementById('edit-active').checked ? 1 : 0
  };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Init-Data': tg ? tg.initData : '' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('admin-modal').style.display = 'none';
      loadAdminCreators();
      loadCreators(); // Refresh public view too
      showToast('Saved');
    } else {
      showToast('Save failed');
    }
  } catch (e) { showToast('Error'); }
}

window.deleteCreator = async function (id) {
  if (!confirm('Delete this creator and all their votes?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/challenge/admin/creators/${id}`, {
      method: 'DELETE',
      headers: { 'X-Init-Data': tg ? tg.initData : '' }
    });
    if (res.ok) { loadAdminCreators(); loadCreators(); showToast('Deleted'); }
  } catch (e) { showToast('Error'); }
};

async function resetVotes() {
  if (!confirm('Are you sure you want to delete ALL votes?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/challenge/admin/reset`, {
      method: 'POST',
      headers: { 'X-Init-Data': tg ? tg.initData : '' }
    });
    if (res.ok) { loadAdminCreators(); loadCreators(); showToast('Votes Reset'); }
  } catch (e) { showToast('Error'); }
}

async function submitRegistration() {
  const btn = document.getElementById('reg-submit-btn');
  btn.textContent = "Registering...";
  btn.disabled = true;

  try {
    const role = document.getElementById('reg-role').value;
    const formData = new FormData();
    formData.append('initData', tg ? tg.initData : '');
    formData.append('name', document.getElementById('reg-name').value.trim());
    formData.append('phone', document.getElementById('reg-phone').value.trim());
    formData.append('email', document.getElementById('reg-email').value.trim());
    formData.append('tg_username', document.getElementById('reg-tg-username').value.trim());
    formData.append('password', document.getElementById('reg-password').value);
    formData.append('role', role);

    if (role === 'employer') {
      formData.append('company_name', document.getElementById('reg-company-name').value.trim());
      const fileInput = document.getElementById('reg-trade-license-file');
      if (fileInput.files.length > 0) {
        formData.append('trade_license', fileInput.files[0]);
      } else {
        showToast("Please upload a trade license.");
        btn.textContent = "Register";
        btn.disabled = false;
        return;
      }
    } else {
      formData.append('job_title', document.getElementById('reg-job-title').value.trim());
    }

    const res = await fetch(`${API_BASE}/api/challenge/register`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Registration failed.");
      btn.textContent = "Register";
      btn.disabled = false;
      return;
    }

    document.getElementById('register-modal').style.display = 'none';

    if (data.coupon_code) {
      document.getElementById('coupon-code-display').textContent = data.coupon_code;
      document.getElementById('coupon-modal').style.display = 'flex';
      
      document.getElementById('coupon-close-btn').onclick = () => {
        document.getElementById('coupon-modal').style.display = 'none';
        showToast("Registration successful! You can now cast your vote.");
      };
    } else {
      showToast("Registration successful! You can now cast your vote.");
    }
  } catch (err) {
    showToast('Network error during registration. Try again.');
  }
  
  btn.textContent = "Register";
  btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', init);
