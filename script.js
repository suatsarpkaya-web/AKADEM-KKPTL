/**
 * AkademikKapital — Yükseköğretim Yayın ve Veri Arşivi (Supabase Entegre Sürüm)
 */

document.addEventListener('DOMContentLoaded', () => {
  const CACHE_KEYS = {
    archive: 'ak_archive_cache_v7',
    social: 'ak_social_cache_v7'
  };

  // Tablo ve bucket adlarını kendi Supabase şemanla birebir eşleştir
  const SB_CONFIG = {
    configEndpoint: '/api/config',
    contentTable: 'site_content',
    submissionsTable: 'site_submissions',
    storageBucket: 'archive-media',
    pageSize: 6
  };

  const TYPE_LABELS = {
    makale: 'Makale',
    haberler: 'Haberler',
    duyurular: 'Duyurular',
    dokuman: 'Doküman Arşivi',
    baglanti: 'Dış Bağlantılar'
  };

  const PLATFORM_LABELS = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    instagram: 'Instagram',
    youtube: 'YouTube',
    threads: 'Threads',
    x: 'X (Twitter)',
    custom: 'Bağlantı'
  };

  const DEFAULT_SOCIAL_LINKS = [
    { id: 'soc-whatsapp', platform: 'whatsapp', label: 'WhatsApp', url: 'https://whatsapp.com/channel/0029Vb6' },
    { id: 'soc-telegram', platform: 'telegram', label: 'Telegram', url: 'https://t.me/akademikkapital' },
    { id: 'soc-instagram', platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/akademikkapital' },
    { id: 'soc-youtube', platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/@akademikkapital' },
    { id: 'soc-threads', platform: 'threads', label: 'Threads', url: 'https://www.threads.net/@akademikkapital' },
    { id: 'soc-x', platform: 'x', label: 'X (Twitter)', url: 'https://x.com/akademikkapital' }
  ];

  const INITIAL_ARCHIVE_JSON = [
    {
      id: 'yok-2026-rapor',
      type: 'dokuman',
      featured: true,
      title: 'Yükseköğretim Kurumları 2026 Akademik Kadro ve Program Raporu',
      summary: 'Üniversitelerdeki program açılışları, araştırma üniversiteleri göstergeleri ve insan kaynağı dağılımına ilişkin temel veri özeti.',
      body: [
        'Yükseköğretim sisteminde program çeşitliliği, kalite güvencesi ve araştırma kapasitesi verileri her dönem yeniden değerlendirilmektedir.',
        'Bu kayıtta resmî kurum tarafından paylaşılan verilerin temel başlıkları özetlenmiş ve doğrulama için birincil kaynağa bağlantı verilmiştir.'
      ],
      imageUrl: '',
      author: 'Yükseköğretim Kurulu (Veri Özeti)',
      source: 'YÖK Resmî Yayınlar',
      date: '2026-11-18',
      updatedAt: '2026-11-20',
      topic: 'YÖK Politikaları',
      docMeta: 'PDF • 3,2 MB',
      sourceUrl: 'https://www.yok.gov.tr',
      isExternalLink: false,
      apa: 'Yükseköğretim Kurulu. (2026, 18 Kasım). Yükseköğretim kurumları 2026 akademik kadro ve program raporu [Özet kayıt]. AkademikKapital Arşivi. https://akademikkapital.vercel.app/?id=yok-2026-rapor'
    }
  ];

  // Supabase istemci durumu
  let sb = {
    url: '',
    anonKey: '',
    accessToken: null,
    user: null
  };

  let records = [];
  let pendingSubmissions = [];
  let socialLinks = [];
  let pendingUploadedFile = null;
  let pendingUploadedPreviewUrl = '';

  let state = {
    tab: 'tumu',
    q: '',
    sira: 'newest',
    year: 'ALL',
    topic: 'ALL',
    visibleLimit: SB_CONFIG.pageSize,
    activeDetailId: null,
    viewMode: 'archive'
  };

  // DOM Elemanları
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const yearFilter = document.getElementById('yearFilter');
  const topicFilter = document.getElementById('topicFilter');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const resultCount = document.getElementById('resultCount');
  const statusBanner = document.getElementById('statusBanner');
  const featuredSection = document.getElementById('featuredSection');
  const featuredCardSlot = document.getElementById('featuredCardSlot');
  const archiveList = document.getElementById('archiveList');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const archiveView = document.getElementById('archiveView');
  const aboutView = document.getElementById('aboutView');
  const detailView = document.getElementById('detailView');

  // =========================================================================
  // Supabase REST / Auth / Storage Yardımcıları
  // =========================================================================
  async function loadSupabaseConfig() {
    if (window.__SUPABASE_CONFIG__?.url && window.__SUPABASE_CONFIG__?.key) {
      sb.url = window.__SUPABASE_CONFIG__.url.replace(/\/+$/, '');
      sb.anonKey = window.__SUPABASE_CONFIG__.key;
      return true;
    }

    try {
      const res = await fetch(SB_CONFIG.configEndpoint, { cache: 'no-store' });
      if (!res.ok) return false;
      const cfg = await res.json();
      if (cfg?.url && cfg?.key) {
        sb.url = String(cfg.url).replace(/\/+$/, '');
        sb.anonKey = String(cfg.key);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function hasSupabase() {
    return Boolean(sb.url && sb.anonKey);
  }

  function sbHeaders(useAuth = false) {
    const token = useAuth && sb.accessToken ? sb.accessToken : sb.anonKey;
    return {
      apikey: sb.anonKey,
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }  function normalizeDbRow(row) { if (!row \vert{}\vert{} typeof row !== 'object') return null; const rawBody = row.body; const bodyArr = Array.isArray(rawBody) ? rawBody : typeof rawBody === 'string' && rawBody.trim() ? rawBody.split(/\n+/).filter(Boolean) : row.summary ? [row.summary] : [];  const dateVal = row.date \vert{}\vert{} row.published_at \vert{}\vert{} (row.created_at ? String(row.created_at).slice(0, 10) : '2026-11-24'); const updatedVal = row.updatedAt \vert{}\vert{} row.updated_at \vert{}\vert{} dateVal;  return { id: String(row.id \vert{}\vert{} `ak-${Date.now()}`),
      type: row.type || row.category || 'makale',
      featured: Boolean(row.featured),
      title: row.title || '',
      summary: row.summary || '',
      body: bodyArr,
      imageUrl: row.imageUrl || row.image_url || '',
      author: row.author || 'AkademikKapital',
      source: row.source || 'Arşiv',
      date: String(dateVal).slice(0, 10),
      updatedAt: String(updatedVal).slice(0, 10),
      topic: row.topic || 'Genel',
      docMeta: row.docMeta || row.doc_meta || '',
      sourceUrl: row.sourceUrl || row.source_url || '',
      isExternalLink: Boolean(row.isExternalLink ?? row.is_external_link ?? row.type === 'baglanti'),
      apa: row.apa || ''
    };
  }

  function toDbPayload(item) {
    const bodyStr = Array.isArray(item.body) ? item.body.join('\n\n') : String(item.body || '');
    return {
      id: item.id,
      type: item.type,
      featured: Boolean(item.featured),
      title: item.title,
      summary: item.summary,
      body: bodyStr,
      image_url: item.imageUrl || '',
      author: item.author,
      source: item.source,
      date: item.date,
      updated_at: item.updatedAt || new Date().toISOString().slice(0, 10),
      topic: item.topic,
      doc_meta: item.docMeta || '',
      source_url: item.sourceUrl || '',
      is_external_link: Boolean(item.isExternalLink),
      apa: item.apa || ''
    };
  }

  async function fetchContentFromSupabase() {
    const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.contentTable}?select=*&order=date.desc`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: sbHeaders(false),
      cache: 'no-store'
    });
    if (!res.ok) {
      throw new Error(`Supabase okuma hatası (${res.status})`);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(normalizeDbRow).filter(Boolean) : [];
  }

  async function upsertContentToSupabase(item) {
    const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.contentTable}?on_conflict=id`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...sbHeaders(true),
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(toDbPayload(item))
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Kayıt yazılamadı (${res.status})`);
    }
  }

  async function clearOtherFeaturedInSupabase(keepId) {
    const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.contentTable}?id=neq.${encodeURIComponent(keepId)}&featured=eq.true`; await fetch(endpoint, { method: 'PATCH', headers: { ...sbHeaders(true), Prefer: 'return=minimal' }, body: JSON.stringify({ featured: false }) }).catch(() => {}); }  async function deleteContentFromSupabase(id) { const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.contentTable}?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: sbHeaders(true)
    });
    if (!res.ok) {
      throw new Error(`Silme hatası (${res.status})`); } }  async function insertSubmissionToSupabase(entry) { const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.submissionsTable}`; const res = await fetch(endpoint, { method: 'POST', headers: { ...sbHeaders(false), Prefer: 'return=minimal' }, body: JSON.stringify({ id: entry.id, name: entry.name, institution: entry.institution, email: entry.email, type: entry.type, title: entry.title, text_or_url: entry.textOrUrl, source_note: entry.sourceNote, status: 'pending', submitted_at: entry.submittedAt }) }); if (!res.ok) { const errText = await res.text(); throw new Error(errText \vert{}\vert{} `Katkı gönderilemedi (${res.status})`);
    }
  }

  async function fetchPendingSubmissionsFromSupabase() {
    if (!sb.accessToken) return [];
    const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.submissionsTable}?select=*&status=eq.pending&order=submitted_at.desc`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: sbHeaders(true),
      cache: 'no-store'
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows)
      ? rows.map((r) => ({
          id: r.id,
          name: r.name,
          institution: r.institution,
          email: r.email,
          type: r.type,
          title: r.title,
          textOrUrl: r.text_or_url || r.textOrUrl || '',
          sourceNote: r.source_note || r.sourceNote || '',
          submittedAt: r.submitted_at || r.submittedAt
        }))
      : [];
  }

  async function updateSubmissionStatusInSupabase(id, status) {
    if (!sb.accessToken) return;
    const endpoint = `${sb.url}/rest/v1/${SB_CONFIG.submissionsTable}?id=eq.${encodeURIComponent(id)}`; await fetch(endpoint, { method: 'PATCH', headers: sbHeaders(true), body: JSON.stringify({ status }) }).catch(() => {}); }  async function uploadImageToSupabaseStorage(file) { const ext = (file.name.split('.').pop() \vert{}\vert{} 'png').toLowerCase().replace(/[^a-z0-9]/g, '') \vert{}\vert{} 'png'; const filePath = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadUrl = `${sb.url}/storage/v1/object/${SB_CONFIG.storageBucket}/${filePath}`;  const res = await fetch(uploadUrl, { method: 'POST', headers: { apikey: sb.anonKey, Authorization: `Bearer ${sb.accessToken || sb.anonKey}`,
        'Content-Type': file.type || 'image/png',
        'x-upsert': 'true'
      },
      body: file
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Görsel Supabase Storage yüklemesi başarısız.');
    }

    return `${sb.url}/storage/v1/object/public/${SB_CONFIG.storageBucket}/${filePath}`; }  async function signInWithSupabase(email, password) { const endpoint = `${sb.url}/auth/v1/token?grant_type=password`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: sb.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
      throw new Error(data?.error_description || data?.msg || 'Giriş başarısız.');
    }
    sb.accessToken = data.access_token;
    sb.user = data.user || null;
    return data;
  }

  // =========================================================================
  // Sosyal Medya İkonları ve Görünümü
  // =========================================================================
  function renderPlatformIcon(platform) {
    switch (platform) {
      case 'whatsapp':
        return `<svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20.52 3.48A11.82 11.82 0 0 0 12.06 0C5.49 0 .14 5.35.14 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.29-1.65a11.88 11.88 0 0 0 5.77 1.47h.01c6.57 0 11.92-5.35 11.92-11.92 0-3.18-1.24-6.18-3.47-8.42zm-8.45 18.33h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98 1-3.64-.24-.37a9.85 9.85 0 0 1-1.51-5.23c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.89-9.9 9.89zm5.42-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49s1.07 2.89 1.22 3.09c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>`;
      case 'telegram':
        return `<svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M23.91 3.79L20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.55-1.12.55l.4-5.64 10.28-9.28c.45-.4-.1-.62-.69-.22L6.52 13.32 1.05 11.61c-1.19-.37-1.21-1.19.25-1.76L22.39 1.59c.99-.37 1.86.22 1.52 2.2z"/></svg>`;
      case 'instagram':
        return `<svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.72 3.72 0 0 1-.9 1.38 3.72 3.72 0 0 1-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-2.12 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.39 2.12.66.67 1.33 1.08 2.12 1.39.76.3 1.64.5 2.91.56 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.12-1.39.67-.66 1.08-1.33 1.39-2.12.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.39-2.12A5.88 5.88 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/></svg>`;
      case 'youtube':
        return `<svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="
