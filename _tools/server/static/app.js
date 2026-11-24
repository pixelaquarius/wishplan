/* WishEdit — Commercial Dark NLE & AI Video Suite Controller */

const state = {
  project: '',
  overview: null,
  edlRows: [],
  layers: null,
  props: null,
  selectedEdlIdx: -1,
  selectedLayer: null, // { kind: 'edl'|'caption'|'hook'|'infocard'|'darkscene'|'logobadge'|'broll'|'marker'|'adjlayer', index: number, ref: object }
  edlFilter: 'all',
  stageMode: 'output', // 'output' | 'source'
  overlaysEnabled: false,
  safeZoneEnabled: false,
  pxPerSec: 34,
  keptOffsets: [],
  totalOutSec: 0,
  timelineSec: 0,
  rangeInSec: null,
  rangeOutSec: null,
  undoStack: [],
  redoStack: [],
  activeJobId: null,
  exportJobId: null,
  lastExportResult: null,
  activeVideoUrl: '',
  showAllLuts: false,
  isAiBusy: false,
  autoBrollCount: 3,
  styleRefs: { dir: 'StyleRefs', videos: [], metrics: [], style_md: '' },
  projectCards: [],
  tlThumbHeight: 44,
  bottomChatOpen: false,

  // CapCut 2-Column X & Y Media Pool State
  poolX: 'media',
  poolY: 'raw',
  lastPoolYByX: {
    media: 'raw',
    audio: 'music',
    text: 'hook_sub',
    effects: 'transitions',
    color: 'lut_top',
  },

  // Responsive & Panel Layout State
  layoutMode: 'wide', // 'wide' (>=1280) | 'compact' (768..1279) | 'mobile' (<768)
  compactSidePane: 'left', // 'left' | 'right'
  mobileActivePane: 'stage', // 'stage' | 'edl' | 'inspector' | 'timeline'
  leftCollapsed: false,
  rightCollapsed: false,
  tlCollapsed: false,
  tlHeightPx: 196,
};

const $ = (id) => document.getElementById(id);

const VIDEO_EXT_RE = /\.(mp4|mov|mkv|webm|m4v|avi)$/i;
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|webp|gif)$/i;

function getExtBadge(filename) {
  const m = String(filename || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : 'FILE';
}

function isVideoFilename(filename) {
  return VIDEO_EXT_RE.test(String(filename || ''));
}

/* ==================== CAPCUT 2-COLUMN (X & Y) MEDIA POOL SCHEMA ==================== */

const POOL_SCHEMA = {
  media: {
    label: 'Media',
    defaultItab: 'video',
    adjustLabel: 'Chỉnh Video',
    items: [
      {
        id: 'raw',
        label: 'Clip gốc',
        paneId: 'ypane-raw',
        title: 'Clip gốc',
        subtitle: 'MP4, MOV, MKV · Rê chuột để xem thử hoặc kéo vào Timeline',
        uploadTarget: 'raw',
        inputId: 'inputUploadRaw',
        uploadText: '+ Nhập Clip',
        adjustItab: 'video',
        adjustLabel: 'Thông số Video',
        count: (ov) => (ov?.raw_files || []).length,
      },
      {
        id: 'broll',
        label: 'Kho B-Roll',
        paneId: 'ypane-broll',
        title: 'Kho B-Roll',
        subtitle: 'Hỗ trợ .MOV, .MP4, Ảnh · Kéo thả vào Timeline',
        uploadTarget: 'broll',
        inputId: 'inputUploadBroll',
        uploadText: '+ Nhập B-Roll',
        adjustItab: 'cards',
        adjustLabel: 'Chỉnh B-Roll & Thẻ',
        count: (ov) => (ov?.assets?.broll || []).length,
      },
      {
        id: 'style_refs',
        label: 'Mẫu phong cách',
        paneId: 'ypane-style_refs',
        title: 'Mẫu phong cách (StyleRefs)',
        subtitle: 'MP4, MOV · Học nhịp cắt, tốc độ nói, B-Roll',
        uploadTarget: 'style_ref',
        inputId: 'inputUploadStyleRef',
        uploadText: '+ Nạp Mẫu',
        adjustItab: 'video',
        adjustLabel: 'Thông số Video',
        count: () => (state.styleRefs?.videos || []).length,
      },
      {
        id: 'outputs',
        label: 'Đã xuất',
        paneId: 'ypane-outputs',
        title: 'Video đã xuất',
        subtitle: '9:16 · 1080×1920 · 30fps',
        uploadTarget: null,
        inputId: null,
        uploadText: '',
        adjustItab: 'video',
        adjustLabel: 'Cài đặt Xuất',
        count: (ov) => (ov?.outputs || []).length,
      },
    ],
  },
  audio: {
    label: 'Audio',
    defaultItab: 'audio',
    adjustLabel: 'Chỉnh Audio',
    items: [
      {
        id: 'music',
        label: 'Nhạc nền',
        paneId: 'ypane-music',
        title: 'Nhạc nền',
        subtitle: 'MP3, WAV, M4A · Bấm chọn hoặc kéo thả',
        uploadTarget: 'music',
        inputId: 'inputUploadMusic',
        uploadText: '+ Nhập Nhạc',
        adjustItab: 'audio',
        adjustLabel: 'Âm lượng & Duck',
        count: (ov) => (ov?.assets?.music || []).length,
      },
      {
        id: 'sfx',
        label: 'Sound FX',
        paneId: 'ypane-sfx',
        title: 'Hiệu ứng âm thanh',
        subtitle: 'Whoosh, Pop, Ding · Kéo vào Timeline',
        uploadTarget: 'sfx',
        inputId: 'inputUploadSfx',
        uploadText: '+ Nhập SFX',
        adjustItab: 'audio',
        adjustLabel: 'Chỉnh dB SFX',
        count: (ov) => (ov?.assets?.sfx || []).filter((f) => !f.startsWith('vo_')).length,
      },
      {
        id: 'voice',
        label: 'Voice AI',
        paneId: 'ypane-voice',
        title: 'Giọng đọc & Voiceover AI',
        subtitle: 'Mẫu giọng & Voice đã tạo · Tạo bên phải',
        uploadTarget: 'sfx',
        inputId: 'inputUploadSfx',
        uploadText: '+ Nhập Voice',
        adjustItab: 'audio',
        adjustLabel: 'Tạo Voice AI →',
        count: (ov) => (ov?.assets?.sfx || []).filter((f) => f.startsWith('vo_')).length,
      },
    ],
  },
  text: {
    label: 'Text / Thẻ',
    defaultItab: 'hook',
    adjustLabel: 'Sửa Chữ & Thẻ',
    items: [
      {
        id: 'hook_sub',
        label: 'Hook & Sub',
        paneId: 'ypane-hook_sub',
        title: 'Mẫu Hook 3s & Phụ đề',
        subtitle: 'Nhấp chọn kiểu · Sửa chữ bên phải',
        uploadTarget: null,
        inputId: null,
        uploadText: '',
        adjustItab: 'hook',
        adjustLabel: 'Sửa Hook / Sub',
        count: () => 4,
      },
      {
        id: 'cards',
        label: 'Thẻ & Cảnh mờ',
        paneId: 'ypane-cards',
        title: 'InfoCard & Cảnh kính mờ',
        subtitle: 'Nhấp hoặc kéo thả vào Playhead',
        uploadTarget: null,
        inputId: null,
        uploadText: '',
        adjustItab: 'cards',
        adjustLabel: 'Chỉnh Thẻ / Cảnh',
        count: () => 5,
      },
      {
        id: 'logos',
        label: 'Logo nhãn',
        paneId: 'ypane-logos',
        title: 'Nhãn Logo minh họa',
        subtitle: 'Chèn góc trên khung 9:16',
        uploadTarget: null,
        inputId: null,
        uploadText: '',
        adjustItab: 'cards',
        adjustLabel: 'Chỉnh Logo',
        count: () => 4,
      },
    ],
  },
  effects: {
    label: 'Hiệu ứng',
    defaultItab: 'video',
    adjustLabel: 'Chỉnh Nhịp cắt',
    items: [
      {
        id: 'transitions',
        label: 'Chuyển cảnh',
        paneId: 'ypane-transitions',
        title: 'Chuyển cảnh (Cut Transitions)',
        subtitle: 'Nhấp hoặc kéo vào điểm cắt Timeline',
        uploadTarget: null,
        inputId: null,
        uploadText: '',
        adjustItab: 'video',
        adjustLabel: 'Nhịp & Whip',
        count: () => 4,
      },
      {
        id: 'zoom',
        label: 'Camera Zoom',
        paneId: 'ypane-zoom',
        title: 'Chuyển động Camera (Zoom)',
        subtitle: 'Đẩy / kéo khung giữ chân người xem',
        uploadTarget: null,
        inputId: null,
        uploadText: '',
        adjustItab: 'video',
        adjustLabel: 'Dynamic Zoom',
        count: () => 4,
      },
    ],
  },
  color: {
    label: 'Màu / LUT',
    defaultItab: 'color',
    adjustLabel: 'Chỉnh Màu & Auto',
    items: [
      {
        id: 'lut_top',
        label: 'Đề xuất AI',
        paneId: 'ypane-luts',
        title: 'Top 3 Smart LUTs theo nguồn',
        subtitle: 'Xếp hạng ánh sáng · Chỉnh chi tiết bên phải',
        uploadTarget: 'lut',
        inputId: 'inputUploadLut',
        uploadText: '+ .cube/.3dl',
        adjustItab: 'color',
        adjustLabel: 'Auto Color & Bánh xe',
        count: (ov) => Math.min(3, (ov?.color_analysis?.all_10_luts || []).length || 3),
      },
      {
        id: 'lut_all',
        label: 'Tất cả LUT',
        paneId: 'ypane-luts',
        title: 'Kho 10+ Smart LUTs',
        subtitle: 'Nhấp để áp dụng ngay lên Stage',
        uploadTarget: 'lut',
        inputId: 'inputUploadLut',
        uploadText: '+ .cube/.3dl',
        adjustItab: 'color',
        adjustLabel: 'Chỉnh thông số Màu',
        count: (ov) => (ov?.color_analysis?.all_10_luts || []).length + (ov?.assets?.luts || []).length,
      },
      {
        id: 'lut_custom',
        label: 'LUT đã nhập',
        paneId: 'ypane-luts',
        title: 'File LUT ngoài (.cube / .3dl)',
        subtitle: 'Tải từ máy vào 04_assets/luts/',
        uploadTarget: 'lut',
        inputId: 'inputUploadLut',
        uploadText: '+ Import LUT',
        adjustItab: 'color',
        adjustLabel: 'Chỉnh Màu & Sync',
        count: (ov) => (ov?.assets?.luts || []).length,
      },
    ],
  },
};

function getCurrentYMeta() {
  const cat = POOL_SCHEMA[state.poolX] || POOL_SCHEMA.media;
  return cat.items.find((it) => it.id === state.poolY) || cat.items[0];
}

function selectPoolXY(xKey, yKey = null) {
  if (!POOL_SCHEMA[xKey]) xKey = 'media';
  const cat = POOL_SCHEMA[xKey];
  const validY = yKey && cat.items.some((it) => it.id === yKey)
    ? yKey
    : (state.lastPoolYByX[xKey] || cat.items[0].id);

  state.poolX = xKey;
  state.poolY = validY;
  state.lastPoolYByX[xKey] = validY;

  if (xKey === 'color') {
    state.showAllLuts = validY === 'lut_all';
  }

  // Highlight Column X
  document.querySelectorAll('.pool-x-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.px === xKey);
  });

  renderPoolSubcategories();
  const yMeta = getCurrentYMeta();

  // Switch Asset Pane
  document.querySelectorAll('.pool-ypane').forEach((p) => p.classList.add('hidden'));
  $(yMeta.paneId)?.classList.remove('hidden');

  // Update Sticky Header
  if ($('poolAssetTitle')) $('poolAssetTitle').textContent = yMeta.title;
  if ($('poolAssetSubtitle')) $('poolAssetSubtitle').textContent = yMeta.subtitle;
  const upBtn = $('btnPoolContextUpload');
  if (upBtn) {
    if (yMeta.inputId) {
      upBtn.classList.remove('hidden');
      upBtn.textContent = yMeta.uploadText || '+ Nhập';
    } else {
      upBtn.classList.add('hidden');
    }
  }
  if ($('lblColYAdjust')) $('lblColYAdjust').textContent = yMeta.adjustLabel || 'Điều chỉnh';

  if (xKey === 'color') renderColorAndLuts();
  if (xKey === 'media' && validY === 'style_refs') renderStyleRefsPool();
}

function renderPoolSubcategories() {
  const wrap = $('poolSubcategoryList');
  if (!wrap) return;
  const cat = POOL_SCHEMA[state.poolX] || POOL_SCHEMA.media;
  wrap.innerHTML = '';
  cat.items.forEach((item) => {
    const cnt = item.count ? item.count(state.overview) : 0;
    const isAct = item.id === state.poolY;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.py = item.id;
    btn.className = `pool-y-btn w-full px-2 py-1.5 flex items-center justify-between gap-1 text-[11px] ${isAct ? 'active font-semibold' : 'font-medium'}`;
    btn.innerHTML = `
      <span class="truncate">${escHtml(item.label)}</span>
      <span class="text-[9px] font-mono px-1 rounded ${isAct ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-800/80 text-zinc-400'}">${cnt}</span>
    `;
    btn.addEventListener('click', () => selectPoolXY(state.poolX, item.id));
    wrap.appendChild(btn);
  });
}

function openAdjustmentPanel(itab) {
  if (itab) {
    document.querySelector(`[data-itab="${itab}"]`)?.click();
  }
  if (state.layoutMode === 'wide') {
    if (state.rightCollapsed) {
      state.rightCollapsed = false;
      applyResponsiveLayout();
    }
  } else if (state.layoutMode === 'compact') {
    state.compactSidePane = 'right';
    applyResponsiveLayout();
  } else if (state.layoutMode === 'mobile') {
    switchMobilePane('inspector');
  }
}

function openPoolCategory(xKey, yKey) {
  document.querySelector('[data-tab="pool"]')?.click();
  selectPoolXY(xKey, yKey);
  if (state.layoutMode === 'wide') {
    if (state.leftCollapsed) {
      state.leftCollapsed = false;
      applyResponsiveLayout();
    }
  } else if (state.layoutMode === 'compact') {
    state.compactSidePane = 'left';
    applyResponsiveLayout();
  } else if (state.layoutMode === 'mobile') {
    switchMobilePane('edl');
  }
}

/* ==================== RESET / UNDO / HELPERS ==================== */

function resetClientProjectState() {
  state.overview = null;
  state.edlRows = [];
  state.layers = null;
  state.props = null;
  state.selectedEdlIdx = -1;
  state.selectedLayer = null;
  state.keptOffsets = [];
  state.totalOutSec = 0;
  state.timelineSec = 0;
  state.rangeInSec = null;
  state.rangeOutSec = null;
  state.undoStack = [];
  state.redoStack = [];
  state.activeVideoUrl = '';
  const player = $('previewPlayer');
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.srcObject = null;
    try {
      player.load();
    } catch {
      /* ignore */
    }
    player.classList.add('hidden');
    player.style.filter = 'none';
  }
  $('stagePlaceholder')?.classList.remove('hidden');
}

function pushUndoState(label = 'edit') {
  if (!state.layers && !state.edlRows.length) return;
  state.undoStack.push({
    label,
    edlRows: structuredClone(state.edlRows),
    layers: state.layers ? structuredClone(state.layers) : null,
  });
  if (state.undoStack.length > 30) state.undoStack.shift();
  state.redoStack = [];
  scheduleAutoSave();
}

let _autoSaveTimer = null;
function scheduleAutoSave(delayMs = 750) {
  if (!state.project) return;
  const dot = $('autoSaveDot');
  const txt = $('autoSaveText');
  if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse';
  if (txt) txt.textContent = 'Đang lưu...';
  if ($('layersDirtyHint')) $('layersDirtyHint').textContent = 'Đang tự động lưu...';

  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(async () => {
    try {
      syncInspectorToLayers(false);
      await apiJson(`/api/projects/${encodeURIComponent(state.project)}/edl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: state.edlRows, mark_final: true }),
      });
      await apiJson(`/api/projects/${encodeURIComponent(state.project)}/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: state.layers }),
      });
      if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-cyan-400';
      if (txt) txt.textContent = 'Đã lưu tự động';
      if ($('layersDirtyHint')) $('layersDirtyHint').textContent = 'Đã lưu tự động';
    } catch {
      /* ignore transient background save error */
    }
  }, delayMs);
}

function undoEdit() {
  if (!state.undoStack.length) return toast('Không còn bước nào để hoàn tác.');
  state.redoStack.push({
    edlRows: structuredClone(state.edlRows),
    layers: state.layers ? structuredClone(state.layers) : null,
  });
  const snap = state.undoStack.pop();
  state.edlRows = snap.edlRows;
  if (snap.layers) state.layers = snap.layers;
  computeKeptOffsets();
  updateTopBadges();
  renderEdlList();
  renderInspector();
  renderColorAndLuts();
  renderTimeline();
  updateLiveOverlays();
  toast('Đã hoàn tác (Undo)');
}

function redoEdit() {
  if (!state.redoStack.length) return toast('Không có bước nào để làm lại.');
  state.undoStack.push({
    edlRows: structuredClone(state.edlRows),
    layers: state.layers ? structuredClone(state.layers) : null,
  });
  const snap = state.redoStack.pop();
  state.edlRows = snap.edlRows;
  if (snap.layers) state.layers = snap.layers;
  computeKeptOffsets();
  updateTopBadges();
  renderEdlList();
  renderInspector();
  renderColorAndLuts();
  renderTimeline();
  updateLiveOverlays();
  toast('Đã làm lại (Redo)');
}

function toast(msg, kind = 'info') {
  const wrap = $('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  const palette =
    kind === 'error'
      ? 'bg-rose-950/95 text-rose-200 border-rose-500/40'
      : kind === 'success'
        ? 'bg-[#141419]/95 text-emerald-300 border-emerald-500/40'
        : 'bg-[#141419]/95 text-zinc-100 border-zinc-700';
  el.className = `pointer-events-auto px-3.5 py-2 rounded-lg border shadow-2xl text-xs font-medium transition-all ${palette}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3400);
}

async function apiJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return data;
}

function fmtSec(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${r}`;
}

function fmtSecMs(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${r}`;
}

function escHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function seekAndPlay(videoEl, sec, autoPlay = true) {
  if (!videoEl) return;
  const doSeek = () => {
    try {
      videoEl.currentTime = Math.max(0, sec);
      if (autoPlay) {
        const p = videoEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      /* ignore seek bounds */
    }
  };
  if (videoEl.readyState >= 1) {
    doSeek();
  } else {
    videoEl.addEventListener('loadedmetadata', doSeek, { once: true });
  }
}

/* ==================== DATA & TIMELINE COMPUTATION ==================== */

function ensureColorObject() {
  if (!state.layers) return null;
  if (!state.layers.color) {
    state.layers.color = {
      autoColorEnabled: false,
      autoColorIntensity: 80,
      lutId: 'none',
      lutIntensity: 85,
      adjustmentLayerEnabled: true,
      brightness: 0.0,
      contrast: 1.0,
      saturation: 1.0,
      temperature: 0.0,
      tint: 0.0,
      syncedAcrossClips: true,
    };
  }
  return state.layers.color;
}

function computeKeptOffsets() {
  const speed = Number(state.layers?.video?.speechSpeed || 1.0);
  const offsets = [];
  let acc = 0;
  state.edlRows.forEach((r, idx) => {
    if (Number(r.keep) === 1) {
      const dur = Math.max(0.05, (Number(r.end) - Number(r.start)) / speed);
      offsets.push({
        edlIdx: idx,
        tStart: acc,
        tEnd: acc + dur,
        srcStart: Number(r.start),
        srcEnd: Number(r.end),
        row: r,
      });
      acc += dur;
    }
  });
  state.keptOffsets = offsets;
  state.totalOutSec = acc || Number(state.layers?.durationSec || 0);
}

function updateTopBadges() {
  const ov = state.overview || {};
  const sum = ov.edl_summary || {};
  const speed = Number(state.layers?.video?.speechSpeed || 1.0);
  const rawKept = Number(sum.kept_seconds || 0);
  const outDur = state.totalOutSec > 0 ? state.totalOutSec : (speed > 0 ? rawKept / speed : rawKept);
  const gaps = ov.gaps_report || {};

  if ($('projectFolderBadge')) $('projectFolderBadge').textContent = ov.project_dir || `Projects/${state.project}`;
  if ($('currentProjectNameLabel')) $('currentProjectNameLabel').textContent = state.project || 'Demo';
  if ($('durationBadge')) $('durationBadge').textContent = `${outDur.toFixed(1)}s`;
  if ($('edlCountLabel')) $('edlCountLabel').textContent = `${state.edlRows.length}`;
  if ($('edlKeptMeta')) $('edlKeptMeta').textContent = `Giữ ${state.keptOffsets.length || sum.kept_segments || 0} câu (${outDur.toFixed(1)}s @ ${speed.toFixed(2)}x)`;
  if ($('watchlistCount')) $('watchlistCount').textContent = `${(ov.watchlist_hits || []).length}`;

  const ai = ov.ai_status || {};
  const statusTxt = $('aiStatusText');
  const modalBadge = $('modalApiStatusBadge');
  if (ai.has_external_key) {
    if (statusTxt) statusTxt.textContent = `API: ${ai.active_provider}`;
    if (modalBadge) modalBadge.textContent = ai.active_provider;
  } else {
    if (statusTxt) statusTxt.textContent = 'Smart Local';
    if (modalBadge) modalBadge.textContent = 'Smart Local';
  }

  const pwr = ov.power_settings || {};
  const hw = pwr.hardware || {};
  if (hw.os_label) {
    const shortEnc = (hw.best_encoder || 'cpu').replace('h264_', '').toUpperCase();
    const osShort = hw.is_mac ? (hw.is_apple_silicon ? 'macOS M-Series' : 'macOS') : 'Win';
    if ($('hwStatusText')) $('hwStatusText').textContent = `${osShort} · ${shortEnc} (${pwr.power_mode || 'auto'})`;
    if ($('hwOsBadge')) $('hwOsBadge').textContent = hw.os_label;
    if ($('hwCpuInfo')) $('hwCpuInfo').textContent = `${hw.cpu_name} (${hw.cpu_cores} luồng · ${hw.ram_gb} GB RAM)`;
    if ($('hwGpuInfo')) $('hwGpuInfo').textContent = `${(hw.gpus || []).join(' + ')} → ${hw.best_encoder_label}`;
    if ($('selPowerMode')) $('selPowerMode').value = pwr.power_mode || 'auto';
    if ($('inpLanUrl')) $('inpLanUrl').value = `http://${hw.lan_ip || '127.0.0.1'}:8000`;
    if ($('inpWebhookUrl')) $('inpWebhookUrl').value = pwr.remote_webhook_url || '';
    if ($('chkPreferNativeWindow')) $('chkPreferNativeWindow').checked = pwr.prefer_native_window !== false;
  }

  adaptHeaderOverflow();
}

/* ==================== MULTI-PROJECT WORKFLOW & CAPCUT HOME LAUNCHER ==================== */

function renderHomeProjectCards(filterText = '') {
  const grid = $('homeProjectsGrid');
  if (!grid) return;
  const q = String(filterText || '').trim().toLowerCase();
  const cards = (state.projectCards || []).filter((c) => !q || String(c.name || '').toLowerCase().includes(q));
  if ($('homeProjectsCount')) $('homeProjectsCount').textContent = String(cards.length);
  grid.innerHTML = '';

  cards.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'group cursor-pointer rounded-xl bg-[#13151A] hover:bg-[#191D24] border border-[#22252E] hover:border-cyan-400/60 p-2.5 flex flex-col gap-2 transition-all';
    const thumb = c.thumbnail_url || '/static/favicon.svg?v=4.0';
    const durMin = Math.floor(Number(c.duration_sec || 0) / 60);
    const durSec = Math.round(Number(c.duration_sec || 0) % 60);
    const durFormatted = `${String(durMin).padStart(2, '0')}:${String(durSec).padStart(2, '0')}`;
    const sizeText = `${Number(c.size_mb || 0).toFixed(1)} MB`;

    card.innerHTML = `
      <div class="w-full aspect-square rounded-lg overflow-hidden bg-[#0A0B0E] border border-[#1E2129] relative">
        <img src="${escHtml(thumb)}" alt="${escHtml(c.name)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
        <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-zinc-200">${escHtml(durFormatted)}</span>
      </div>
      <div class="px-0.5">
        <div class="text-xs font-semibold text-zinc-100 truncate">${escHtml(c.name)}</div>
        <div class="text-[11px] font-mono text-zinc-500 mt-0.5">${escHtml(sizeText)} | ${escHtml(durFormatted)}</div>
      </div>
    `;
    card.addEventListener('click', async () => {
      $('homeLauncherScreen')?.classList.add('hidden');
      if ($('projectSelect')) $('projectSelect').value = c.name;
      await loadProjectOverview(c.name, true);
    });
    grid.appendChild(card);
  });
}

function openHomeLauncher() {
  renderHomeProjectCards($('inpHomeSearchProject')?.value || '');
  $('homeLauncherScreen')?.classList.remove('hidden');
}

function closeHomeLauncher() {
  $('homeLauncherScreen')?.classList.add('hidden');
}

function toggleBottomAiChat(forceOpen = null) {
  const next = forceOpen !== null ? Boolean(forceOpen) : !state.bottomChatOpen;
  state.bottomChatOpen = next;
  if (next && state.tlCollapsed) {
    state.tlCollapsed = false;
    $('paneTimeline')?.classList.remove('tl-collapsed');
  }
  $('tlTracksWrap')?.classList.toggle('hidden', next);
  $('tlAiChatBar')?.classList.toggle('hidden', !next);
  $('btnQuickAiChat')?.classList.toggle('bg-cyan-400', next);
  $('btnQuickAiChat')?.classList.toggle('text-zinc-950', next);
  $('btnToggleBottomAiChat')?.classList.toggle('bg-cyan-400', next);
  $('btnToggleBottomAiChat')?.classList.toggle('text-zinc-950', next);
  if (next) {
    setTimeout(() => $('inpAiChatMessage')?.focus(), 50);
  }
}

async function loadProjects(selectName = null) {
  const data = await apiJson('/api/projects');
  const sel = $('projectSelect');
  sel.innerHTML = '';
  const list = data.projects || [];
  state.projectCards = Array.isArray(data.project_cards) ? data.project_cards : list.map((n) => ({ name: n, duration_sec: 0, size_mb: 0, thumbnail_url: '' }));
  renderHomeProjectCards();

  if (!list.length) {
    sel.innerHTML = '<option value="Demo">Demo</option>';
  } else {
    list.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
  }
  const target = selectName && list.includes(selectName) ? selectName : list.includes('Demo') ? 'Demo' : sel.options[0].value;
  sel.value = target;
  await loadProjectOverview(target, true);
}

async function loadProjectOverview(name, isSwitch = false) {
  if (isSwitch || state.project !== name) {
    resetClientProjectState();
  }
  state.project = name;
  const ov = await apiJson(`/api/projects/${encodeURIComponent(name)}/overview`);
  state.overview = ov;
  state.edlRows = (ov.edl_rows || []).map((r) => ({ ...r }));
  state.layers = ov.layers ? structuredClone(ov.layers) : null;
  state.props = ov.props ? structuredClone(ov.props) : null;
  ensureColorObject();

  computeKeptOffsets();
  await loadStyleRefs().catch(() => {});
  updateTopBadges();
  renderEdlList();
  renderAssetsAndPipeline();
  renderEffectsPool();
  renderTextPresetPool();
  renderColorAndLuts();
  renderPoolSubcategories();
  renderInspector();
  renderTimeline();
  configureStageMedia(true);
  applyLiveStageColorFilter();
  applyLiveStageTransform();
  renderLogsModalContent();
  renderAiChatHistory(ov.chat_history || []);
}

/* ==================== AI CHAT ASSISTANT (TRỢ LÝ AI) ==================== */

function renderAiChatHistory(history = []) {
  const wrap = $('aiChatMessages');
  if (!wrap) return;
  wrap.innerHTML = '';

  const intro = document.createElement('div');
  intro.className = 'p-2 rounded-md bg-[#14171E] border border-[#232731] text-zinc-300 text-xs leading-relaxed';
  intro.innerHTML = 'Nhập yêu cầu chỉnh sửa bằng tiếng Việt: <b>"Rút gọn còn 45s"</b>, <b>"Đảo cảnh số 3 lên đầu"</b>, <b>"Đổi tiêu đề Hook thành: MÁY ĐỌC SÁCH NHỎ NHẤT THẾ GIỚI"</b>, hoặc <b>"Lọc từ buôn bán giá cả"</b>.';
  wrap.appendChild(intro);

  (history || []).forEach((item) => {
    appendAiChatBubble(item.role, item.text || item.content || '', item.actions || [], false);
  });
  wrap.scrollTop = wrap.scrollHeight;
}

function appendAiChatBubble(role, content, actions = [], scroll = true) {
  const wrap = $('aiChatMessages');
  if (!wrap) return;
  const isUser = role === 'user';
  const msg = document.createElement('div');
  msg.className = isUser
    ? 'ml-8 p-2 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-zinc-100 text-xs leading-relaxed'
    : 'mr-4 p-2 rounded-md bg-[#161920] border border-[#262932] text-zinc-200 text-xs leading-relaxed space-y-1';

  let actionsHtml = '';
  if (!isUser && Array.isArray(actions) && actions.length) {
    actionsHtml = `<div class="flex flex-wrap gap-1 pt-0.5">${actions
      .map((a) => `<span class="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">${escHtml(a)}</span>`)
      .join('')}</div>`;
  }

  const formattedContent = escHtml(content)
    .replace(/\*\*(.+?)\*\*/g, '<b class="text-cyan-300">$1</b>')
    .replace(/\*(.+?)\*/g, '<em class="text-zinc-300">$1</em>');

  msg.innerHTML = `
    <div class="flex items-center justify-between text-[10px] font-mono ${isUser ? 'text-cyan-300' : 'text-zinc-400'}">
      <span>${isUser ? 'Bạn' : 'WishEdit AI'}</span>
    </div>
    <div class="whitespace-pre-wrap">${formattedContent}</div>
    ${actionsHtml}
  `;
  wrap.appendChild(msg);
  if (scroll) wrap.scrollTop = wrap.scrollHeight;
}

async function sendAiChatMessage(text) {
  const clean = String(text || '').trim();
  if (!clean || !state.project) return;
  const inp = $('inpAiChatMessage');
  const btn = $('btnSendAiChat');
  if (inp) inp.value = '';
  appendAiChatBubble('user', clean);

  if (btn) {
    btn.disabled = true;
    btn.textContent = '...';
  }
  try {
    await saveAllEdlAndLayers(true);
    const res = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: clean }),
    });
    appendAiChatBubble('assistant', res.reply || 'Đã cập nhật timeline theo yêu cầu.', res.actions || []);
    toast('Trợ lý AI đã cập nhật dự án!', 'success');
    await loadProjectOverview(state.project, false);
  } catch (err) {
    appendAiChatBubble('assistant', `⚠️ Lỗi xử lý: ${err.message}`);
    toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Gửi';
    }
  }
}

/* ==================== STYLE REF VIDEO POOL (_style_refs/) ==================== */

async function loadStyleRefs() {
  const data = await apiJson('/api/style-refs');
  state.styleRefs = {
    dir: data.dir || 'StyleRefs',
    videos: Array.isArray(data.videos) ? data.videos : [],
    metrics: Array.isArray(data.metrics) ? data.metrics : [],
    style_md: typeof data.style_md === 'string' ? data.style_md : '',
  };
  renderPoolSubcategories();
  renderStyleRefsPool();
}

function renderStyleRefsPool() {
  const listEl = $('styleRefsList');
  const sr = state.styleRefs || { videos: [], style_md: '' };
  const videos = sr.videos || [];

  if (listEl) {
    listEl.innerHTML = '';
    if (!videos.length) {
      listEl.appendChild(
        makeEmptyDropBox(
          'Chưa có video mẫu trong StyleRefs',
          'Nạp 3–5 clip tham khảo (.MP4, .MOV) rồi bấm Phân tích để học nhịp & phong cách',
          'inputUploadStyleRef'
        )
      );
    } else {
      videos.forEach((v) => {
        const fn = v.name || '';
        const thumbUrl = `/api/style-refs/thumbnail?filename=${encodeURIComponent(fn)}`;
        const durTxt = v.duration_sec != null ? `${Number(v.duration_sec).toFixed(1)}s` : '';
        const resTxt = v.resolution || '';
        const metricsParts = [];
        if (v.avg_shot_sec != null) metricsParts.push(`Shot ${v.avg_shot_sec}s`);
        if (v.words_per_minute != null) metricsParts.push(`${v.words_per_minute} WPM`);
        if (v.scene_cuts_count != null) metricsParts.push(`${v.scene_cuts_count} cuts`);
        const subMeta = metricsParts.length
          ? metricsParts.join(' · ')
          : `${[resTxt, durTxt, v.size_mb != null ? `${v.size_mb}MB` : ''].filter(Boolean).join(' · ') || 'Chưa phân tích'}`;

        const card = document.createElement('div');
        card.className = 'asset-tile p-2 flex items-center gap-2.5 text-xs';
        card.innerHTML = `
          <div class="w-12 h-16 rounded overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 relative">
            <img src="${thumbUrl}" alt="${escHtml(fn)}" loading="lazy" class="w-full h-full object-cover" />
            <span class="absolute top-0.5 left-0.5 px-1 rounded bg-zinc-950/85 text-cyan-300 font-mono text-[8px] font-bold">${escHtml(getExtBadge(fn))}</span>
          </div>
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="font-medium text-zinc-100 truncate text-[11px]" title="${escHtml(fn)}">${escHtml(fn)}</div>
            <div class="text-[10px] text-zinc-400 font-mono truncate">${escHtml([resTxt, durTxt].filter(Boolean).join(' · ') || 'Video mẫu')}</div>
            <div class="text-[10px] ${metricsParts.length ? 'text-cyan-400' : 'text-zinc-400'} font-mono truncate">${escHtml(subMeta)}</div>
          </div>
          <button type="button" data-del-style-ref="${escHtml(fn)}" title="Xóa video mẫu này" class="w-6 h-6 rounded border border-zinc-700 hover:border-rose-500/60 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-300 flex items-center justify-center shrink-0 text-[11px]">✕</button>
        `;
        card.querySelector('[data-del-style-ref]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteStyleRef(fn);
        });
        listEl.appendChild(card);
      });
    }
  }

  const txtEl = $('txtStyleMdPreview');
  if (txtEl && document.activeElement !== txtEl) {
    txtEl.value = sr.style_md || '';
  }
}

async function deleteStyleRef(filename) {
  if (!filename) return;
  try {
    await apiJson(`/api/style-refs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    toast(`Đã xóa Style Ref: ${filename}`);
    await loadStyleRefs();
  } catch (err) {
    toast(`Lỗi xóa Style Ref: ${err.message}`, 'error');
  }
}

async function uploadStyleRefFiles(fileList, inputEl = null) {
  const files = Array.from(fileList || []);
  for (const f of files) {
    try {
      const fd = new FormData();
      fd.append('file', f);
      toast(`Đang nạp Style Ref: ${f.name}...`);
      await apiJson('/api/style-refs/upload', { method: 'POST', body: fd });
      toast(`Đã nạp Style Ref: ${f.name}`, 'success');
    } catch (err) {
      toast(`Lỗi nạp ${f.name}: ${err.message}`, 'error');
    }
  }
  if (inputEl) inputEl.value = '';
  await loadStyleRefs().catch(() => {});
}

/* ==================== MEDIA POOL ASSETS RENDERERS (PURE ASSETS ONLY) ==================== */

let _audioPreviewEl = null;
window.previewPoolAudio = function (kind, filename) {
  if (!_audioPreviewEl) {
    _audioPreviewEl = new Audio();
  }
  const url = `/api/projects/${encodeURIComponent(state.project)}/media/audio/${encodeURIComponent(kind)}/${encodeURIComponent(filename)}`;
  if (_audioPreviewEl.src.endsWith(url) && !_audioPreviewEl.paused) {
    _audioPreviewEl.pause();
    toast(`Đã dừng nghe thử: ${filename}`);
    return;
  }
  _audioPreviewEl.src = url;
  _audioPreviewEl.volume = 0.85;
  _audioPreviewEl.play().catch(() => {});
  toast(`Đang phát thử âm thanh: ${filename}`);
};

window.playRawFile = function (filename) {
  state.stageMode = 'source';
  state.overlaysEnabled = true;
  const player = $('previewPlayer');
  const ph = $('stagePlaceholder');
  const url = `/api/projects/${encodeURIComponent(state.project)}/media/raw/${encodeURIComponent(filename)}`;
  if ($('stageSourceInfo')) $('stageSourceInfo').textContent = filename;
  if (player) {
    ph?.classList.add('hidden');
    player.classList.remove('hidden');
    state.activeVideoUrl = url;
    player.src = url;
    player.load();
    seekAndPlay(player, 0, true);
  }
};

window.playBrollFile = function (filename) {
  if (!isVideoFilename(filename)) {
    insertAssetAtSec({ kind: 'broll', filename }, state.timelineSec);
    return;
  }
  state.stageMode = 'source';
  state.overlaysEnabled = false;
  const player = $('previewPlayer');
  const ph = $('stagePlaceholder');
  const url = `/api/projects/${encodeURIComponent(state.project)}/media/broll/${encodeURIComponent(filename)}`;
  if ($('stageSourceInfo')) $('stageSourceInfo').textContent = `B-Roll: ${filename}`;
  if (player) {
    ph?.classList.add('hidden');
    player.classList.remove('hidden');
    state.activeVideoUrl = url;
    player.src = url;
    player.load();
    seekAndPlay(player, 0, true);
  }
};

function makeEmptyDropBox(title, hint, inputId) {
  const box = document.createElement('div');
  box.className = 'col-span-full p-4 rounded-lg border border-dashed border-zinc-700 bg-[#18181E]/60 hover:border-cyan-500/60 text-center space-y-1.5 cursor-pointer transition-colors';
  box.innerHTML = `
    <svg class="w-6 h-6 text-cyan-400 mx-auto opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    <div class="text-xs font-semibold text-zinc-200">${escHtml(title)}</div>
    <div class="text-[10px] text-zinc-400">${escHtml(hint)}</div>
  `;
  if (inputId) {
    box.addEventListener('click', () => $(inputId)?.click());
  }
  return box;
}

function makeVisualAssetCard({ filename, badge, extBadge, thumbUrl, previewUrl, isVideo = false, dragPayload, onPreview, onInsert }) {
  const div = document.createElement('div');
  div.className = 'asset-tile p-1.5 flex flex-col justify-between gap-1.5 overflow-hidden group cursor-pointer';
  div.draggable = true;
  div.innerHTML = `
    <div class="pool-thumb-wrap w-full aspect-[4/3] rounded-md overflow-hidden bg-zinc-950 border border-zinc-800 relative">
      <img src="${thumbUrl}" alt="${escHtml(filename)}" loading="lazy" draggable="false" class="w-full h-full object-cover pointer-events-none select-none" />
      <span class="absolute top-1 left-1 px-1 py-0.5 rounded bg-zinc-950/85 text-cyan-300 border border-cyan-500/30 font-mono text-[9px] font-bold">${escHtml(extBadge)}</span>
      ${badge ? `<span class="absolute top-1 right-1 px-1 py-0.5 rounded bg-zinc-950/85 text-zinc-200 border border-zinc-700 font-mono text-[9px]">${escHtml(badge)}</span>` : ''}
      <button type="button" data-act="insert" title="Chèn tại vị trí Playhead" class="absolute bottom-1 right-1 h-5 px-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-[10px] shadow opacity-90 group-hover:opacity-100 transition-opacity">+</button>
    </div>
    <div class="px-0.5 flex items-center justify-between gap-1">
      <div class="text-[11px] font-medium text-zinc-200 truncate" title="${escHtml(filename)}">${escHtml(filename)}</div>
    </div>
  `;
  if (isVideo && previewUrl) {
    let hoverVid = null;
    const wrap = div.querySelector('.pool-thumb-wrap');
    div.addEventListener('mouseenter', () => {
      if (hoverVid || !wrap) return;
      hoverVid = document.createElement('video');
      hoverVid.src = previewUrl;
      hoverVid.muted = true;
      hoverVid.loop = true;
      hoverVid.playsInline = true;
      hoverVid.className = 'absolute inset-0 w-full h-full object-cover pointer-events-none';
      wrap.insertBefore(hoverVid, wrap.firstChild.nextSibling);
      hoverVid.play().catch(() => {});
    });
    div.addEventListener('mouseleave', () => {
      if (hoverVid) {
        hoverVid.pause();
        hoverVid.removeAttribute('src');
        hoverVid.remove();
        hoverVid = null;
      }
    });
  }
  div.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
  });
  div.querySelector('[data-act="insert"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    onInsert?.();
  });
  div.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    onPreview?.();
  });
  return div;
}

function makePoolDraggableTile({ title, sub, badge, isAudio = false, audioKind = 'music', dragPayload, onClick, actionHtml = '' }) {
  const div = document.createElement('div');
  div.className = 'asset-tile p-2 flex items-center justify-between gap-2 text-xs cursor-pointer';
  div.draggable = true;

  const audioBtn = isAudio
    ? `<button type="button" onclick="previewPoolAudio('${escHtml(audioKind)}', '${escHtml(title)}')" title="Bấm nghe thử" class="w-8 h-8 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 font-bold text-xs">▶</button>`
    : '';

  div.innerHTML = `
    <div class="flex items-center gap-2 min-w-0 flex-1">
      ${audioBtn}
      <div class="min-w-0 flex-1">
        <div class="font-medium text-zinc-100 truncate text-[11px]" title="${escHtml(title)}">${escHtml(title)}</div>
        <div class="text-[10px] text-zinc-400 font-mono truncate">${escHtml(sub || '')}</div>
      </div>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      ${badge ? `<span class="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-400 font-mono text-[9px] border border-zinc-700">${escHtml(badge)}</span>` : ''}
      ${actionHtml}
    </div>
  `;
  div.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
  });
  if (onClick) {
    div.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return;
      onClick();
    });
  }
  return div;
}

function renderAssetsAndPipeline() {
  const ov = state.overview || {};
  const projFolder = ov.project_dir || `Projects/${state.project}`;

  // 1. Media Raw (Grid of pure visual cards)
  const raw = ov.raw_files || [];
  const rawWrap = $('rawFilesList');
  if (rawWrap) {
    rawWrap.innerHTML = '';
    if (!raw.length) {
      rawWrap.appendChild(
        makeEmptyDropBox(
          'Chưa có clip gốc trong 01_raw/',
          'Kéo thả file .MOV, .MP4, .MKV vào đây hoặc bấm + Nhập Clip',
          'inputUploadRaw'
        )
      );
    } else {
      raw.forEach((fn) => {
        const thumbUrl = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=raw&filename=${encodeURIComponent(fn)}`;
        const previewUrl = `/api/projects/${encodeURIComponent(state.project)}/media/raw/${encodeURIComponent(fn)}`;
        rawWrap.appendChild(
          makeVisualAssetCard({
            filename: fn,
            badge: 'RAW',
            extBadge: getExtBadge(fn),
            thumbUrl,
            previewUrl,
            isVideo: true,
            dragPayload: { kind: 'raw', filename: fn },
            onPreview: () => window.playRawFile(fn),
            onInsert: () => insertAssetAtSec({ kind: 'raw', filename: fn }, state.timelineSec),
          })
        );
      });
    }
  }

  // 2. B-Roll Pool (Grid of pure visual cards — supports .mov, .mp4, .png, .jpg)
  const brolls = ov.assets?.broll || [];
  const brollWrap = $('brollAssetsList');
  if (brollWrap) {
    brollWrap.innerHTML = '';
    if (!brolls.length) {
      brollWrap.appendChild(
        makeEmptyDropBox(
          'Kho B-Roll đang trống',
          'Hỗ trợ .MOV, .MP4, .PNG, .JPG · Hoặc bật AI Auto B-Roll',
          'inputUploadBroll'
        )
      );
    } else {
      brolls.forEach((fn) => {
        const thumbUrl = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=broll&filename=${encodeURIComponent(fn)}`;
        const isVid = isVideoFilename(fn);
        const previewUrl = isVid ? `/api/projects/${encodeURIComponent(state.project)}/media/broll/${encodeURIComponent(fn)}` : '';
        brollWrap.appendChild(
          makeVisualAssetCard({
            filename: fn,
            badge: isVid ? 'VIDEO' : 'IMG',
            extBadge: getExtBadge(fn),
            thumbUrl,
            previewUrl,
            isVideo: isVid,
            dragPayload: { kind: 'broll', filename: fn },
            onPreview: () => window.playBrollFile(fn),
            onInsert: () => {
              insertAssetAtSec({ kind: 'broll', filename: fn }, state.timelineSec);
              openAdjustmentPanel('cards');
            },
          })
        );
      });
    }
  }

  // 3. Outputs List
  const outs = ov.outputs || [];
  const outWrap = $('outputsList');
  if (outWrap) {
    if (!outs.length) {
      outWrap.innerHTML = `<div class="p-3 rounded-lg border border-[#26262F] bg-[#18181E] text-zinc-400 text-[11px]">Chưa có video render trong <code>${escHtml(projFolder)}/05_output/</code>.</div>`;
    } else {
      outWrap.innerHTML = outs
        .slice()
        .reverse()
        .map((fn) => {
          const thumbUrl = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=output&filename=${encodeURIComponent(fn)}`;
          return `
        <div class="flex items-center justify-between p-2 rounded-lg border border-[#26262F] bg-[#18181E] gap-2">
          <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onclick="playOutputFile('${escHtml(fn)}')">
            <div class="w-9 h-12 rounded overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
              <img src="${thumbUrl}" alt="${escHtml(fn)}" loading="lazy" class="w-full h-full object-cover" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-mono text-[11px] font-semibold text-zinc-100 truncate">${escHtml(fn)}</div>
              <div class="text-[10px] text-emerald-400 font-mono">1080x1920 · 30fps</div>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="playOutputFile('${escHtml(fn)}')" class="px-2 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-[10px] font-bold">Phát</button>
            <a href="/api/projects/${encodeURIComponent(state.project)}/media/output/${encodeURIComponent(fn)}" download="${escHtml(fn)}" class="px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[10px] font-medium hover:bg-zinc-800">Tải</a>
          </div>
        </div>`;
        })
        .join('');
    }
  }

  // 4. Audio Pool (Music, SFX, Voice AI — pure asset rows)
  const musics = ov.assets?.music || [];
  const musicWrap = $('musicAssetsList');
  if (musicWrap) {
    musicWrap.innerHTML = '';
    if (!musics.length) {
      musicWrap.appendChild(makeEmptyDropBox('Chưa có nhạc nền', 'Kéo thả MP3/WAV/M4A hoặc bấm + Nhập Nhạc', 'inputUploadMusic'));
    } else {
      musics.forEach((fn) => {
        const isCurrent = state.layers?.audio?.musicFile === fn;
        const tile = makePoolDraggableTile({
          title: fn,
          sub: isCurrent ? 'Đang làm nhạc nền' : 'Nhấp chọn hoặc kéo vào Timeline',
          badge: isCurrent ? 'ACTIVE' : 'BGM',
          isAudio: true,
          audioKind: 'music',
          dragPayload: { kind: 'music', filename: fn },
          onClick: () => {
            if (!state.layers) return;
            state.layers.audio = state.layers.audio || {};
            state.layers.audio.musicFile = fn;
            renderInspector();
            renderAssetsAndPipeline();
            renderTimeline();
            toast(`Đã chọn nhạc nền: ${fn}`, 'success');
          },
        });
        musicWrap.appendChild(tile);
      });
    }
  }

  const allSfx = ov.assets?.sfx || [];
  const pureSfxs = allSfx.filter((fn) => !fn.startsWith('vo_'));
  const sfxWrap = $('sfxAssetsList');
  if (sfxWrap) {
    sfxWrap.innerHTML = '';
    if (!pureSfxs.length) {
      sfxWrap.appendChild(makeEmptyDropBox('Chưa có Sound FX', 'Bấm + Nhập SFX để tải hiệu ứng âm thanh', 'inputUploadSfx'));
    } else {
      pureSfxs.slice(0, 30).forEach((fn) => {
        const tile = makePoolDraggableTile({
          title: fn,
          sub: 'Bấm ▶ nghe · Kéo hoặc bấm + để chèn',
          badge: 'SFX',
          isAudio: true,
          audioKind: 'sfx',
          dragPayload: { kind: 'sfx', filename: fn },
          actionHtml: `<button type="button" data-add-sfx="${escHtml(fn)}" class="px-1.5 py-0.5 rounded bg-cyan-500 text-zinc-950 font-bold text-[10px]">+</button>`,
        });
        tile.querySelector('[data-add-sfx]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          insertAssetAtSec({ kind: 'sfx', filename: fn }, state.timelineSec);
        });
        sfxWrap.appendChild(tile);
      });
    }
  }

  const voiceFiles = allSfx.filter((fn) => fn.startsWith('vo_'));
  const voiceWrap = $('voiceAssetsList');
  if (voiceWrap) {
    voiceWrap.innerHTML = '';
    const genBtnCard = document.createElement('div');
    genBtnCard.className = 'p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-between gap-2 cursor-pointer hover:bg-cyan-500/15';
    genBtnCard.innerHTML = `
      <div class="min-w-0">
        <div class="text-xs font-bold text-cyan-300">+ Tạo Voice AI mới (TTS)</div>
        <div class="text-[10px] text-zinc-400">Mở công cụ nhập văn bản &amp; trích mẫu giọng bên phải</div>
      </div>
      <span class="text-cyan-300 font-bold text-xs shrink-0">→</span>
    `;
    genBtnCard.addEventListener('click', () => openAdjustmentPanel('audio'));
    voiceWrap.appendChild(genBtnCard);

    if (voiceFiles.length) {
      voiceFiles.forEach((fn) => {
        const tile = makePoolDraggableTile({
          title: fn,
          sub: 'Voiceover AI đã tạo · Kéo vào Timeline',
          badge: 'VO',
          isAudio: true,
          audioKind: 'sfx',
          dragPayload: { kind: 'sfx', filename: fn },
          actionHtml: `<button type="button" data-add-vo="${escHtml(fn)}" class="px-1.5 py-0.5 rounded bg-cyan-500 text-zinc-950 font-bold text-[10px]">+</button>`,
        });
        tile.querySelector('[data-add-vo]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          insertAssetAtSec({ kind: 'sfx', filename: fn }, state.timelineSec);
        });
        voiceWrap.appendChild(tile);
      });
    }
  }

  // Brief & Source Gaps
  if ($('txtProjectBrief')) $('txtProjectBrief').value = ov.brief?.text || '';
  const gaps = ov.gaps_report || {};
  const covEl = $('briefCoverageBadge');
  if (covEl) {
    if (gaps.brief_coverage_pct != null) {
      covEl.textContent = `Đạt ${gaps.brief_covered_count}/${gaps.brief_outline_count} ý (${gaps.brief_coverage_pct}%)`;
    } else {
      covEl.textContent = 'Chưa có Brief';
    }
  }
  const gapList = gaps.gaps || [];
  if ($('gapsCountBadge')) $('gapsCountBadge').textContent = `${gapList.length}`;
  const gWrap = $('gapsSuggestionsList');
  if (gWrap) {
    if (!gapList.length) {
      gWrap.innerHTML = '<div class="text-[11px] text-emerald-400 font-medium">Mạch nội dung &amp; nguồn minh họa đang đầy đủ!</div>';
    } else {
      gWrap.innerHTML = gapList
        .map((g) => {
          const tagCls =
            g.severity === 'high'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : g.severity === 'medium'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-zinc-800 text-zinc-300';
          const seekAttr = g.timeline_sec != null ? `onclick="scrubToSeconds(${Number(g.timeline_sec)}, true)"` : '';
          return `
          <div class="p-2 rounded border border-[#26262F] bg-[#141419] space-y-1">
            <div class="flex items-center justify-between gap-1.5">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${tagCls}">${escHtml(g.gap_type)}</span>
              ${g.timeline_sec != null ? `<button ${seekAttr} class="text-[10px] font-mono text-cyan-400 hover:underline">@ ${Number(g.timeline_sec).toFixed(1)}s</button>` : ''}
            </div>
            <div class="text-[11px] font-semibold text-zinc-100">${escHtml(g.title)}</div>
            <div class="text-[11px] text-zinc-400 leading-snug">${escHtml(g.suggestion)}</div>
          </div>`;
        })
        .join('');
    }
  }
}

function renderTextPresetPool() {
  // 1. Hook & Sub presets
  const hsGrid = $('textHookSubPresetsGrid');
  if (hsGrid && !hsGrid.children.length) {
    const presets = [
      { id: 'hook_editorial', name: 'Hook Editorial', tag: 'HOOK', desc: 'Chữ lớn + pill trên, không khung hộp', onPick: () => {
        if (!state.layers) return;
        state.layers.hook = { ...(state.layers.hook || {}), enabled: true };
        state.layers.style = { ...(state.layers.style || {}), stylePreset: 'editorial' };
        renderInspector(); updateLiveOverlays(); openAdjustmentPanel('hook');
        toast('Đã áp dụng Hook Editorial — chỉnh chữ bên phải');
      }},
      { id: 'hook_boxed', name: 'Hook Boxed Nền Tối', tag: 'HOOK', desc: 'Đóng khung tối nổi bật giữa nền sáng', onPick: () => {
        if (!state.layers) return;
        state.layers.hook = { ...(state.layers.hook || {}), enabled: true };
        state.layers.style = { ...(state.layers.style || {}), stylePreset: 'boxed' };
        renderInspector(); updateLiveOverlays(); openAdjustmentPanel('hook');
        toast('Đã áp dụng Hook Boxed — chỉnh chữ bên phải');
      }},
      { id: 'sub_cyan', name: 'Sub Từ khóa Xanh', tag: 'SUB', desc: 'Chữ trắng + nhấn từ khóa Cyan #38BDF8', onPick: () => {
        if (!state.layers) return;
        state.layers.style = { ...(state.layers.style || {}), accentColor: '#38BDF8', numberColor: '#FACC15' };
        renderInspector(); updateLiveOverlays(); openAdjustmentPanel('sub');
        toast('Đã chọn style Phụ đề Cyan');
      }},
      { id: 'sub_gold', name: 'Sub Số liệu Vàng', tag: 'SUB', desc: 'Nhấn mạnh con số & CTA vàng rực', onPick: () => {
        if (!state.layers) return;
        state.layers.style = { ...(state.layers.style || {}), accentColor: '#FACC15', numberColor: '#22D3EE' };
        renderInspector(); updateLiveOverlays(); openAdjustmentPanel('sub');
        toast('Đã chọn style Phụ đề Vàng');
      }},
    ];
    presets.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'asset-tile p-2 space-y-1 cursor-pointer';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <span class="text-[11px] font-bold text-zinc-100 truncate">${escHtml(p.name)}</span>
          <span class="text-[8px] font-mono px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300 shrink-0">${p.tag}</span>
        </div>
        <p class="text-[10px] text-zinc-400 leading-snug">${escHtml(p.desc)}</p>
      `;
      card.addEventListener('click', p.onPick);
      hsGrid.appendChild(card);
    });
  }

  // 2. Cards & Dark Scenes templates
  const cardsGrid = $('textCardsPresetsGrid');
  if (cardsGrid && !cardsGrid.children.length) {
    const items = [
      { kind: 'infocard', icon: 'bolt', label: 'Điểm cần nhớ', detail: 'Nhấn ý quan trọng', tag: 'CARD' },
      { kind: 'infocard', icon: 'check', label: 'Bước thực chiến', detail: 'Checklist từng bước', tag: 'CARD' },
      { kind: 'infocard', icon: 'alert', label: 'Lưu ý tránh lỗi', detail: 'Cảnh báo chính sách', tag: 'ALERT' },
      { kind: 'infocard', icon: 'chart', label: 'Tăng chuyển đổi', detail: 'Số liệu / ROI', tag: 'STAT' },
      { kind: 'darkscene', title: 'TÓM TẮT 2 Ý CHÍNH', metric: 'ĐIỂM CHÍNH', bullets: ['Bước 1: Chuẩn hóa nội dung', 'Bước 2: Tối ưu Hook 3 giây'], tag: 'FROST' },
    ];
    items.forEach((it) => {
      const card = document.createElement('div');
      card.className = 'asset-tile p-2 space-y-1 cursor-pointer';
      card.draggable = true;
      const title = it.kind === 'darkscene' ? it.title : it.label;
      const desc = it.kind === 'darkscene' ? 'Cảnh nền kính mờ tóm tắt checklist' : it.detail;
      card.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <span class="text-[11px] font-bold text-zinc-100 truncate">${escHtml(title)}</span>
          <span class="text-[8px] font-mono px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 shrink-0">${it.tag}</span>
        </div>
        <p class="text-[10px] text-zinc-400 leading-snug">${escHtml(desc)}</p>
      `;
      const payload = { kind: it.kind === 'darkscene' ? 'preset_darkscene' : 'preset_infocard', template: it };
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', JSON.stringify(payload)));
      card.addEventListener('click', () => {
        insertAssetAtSec(payload, state.timelineSec);
        openAdjustmentPanel('cards');
      });
      cardsGrid.appendChild(card);
    });
  }

  // 3. Logo Badge templates
  const logosGrid = $('textLogosPresetsGrid');
  if (logosGrid && !logosGrid.children.length) {
    const logos = [
      { brand: 'tiktokshop', label: 'TikTok Shop', position: 'top_right' },
      { brand: 'tiktok', label: 'TikTok', position: 'top_right' },
      { brand: 'chatgpt', label: 'ChatGPT', position: 'top_left' },
      { brand: 'gemini', label: 'Gemini AI', position: 'top_left' },
    ];
    logos.forEach((lg) => {
      const card = document.createElement('div');
      card.className = 'asset-tile p-2 space-y-1 cursor-pointer';
      card.draggable = true;
      card.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <span class="text-[11px] font-bold text-zinc-100 truncate">${escHtml(lg.label)}</span>
          <span class="text-[8px] font-mono px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 shrink-0">LOGO</span>
        </div>
        <p class="text-[10px] text-zinc-400 font-mono">${lg.position}</p>
      `;
      const payload = { kind: 'preset_logo', template: lg };
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', JSON.stringify(payload)));
      card.addEventListener('click', () => {
        insertAssetAtSec(payload, state.timelineSec);
        openAdjustmentPanel('cards');
      });
      logosGrid.appendChild(card);
    });
  }
}

function renderEffectsPool() {
  const trGrid = $('effectsTransitionGrid');
  if (trGrid && !trGrid.children.length) {
    const transitions = [
      { id: 'zoom_pop', name: 'Zoom Pop Punch', desc: 'Phóng nhẹ + Pop tại điểm cắt' },
      { id: 'whip_left', name: 'Whip Pan Left', desc: 'Lướt nhanh sang trái kèm Whoosh' },
      { id: 'whip_right', name: 'Whip Pan Right', desc: 'Lướt nhanh sang phải kèm Whoosh' },
      { id: 'flash', name: 'Soft Flash Cut', desc: 'Chớp sáng mảnh chuyển ý' },
    ];
    transitions.forEach((tr) => {
      const card = document.createElement('div');
      card.className = 'asset-tile p-2 space-y-1 cursor-pointer';
      card.draggable = true;
      card.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <span class="text-[11px] font-bold text-zinc-100 truncate">${escHtml(tr.name)}</span>
          <span class="text-[8px] font-mono px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300 shrink-0">FX</span>
        </div>
        <p class="text-[10px] text-zinc-400 leading-snug">${escHtml(tr.desc)}</p>
      `;
      const payload = { kind: 'transition', effectType: tr.id, name: tr.name };
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', JSON.stringify(payload)));
      card.addEventListener('click', () => insertAssetAtSec(payload, state.timelineSec));
      trGrid.appendChild(card);
    });
  }

  const zmGrid = $('effectsZoomGrid');
  if (zmGrid && !zmGrid.children.length) {
    const zooms = [
      { id: 'punch_in', name: 'Punch-In 1.14x', fromScale: 1.0, toScale: 1.14, desc: 'Zoom cận nhấn mạnh câu chốt' },
      { id: 'slow_push', name: 'Slow Push 1.08x', fromScale: 1.0, toScale: 1.08, desc: 'Đẩy máy từ từ giữ nhịp xem' },
      { id: 'pull_out', name: 'Pull-Out 1.10x → 1.0x', fromScale: 1.1, toScale: 1.0, desc: 'Mở rộng khung hình chuyển đoạn' },
      { id: 'center_hold', name: 'Tight Hold 1.12x', fromScale: 1.12, toScale: 1.12, desc: 'Giữ khung cận mặt' },
    ];
    zooms.forEach((zm) => {
      const card = document.createElement('div');
      card.className = 'asset-tile p-2 space-y-1 cursor-pointer';
      card.draggable = true;
      card.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <span class="text-[11px] font-bold text-zinc-100 truncate">${escHtml(zm.name)}</span>
          <span class="text-[8px] font-mono px-1 py-0.5 rounded bg-indigo-500/15 text-indigo-300 shrink-0">ZOOM</span>
        </div>
        <p class="text-[10px] text-zinc-400 leading-snug">${escHtml(zm.desc)}</p>
      `;
      const payload = { kind: 'zoom', zoomPreset: zm };
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', JSON.stringify(payload)));
      card.addEventListener('click', () => insertAssetAtSec(payload, state.timelineSec));
      zmGrid.appendChild(card);
    });
  }
}

/* ==================== SMART COLOR GRADING & 10 LUTs (Assets on Left, Sliders on Right) ==================== */

function renderColorAndLuts() {
  const c = ensureColorObject();
  if (!c) return;
  const analysis = state.overview?.color_analysis || {};
  const m = analysis.metrics || {};

  if ($('colorTelemetryText')) {
    if (m.lighting_tag) {
      $('colorTelemetryText').textContent = `Luma ${(m.mean_luma ?? 126).toFixed(0)} · Contrast ${(m.contrast_std ?? 48).toFixed(0)} (${m.lighting_tag}, ${m.temp_tag})`;
    } else {
      $('colorTelemetryText').textContent = 'Chuẩn studio (Cached)';
    }
  }

  // Right Inspector Controls
  const btnAuto = $('btnToggleAutoColor');
  if (btnAuto) {
    if (c.autoColorEnabled) {
      btnAuto.textContent = 'Đang BẬT Auto Color';
      btnAuto.className = 'h-7 px-3 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors shrink-0';
    } else {
      btnAuto.textContent = 'Bật Auto Color';
      btnAuto.className = 'h-7 px-3 rounded-md bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold transition-colors shrink-0';
    }
  }
  if ($('inpAutoColorIntensity')) $('inpAutoColorIntensity').value = c.autoColorIntensity ?? 80;
  if ($('valAutoColorIntensity')) $('valAutoColorIntensity').textContent = `${c.autoColorIntensity ?? 80}%`;
  if ($('chkAdjustmentLayer')) $('chkAdjustmentLayer').checked = c.adjustmentLayerEnabled !== false;

  if ($('inpColorBright')) $('inpColorBright').value = c.brightness ?? 0;
  if ($('valColorBright')) $('valColorBright').textContent = Number(c.brightness ?? 0).toFixed(2);
  if ($('inpColorContrast')) $('inpColorContrast').value = c.contrast ?? 1.0;
  if ($('valColorContrast')) $('valColorContrast').textContent = Number(c.contrast ?? 1.0).toFixed(2);
  if ($('inpColorSat')) $('inpColorSat').value = c.saturation ?? 1.0;
  if ($('valColorSat')) $('valColorSat').textContent = Number(c.saturation ?? 1.0).toFixed(2);
  if ($('activeLutBadge')) $('activeLutBadge').textContent = c.lutId && c.lutId !== 'none' ? c.lutId : 'Mặc định (None)';

  // Left Media Pool: PURE LUT ASSETS ONLY
  const allLuts = analysis.all_10_luts || [];
  const customFiles = state.overview?.assets?.luts || [];
  const customItems = customFiles
    .filter((fn) => !allLuts.some((l) => `${l.id}.cube` === fn))
    .map((fn, idx) => ({
      id: fn,
      name: `Custom: ${fn}`,
      category: 'Imported LUT',
      preview_gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #1e293b 100%)',
      description: 'File LUT (.cube/.3dl) nhập từ bên ngoài',
      match_score: 95 - idx,
      rank: idx + 1,
    }));

  let visibleLuts;
  if (state.poolX === 'color' && state.poolY === 'lut_custom') {
    visibleLuts = customItems;
  } else if (state.poolX === 'color' && state.poolY === 'lut_all') {
    visibleLuts = [...customItems, ...allLuts];
  } else {
    visibleLuts = [...customItems, ...allLuts].slice(0, 3);
  }

  const listWrap = $('smartLutsList');
  if (listWrap) {
    listWrap.innerHTML = '';

    if (state.poolY !== 'lut_custom') {
      const noneRow = document.createElement('div');
      noneRow.className = `lut-card p-2 flex items-center justify-between gap-2 ${!c.lutId || c.lutId === 'none' ? 'active' : ''}`;
      noneRow.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-400 shrink-0">RAW</div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-zinc-200 truncate">Màu gốc (Không LUT)</div>
            <div class="text-[10px] text-zinc-500 truncate">Giữ nguyên màu máy quay</div>
          </div>
        </div>
        <span class="text-[10px] font-mono text-zinc-400 shrink-0">0%</span>
      `;
      noneRow.addEventListener('click', () => {
        pushUndoState('select_lut_none');
        c.lutId = 'none';
        renderColorAndLuts();
        renderTimeline();
        applyLiveStageColorFilter();
      });
      listWrap.appendChild(noneRow);
    }

    if (!visibleLuts.length && state.poolY === 'lut_custom') {
      listWrap.appendChild(
        makeEmptyDropBox('Chưa có LUT ngoài', 'Bấm + Import LUT để thêm file .cube hoặc .3dl', 'inputUploadLut')
      );
      return;
    }

    visibleLuts.forEach((lut) => {
      const isSelected = c.lutId === lut.id;
      const card = document.createElement('div');
      card.className = `lut-card p-2 flex items-center justify-between gap-2 ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-md shrink-0 border border-white/15 shadow-inner" style="background: ${lut.preview_gradient || 'linear-gradient(135deg,#0ea5e9,#1e293b)'}"></div>
          <div class="min-w-0">
            <div class="flex items-center gap-1">
              <span class="text-xs font-bold text-zinc-100 truncate">${escHtml(lut.name)}</span>
              ${lut.rank <= 3 ? `<span class="px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[8px] font-bold shrink-0">TOP ${lut.rank}</span>` : ''}
            </div>
            <div class="text-[10px] text-zinc-400 truncate">${escHtml(lut.description || lut.category)}</div>
          </div>
        </div>
        <span class="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-emerald-400 shrink-0">${lut.match_score || 90}%</span>
      `;
      card.addEventListener('click', () => {
        pushUndoState(`select_lut_${lut.id}`);
        c.lutId = lut.id;
        renderColorAndLuts();
        renderTimeline();
        applyLiveStageColorFilter();
        toast(`Đã áp dụng LUT: ${lut.name}`, 'success');
      });
      listWrap.appendChild(card);
    });
  }
}

function applyLiveStageColorFilter() {
  const player = $('previewPlayer');
  if (!player) return;
  if (state.stageMode === 'output') {
    player.style.filter = 'none';
    return;
  }
  const c = ensureColorObject();
  if (!c) {
    player.style.filter = 'none';
    return;
  }

  const analysis = state.overview?.color_analysis || {};
  const rec = analysis.recommended_auto_color || {};
  const autoScale = c.autoColorEnabled ? Number(c.autoColorIntensity ?? 80) / 100.0 : 0.0;

  const br = 1.0 + Number(c.brightness || 0) + Number(rec.brightness || 0) * autoScale;
  let ct = Number(c.contrast || 1.0) * (1.0 + (Number(rec.contrast || 1.0) - 1.0) * autoScale);
  let sat = Number(c.saturation || 1.0) * (1.0 + (Number(rec.saturation || 1.0) - 1.0) * autoScale);
  let sepia = 0;
  let hue = 0;

  const lutMap = {
    wishedit_clean_studio: { ct: 1.05, sat: 1.08, hue: 0, sepia: 0 },
    tiktok_viral_crisp: { ct: 1.12, sat: 1.18, hue: -2, sepia: 0 },
    teal_orange_pro: { ct: 1.10, sat: 1.15, hue: -6, sepia: 0.08 },
    sony_s_cinetone: { ct: 1.04, sat: 1.05, hue: 2, sepia: 0.05 },
    cyber_tech_cyan: { ct: 1.10, sat: 1.12, hue: -10, sepia: 0 },
    high_key_bright: { ct: 1.02, sat: 1.06, hue: 0, sepia: 0 },
    warm_golden_hour: { ct: 1.05, sat: 1.12, hue: 4, sepia: 0.14 },
    fuji_eterna_film: { ct: 0.96, sat: 0.92, hue: -3, sepia: 0.06 },
    moody_matte_slate: { ct: 1.08, sat: 0.85, hue: -5, sepia: 0.04 },
    bw_high_contrast: { ct: 1.22, sat: 0.0, hue: 0, sepia: 0 },
  };
  const preset = lutMap[c.lutId];
  if (preset) {
    ct *= preset.ct;
    sat *= preset.sat;
    hue += preset.hue;
    sepia += preset.sepia;
  }

  player.style.filter = `brightness(${br.toFixed(3)}) contrast(${ct.toFixed(3)}) saturate(${sat.toFixed(3)}) sepia(${sepia.toFixed(2)}) hue-rotate(${hue}deg)`;
}

/* ==================== EDL LIST RENDERING ==================== */

function renderEdlList() {
  const wrap = $('edlList');
  if (!wrap) return;
  wrap.innerHTML = '';
  const hitTexts = new Set((state.overview?.watchlist_hits || []).map((h) => h.text));

  if (!state.edlRows.length) {
    wrap.innerHTML = '<div class="p-6 text-center text-xs text-zinc-500">Chưa có EDL. Qua tab <b>Brief &amp; AI</b> để chạy bước 1–3.</div>';
    return;
  }

  state.edlRows.forEach((row, idx) => {
    const isKept = Number(row.keep) === 1;
    const isHit = hitTexts.has(row.text);
    if (state.edlFilter === 'kept' && !isKept) return;
    if (state.edlFilter === 'drop' && isKept) return;
    if (state.edlFilter === 'watchlist' && !isHit) return;

    const card = document.createElement('div');
    card.className = `edl-card p-2.5 space-y-1.5 ${!isKept ? 'dropped' : ''} ${state.selectedEdlIdx === idx ? 'selected' : ''}`;
    const rid = `R${String(idx + 1).padStart(2, '0')}`;
    const lblBadgeClass =
      row.label === 'hook'
        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
        : row.label === 'dark'
          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          : row.label === 'drop'
            ? 'bg-zinc-800 text-zinc-500 border-zinc-700'
            : 'bg-zinc-800 text-zinc-200 border-zinc-700';

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <input type="checkbox" ${isKept ? 'checked' : ''} data-act="keep" class="rounded accent-cyan-400 cursor-pointer" title="Giữ / Bỏ câu này" />
          <button data-act="seek" class="text-[11px] font-mono font-bold text-zinc-100 hover:text-cyan-400">${rid}</button>
          <select data-act="label" class="h-5 px-1 rounded border text-[10px] font-semibold ${lblBadgeClass}">
            <option value="main" ${row.label === 'main' ? 'selected' : ''}>main</option>
            <option value="hook" ${row.label === 'hook' ? 'selected' : ''}>hook</option>
            <option value="dark" ${row.label === 'dark' ? 'selected' : ''}>dark</option>
            <option value="drop" ${row.label === 'drop' ? 'selected' : ''}>drop</option>
          </select>
          ${isHit ? '<span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">WATCHLIST</span>' : ''}
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[10px] font-mono text-zinc-400">${Number(row.start).toFixed(1)}–${Number(row.end).toFixed(1)}s</span>
          <button data-act="up" class="h-5 w-5 rounded hover:bg-zinc-800 text-zinc-400 text-[10px]" title="Đẩy lên">↑</button>
          <button data-act="down" class="h-5 w-5 rounded hover:bg-zinc-800 text-zinc-400 text-[10px]" title="Đẩy xuống">↓</button>
        </div>
      </div>
      <textarea data-act="text" rows="2" class="w-full text-xs leading-snug text-zinc-100 bg-transparent border border-transparent hover:border-zinc-700 focus:border-cyan-500 focus:bg-[#111115] rounded p-1 outline-none resize-none">${escHtml(row.text)}</textarea>
      <input data-act="note" type="text" placeholder="Ghi chú sửa (vd: đổi thành hook, bỏ ý này...)" value="${escHtml(row.note || '')}" class="w-full text-[11px] text-zinc-300 bg-[#111115] border border-[#26262F] rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500" />
    `;

    card.addEventListener('click', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
      selectAndPreviewEdlRow(idx);
    });

    card.querySelector('[data-act="seek"]').addEventListener('click', () => selectAndPreviewEdlRow(idx));
    card.querySelector('[data-act="keep"]').addEventListener('change', (e) => {
      row.keep = e.target.checked ? 1 : 0;
      if (row.keep === 1 && row.label === 'drop') row.label = 'main';
      if (row.keep === 0) row.label = 'drop';
      computeKeptOffsets();
      updateTopBadges();
      renderEdlList();
      renderTimeline();
    });
    card.querySelector('[data-act="label"]').addEventListener('change', (e) => {
      row.label = e.target.value;
      row.keep = row.label === 'drop' ? 0 : 1;
      computeKeptOffsets();
      updateTopBadges();
      renderEdlList();
      renderTimeline();
    });
    card.querySelector('[data-act="text"]').addEventListener('input', (e) => {
      row.text = e.target.value;
    });
    card.querySelector('[data-act="note"]').addEventListener('input', (e) => {
      row.note = e.target.value;
    });
    card.querySelector('[data-act="up"]').addEventListener('click', () => {
      if (idx === 0) return;
      pushUndoState('edl_move_up');
      let swapIdx = idx - 1;
      if (Number(row.keep) === 1) {
        for (let j = idx - 1; j >= 0; j -= 1) {
          if (Number(state.edlRows[j]?.keep) === 1) {
            swapIdx = j;
            break;
          }
        }
      }
      if (swapIdx === idx) return;
      [state.edlRows[swapIdx], state.edlRows[idx]] = [state.edlRows[idx], state.edlRows[swapIdx]];
      state.selectedEdlIdx = swapIdx;
      computeKeptOffsets();
      renderEdlList();
      renderTimeline();
      toast(`Đã đảo cảnh ${rid} lên trên`);
    });
    card.querySelector('[data-act="down"]').addEventListener('click', () => {
      if (idx >= state.edlRows.length - 1) return;
      pushUndoState('edl_move_down');
      let swapIdx = idx + 1;
      if (Number(row.keep) === 1) {
        for (let j = idx + 1; j < state.edlRows.length; j += 1) {
          if (Number(state.edlRows[j]?.keep) === 1) {
            swapIdx = j;
            break;
          }
        }
      }
      if (swapIdx === idx) return;
      [state.edlRows[swapIdx], state.edlRows[idx]] = [state.edlRows[idx], state.edlRows[swapIdx]];
      state.selectedEdlIdx = swapIdx;
      computeKeptOffsets();
      renderEdlList();
      renderTimeline();
      toast(`Đã đảo cảnh ${rid} xuống dưới`);
    });

    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/edl-idx', String(idx));
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', () => card.classList.remove('opacity-50'));
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('border-cyan-400');
    });
    card.addEventListener('dragleave', () => card.classList.remove('border-cyan-400'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('border-cyan-400');
      const fromRaw = e.dataTransfer.getData('text/edl-idx');
      if (fromRaw === '') return;
      const fromIdx = Number(fromRaw);
      if (Number.isNaN(fromIdx) || fromIdx === idx) return;
      pushUndoState('edl_drag_reorder');
      const [movedRow] = state.edlRows.splice(fromIdx, 1);
      state.edlRows.splice(idx, 0, movedRow);
      state.selectedEdlIdx = idx;
      computeKeptOffsets();
      renderEdlList();
      renderTimeline();
      toast(`Đã đổi vị trí cảnh R${String(fromIdx + 1).padStart(2, '0')} → R${String(idx + 1).padStart(2, '0')}`);
    });

    wrap.appendChild(card);
  });
}

window.playOutputFile = function (filename) {
  state.stageMode = 'output';
  state.overlaysEnabled = false;
  configureStageMedia(false, filename);
  seekAndPlay($('previewPlayer'), 0, true);
};

/* ==================== STAGE PLAYER & SYNCED OVERLAYS ==================== */

function configureStageMedia(autoPickMode = false, explicitOutputName = null) {
  const ov = state.overview || {};
  const outs = ov.outputs || [];
  const hasOut = outs.length > 0;
  const hasSrc = !!ov.has_source_video;
  const player = $('previewPlayer');
  const ph = $('stagePlaceholder');

  if (autoPickMode) {
    state.stageMode = hasOut ? 'output' : 'source';
    state.overlaysEnabled = !hasOut;
  }

  $('btnModeOutput')?.classList.toggle('active', state.stageMode === 'output');
  $('btnModeSource')?.classList.toggle('active', state.stageMode === 'source');
  if ($('btnModeOutput')) $('btnModeOutput').disabled = !hasOut;
  if ($('btnToggleOverlays')) $('btnToggleOverlays').textContent = state.overlaysEnabled ? 'Overlay: Bật' : 'Overlay: Tắt';

  let url = '';
  let info = '—';
  if (state.stageMode === 'output' && hasOut) {
    const fn = explicitOutputName || outs[outs.length - 1];
    url = `/api/projects/${encodeURIComponent(state.project)}/media/output/${encodeURIComponent(fn)}`;
    info = fn;
  } else if (hasSrc) {
    url = `/api/projects/${encodeURIComponent(state.project)}/media/source`;
    info = ov.raw_files?.[0] || 'work_source.mp4';
  }

  if ($('stageSourceInfo')) $('stageSourceInfo').textContent = info;
  if (!url) {
    ph?.classList.remove('hidden');
    if (player) {
      player.pause();
      player.removeAttribute('src');
      player.srcObject = null;
      try {
        player.load();
      } catch {
        /* ignore */
      }
      player.classList.add('hidden');
    }
    state.activeVideoUrl = '';
  } else {
    ph?.classList.add('hidden');
    if (player) {
      player.classList.remove('hidden');
      if (state.activeVideoUrl !== url) {
        state.activeVideoUrl = url;
        player.src = url;
        player.load();
      }
    }
  }
  applyLiveStageColorFilter();
  updateLiveOverlays();
}

function selectAndPreviewEdlRow(idx) {
  const row = state.edlRows[idx];
  if (!row) return;
  state.selectedEdlIdx = idx;
  renderEdlList();

  const player = $('previewPlayer');
  const kept = state.keptOffsets.find((k) => k.edlIdx === idx);
  if (state.stageMode === 'output' && kept) {
    state.timelineSec = kept.tStart;
    seekAndPlay(player, kept.tStart, true);
  } else {
    if (state.stageMode !== 'source') {
      state.stageMode = 'source';
      state.overlaysEnabled = true;
      configureStageMedia(false);
    }
    state.timelineSec = kept ? kept.tStart : 0;
    seekAndPlay(player, Number(row.start), true);
  }
  updatePlayheadVisual();
  updateLiveOverlays();
}

function getActiveTimelineSec() {
  const player = $('previewPlayer');
  if (!player || !state.activeVideoUrl) return state.timelineSec;
  const cur = player.currentTime || 0;
  if (state.stageMode === 'output') {
    return cur;
  }
  const speed = Number(state.layers?.video?.speechSpeed || 1.0);
  const match = state.keptOffsets.find((k) => cur >= k.srcStart && cur <= k.srcEnd);
  if (match) {
    return match.tStart + (cur - match.srcStart) / speed;
  }
  return state.timelineSec;
}

function updatePlayheadVisual() {
  const t = state.timelineSec;
  if ($('tlPlayheadLabel')) $('tlPlayheadLabel').textContent = fmtSecMs(t);
  if ($('timeCurrent')) $('timeCurrent').textContent = fmtSec(t);
  if ($('timeTotal')) $('timeTotal').textContent = fmtSec(state.totalOutSec);
  if ($('tlPlayhead')) $('tlPlayhead').style.left = `${t * state.pxPerSec}px`;
}

function updateLiveOverlays() {
  const layerEl = $('liveOverlayLayer');
  if (!layerEl) return;
  if (!state.overlaysEnabled || !state.props) {
    layerEl.classList.add('hidden');
    return;
  }
  layerEl.classList.remove('hidden');

  const props = state.props;
  const fps = Number(props.fps || 30);
  const frame = Math.round(state.timelineSec * fps);
  const st = state.layers?.style || props.style || {};

  const wmText = (state.layers?.video?.watermarkHandle ?? props.watermarkHandle ?? '').trim();
  if ($('ovWatermark')) {
    $('ovWatermark').textContent = wmText === '@thinhchapmach' ? '' : wmText;
  }

  const hook = state.layers?.hook || props.hook;
  const hookEl = $('ovHook');
  if (hookEl) {
    if (hook?.enabled && hook.title && frame >= hook.startFrame && frame < hook.endFrame) {
      hookEl.classList.remove('hidden');
      $('ovHookEyebrow').textContent = hook.eyebrow || '';
      $('ovHookEyebrow').classList.toggle('hidden', !hook.eyebrow);
      $('ovHookTitle').textContent = hook.title;
    } else {
      hookEl.classList.add('hidden');
    }
  }

  const darkList = state.layers?.darkScenes || props.darkScenes || [];
  const dark = darkList.find((d) => frame >= d.startFrame && frame < d.endFrame);
  const darkEl = $('ovDarkScene');
  if (darkEl) {
    if (dark) {
      darkEl.classList.remove('hidden');
      $('ovDarkMetric').textContent = dark.metric || '';
      $('ovDarkMetric').classList.toggle('hidden', !dark.metric);
      $('ovDarkTitle').textContent = dark.title || '';
      $('ovDarkBullets').innerHTML = (dark.bullets || [])
        .map(
          (b, i) => `
        <div class="flex items-center gap-2 text-[10px] font-bold text-slate-900">
          <span class="w-4 h-4 rounded bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-[9px] flex items-center justify-center shrink-0">${i + 1}</span>
          <span>${escHtml(b)}</span>
        </div>`
        )
        .join('');
    } else {
      darkEl.classList.add('hidden');
    }
  }

  const cardList = state.layers?.infoCards || props.infoCards || [];
  const card = cardList.find((c) => frame >= c.startFrame && frame < c.endFrame);
  const cardEl = $('ovInfoCard');
  if (cardEl) {
    if (card) {
      cardEl.classList.remove('hidden');
      $('ovCardLabel').textContent = card.label || '';
      $('ovCardDetail').textContent = card.detail || '';
      $('ovCardDetail').classList.toggle('hidden', !card.detail);
    } else {
      cardEl.classList.add('hidden');
    }
  }

  const badgeList = state.layers?.logoBadges || props.logoBadges || [];
  const badge = badgeList.find((b) => frame >= b.startFrame && frame < b.endFrame);
  const badgeEl = $('ovLogoBadge');
  if (badgeEl) {
    if (badge) {
      badgeEl.classList.remove('hidden');
      $('ovLogoText').textContent = badge.label || badge.brand || '';
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  const capList = state.layers?.captions || props.captions || [];
  const cap = capList.find((c) => frame >= c.startFrame && frame < c.endFrame);
  const capWrap = $('ovCaptionWrap');
  if (capWrap) {
    if (cap) {
      capWrap.classList.remove('hidden');
      const accent = st.accentColor || '#38BDF8';
      const numCol = st.numberColor || '#FACC15';
      const baseCol = st.captionColor || '#FFFFFF';
      const isBoxed = st.stylePreset === 'boxed';
      $('ovCaptionBox').className = isBoxed ? 'px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/15' : '';

      let html = escHtml(cap.text || '');
      const kws = (cap.keywords || []).filter(Boolean).sort((a, b) => b.length - a.length);
      if (kws.length) {
        const re = new RegExp(`(${kws.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');
        html = html.replace(re, (m) => `<span style="color:${/\d/.test(m) ? numCol : accent}">${m}</span>`);
      }
      const textEl = $('ovCaptionText');
      textEl.style.color = baseCol;
      textEl.innerHTML = html;

      const subEl = $('ovCaptionSubtext');
      if (cap.subtext) {
        subEl.classList.remove('hidden');
        subEl.textContent = cap.subtext;
      } else {
        subEl.classList.add('hidden');
      }
    } else {
      capWrap.classList.add('hidden');
    }
  }
}

/* ==================== RIGHT PANEL: 6-TAB INSPECTOR (ALL ADJUSTMENTS) ==================== */

function applyLiveStageTransform() {
  const player = $('previewPlayer');
  if (!player) return;
  const v = state.layers?.video || {};
  const sc = Number(v.videoScale ?? 1.0);
  const ox = Number(v.videoOffsetX ?? 0.0);
  const oy = Number(v.videoOffsetY ?? 0.0);
  player.style.transform = `translate(${ox}%, ${oy}%) scale(${sc})`;
  player.style.transformOrigin = 'center center';
}

function renderInspector() {
  const l = state.layers;
  if (!l) return;

  // 1. Video
  if ($('inpTopic')) {
    const curVal = ($('inpTopic').value || '').trim();
    if (!curVal || curVal === 'tim-ugc-mien-phi' || curVal === '_demo' || curVal === 'Demo') {
      $('inpTopic').value = state.project === '_demo' || state.project === 'Demo' ? 'Review máy đọc sách XTEINK' : state.project;
    }
  }
  const spd = Number(l.video?.speechSpeed || 1.1);
  if ($('inpSpeechSpeed')) $('inpSpeechSpeed').value = spd;
  if ($('valSpeechSpeed')) $('valSpeechSpeed').textContent = `${spd.toFixed(2)}x`;

  const vScale = Number(l.video?.videoScale ?? 1.0);
  const vOffX = Number(l.video?.videoOffsetX ?? 0);
  const vOffY = Number(l.video?.videoOffsetY ?? 0);
  if ($('inpVideoScale')) $('inpVideoScale').value = vScale;
  if ($('valVideoScale')) $('valVideoScale').textContent = `${Math.round(vScale * 100)}%`;
  if ($('inpVideoOffsetX')) $('inpVideoOffsetX').value = vOffX;
  if ($('valVideoOffsetX')) $('valVideoOffsetX').textContent = `${Math.round(vOffX)}%`;
  if ($('inpVideoOffsetY')) $('inpVideoOffsetY').value = vOffY;
  if ($('valVideoOffsetY')) $('valVideoOffsetY').textContent = `${Math.round(vOffY)}%`;
  applyLiveStageTransform();

  const wmRaw = l.video?.watermarkHandle ?? '';
  if ($('inpWatermark')) $('inpWatermark').value = wmRaw === '@thinhchapmach' ? '' : wmRaw;
  if ($('chkSubtleZoom')) $('chkSubtleZoom').checked = l.video?.enableSubtleZoom !== false;
  if ($('chkPreserveRes')) $('chkPreserveRes').checked = !!l.video?.preserveNativeResolution;
  if ($('chkOtherPlatforms')) $('chkOtherPlatforms').checked = !!l.video?.exportOtherPlatforms;

  // 2. Hook
  if ($('chkHookEnabled')) $('chkHookEnabled').checked = l.hook?.enabled !== false;
  if ($('inpHookEyebrow')) $('inpHookEyebrow').value = l.hook?.eyebrow || '';
  if ($('inpHookTitle')) $('inpHookTitle').value = l.hook?.title || '';
  if ($('inpHookStart')) $('inpHookStart').value = l.hook?.startFrame ?? 0;
  if ($('inpHookEnd')) $('inpHookEnd').value = l.hook?.endFrame ?? 90;
  if ($('inpHookTop')) $('inpHookTop').value = l.style?.hookTopPx ?? 88;
  if ($('inpStylePreset')) $('inpStylePreset').value = l.style?.stylePreset || 'editorial';

  // 3. Sub & Màu
  if ($('inpAccentColor')) $('inpAccentColor').value = l.style?.accentColor || '#38BDF8';
  if ($('inpNumberColor')) $('inpNumberColor').value = l.style?.numberColor || '#FACC15';
  if ($('inpCaptionColor')) $('inpCaptionColor').value = l.style?.captionColor || '#FFFFFF';
  if ($('inpCaptionSize')) $('inpCaptionSize').value = l.style?.captionFontSize ?? 52;
  if ($('inpCaptionBottom')) $('inpCaptionBottom').value = l.style?.captionBottomPx ?? 320;
  renderCaptionsEditor();

  // 4. B-Roll, Cards, Dark & Logos
  if ($('chkAutoBrollToggle')) {
    $('chkAutoBrollToggle').checked = l.autoBrollEnabled !== false;
  }
  renderCardsAndLogosEditor();

  // 5. Color & LUT
  renderColorAndLuts();

  // 6. Audio
  if ($('chkDenoiseSpeech')) $('chkDenoiseSpeech').checked = l.audio?.denoiseSpeech !== false;
  if ($('chkNormalizeSpeech')) $('chkNormalizeSpeech').checked = l.audio?.normalizeSpeech !== false;
  const musicSel = $('inpMusicFile');
  if (musicSel) {
    const musicFiles = state.overview?.assets?.music || [];
    musicSel.innerHTML = '<option value="">-- Không nhạc nền --</option>' +
      musicFiles.map((f) => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join('');
    musicSel.value = l.audio?.musicFile || '';
  }
  if ($('inpMusicDb')) $('inpMusicDb').value = l.audio?.musicDb ?? -22;
  if ($('valMusicDb')) $('valMusicDb').textContent = `${$('inpMusicDb')?.value ?? -22} dB`;
  if ($('chkEnableSfx')) $('chkEnableSfx').checked = l.audio?.enableSfx !== false;
  if ($('inpSfxDb')) $('inpSfxDb').value = l.audio?.sfxDb ?? -16;
  if ($('valSfxDb')) $('valSfxDb').textContent = `${$('inpSfxDb')?.value ?? -16} dB`;
}

function renderCaptionsEditor() {
  const caps = state.layers?.captions || [];
  if ($('subCountLabel')) $('subCountLabel').textContent = `${caps.length}`;
  const wrap = $('captionsEditorList');
  if (!wrap) return;
  wrap.innerHTML = '';
  caps.forEach((c) => {
    const box = document.createElement('div');
    box.className = 'p-2 rounded border border-[#26262F] bg-[#18181E] space-y-1';
    box.innerHTML = `
      <div class="flex justify-between text-[10px] font-mono text-zinc-400">
        <span>${escHtml(c.id)}</span>
        <span>${(c.startFrame / 30).toFixed(1)}s–${(c.endFrame / 30).toFixed(1)}s</span>
      </div>
      <input data-field="text" type="text" value="${escHtml(c.text)}" class="w-full h-7 px-2 rounded border border-[#26262F] bg-[#111115] text-xs font-medium text-zinc-100" />
      <div class="grid grid-cols-2 gap-1.5">
        <input data-field="keywords" type="text" placeholder="Từ khóa (phẩy)" value="${escHtml((c.keywords || []).join(', '))}" class="h-6 px-2 rounded border border-[#26262F] bg-[#111115] text-[11px] font-mono text-cyan-300" />
        <input data-field="subtext" type="text" placeholder="Chữ phụ nhỏ" value="${escHtml(c.subtext || '')}" class="h-6 px-2 rounded border border-[#26262F] bg-[#111115] text-[11px] text-zinc-400" />
      </div>
    `;
    box.querySelector('[data-field="text"]').addEventListener('input', (e) => {
      c.text = e.target.value;
      state.layers.captions_edited = true;
      updateLiveOverlays();
    });
    box.querySelector('[data-field="keywords"]').addEventListener('input', (e) => {
      c.keywords = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
      state.layers.captions_edited = true;
      updateLiveOverlays();
    });
    box.querySelector('[data-field="subtext"]').addEventListener('input', (e) => {
      c.subtext = e.target.value;
      state.layers.captions_edited = true;
      updateLiveOverlays();
    });
    wrap.appendChild(box);
  });
}

function renderCardsAndLogosEditor() {
  const l = state.layers;
  if (!l) return;

  // B-Roll Layers Editor (Moved to Right Panel!)
  const brWrap = $('brollEditorList');
  if (brWrap) {
    brWrap.innerHTML = '';
    const brItems = l.broll || [];
    if (!brItems.length) {
      brWrap.innerHTML = '<div class="p-2 rounded border border-[#26262F] bg-[#18181E] text-[11px] text-zinc-500">Chưa có B-Roll trên Timeline. Kéo từ Media Pool hoặc bật Auto B-Roll.</div>';
    } else {
      brItems.forEach((br, i) => {
        const layVal = br.layout || (br.mode === 'full' ? 'full' : 'pip_top');
        const el = document.createElement('div');
        el.className = 'p-2 rounded border border-[#26262F] bg-[#18181E] space-y-1.5';
        el.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-mono text-cyan-300 truncate">${escHtml(br.src)}</span>
            <button data-del="${i}" class="text-[11px] text-rose-400 hover:underline shrink-0">Xóa</button>
          </div>
          <input data-f="caption" type="text" placeholder="Chú thích B-Roll" value="${escHtml(br.caption || '')}" class="w-full h-6 px-2 rounded border border-[#26262F] bg-[#111115] text-[11px] text-zinc-200" />
          <div class="grid grid-cols-3 gap-1.5 text-[10px]">
            <select data-f="layout" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1">
              <option value="pip_top" ${layVal !== 'full' ? 'selected' : ''}>Khung Trên</option>
              <option value="full" ${layVal === 'full' ? 'selected' : ''}>Toàn màn</option>
            </select>
            <input data-f="startFrame" type="number" value="${br.startFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
            <input data-f="endFrame" type="number" value="${br.endFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
          </div>
        `;
        el.querySelectorAll('[data-f]').forEach((inp) => {
          inp.addEventListener('input', (e) => {
            const f = e.target.dataset.f;
            br[f] = ['startFrame', 'endFrame'].includes(f) ? Number(e.target.value) : e.target.value;
            l.broll_edited = true;
            renderTimeline();
          });
        });
        el.querySelector('[data-del]').addEventListener('click', () => {
          l.broll.splice(i, 1);
          l.broll_edited = true;
          renderCardsAndLogosEditor();
          renderTimeline();
        });
        brWrap.appendChild(el);
      });
    }
  }

  // InfoCards
  const icWrap = $('infoCardsList');
  if (icWrap) {
    icWrap.innerHTML = '';
    (l.infoCards || []).forEach((ic, i) => {
      const el = document.createElement('div');
      el.className = 'p-2 rounded border border-[#26262F] bg-[#18181E] space-y-1.5';
      el.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <input data-f="label" type="text" value="${escHtml(ic.label)}" class="flex-1 h-7 px-2 rounded border border-[#26262F] bg-[#111115] text-xs font-semibold text-zinc-100" />
          <button data-del="${i}" class="text-[11px] text-rose-400 hover:underline">Xóa</button>
        </div>
        <input data-f="detail" type="text" placeholder="Mô tả phụ" value="${escHtml(ic.detail || '')}" class="w-full h-6 px-2 rounded border border-[#26262F] bg-[#111115] text-[11px] text-zinc-300" />
        <div class="grid grid-cols-3 gap-1.5 text-[10px]">
          <select data-f="icon" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1">
            ${['check', 'alert', 'chart', 'bag', 'bolt', 'clock'].map((ico) => `<option value="${ico}" ${ic.icon === ico ? 'selected' : ''}>${ico}</option>`).join('')}
          </select>
          <input data-f="startFrame" type="number" value="${ic.startFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
          <input data-f="endFrame" type="number" value="${ic.endFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
        </div>
      `;
      el.querySelectorAll('[data-f]').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          const f = e.target.dataset.f;
          ic[f] = ['startFrame', 'endFrame'].includes(f) ? Number(e.target.value) : e.target.value;
          l.infoCards_edited = true;
        });
      });
      el.querySelector('[data-del]').addEventListener('click', () => {
        l.infoCards.splice(i, 1);
        l.infoCards_edited = true;
        renderCardsAndLogosEditor();
        renderTimeline();
      });
      icWrap.appendChild(el);
    });
  }

  // Dark Scenes
  const dsWrap = $('darkScenesList');
  if (dsWrap) {
    dsWrap.innerHTML = '';
    (l.darkScenes || []).forEach((ds, i) => {
      const el = document.createElement('div');
      el.className = 'p-2 rounded border border-[#26262F] bg-[#18181E] space-y-1.5';
      el.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <input data-f="title" type="text" value="${escHtml(ds.title)}" class="flex-1 h-7 px-2 rounded border border-[#26262F] bg-[#111115] text-xs font-semibold text-zinc-100" />
          <button data-del="${i}" class="text-[11px] text-rose-400 hover:underline">Xóa</button>
        </div>
        <textarea data-f="bullets" rows="2" placeholder="Mỗi gạch đầu dòng 1 ý" class="w-full p-1.5 rounded border border-[#26262F] bg-[#111115] text-[11px] text-zinc-200">${escHtml((ds.bullets || []).join('\n'))}</textarea>
        <div class="grid grid-cols-3 gap-1.5 text-[10px]">
          <input data-f="metric" type="text" placeholder="Nhãn pill" value="${escHtml(ds.metric || '')}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5" />
          <input data-f="startFrame" type="number" value="${ds.startFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
          <input data-f="endFrame" type="number" value="${ds.endFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
        </div>
      `;
      el.querySelectorAll('[data-f]').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          const f = e.target.dataset.f;
          if (f === 'bullets') ds.bullets = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
          else if (['startFrame', 'endFrame'].includes(f)) ds[f] = Number(e.target.value);
          else ds[f] = e.target.value;
          l.darkScenes_edited = true;
        });
      });
      el.querySelector('[data-del]').addEventListener('click', () => {
        l.darkScenes.splice(i, 1);
        l.darkScenes_edited = true;
        renderCardsAndLogosEditor();
        renderTimeline();
      });
      dsWrap.appendChild(el);
    });
  }

  // Logo Badges
  const lgWrap = $('logoBadgesList');
  if (lgWrap) {
    lgWrap.innerHTML = '';
    (l.logoBadges || []).forEach((lb, i) => {
      const el = document.createElement('div');
      el.className = 'p-2 rounded border border-[#26262F] bg-[#18181E] space-y-1.5';
      el.innerHTML = `
        <div class="flex items-center gap-1.5">
          <input data-f="brand" type="text" placeholder="tiktok/chatgpt/google" value="${escHtml(lb.brand)}" class="w-24 h-6 px-1.5 rounded border border-[#26262F] bg-[#111115] text-[11px] font-mono text-zinc-100" />
          <input data-f="label" type="text" placeholder="Nhãn" value="${escHtml(lb.label || '')}" class="flex-1 h-6 px-1.5 rounded border border-[#26262F] bg-[#111115] text-[11px] text-zinc-200" />
          <button data-del="${i}" class="text-[11px] text-rose-400 hover:underline">Xóa</button>
        </div>
        <div class="grid grid-cols-3 gap-1.5 text-[10px]">
          <select data-f="position" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1">
            <option value="top_right" ${lb.position === 'top_right' ? 'selected' : ''}>top_right</option>
            <option value="top_left" ${lb.position === 'top_left' ? 'selected' : ''}>top_left</option>
            <option value="chest_pill" ${lb.position === 'chest_pill' ? 'selected' : ''}>chest_pill</option>
          </select>
          <input data-f="startFrame" type="number" value="${lb.startFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
          <input data-f="endFrame" type="number" value="${lb.endFrame}" class="h-6 rounded border border-[#26262F] bg-[#111115] text-zinc-200 px-1.5 font-mono" />
        </div>
      `;
      el.querySelectorAll('[data-f]').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          const f = e.target.dataset.f;
          lb[f] = ['startFrame', 'endFrame'].includes(f) ? Number(e.target.value) : e.target.value;
          l.logoBadges_edited = true;
        });
      });
      el.querySelector('[data-del]').addEventListener('click', () => {
        l.logoBadges.splice(i, 1);
        l.logoBadges_edited = true;
        renderCardsAndLogosEditor();
        renderTimeline();
      });
      lgWrap.appendChild(el);
    });
  }
}

function syncInspectorToLayers(triggerAutoSave = true) {
  const l = state.layers;
  if (!l) return;
  const vScale = Number($('inpVideoScale')?.value ?? l.video?.videoScale ?? 1.0);
  const vOffX = Number($('inpVideoOffsetX')?.value ?? l.video?.videoOffsetX ?? 0);
  const vOffY = Number($('inpVideoOffsetY')?.value ?? l.video?.videoOffsetY ?? 0);
  if ($('valVideoScale')) $('valVideoScale').textContent = `${Math.round(vScale * 100)}%`;
  if ($('valVideoOffsetX')) $('valVideoOffsetX').textContent = `${Math.round(vOffX)}%`;
  if ($('valVideoOffsetY')) $('valVideoOffsetY').textContent = `${Math.round(vOffY)}%`;

  l.video = {
    ...(l.video || {}),
    speechSpeed: Number($('inpSpeechSpeed')?.value || 1.1),
    watermarkHandle: ($('inpWatermark')?.value || '').trim(),
    enableSubtleZoom: $('chkSubtleZoom')?.checked !== false,
    preserveNativeResolution: !!$('chkPreserveRes')?.checked,
    exportOtherPlatforms: !!$('chkOtherPlatforms')?.checked,
    videoScale: vScale,
    videoOffsetX: vOffX,
    videoOffsetY: vOffY,
  };
  applyLiveStageTransform();
  l.hook = {
    ...(l.hook || {}),
    enabled: $('chkHookEnabled')?.checked !== false,
    eyebrow: ($('inpHookEyebrow')?.value || '').trim(),
    title: ($('inpHookTitle')?.value || '').trim(),
    startFrame: Number($('inpHookStart')?.value) || 0,
    endFrame: Math.max(15, Number($('inpHookEnd')?.value) || 90),
  };
  l.style = {
    ...(l.style || {}),
    accentColor: $('inpAccentColor')?.value || '#38BDF8',
    numberColor: $('inpNumberColor')?.value || '#22D3EE',
    captionColor: $('inpCaptionColor')?.value || '#FFFFFF',
    captionFontSize: Number($('inpCaptionSize')?.value) || 52,
    captionBottomPx: Number($('inpCaptionBottom')?.value) || 320,
    hookTopPx: Number($('inpHookTop')?.value) || 88,
    enableSubtleZoom: $('chkSubtleZoom')?.checked !== false,
    stylePreset: $('inpStylePreset')?.value || 'editorial',
  };
  l.audio = {
    ...(l.audio || {}),
    denoiseSpeech: $('chkDenoiseSpeech')?.checked !== false,
    normalizeSpeech: $('chkNormalizeSpeech')?.checked !== false,
    musicFile: $('inpMusicFile')?.value || '',
    musicDb: Number($('inpMusicDb')?.value ?? -22),
    enableSfx: $('chkEnableSfx')?.checked !== false,
    sfxDb: Number($('inpSfxDb')?.value ?? -16),
  };
  const c = ensureColorObject();
  if (c) {
    c.autoColorIntensity = Number($('inpAutoColorIntensity')?.value ?? c.autoColorIntensity ?? 80);
    c.adjustmentLayerEnabled = $('chkAdjustmentLayer')?.checked !== false;
    c.brightness = Number($('inpColorBright')?.value ?? c.brightness ?? 0);
    c.contrast = Number($('inpColorContrast')?.value ?? c.contrast ?? 1.0);
    c.saturation = Number($('inpColorSat')?.value ?? c.saturation ?? 1.0);
  }
  computeKeptOffsets();
  updateTopBadges();
  applyLiveStageColorFilter();
  updateLiveOverlays();
  if (triggerAutoSave) scheduleAutoSave();
}

/* ==================== CAPCUT / RESOLVE INTERACTIVE TIMELINE & DRAG ENGINE ==================== */

const CONTEXT_INSPECTOR_TABS = {
  edl: ['video', 'color', 'audio'],
  hook: ['hook'],
  caption: ['sub'],
  infocard: ['cards'],
  darkscene: ['cards'],
  logobadge: ['cards'],
  broll: ['cards', 'color'],
  adjlayer: ['color'],
  audio: ['audio'],
  marker: ['cards'],
};

function updateContextualInspectorTabs(kind = null) {
  const allowed = kind && CONTEXT_INSPECTOR_TABS[kind] ? CONTEXT_INSPECTOR_TABS[kind] : null;
  const allBtns = Array.from(document.querySelectorAll('#inspectorTabs .insp-tab'));
  allBtns.forEach((btn) => {
    const t = btn.dataset.itab;
    const show = !allowed || allowed.includes(t);
    btn.classList.toggle('hidden', !show);
  });
  const activeBtn = allBtns.find((b) => b.classList.contains('active') && !b.classList.contains('hidden'));
  if (!activeBtn) {
    const firstVisible = allBtns.find((b) => !b.classList.contains('hidden'));
    firstVisible?.click();
  }
}

function setSelectedLayer(kind, index, ref, labelText = '') {
  state.selectedLayer = { kind, index, ref };
  if (kind === 'edl') state.selectedEdlIdx = index;
  const badge = $('selectedLayerBadge');
  if (badge) {
    badge.textContent = labelText ? `Đang chọn: ${labelText} (B: Tách · Del: Xóa · Kéo [ ] co giãn)` : 'Kéo thả từ Media Pool hoặc kéo 2 đầu [ ] để co giãn';
  }
  updateContextualInspectorTabs(kind);
  const tabMap = { edl: 'video', hook: 'hook', caption: 'sub', infocard: 'cards', darkscene: 'cards', logobadge: 'cards', broll: 'cards', adjlayer: 'color', audio: 'audio' };
  if (tabMap[kind]) {
    document.querySelector(`[data-itab="${tabMap[kind]}"]`)?.click();
    if (state.layoutMode === 'compact') {
      state.compactSidePane = 'right';
      applyResponsiveLayout();
    }
  }
}

function attachFrameDragAndTrim(el, itemObj, editedFlagKey, kind, index, labelText) {
  const fps = Number(state.props?.fps || 30);
  const hL = document.createElement('div');
  hL.className = 'tl-handle-l';
  const hR = document.createElement('div');
  hR.className = 'tl-handle-r';
  el.appendChild(hL);
  el.appendChild(hR);

  if (state.selectedLayer?.kind === kind && state.selectedLayer?.index === index) {
    el.classList.add('selected');
  }

  let dragMode = null;
  let startX = 0;
  let origStartF = 0;
  let origEndF = 0;
  let moved = false;

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    setSelectedLayer(kind, index, itemObj, labelText);
    document.querySelectorAll('.tl-block.selected').forEach((n) => n.classList.remove('selected'));
    el.classList.add('selected');

    dragMode = e.target === hL ? 'trim_l' : e.target === hR ? 'trim_r' : 'move';
    startX = e.clientX;
    origStartF = Number(itemObj.startFrame || 0);
    origEndF = Number(itemObj.endFrame || origStartF + 45);
    moved = false;
    pushUndoState(`drag_${kind}`);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 2) moved = true;
      const dSec = dx / state.pxPerSec;
      const dFrames = Math.round(dSec * fps);
      const durF = Math.max(12, origEndF - origStartF);

      if (dragMode === 'move') {
        const nf0 = Math.max(0, origStartF + dFrames);
        itemObj.startFrame = nf0;
        itemObj.endFrame = nf0 + durF;
      } else if (dragMode === 'trim_l') {
        itemObj.startFrame = Math.max(0, Math.min(origEndF - 12, origStartF + dFrames));
      } else if (dragMode === 'trim_r') {
        itemObj.endFrame = Math.max(origStartF + 12, origEndF + dFrames);
      }

      if (editedFlagKey && state.layers) state.layers[editedFlagKey] = true;
      const t0 = itemObj.startFrame / fps;
      const t1 = itemObj.endFrame / fps;
      el.style.left = `${t0 * state.pxPerSec}px`;
      el.style.width = `${Math.max(10, (t1 - t0) * state.pxPerSec - 1)}px`;
      const badge = $('selectedLayerBadge');
      if (badge) badge.textContent = `${labelText}: ${t0.toFixed(1)}s → ${t1.toFixed(1)}s (${(t1 - t0).toFixed(1)}s)`;
      updateLiveOverlays();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) {
        scrubToSeconds(origStartF / fps, false);
      } else {
        renderInspector();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  el.addEventListener('pointerdown', onPointerDown);
}

function updateInOutRangeVisual() {
  const box = $('tlInOutRange');
  const badge = $('inOutHeaderBadge');
  if (!box) return;
  if (state.rangeInSec == null && state.rangeOutSec == null) {
    box.classList.add('hidden');
    if (badge) badge.textContent = '';
    return;
  }
  const tIn = state.rangeInSec ?? 0;
  const tOut = state.rangeOutSec != null && state.rangeOutSec > tIn ? state.rangeOutSec : Math.min(state.totalOutSec || 60, tIn + 3.0);
  box.classList.remove('hidden');
  box.style.left = `${tIn * state.pxPerSec}px`;
  box.style.width = `${Math.max(6, (tOut - tIn) * state.pxPerSec)}px`;
  if (badge) badge.textContent = `[${tIn.toFixed(1)}–${tOut.toFixed(1)}s]`;
}

function renderTimeline() {
  const px = state.pxPerSec;
  const dur = Math.max(10, state.totalOutSec);
  const widthPx = Math.max(700, Math.ceil((dur + 2) * px));
  if ($('tlCanvas')) $('tlCanvas').style.width = `${widthPx}px`;

  const ruler = $('tlRuler');
  if (ruler) {
    ruler.innerHTML = '';
    const step = px >= 44 ? 2 : 5;
    for (let s = 0; s <= dur + 1; s += step) {
      const tick = document.createElement('div');
      tick.className = 'absolute top-0 bottom-0 border-l border-[#26262F] pl-1 text-[9px] font-mono text-zinc-500 pointer-events-none';
      tick.style.left = `${s * px}px`;
      tick.textContent = `${s}s`;
      ruler.appendChild(tick);
    }
  }

  const tv = $('trackVideo');
  const vidTrackH = Math.max(32, Math.min(76, Number(state.tlThumbHeight || 44)));
  if (tv) {
    tv.style.height = `${vidTrackH}px`;
    if ($('tlHdrMainVideo')) $('tlHdrMainVideo').style.height = `${vidTrackH}px`;
    tv.innerHTML = '';
    const blockEls = [];
    state.keptOffsets.forEach((k, kPos) => {
      const b = document.createElement('div');
      const isHook = k.row.label === 'hook';
      const isSel = state.selectedLayer?.kind === 'edl' && state.selectedLayer?.index === k.edlIdx;
      b.dataset.edlIdx = String(k.edlIdx);
      b.dataset.keptPos = String(kPos);
      b.className = `tl-block border font-medium ${isSel ? 'selected' : ''} ${
        isHook ? 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200' : 'bg-[#1A1D24] border-zinc-700 text-zinc-100'
      }`;
      const thumbUrl = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=source&sec=${Math.round(Number(k.row.start || 0))}`;
      b.style.backgroundImage = `linear-gradient(90deg, rgba(12,14,18,0.82) 0%, rgba(12,14,18,0.45) 50%, rgba(12,14,18,0.78) 100%), url("${thumbUrl}")`;
      b.style.backgroundSize = 'auto 100%';
      b.style.backgroundRepeat = 'repeat-x';
      b.style.left = `${k.tStart * px}px`;
      b.style.width = `${Math.max(14, (k.tEnd - k.tStart) * px - 2)}px`;
      b.title = `Kéo thân clip để đảo vị trí hoặc kéo 2 đầu [ ] để co giãn: ${k.row.text}`;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'truncate pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] font-semibold';
      labelSpan.textContent = `R${String(k.edlIdx + 1).padStart(2, '0')} · ${k.row.text}`;
      b.appendChild(labelSpan);

      const hL = document.createElement('div');
      hL.className = 'tl-handle-l';
      const hR = document.createElement('div');
      hR.className = 'tl-handle-r';
      b.appendChild(hL);
      b.appendChild(hR);
      blockEls.push(b);

      b.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();
        setSelectedLayer('edl', k.edlIdx, k.row, `Video R${String(k.edlIdx + 1).padStart(2, '0')}`);
        document.querySelectorAll('#trackVideo .tl-block.selected').forEach((n) => n.classList.remove('selected'));
        b.classList.add('selected');

        const mode = e.target === hL ? 'trim_l' : e.target === hR ? 'trim_r' : 'move';
        const startX = e.clientX;
        const origStart = Number(k.row.start);
        const origEnd = Number(k.row.end);
        const speed = Number(state.layers?.video?.speechSpeed || 1.0);
        let moved = false;
        let hoverTargetK = null;
        pushUndoState('edl_drag');

        if (mode === 'move') {
          b.style.zIndex = '40';
          b.style.opacity = '0.92';
        }

        const syncBlocksInPlace = () => {
          computeKeptOffsets();
          state.keptOffsets.forEach((ko, idxPos) => {
            const el = blockEls[idxPos];
            if (!el) return;
            el.style.left = `${ko.tStart * state.pxPerSec}px`;
            el.style.width = `${Math.max(14, (ko.tEnd - ko.tStart) * state.pxPerSec - 2)}px`;
          });
        };

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          if (Math.abs(dx) > 3) moved = true;
          const dSrcSec = (dx / state.pxPerSec) * speed;

          if (mode === 'trim_l') {
            k.row.start = Number(Math.max(0, Math.min(origEnd - 0.25, origStart + dSrcSec)).toFixed(2));
            syncBlocksInPlace();
            const badge = $('selectedLayerBadge');
            if (badge) {
              const durClip = Math.max(0.25, Number(k.row.end) - Number(k.row.start));
              badge.textContent = `Cắt đầu R${String(k.edlIdx + 1).padStart(2, '0')}: ${k.row.start.toFixed(2)}s → ${Number(k.row.end).toFixed(2)}s (${durClip.toFixed(2)}s)`;
            }
          } else if (mode === 'trim_r') {
            k.row.end = Number(Math.max(origStart + 0.25, origEnd + dSrcSec).toFixed(2));
            syncBlocksInPlace();
            const badge = $('selectedLayerBadge');
            if (badge) {
              const durClip = Math.max(0.25, Number(k.row.end) - Number(k.row.start));
              badge.textContent = `Cắt đuôi R${String(k.edlIdx + 1).padStart(2, '0')}: ${Number(k.row.start).toFixed(2)}s → ${k.row.end.toFixed(2)}s (${durClip.toFixed(2)}s)`;
            }
          } else if (mode === 'move' && moved) {
            b.style.transform = `translateX(${dx}px)`;
            const centerSec = Math.max(0, (k.tStart + k.tEnd) / 2 + dx / state.pxPerSec);
            hoverTargetK = state.keptOffsets.find((o) => centerSec >= o.tStart && centerSec <= o.tEnd) || null;
            blockEls.forEach((el, idxPos) => {
              const ko = state.keptOffsets[idxPos];
              const isDropTarget = hoverTargetK && ko && ko.edlIdx === hoverTargetK.edlIdx && ko.edlIdx !== k.edlIdx;
              el.style.outline = isDropTarget ? '2px dashed #22d3ee' : '';
            });
            const badge = $('selectedLayerBadge');
            if (badge && hoverTargetK && hoverTargetK.edlIdx !== k.edlIdx) {
              badge.textContent = `Đảo vị trí R${String(k.edlIdx + 1).padStart(2, '0')} ⇄ R${String(hoverTargetK.edlIdx + 1).padStart(2, '0')}`;
            }
          }
        };

        const onUp = (ev) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          b.style.transform = '';
          b.style.zIndex = '';
          b.style.opacity = '';
          blockEls.forEach((el) => {
            el.style.outline = '';
          });

          if (mode === 'move' && moved) {
            const dx = ev.clientX - startX;
            const centerSec = Math.max(0, (k.tStart + k.tEnd) / 2 + dx / state.pxPerSec);
            const targetK =
              hoverTargetK ||
              state.keptOffsets.find((o) => centerSec >= o.tStart && centerSec <= o.tEnd) ||
              (centerSec > state.totalOutSec ? state.keptOffsets[state.keptOffsets.length - 1] : null);

            if (targetK && targetK.edlIdx !== k.edlIdx) {
              const fromIdx = k.edlIdx;
              const toIdx = targetK.edlIdx;
              const [item] = state.edlRows.splice(fromIdx, 1);
              state.edlRows.splice(toIdx, 0, item);
              state.selectedEdlIdx = toIdx;
              computeKeptOffsets();
              updateTopBadges();
              renderEdlList();
              renderTimeline();
              toast(`Đã đảo vị trí cảnh R${String(fromIdx + 1).padStart(2, '0')} sang vị trí R${String(toIdx + 1).padStart(2, '0')}`, 'success');
              return;
            }
          }
          if (!moved) {
            selectAndPreviewEdlRow(k.edlIdx);
          } else {
            computeKeptOffsets();
            updateTopBadges();
            renderEdlList();
            renderTimeline();
            toast(`Đã cập nhật độ dài đoạn R${String(k.edlIdx + 1).padStart(2, '0')} (${(Number(k.row.end) - Number(k.row.start)).toFixed(2)}s)`, 'success');
          }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      tv.appendChild(b);
    });
  }

  const fps = Number(state.props?.fps || 30);

  const ts = $('trackSubs');
  if (ts) {
    ts.innerHTML = '';
    const capArr = state.layers?.captions || [];
    capArr.forEach((c, idx) => {
      const b = document.createElement('div');
      b.className = 'tl-block bg-[#192230] border border-cyan-500/40 text-zinc-100 font-medium';
      const t0 = c.startFrame / fps;
      const t1 = c.endFrame / fps;
      b.style.left = `${t0 * px}px`;
      b.style.width = `${Math.max(10, (t1 - t0) * px - 1)}px`;
      b.title = `Kéo để di chuyển / kéo cạnh [ ] để chỉnh độ dài Sub: ${c.text}`;
      const sp = document.createElement('span');
      sp.className = 'truncate pointer-events-none';
      sp.textContent = c.text;
      b.appendChild(sp);
      attachFrameDragAndTrim(b, c, 'captions_edited', 'caption', idx, `Sub #${idx + 1}`);
      ts.appendChild(b);
    });
  }

  const to = $('trackOverlays');
  if (to) {
    to.innerHTML = '';
    const c = state.layers?.color;
    if (c && c.adjustmentLayerEnabled && (c.autoColorEnabled || (c.lutId && c.lutId !== 'none') || c.brightness || c.contrast !== 1 || c.saturation !== 1)) {
      const adj = document.createElement('div');
      const isAdjSel = state.selectedLayer?.kind === 'adjlayer';
      adj.className = `tl-block !top-0.5 !bottom-auto h-3.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-[9px] font-mono text-cyan-200 px-1.5 flex items-center z-20 cursor-pointer ${isAdjSel ? 'selected' : ''}`;
      adj.style.left = '0px';
      adj.style.width = `${Math.max(60, dur * px)}px`;
      adj.textContent = `ADJ LAYER · ${c.lutId && c.lutId !== 'none' ? c.lutId : 'Auto Color'}`;
      adj.title = 'Adjustment Layer phủ màu toàn bộ Timeline (Nhấn để chỉnh Màu)';
      adj.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.tl-block.selected').forEach((n) => n.classList.remove('selected'));
        adj.classList.add('selected');
        setSelectedLayer('adjlayer', 0, c, 'Adjustment Layer');
      });
      to.appendChild(adj);
    }

    const ovItems = [];
    if (state.layers?.hook?.enabled) {
      ovItems.push({ ref: state.layers.hook, flag: null, kind: 'hook', idx: 0, tag: `HOOK: ${state.layers.hook.title}`, cls: 'bg-[#1D2432] border-cyan-400/60 text-cyan-200' });
    }
    (state.layers?.infoCards || []).forEach((ic, i) =>
      ovItems.push({ ref: ic, flag: 'infoCards_edited', kind: 'infocard', idx: i, tag: `CARD: ${ic.label}`, cls: 'bg-[#1E222D] border-zinc-500/70 text-zinc-100' })
    );
    (state.layers?.darkScenes || []).forEach((ds, i) =>
      ovItems.push({ ref: ds, flag: 'darkScenes_edited', kind: 'darkscene', idx: i, tag: `FROST: ${ds.title}`, cls: 'bg-[#1A1D26] border-zinc-500 text-zinc-100' })
    );
    (state.layers?.logoBadges || []).forEach((lb, i) =>
      ovItems.push({ ref: lb, flag: 'logoBadges_edited', kind: 'logobadge', idx: i, tag: `LOGO: ${lb.label || lb.brand}`, cls: 'bg-[#1B2531] border-cyan-400/50 text-cyan-200' })
    );
    (state.layers?.broll || []).forEach((br, i) =>
      ovItems.push({ ref: br, flag: 'broll_edited', kind: 'broll', idx: i, tag: `BROLL: ${br.caption || br.src}`, cls: 'bg-[#1B222C] border-cyan-400/70 text-zinc-100' })
    );

    ovItems.forEach((it) => {
      const b = document.createElement('div');
      b.className = `tl-block border font-semibold z-10 ${it.cls}`;
      const t0 = (it.ref.startFrame || 0) / fps;
      const t1 = (it.ref.endFrame || 30) / fps;
      b.style.left = `${t0 * px}px`;
      b.style.width = `${Math.max(12, (t1 - t0) * px - 1)}px`;
      if (it.kind === 'broll' && it.ref.src) {
        const brThumb = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=broll&filename=${encodeURIComponent(it.ref.src)}`;
        b.style.backgroundImage = `linear-gradient(90deg, rgba(20,16,8,0.85) 0%, rgba(20,16,8,0.5) 100%), url("${brThumb}")`;
        b.style.backgroundSize = 'auto 100%';
        b.style.backgroundRepeat = 'repeat-x';
      }
      b.title = `Kéo di chuyển hoặc kéo 2 đầu [ ] để chỉnh thời lượng: ${it.tag}`;
      const sp = document.createElement('span');
      sp.className = 'truncate pointer-events-none';
      sp.textContent = it.tag;
      b.appendChild(sp);
      attachFrameDragAndTrim(b, it.ref, it.flag, it.kind, it.idx, it.tag);
      to.appendChild(b);
    });
  }

  const ta = $('trackAudio');
  if (ta) {
    ta.innerHTML = '';
    const speechStrip = document.createElement('div');
    speechStrip.className = 'tl-block bg-[#142228] border border-cyan-500/35 text-cyan-200 font-mono cursor-pointer';
    speechStrip.style.left = '0px';
    speechStrip.style.width = `${Math.max(40, dur * px)}px`;
    speechStrip.textContent = state.layers?.audio?.musicFile ? `Thoại (-14 LUFS) + Nhạc (${state.layers.audio.musicFile})` : 'Thoại chuẩn hóa -14 LUFS';
    speechStrip.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedLayer('audio', 0, state.layers?.audio || {}, 'Track Âm thanh');
    });
    ta.appendChild(speechStrip);

    (state.props?.sfxEvents || []).forEach((ev) => {
      const mark = document.createElement('div');
      mark.className = 'absolute top-1 bottom-1 px-1 rounded bg-cyan-500/20 border border-cyan-400/50 text-[9px] font-mono text-cyan-200 flex items-center pointer-events-none';
      mark.style.left = `${(ev.frame / fps) * px}px`;
      mark.textContent = ev.reason?.startsWith('voiceover:') ? 'VO' : 'SFX';
      mark.title = `${ev.sfx} (${ev.reason})`;
      ta.appendChild(mark);
    });

    (state.layers?.markers || []).forEach((mk, mIdx) => {
      const mEl = document.createElement('div');
      const isSel = state.selectedLayer?.kind === 'marker' && state.selectedLayer?.index === mIdx;
      mEl.className = `tl-block bg-cyan-500 text-zinc-950 font-bold border border-cyan-300 z-10 ${isSel ? 'selected' : ''}`;
      const t0 = Number(mk.startSec || 0);
      const t1 = Math.max(t0 + 0.8, Number(mk.endSec || t0 + 2));
      mEl.style.left = `${t0 * px}px`;
      mEl.style.width = `${Math.max(18, (t1 - t0) * px)}px`;
      mEl.title = `Note khoảng [${t0.toFixed(1)}s–${t1.toFixed(1)}s]: ${mk.note}`;
      mEl.textContent = `[NOTE] ${mk.note}`;
      mEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedLayer('marker', mIdx, mk, `Note: ${mk.note}`);
        state.rangeInSec = t0;
        state.rangeOutSec = t1;
        updateInOutRangeVisual();
        scrubToSeconds(t0, false);
      });
      ta.appendChild(mEl);
    });
  }

  updateInOutRangeVisual();
  updatePlayheadVisual();
}

function insertAssetAtSec(payload, atSec) {
  if (!state.layers || !payload) return;
  const fps = Number(state.props?.fps || 30);
  const f0 = Math.max(0, Math.round((Number(atSec) || 0) * fps));
  pushUndoState(`drop_${payload.kind}`);

  if (payload.kind === 'broll') {
    const isVid = isVideoFilename(payload.filename);
    state.layers.broll = state.layers.broll || [];
    state.layers.broll.push({
      id: `BR_${Date.now().toString().slice(-3)}`,
      src: payload.filename,
      mediaType: isVid ? 'video' : 'image',
      layout: 'pip_top',
      caption: payload.filename.replace(/\.[^.]+$/, ''),
      startFrame: f0,
      endFrame: f0 + 75,
    });
    state.layers.broll_edited = true;
    renderInspector();
    renderTimeline();
    toast(`Đã chèn B-Roll "${payload.filename}" tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'music') {
    state.layers.audio = state.layers.audio || {};
    state.layers.audio.musicFile = payload.filename;
    renderInspector();
    renderAssetsAndPipeline();
    renderTimeline();
    toast(`Đã đặt nhạc nền: ${payload.filename}`, 'success');
  } else if (payload.kind === 'sfx') {
    state.layers.voiceoverEvents = state.layers.voiceoverEvents || [];
    state.layers.voiceoverEvents.push({
      id: `SFX_${Date.now().toString().slice(-3)}`,
      file: payload.filename,
      startFrame: f0,
    });
    if (state.props) {
      state.props.sfxEvents = state.props.sfxEvents || [];
      state.props.sfxEvents.push({
        frame: f0,
        sfx: payload.filename,
        reason: payload.filename.startsWith('vo_') ? `voiceover:${payload.filename}` : 'manual',
      });
    }
    renderTimeline();
    toast(`Đã gắn âm thanh "${payload.filename}" tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'transition') {
    state.layers.cutTransitions = state.layers.cutTransitions || [];
    state.layers.cutTransitions.push({
      frame: f0,
      type: payload.effectType || 'zoom_pop',
      durationFrames: 10,
    });
    state.layers.cutTransitions_edited = true;
    toast(`Đã gắn chuyển cảnh "${payload.name}" tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'zoom' && payload.zoomPreset) {
    const zm = payload.zoomPreset;
    state.layers.zoomSegments = state.layers.zoomSegments || [];
    state.layers.zoomSegments.push({
      startFrame: f0,
      endFrame: f0 + 75,
      fromScale: zm.fromScale,
      toScale: zm.toScale,
      originY: '38%',
    });
    state.layers.zoomSegments_edited = true;
    toast(`Đã gắn hiệu ứng "${zm.name}" tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'preset_infocard' && payload.template) {
    state.layers.infoCards = state.layers.infoCards || [];
    state.layers.infoCards.push({
      id: `IC_${Date.now().toString().slice(-3)}`,
      icon: payload.template.icon || 'bolt',
      label: payload.template.label,
      detail: payload.template.detail || '',
      startFrame: f0,
      endFrame: f0 + 75,
    });
    state.layers.infoCards_edited = true;
    renderCardsAndLogosEditor();
    renderTimeline();
    updateLiveOverlays();
    toast(`Đã chèn thẻ "${payload.template.label}" tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'preset_darkscene' && payload.template) {
    state.layers.darkScenes = state.layers.darkScenes || [];
    state.layers.darkScenes.push({
      id: `DS_${Date.now().toString().slice(-3)}`,
      title: payload.template.title,
      metric: payload.template.metric || 'ĐIỂM CHÍNH',
      bullets: payload.template.bullets || ['Ý chính 1', 'Ý chính 2'],
      startFrame: f0,
      endFrame: f0 + 84,
    });
    state.layers.darkScenes_edited = true;
    renderCardsAndLogosEditor();
    renderTimeline();
    updateLiveOverlays();
    toast(`Đã chèn Cảnh kính mờ tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'preset_logo' && payload.template) {
    state.layers.logoBadges = state.layers.logoBadges || [];
    state.layers.logoBadges.push({
      id: `LG_${Date.now().toString().slice(-3)}`,
      brand: payload.template.brand,
      label: payload.template.label,
      src: '',
      position: payload.template.position || 'top_right',
      startFrame: f0,
      endFrame: f0 + 75,
    });
    state.layers.logoBadges_edited = true;
    renderCardsAndLogosEditor();
    renderTimeline();
    updateLiveOverlays();
    toast(`Đã chèn Logo "${payload.template.label}" tại ${fmtSec(atSec)}`, 'success');
  } else if (payload.kind === 'raw') {
    toast(`Đang nạp "${payload.filename}" xuống Timeline...`);
    apiJson(`/api/projects/${encodeURIComponent(state.project)}/timeline/drop-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: payload.filename, at_sec: Number(atSec) || 0 }),
    })
      .then(async (res) => {
        await loadProjectOverview(state.project, false);
        window.playRawFile(payload.filename);
        toast(`Đã đưa "${payload.filename}" (${Number(res.duration || 0).toFixed(1)}s) xuống Track 1 Timeline!`, 'success');
      })
      .catch((err) => toast(err.message, 'error'));
  }
}

function bindPoolAndTimelineDragDrop() {
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (!e.target.closest('#tlViewport, #stageDropArea, #poolAssetBody')) {
      e.preventDefault();
    }
  });

  // Drop on Timeline Viewport
  const tlVp = $('tlViewport');
  if (tlVp) {
    tlVp.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      tlVp.classList.add('dropzone-active');
    });
    tlVp.addEventListener('dragleave', (e) => {
      if (!tlVp.contains(e.relatedTarget)) tlVp.classList.remove('dropzone-active');
    });
    tlVp.addEventListener('drop', async (e) => {
      e.preventDefault();
      tlVp.classList.remove('dropzone-active');
      const rect = $('tlCanvas').getBoundingClientRect();
      const dropSec = Math.max(0, (e.clientX - rect.left) / state.pxPerSec);
      const rawJson = e.dataTransfer.getData('application/json');
      if (rawJson) {
        try {
          insertAssetAtSec(JSON.parse(rawJson), dropSec);
          return;
        } catch {
          /* ignore */
        }
      }
      if (e.dataTransfer.files?.length) {
        for (const f of e.dataTransfer.files) {
          const onVideoTrack = !!e.target.closest('#trackVideo');
          const isVideo = f.type.startsWith('video/') || isVideoFilename(f.name);
          const target = f.type.startsWith('audio/')
            ? 'music'
            : (isVideo && (onVideoTrack || !state.edlRows.length))
              ? 'raw'
              : 'broll';
          await uploadFile(f, target);
          if (target === 'raw') {
            insertAssetAtSec({ kind: 'raw', filename: f.name }, dropSec);
          } else if (target === 'broll') {
            insertAssetAtSec({ kind: 'broll', filename: f.name }, dropSec);
          }
        }
      }
    });
  }

  // Drop on 9:16 Stage
  const stageArea = $('stageDropArea');
  if (stageArea) {
    stageArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      stageArea.classList.add('dropzone-active');
    });
    stageArea.addEventListener('dragleave', (e) => {
      if (!stageArea.contains(e.relatedTarget)) stageArea.classList.remove('dropzone-active');
    });
    stageArea.addEventListener('drop', async (e) => {
      e.preventDefault();
      stageArea.classList.remove('dropzone-active');
      const rawJson = e.dataTransfer.getData('application/json');
      if (rawJson) {
        try {
          insertAssetAtSec(JSON.parse(rawJson), state.timelineSec);
          return;
        } catch {
          /* ignore */
        }
      }
      if (e.dataTransfer.files?.length) {
        for (const f of e.dataTransfer.files) {
          await uploadFile(f, 'raw');
          insertAssetAtSec({ kind: 'raw', filename: f.name }, 0);
        }
      }
    });
  }

  // Contextual Drag & Drop anywhere inside Media Pool Asset Body
  const poolBody = $('poolAssetBody');
  if (poolBody) {
    poolBody.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      poolBody.classList.add('dropzone-active');
    });
    poolBody.addEventListener('dragleave', (e) => {
      if (!poolBody.contains(e.relatedTarget)) poolBody.classList.remove('dropzone-active');
    });
    poolBody.addEventListener('drop', async (e) => {
      e.preventDefault();
      poolBody.classList.remove('dropzone-active');
      if (!e.dataTransfer.files?.length) return;
      const yMeta = getCurrentYMeta();
      if (yMeta.id === 'style_refs' || yMeta.uploadTarget === 'style_ref') {
        await uploadStyleRefFiles(e.dataTransfer.files);
        return;
      }
      for (const f of e.dataTransfer.files) {
        let target = yMeta.uploadTarget;
        if (!target) {
          if (f.type.startsWith('audio/')) target = 'music';
          else if (/\.(cube|3dl)$/i.test(f.name)) target = 'lut';
          else target = IMAGE_EXT_RE.test(f.name) ? 'broll' : 'raw';
        }
        await uploadFile(f, target);
      }
    });
  }
}

function splitAtPlayhead() {
  const fps = Number(state.props?.fps || 30);
  const curSec = state.timelineSec;
  const curF = Math.round(curSec * fps);

  const sel = state.selectedLayer;
  if (sel && ['caption', 'infocard', 'darkscene', 'logobadge', 'broll'].includes(sel.kind) && sel.ref) {
    const f0 = Number(sel.ref.startFrame || 0);
    const f1 = Number(sel.ref.endFrame || 0);
    if (curF > f0 + 9 && curF < f1 - 9) {
      pushUndoState('split_overlay');
      const clone = structuredClone(sel.ref);
      clone.id = `${sel.ref.id || 'L'}_B`;
      sel.ref.endFrame = curF;
      clone.startFrame = curF;
      const arrMap = {
        caption: ['captions', 'captions_edited'],
        infocard: ['infoCards', 'infoCards_edited'],
        darkscene: ['darkScenes', 'darkScenes_edited'],
        logobadge: ['logoBadges', 'logoBadges_edited'],
        broll: ['broll', 'broll_edited'],
      };
      const [arrKey, flagKey] = arrMap[sel.kind];
      state.layers[arrKey].splice(sel.index + 1, 0, clone);
      state.layers[flagKey] = true;
      renderInspector();
      renderTimeline();
      updateLiveOverlays();
      return toast(`Đã tách đôi ${sel.kind} tại ${curSec.toFixed(1)}s!`, 'success');
    }
  }

  const hit = state.keptOffsets.find((k) => curSec > k.tStart + 0.35 && curSec < k.tEnd - 0.35);
  if (!hit) {
    return toast('Hãy đặt Playhead vào giữa đoạn Video hoặc Layer cần tách (> 0.35s từ 2 mép).', 'error');
  }
  pushUndoState('split_edl');
  const speed = Number(state.layers?.video?.speechSpeed || 1.0);
  const ratio = (curSec - hit.tStart) / Math.max(0.1, hit.tEnd - hit.tStart);
  const splitSrcSec = Number((hit.srcStart + (curSec - hit.tStart) * speed).toFixed(3));
  const words = String(hit.row.text || '').trim().split(/\s+/);
  const wSplit = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
  const txtA = words.length >= 2 ? words.slice(0, wSplit).join(' ') : hit.row.text;
  const txtB = words.length >= 2 ? words.slice(wSplit).join(' ') : hit.row.text;

  const rowB = {
    keep: 1,
    start: splitSrcSec,
    end: hit.row.end,
    label: 'main',
    text: txtB,
    note: hit.row.note || '',
  };
  hit.row.end = splitSrcSec;
  hit.row.text = txtA;
  state.edlRows.splice(hit.edlIdx + 1, 0, rowB);

  computeKeptOffsets();
  updateTopBadges();
  renderEdlList();
  renderTimeline();
  toast(`Đã tách đôi đoạn Video R${String(hit.edlIdx + 1).padStart(2, '0')} tại ${curSec.toFixed(1)}s!`, 'success');
}

function deleteSelected() {
  const sel = state.selectedLayer;
  if (!sel && state.selectedEdlIdx >= 0) {
    setSelectedLayer('edl', state.selectedEdlIdx, state.edlRows[state.selectedEdlIdx]);
  }
  const active = state.selectedLayer;
  if (!active) return toast('Hãy bấm chọn 1 đoạn Video hoặc Layer trên Timeline để xóa.', 'error');

  pushUndoState(`delete_${active.kind}`);
  if (active.kind === 'edl') {
    const r = state.edlRows[active.index];
    if (!r) return;
    r.keep = 0;
    r.label = 'drop';
    state.selectedLayer = null;
    computeKeptOffsets();
    updateTopBadges();
    renderEdlList();
    renderTimeline();
    return toast(`Đã cắt bỏ đoạn Video R${String(active.index + 1).padStart(2, '0')}`, 'success');
  }

  if (active.kind === 'hook' && state.layers?.hook) {
    state.layers.hook.enabled = false;
  } else if (active.kind === 'adjlayer' && state.layers?.color) {
    state.layers.color.adjustmentLayerEnabled = false;
  } else if (active.kind === 'marker' && state.layers?.markers) {
    state.layers.markers.splice(active.index, 1);
  } else {
    const arrMap = {
      caption: ['captions', 'captions_edited'],
      infocard: ['infoCards', 'infoCards_edited'],
      darkscene: ['darkScenes', 'darkScenes_edited'],
      logobadge: ['logoBadges', 'logoBadges_edited'],
      broll: ['broll', 'broll_edited'],
    };
    const pair = arrMap[active.kind];
    if (pair && state.layers?.[pair[0]]) {
      state.layers[pair[0]].splice(active.index, 1);
      state.layers[pair[1]] = true;
    }
  }
  state.selectedLayer = null;
  renderInspector();
  renderTimeline();
  updateLiveOverlays();
  toast('Đã xóa Layer đang chọn!', 'success');
}

function bindStageCanvasDragging() {
  const stage = $('stageFrame');
  if (!stage) return;

  const attachDrag = (elId, onDelta) => {
    const el = $(elId);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (!state.overlaysEnabled || !state.layers) return;
      e.stopPropagation();
      const rect = stage.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      pushUndoState(`stage_drag_${elId}`);

      const onMove = (ev) => {
        const dxNorm = (ev.clientX - startX) / Math.max(100, rect.width);
        const dyNorm = (ev.clientY - startY) / Math.max(180, rect.height);
        onDelta(dxNorm, dyNorm, ev, rect);
        renderInspector();
        updateLiveOverlays();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  };

  let hookBaseTop = 88;
  $('ovHook')?.addEventListener('pointerdown', () => {
    hookBaseTop = Number(state.layers?.style?.hookTopPx ?? 88);
  });
  attachDrag('ovHook', (_dx, dyNorm) => {
    const newTop = Math.round(Math.max(40, Math.min(900, hookBaseTop + dyNorm * 1920)));
    state.layers.style.hookTopPx = newTop;
    $('ovHook').style.top = `${((newTop / 1920) * 100).toFixed(1)}%`;
  });

  let subBaseBottom = 320;
  $('ovCaptionWrap')?.addEventListener('pointerdown', () => {
    subBaseBottom = Number(state.layers?.style?.captionBottomPx ?? 320);
  });
  attachDrag('ovCaptionWrap', (_dx, dyNorm) => {
    const newBot = Math.round(Math.max(180, Math.min(960, subBaseBottom - dyNorm * 1920)));
    state.layers.style.captionBottomPx = newBot;
    $('ovCaptionWrap').style.bottom = `${((newBot / 1920) * 100).toFixed(1)}%`;
  });

  attachDrag('ovLogoBadge', (_dx, _dy, ev, rect) => {
    const fps = Number(state.props?.fps || 30);
    const frame = Math.round(state.timelineSec * fps);
    const active = (state.layers?.logoBadges || []).find((b) => frame >= b.startFrame && frame < b.endFrame);
    if (!active) return;
    const relX = (ev.clientX - rect.left) / rect.width;
    const relY = (ev.clientY - rect.top) / rect.height;
    active.position = relY > 0.48 ? 'chest_pill' : relX < 0.5 ? 'top_left' : 'top_right';
    state.layers.logoBadges_edited = true;
    const el = $('ovLogoBadge');
    el.style.left = active.position === 'top_left' ? '4.5%' : active.position === 'chest_pill' ? '30%' : 'auto';
    el.style.right = active.position === 'top_right' ? '4.5%' : 'auto';
    el.style.top = active.position === 'chest_pill' ? '58%' : '12%';
  });

  // CapCut-style Stage Video Wheel Zoom & Background Drag Pan
  stage.addEventListener(
    'wheel',
    (e) => {
      if (!state.layers) return;
      e.preventDefault();
      state.layers.video = state.layers.video || {};
      const cur = Number(state.layers.video.videoScale ?? 1.0);
      const delta = e.deltaY < 0 ? 0.04 : -0.04;
      const next = Number(Math.max(0.6, Math.min(2.2, cur + delta)).toFixed(2));
      state.layers.video.videoScale = next;
      if ($('inpVideoScale')) $('inpVideoScale').value = next;
      if ($('valVideoScale')) $('valVideoScale').textContent = `${Math.round(next * 100)}%`;
      applyLiveStageTransform();
    },
    { passive: false }
  );

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.stage-draggable')) return;
    if (!state.layers) return;
    state.layers.video = state.layers.video || {};
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = Number(state.layers.video.videoOffsetX ?? 0);
    const origY = Number(state.layers.video.videoOffsetY ?? 0);
    let panned = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panned = true;
      if (!panned) return;
      const nx = Math.round(Math.max(-45, Math.min(45, origX + (dx / Math.max(120, rect.width)) * 100)));
      const ny = Math.round(Math.max(-45, Math.min(45, origY + (dy / Math.max(200, rect.height)) * 100)));
      state.layers.video.videoOffsetX = nx;
      state.layers.video.videoOffsetY = ny;
      if ($('inpVideoOffsetX')) $('inpVideoOffsetX').value = nx;
      if ($('valVideoOffsetX')) $('valVideoOffsetX').textContent = `${nx}%`;
      if ($('inpVideoOffsetY')) $('inpVideoOffsetY').value = ny;
      if ($('valVideoOffsetY')) $('valVideoOffsetY').textContent = `${ny}%`;
      applyLiveStageTransform();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function scrubToSeconds(sec, autoPlay = false) {
  const clamped = Math.max(0, Math.min(state.totalOutSec || 120, sec));
  state.timelineSec = clamped;
  const player = $('previewPlayer');
  if (state.stageMode === 'output') {
    seekAndPlay(player, clamped, autoPlay);
  } else {
    const speed = Number(state.layers?.video?.speechSpeed || 1.0);
    const hit = state.keptOffsets.find((k) => clamped >= k.tStart && clamped <= k.tEnd);
    if (hit) {
      const srcSec = hit.srcStart + (clamped - hit.tStart) * speed;
      seekAndPlay(player, srcSec, autoPlay);
    }
  }
  updatePlayheadVisual();
  updateLiveOverlays();
}

/* ==================== RESPONSIVE LAYOUT, STAGE SCALING & OVERFLOW TOOLBARS ==================== */

function switchMobilePane(target) {
  state.mobileActivePane = target;
  document.querySelectorAll('.mnav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mnav === target);
  });
  const mainWs = $('mainWorkspace');
  if (state.layoutMode !== 'mobile') {
    mainWs?.classList.remove('hidden');
    return;
  }
  const showTimeline = target === 'timeline';
  mainWs?.classList.toggle('hidden', showTimeline);
  document.querySelectorAll('.m-pane').forEach((pane) => {
    const isMe = pane.dataset.mpane === target;
    pane.classList.toggle('hidden', !isMe);
    pane.classList.toggle('flex', isMe);
    pane.classList.toggle('m-pane-active', isMe);
  });
  fitStageFrame();
}

function applyResponsiveLayout() {
  const w = window.innerWidth;
  let mode = 'wide';
  if (w < 768) mode = 'mobile';
  else if (w < 1280) mode = 'compact';

  state.layoutMode = mode;
  document.body.dataset.layout = mode;

  const left = $('paneLeft');
  const right = $('paneRight');
  const stage = $('paneStage');
  const tl = $('paneTimeline');
  const splitL = $('splitterLeft');
  const splitR = $('splitterRight');
  const compactSwitch = $('compactSideSwitch');

  const mainWs = $('mainWorkspace');
  if (mode !== 'mobile') {
    mainWs?.classList.remove('hidden');
  }

  if (mode === 'wide') {
    compactSwitch?.classList.add('hidden');
    compactSwitch?.classList.remove('inline-flex');
    document.querySelectorAll('.compact-only-btn').forEach((b) => b.classList.add('hidden'));

    [left, stage, right, tl].forEach((p) => {
      if (!p) return;
      p.classList.remove('hidden', 'compact-hidden', 'm-pane-active');
      p.classList.add('flex');
    });

    // Clamp persisted panel widths so Stage always keeps >= 260px
    const availW = window.innerWidth;
    if (left && right && !state.leftCollapsed && !state.rightCollapsed) {
      const lw = left.style.width ? parseFloat(left.style.width) : availW * 0.34;
      const rw = right.style.width ? parseFloat(right.style.width) : availW * 0.30;
      const maxSides = availW - 260;
      if (lw + rw > maxSides && maxSides > 520) {
        const ratio = maxSides / (lw + rw);
        left.style.width = `${Math.floor(lw * ratio)}px`;
        right.style.width = `${Math.floor(rw * ratio)}px`;
      }
    }

    left?.classList.toggle('panel-collapsed', state.leftCollapsed);
    right?.classList.toggle('panel-collapsed', state.rightCollapsed);
    splitR?.classList.toggle('panel-collapsed', state.rightCollapsed);
    if ($('btnToggleLeftPanel')) $('btnToggleLeftPanel').textContent = state.leftCollapsed ? '◧+' : '◧';
    if ($('btnToggleRightPanel')) $('btnToggleRightPanel').textContent = state.rightCollapsed ? '+◨' : '◨';
  } else if (mode === 'compact') {
    compactSwitch?.classList.remove('hidden');
    compactSwitch?.classList.add('inline-flex');
    document.querySelectorAll('.compact-only-btn').forEach((b) => b.classList.remove('hidden'));
    document.querySelectorAll('.compact-wb-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.cside === state.compactSidePane);
    });

    left?.classList.remove('panel-collapsed', 'm-pane-active');
    right?.classList.remove('panel-collapsed', 'm-pane-active');
    [left, stage, right, tl].forEach((p) => {
      p?.classList.remove('hidden');
      p?.classList.add('flex');
    });
    left?.classList.toggle('compact-hidden', state.compactSidePane !== 'left');
    right?.classList.toggle('compact-hidden', state.compactSidePane !== 'right');
    splitL?.classList.add('hidden');
    splitR?.classList.add('hidden');
  } else {
    // mobile (< 768px)
    compactSwitch?.classList.add('hidden');
    compactSwitch?.classList.remove('inline-flex');
    document.querySelectorAll('.compact-only-btn').forEach((b) => b.classList.add('hidden'));
    left?.classList.remove('panel-collapsed', 'compact-hidden');
    right?.classList.remove('panel-collapsed', 'compact-hidden');
    switchMobilePane(state.mobileActivePane || 'stage');
  }

  tl?.classList.toggle('tl-collapsed', state.tlCollapsed);
  if ($('btnToggleTimelineCollapse')) {
    $('btnToggleTimelineCollapse').textContent = state.tlCollapsed ? '▴' : '▾';
  }

  applyTimelineHeight(state.tlHeightPx, false);
  fitStageFrame();
  adaptHeaderOverflow();
  adaptTimelineOverflow();
}

function fitStageFrame() {
  const area = $('stageDropArea');
  const frame = $('stageFrame');
  const stage = $('paneStage');
  if (!area || !frame || !stage || stage.classList.contains('hidden')) return;
  if (area.clientWidth < 40 || area.clientHeight < 40) return;

  const cs = getComputedStyle(area);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const availW = Math.max(90, area.clientWidth - padX);
  const availH = Math.max(100, area.clientHeight - padY);

  const frameH = Math.min(availH, availW * (16 / 9));
  const frameW = frameH * (9 / 16);
  frame.style.width = `${Math.floor(frameW)}px`;
  frame.style.height = `${Math.floor(frameH)}px`;

  const scale = Math.max(0.32, Math.min(1.8, frameH / 560));
  frame.style.setProperty('--stage-scale', scale.toFixed(3));
}

function adaptHeaderOverflow() {
  const header = $('topHeader');
  const leftCluster = $('hdrLeftCluster');
  const wrap = $('headerOverflowWrap');
  const dd = $('headerOverflowDropdown');
  const cntEl = $('hdrOverflowCount');
  if (!header || !wrap || !dd) return;

  const candidates = Array.from(header.querySelectorAll('[data-hdr-ov]'));
  candidates.forEach((el) => el.classList.remove('is-overflowed'));
  header.classList.remove('compact-labels');
  wrap.classList.add('hidden');

  const isOverflowing = () =>
    header.scrollWidth > header.clientWidth + 2 ||
    (leftCluster ? leftCluster.scrollWidth > leftCluster.clientWidth + 2 : false);

  if (isOverflowing() || window.innerWidth < 1180) {
    header.classList.add('compact-labels');
  }

  const ordered = candidates
    .slice()
    .sort((a, b) => Number(a.dataset.hdrOv || 0) - Number(b.dataset.hdrOv || 0));

  const moved = [];
  for (const el of ordered) {
    if (!isOverflowing()) break;
    if (el.classList.contains('hidden')) continue; // genuinely inactive (e.g. qaBadge when no QA yet)
    el.classList.add('is-overflowed');
    moved.push(el);
    wrap.classList.remove('hidden');
  }

  if (moved.length === 0) {
    wrap.classList.add('hidden');
    dd.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  if (cntEl) cntEl.textContent = `${moved.length}`;
  const hasAlertInside = moved.some((el) => el.id === 'btnGapAlertPill');
  const ovBtn = $('btnHeaderOverflow');
  if (ovBtn) {
    ovBtn.classList.toggle('border-amber-500/50', hasAlertInside);
    ovBtn.classList.toggle('text-amber-300', hasAlertInside);
  }

  dd.innerHTML = '';
  moved.forEach((orig) => {
    if (orig.tagName === 'SELECT') {
      const box = document.createElement('div');
      box.className = 'p-1.5 rounded-lg bg-[#18181E] border border-[#26262F] space-y-1';
      box.innerHTML = `<div class="text-[10px] text-zinc-400">${escHtml(orig.dataset.ovLabel || 'Tùy chọn')}</div>`;
      const sel = document.createElement('select');
      sel.className = 'w-full h-7 rounded bg-[#111115] border border-[#26262F] px-2 text-xs text-zinc-100';
      sel.innerHTML = orig.innerHTML;
      sel.value = orig.value;
      sel.addEventListener('change', () => {
        orig.value = sel.value;
        orig.dispatchEvent(new Event('change'));
      });
      box.appendChild(sel);
      dd.appendChild(box);
    } else if (orig.tagName === 'SPAN') {
      const info = document.createElement('div');
      info.className = 'px-2.5 py-1.5 rounded-lg bg-[#18181E] border border-[#26262F] flex items-center justify-between text-[11px]';
      info.innerHTML = `<span class="text-zinc-400">${escHtml(orig.dataset.ovLabel || '')}</span><span class="font-mono text-zinc-100">${escHtml(orig.textContent.trim())}</span>`;
      dd.appendChild(info);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full px-2.5 py-1.5 rounded-lg bg-[#18181E] hover:bg-[#22222A] border border-[#26262F] text-left text-xs font-medium text-zinc-100 flex items-center justify-between gap-2';
      btn.innerHTML = `<span>${escHtml(orig.dataset.ovLabel || orig.textContent.trim())}</span><span class="text-[10px] font-mono text-cyan-400 truncate max-w-[120px]">${escHtml(orig.textContent.trim())}</span>`;
      btn.addEventListener('click', () => {
        dd.classList.add('hidden');
        orig.click();
      });
      dd.appendChild(btn);
    }
  });
}

function adaptTimelineOverflow() {
  const bar = $('tlToolbar');
  const wrap = $('tlOverflowWrap');
  const dd = $('tlOverflowDropdown');
  if (!bar || !wrap || !dd) return;

  const candidates = Array.from(bar.querySelectorAll('[data-tl-ov]'));
  candidates.forEach((el) => el.classList.remove('is-overflowed'));
  wrap.classList.add('hidden');

  const isOverflowing = () => bar.scrollWidth > bar.clientWidth + 2;
  const ordered = candidates
    .slice()
    .sort((a, b) => Number(a.dataset.tlOv || 0) - Number(b.dataset.tlOv || 0));

  const moved = [];
  for (const el of ordered) {
    if (!isOverflowing()) break;
    el.classList.add('is-overflowed');
    if (el.tagName === 'BUTTON' || el.id === 'tlZoomGroup') moved.push(el);
    wrap.classList.remove('hidden');
  }

  if (moved.length === 0) {
    wrap.classList.add('hidden');
    dd.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  dd.innerHTML = '';
  moved.forEach((orig) => {
    if (orig.id === 'tlZoomGroup') {
      const box = document.createElement('div');
      box.className = 'p-2 rounded-lg bg-[#18181E] border border-[#26262F] space-y-1';
      box.innerHTML = '<div class="text-[10px] text-zinc-400">Zoom Timeline</div>';
      const rng = document.createElement('input');
      rng.type = 'range';
      rng.min = '16';
      rng.max = '90';
      rng.value = String(state.pxPerSec);
      rng.className = 'w-full accent-cyan-400';
      rng.addEventListener('input', () => {
        state.pxPerSec = Number(rng.value);
        if ($('tlZoomRange')) $('tlZoomRange').value = rng.value;
        renderTimeline();
      });
      box.appendChild(rng);
      dd.appendChild(box);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full px-2.5 py-1.5 rounded-lg bg-[#18181E] hover:bg-[#22222A] border border-[#26262F] text-left text-xs font-medium text-zinc-100';
      btn.textContent = orig.dataset.ovLabel || orig.textContent.trim();
      btn.addEventListener('click', () => {
        dd.classList.add('hidden');
        orig.click();
      });
      dd.appendChild(btn);
    }
  });
}

function applyTimelineHeight(px, persist = true) {
  const tl = $('paneTimeline');
  if (!tl) return;
  const maxH = Math.max(240, Math.round(window.innerHeight * 0.58));
  const h = Math.max(108, Math.min(maxH, Math.round(Number(px) || 196)));
  state.tlHeightPx = h;

  const isMobile = state.layoutMode === 'mobile';
  if (isMobile || state.tlCollapsed) {
    tl.style.height = '';
    tl.classList.remove('tl-mini', 'tl-tall');
  } else {
    tl.style.height = `${h}px`;
    tl.classList.toggle('tl-mini', h < 180);
    tl.classList.toggle('tl-tall', h > 250);
  }

  const cycBtn = $('btnCycleTimelineSize');
  if (cycBtn) {
    const label = h < 170 ? 'Nhỏ ⇅' : h > 245 ? 'Cao ⇅' : 'Vừa ⇅';
    cycBtn.textContent = label;
    cycBtn.title = `Đổi chiều cao Timeline (hiện ${h}px)`;
  }

  if (persist) {
    try { localStorage.setItem('anthinh_tl_h', String(h)); } catch { /* ignore */ }
  }
}

function cycleTimelineSize() {
  if (state.tlCollapsed) {
    state.tlCollapsed = false;
    $('paneTimeline')?.classList.remove('tl-collapsed');
    if ($('btnToggleTimelineCollapse')) $('btnToggleTimelineCollapse').textContent = '▾';
  }
  const cur = Number(state.tlHeightPx) || 196;
  const nextH = cur < 165 ? 196 : cur < 245 ? 290 : 124;
  applyTimelineHeight(nextH, true);
  fitStageFrame();
}

function setTimelineZoom(nextPx) {
  const rng = $('tlZoomRange');
  const minPx = Number(rng?.min || 12);
  const maxPx = Number(rng?.max || 90);
  const clamped = Math.max(minPx, Math.min(maxPx, Math.round(Number(nextPx) || state.pxPerSec)));
  state.pxPerSec = clamped;
  if (rng) rng.value = String(clamped);
  renderTimeline();
  updatePlayheadVisual();
}

function fitTimelineZoom() {
  const vpW = Math.max(240, ($('tlViewport')?.clientWidth || 720) - 40);
  const dur = Math.max(5, Number(state.totalOutSec) || 30);
  setTimelineZoom(vpW / dur);
}

function bindPanelSplitters() {
  const left = $('paneLeft');
  const right = $('paneRight');
  const tl = $('paneTimeline');
  const splitL = $('splitterLeft');
  const splitR = $('splitterRight');
  const splitTl = $('splitterTimeline');
  const main = $('mainWorkspace');
  if (!main) return;

  const savedL = localStorage.getItem('anthinh_left_w');
  const savedR = localStorage.getItem('anthinh_right_w');
  const savedTlH = Number(localStorage.getItem('anthinh_tl_h'));
  if (savedL && left) left.style.width = savedL;
  if (savedR && right) right.style.width = savedR;
  if (Number.isFinite(savedTlH) && savedTlH >= 108) state.tlHeightPx = savedTlH;

  if (splitL && left) {
    splitL.addEventListener('pointerdown', (e) => {
      if (state.layoutMode !== 'wide') return;
      e.preventDefault();
      splitL.classList.add('dragging');
      const startX = e.clientX;
      const startW = left.getBoundingClientRect().width;
      const onMove = (ev) => {
        const maxW = Math.min(560, main.clientWidth * 0.5);
        const nw = Math.max(270, Math.min(maxW, startW + (ev.clientX - startX)));
        left.style.width = `${Math.round(nw)}px`;
        fitStageFrame();
      };
      const onUp = () => {
        splitL.classList.remove('dragging');
        localStorage.setItem('anthinh_left_w', left.style.width);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  if (splitR && right) {
    splitR.addEventListener('pointerdown', (e) => {
      if (state.layoutMode !== 'wide') return;
      e.preventDefault();
      splitR.classList.add('dragging');
      const startX = e.clientX;
      const startW = right.getBoundingClientRect().width;
      const onMove = (ev) => {
        const maxW = Math.min(500, main.clientWidth * 0.45);
        const nw = Math.max(260, Math.min(maxW, startW - (ev.clientX - startX)));
        right.style.width = `${Math.round(nw)}px`;
        fitStageFrame();
      };
      const onUp = () => {
        splitR.classList.remove('dragging');
        localStorage.setItem('anthinh_right_w', right.style.width);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  if (splitTl && tl) {
    splitTl.addEventListener('pointerdown', (e) => {
      if (state.layoutMode === 'mobile') return;
      e.preventDefault();
      if (state.tlCollapsed) {
        state.tlCollapsed = false;
        tl.classList.remove('tl-collapsed');
        if ($('btnToggleTimelineCollapse')) $('btnToggleTimelineCollapse').textContent = '▾';
      }
      splitTl.classList.add('dragging');
      const startY = e.clientY;
      const startH = tl.getBoundingClientRect().height || state.tlHeightPx || 196;
      const onMove = (ev) => {
        const nh = startH + (startY - ev.clientY);
        applyTimelineHeight(nh, false);
        fitStageFrame();
      };
      const onUp = () => {
        splitTl.classList.remove('dragging');
        applyTimelineHeight(state.tlHeightPx, true);
        fitStageFrame();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }
}

/* ==================== EXPORT MODAL CONTROLLER (TIKTOK / CAPCUT WORKFLOW) ==================== */

function sanitizeExportSlug(raw) {
  let cleaned = String(raw || '').trim();
  if (cleaned.toLowerCase().endsWith('.mp4')) {
    cleaned = cleaned.slice(0, -4).trim();
  }
  cleaned = cleaned
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned === '_demo' || cleaned === 'Demo' || cleaned === 'tim-ugc-mien-phi') {
    const hookTitle = (state.layers?.hook?.title || '').trim();
    cleaned = hookTitle || 'Review máy đọc sách XTEINK';
  }
  return cleaned;
}

function getSelectedExportEngine() {
  return $('selSettingsDefaultEngine')?.value || $('selRenderEngine')?.value || 'remotion';
}

function updateExportFilenamePreview() {
  const rawTopic = ($('expInpTopic')?.value || '').trim() || ($('inpTopic')?.value || '').trim() || state.project || 'Video WishEdit';
  const cleanName = sanitizeExportSlug(rawTopic);
  const ov = state.overview || {};
  const existing = (ov.outputs || []).filter(
    (n) => n === `${cleanName}.mp4` || n.startsWith(`${cleanName} (`) || n.startsWith(`${cleanName}_v`)
  );
  const overwrite = !!$('expChkOverwrite')?.checked;
  const outName = overwrite || existing.length === 0 ? `${cleanName}.mp4` : `${cleanName} (${existing.length + 1}).mp4`;
  if ($('expFilenamePreview')) $('expFilenamePreview').textContent = `Projects/${state.project || 'Demo'}/05_output/${outName}`;
  if ($('expModalTitle')) $('expModalTitle').textContent = `Export — ${cleanName}`;

  const coverImg = $('expCoverThumbImg');
  if (coverImg && state.project) {
    const outs = ov.outputs || [];
    const raws = ov.raw_files || [];
    if (outs.length) {
      coverImg.src = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=output&filename=${encodeURIComponent(outs[outs.length - 1])}`;
    } else if (raws.length) {
      coverImg.src = `/api/projects/${encodeURIComponent(state.project)}/thumbnail?kind=raw&filename=${encodeURIComponent(raws[0])}`;
    }
  }

  const speed = Number(state.layers?.video?.speechSpeed || 1.0);
  const rawKept = Number(ov.edl_summary?.kept_seconds || 0);
  const outDur = state.totalOutSec > 0 ? state.totalOutSec : (speed > 0 ? rawKept / speed : rawKept);
  if ($('expDurSummary')) $('expDurSummary').textContent = `${Number(outDur || 0).toFixed(1)}s`;
  if ($('expSegSummary')) {
    const estMb = Math.max(4, Math.round(Number(outDur || 15) * 0.95));
    $('expSegSummary').textContent = `Dung lượng ước tính: ~${estMb} MB`;
  }
}

function openExportModal(mode = 'config') {
  const modal = $('modalExport');
  if (!modal) return;
  modal.classList.remove('hidden');

  if (mode === 'progress' || (state.exportJobId && state.isAiBusy)) {
    $('exportConfigView')?.classList.add('hidden');
    $('exportResultView')?.classList.add('hidden');
    $('exportProgressView')?.classList.remove('hidden');
    if ($('expHeaderSub')) $('expHeaderSub').textContent = 'Đang xuất video 9:16...';
    return;
  }

  if (mode === 'result' && state.lastExportResult) {
    $('exportConfigView')?.classList.add('hidden');
    $('exportProgressView')?.classList.add('hidden');
    $('exportResultView')?.classList.remove('hidden');
    return;
  }

  $('exportProgressView')?.classList.add('hidden');
  $('exportResultView')?.classList.add('hidden');
  $('exportConfigView')?.classList.remove('hidden');
  if ($('expHeaderSub')) $('expHeaderSub').textContent = '1080P · 30fps · Rec.709';

  if ($('expInpTopic')) {
    const curTopic = ($('inpTopic')?.value || '').trim();
    $('expInpTopic').value =
      !curTopic || curTopic === 'tim-ugc-mien-phi' || curTopic === '_demo' || curTopic === 'Demo'
        ? (state.project === 'Demo' || state.project === '_demo' ? 'Review máy đọc sách XTEINK' : state.project)
        : curTopic;
  }
  const curEngine = $('selRenderEngine')?.value || 'remotion';
  document.querySelectorAll('input[name="expEngine"]').forEach((r) => {
    r.checked = r.value === curEngine;
  });
  if ($('expChkOtherPlatforms')) $('expChkOtherPlatforms').checked = false;
  if ($('expChkOverwrite')) $('expChkOverwrite').checked = true;
  updateExportFilenamePreview();
}

function updateExportProgressModal(job, isError = false) {
  $('exportConfigView')?.classList.add('hidden');
  $('exportResultView')?.classList.add('hidden');
  $('exportProgressView')?.classList.remove('hidden');

  const pct = isError ? Math.max(10, Number(job?.progress_pct ?? 50)) : Math.max(4, Math.min(100, Number(job?.progress_pct ?? 5)));
  const elapsed = Math.max(0, Math.round(Number(job?.elapsed_sec || 0)));
  const stepText = isError
    ? `Lỗi xuất video: ${job?.error || 'Thất bại'}`
    : (job?.step_label || 'Đang chuẩn bị render...');

  if ($('expHeaderSub')) $('expHeaderSub').textContent = isError ? 'Quá trình xuất gặp lỗi' : `Đang xuất video... (${pct}%)`;
  if ($('expStepLabel')) $('expStepLabel').textContent = stepText;
  if ($('expElapsedText')) $('expElapsedText').textContent = `${elapsed}s`;
  if ($('expPctText')) $('expPctText').textContent = `${pct}%`;

  const bar = $('expProgressBar');
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.classList.toggle('bg-rose-500', isError);
    bar.classList.toggle('bg-cyan-500', !isError);
  }

  let activeStep = 1;
  if (pct >= 92 || /QA/i.test(stepText)) activeStep = 5;
  else if (pct >= 60 || /4\/5|Remotion|Render/i.test(stepText)) activeStep = 4;
  else if (pct >= 40 || /3\/5|Layer|Overlay/i.test(stepText)) activeStep = 3;
  else if (pct >= 20 || /2\/5|Cắt|Audio/i.test(stepText)) activeStep = 2;

  document.querySelectorAll('.exp-step-pill').forEach((pill) => {
    const s = Number(pill.dataset.estep || 0);
    pill.classList.remove(
      'border-cyan-500/60', 'bg-cyan-500/15', 'text-cyan-300',
      'border-emerald-500/50', 'bg-emerald-500/10', 'text-emerald-300',
      'border-[#26262F]', 'text-zinc-500'
    );
    if (s < activeStep || (!isError && pct >= 100)) {
      pill.classList.add('border-emerald-500/50', 'bg-emerald-500/10', 'text-emerald-300');
    } else if (s === activeStep) {
      pill.classList.add('border-cyan-500/60', 'bg-cyan-500/15', 'text-cyan-300');
    } else {
      pill.classList.add('border-[#26262F]', 'text-zinc-500');
    }
  });

  const logBox = $('expLogBox');
  if (logBox) {
    logBox.textContent = (job?.logs || []).join('\n') || 'Đang khởi tạo...';
    logBox.scrollTop = logBox.scrollHeight;
  }
}

function showExportResultModal(job) {
  const res = job?.result || {};
  const outPath = String(res.output_video || '');
  const outs = state.overview?.outputs || [];
  const fileName = outPath ? outPath.split(/[\\/]/).pop() : (outs[outs.length - 1] || '');
  state.lastExportResult = { ...res, fileName };

  $('exportConfigView')?.classList.add('hidden');
  $('exportProgressView')?.classList.add('hidden');
  $('exportResultView')?.classList.remove('hidden');

  const passed = res.qa_passed !== false;
  if ($('expHeaderSub')) $('expHeaderSub').textContent = passed ? 'Xuất video hoàn tất (Đạt chuẩn)!' : 'Xuất video xong (Có lưu ý kỹ thuật)';
  if ($('expResultQaBadge')) {
    $('expResultQaBadge').textContent = passed ? 'ĐẠT CHUẨN · 1080×1920' : 'CẦN KIỂM TRA';
    $('expResultQaBadge').className = passed
      ? 'px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold shrink-0'
      : 'px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono text-[10px] font-bold shrink-0';
  }
  const banner = $('expResultBanner');
  if (banner) {
    banner.classList.toggle('border-cyan-500/40', passed);
    banner.classList.toggle('bg-cyan-950/20', passed);
    banner.classList.toggle('border-rose-500/40', !passed);
    banner.classList.toggle('bg-rose-950/20', !passed);
  }
  if ($('expResultFile')) $('expResultFile').textContent = fileName || '05_output/';

  const parts = [];
  if (res.duration_sec != null) parts.push(`Thời lượng: ${Number(res.duration_sec).toFixed(1)}s`);
  if (res.elapsed_sec != null) parts.push(`Render: ${Number(res.elapsed_sec).toFixed(1)}s`);
  if (res.other_platform_video) parts.push('+ Reels/Shorts');
  if (res.resolve_edl) parts.push('+ Resolve EDL');
  if (Array.isArray(res.qa_warnings) && res.qa_warnings.length) {
    parts.push(`Lưu ý: ${res.qa_warnings.join('; ')}`);
  }
  if ($('expResultMeta')) $('expResultMeta').textContent = parts.join(' · ') || 'Chuẩn 9:16 30fps h264 AAC -14 LUFS';

  const dl = $('btnExpDownload');
  if (dl && fileName) {
    const dlUrl = `/api/projects/${encodeURIComponent(state.project)}/media/output/${encodeURIComponent(fileName)}`;
    if (dl.tagName === 'A') {
      dl.href = dlUrl;
      dl.setAttribute('download', fileName);
    } else {
      dl.onclick = () => {
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = fileName;
        a.click();
      };
    }
  }
}

async function startExportFromModal() {
  if (state.isAiBusy) return toast('Hệ thống đang xử lý tác vụ khác, vui lòng đợi...', 'info');
  const topic = ($('expInpTopic')?.value || '').trim() || ($('inpTopic')?.value || '').trim() || state.project;
  const engine = getSelectedExportEngine();
  const otherPlatforms = !!$('expChkOtherPlatforms')?.checked;
  const overwrite = !!$('expChkOverwrite')?.checked;

  if ($('inpTopic')) $('inpTopic').value = topic;
  if ($('selRenderEngine')) $('selRenderEngine').value = engine;
  if ($('chkOtherPlatforms')) $('chkOtherPlatforms').checked = otherPlatforms;

  updateExportProgressModal({ progress_pct: 4, step_label: 'Đang lưu EDL & Layers trước khi xuất...', elapsed_sec: 0, logs: [] });
  await saveAllEdlAndLayers(true);

  const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      overwrite,
      other_platforms: otherPlatforms,
      render_engine: engine,
    }),
  });
  state.exportJobId = data.job_id;
  pollJob(data.job_id, `Render (${engine}) hoàn tất! Có thể bấm Phát bản mới.`);
}

/* ==================== SAVE / PIPELINE / AI / RENDER / BRIDGE ==================== */

async function saveAllEdlAndLayers(silent = false) {
  if (!state.project) return;
  syncInspectorToLayers();
  await apiJson(`/api/projects/${encodeURIComponent(state.project)}/edl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: state.edlRows, mark_final: true }),
  });
  await apiJson(`/api/projects/${encodeURIComponent(state.project)}/layers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layers: state.layers }),
  });
  if (!silent) toast('Đã lưu EDL, Màu LUT & Layers!', 'success');
  await loadProjectOverview(state.project, false);
}

async function pollJob(jobId, onSuccessMsg, opts = {}) {
  state.activeJobId = jobId;
  state.isAiBusy = true;
  $('jobProgressWrap')?.classList.remove('hidden');
  $('jobProgressWrap')?.classList.add('inline-flex');
  if ($('jobProgressText')) $('jobProgressText').textContent = 'Đang chạy...';
  adaptHeaderOverflow();

  const tick = async () => {
    try {
      const job = await apiJson(`/api/jobs/${jobId}`);
      if ($('jobLogBox')) $('jobLogBox').textContent = (job.logs || []).join('\n');
      const isExportJob = state.exportJobId && state.exportJobId === jobId;

      if (job.status === 'running') {
        const lastLog = (job.logs || []).slice(-1)[0] || 'Đang xử lý...';
        const barLabel = job.progress_pct != null && job.step_label
          ? `${job.progress_pct}% · ${job.step_label}`
          : lastLog;
        if ($('jobProgressText')) $('jobProgressText').textContent = barLabel;
        if (isExportJob) updateExportProgressModal(job, false);
        setTimeout(tick, 1200);
        return;
      }

      state.isAiBusy = false;
      $('jobProgressWrap')?.classList.add('hidden');
      $('jobProgressWrap')?.classList.remove('inline-flex');
      adaptHeaderOverflow();

      if (job.status === 'failed' || job.status === 'error') {
        if (isExportJob) {
          updateExportProgressModal(job, true);
          state.exportJobId = null;
        }
        toast(`Lỗi: ${job.error || 'Tác vụ thất bại'}`, 'error');
      } else {
        toast(onSuccessMsg || 'Hoàn tất!', 'success');
        await loadProjectOverview(state.project, false);
        if (typeof opts?.onDone === 'function') await opts.onDone(job);
        if (isExportJob) {
          state.exportJobId = null;
          showExportResultModal(job);
        }
      }
    } catch (err) {
      state.isAiBusy = false;
      $('jobProgressWrap')?.classList.add('hidden');
      $('jobProgressWrap')?.classList.remove('inline-flex');
      adaptHeaderOverflow();
      if (state.exportJobId === jobId) {
        updateExportProgressModal({ progress_pct: 50, error: err.message, logs: [err.message] }, true);
        state.exportJobId = null;
      }
      toast(err.message, 'error');
    }
  };
  setTimeout(tick, 700);
}

async function uploadFile(file, target) {
  if (!file || !state.project) return;
  try {
    const fd = new FormData();
    fd.append('file', file);
    toast(`Đang tải ${file.name} lên ${target}...`);
    await apiJson(`/api/projects/${encodeURIComponent(state.project)}/upload?target=${encodeURIComponent(target)}`, {
      method: 'POST',
      body: fd,
    });
    toast(`Đã tải xong ${file.name}`, 'success');
    await loadProjectOverview(state.project, false);
  } catch (err) {
    toast(`Lỗi tải ${file.name}: ${err.message}`, 'error');
  }
}

async function uploadMultipleFiles(fileList, target, inputEl = null) {
  const files = Array.from(fileList || []);
  for (const f of files) {
    await uploadFile(f, target);
  }
  if (inputEl) inputEl.value = '';
}

function renderLogsModalContent() {
  const ov = state.overview || {};
  if ($('qaReportBox')) $('qaReportBox').textContent = ov.qa_report ? JSON.stringify(ov.qa_report, null, 2) : 'Chưa có báo cáo QA.';
  if ($('pipelineLogBox')) $('pipelineLogBox').textContent = (ov.logs_tail || []).join('\n') || 'Chưa có nhật ký.';
}

/* ==================== INIT & EVENT WIRING ==================== */

function bindEvents() {
  // Multi-Project Switcher
  $('projectSelect')?.addEventListener('change', (e) => loadProjectOverview(e.target.value, true));

  // New Project Wizard Modal
  const openNewProjModal = () => {
    $('inpNewProjName').value = '';
    $('inpNewProjBrief').value = '';
    $('chkNewProjAutoBroll').checked = true;
    $('modalNewProject')?.classList.remove('hidden');
    $('inpNewProjName')?.focus();
  };
  const closeNewProjModal = () => $('modalNewProject')?.classList.add('hidden');
  $('btnNewProject')?.addEventListener('click', openNewProjModal);
  $('btnCloseNewProject')?.addEventListener('click', closeNewProjModal);
  $('btnCancelNewProject')?.addEventListener('click', closeNewProjModal);

  $('btnConfirmNewProject')?.addEventListener('click', async () => {
    try {
      const name = ($('inpNewProjName')?.value || '').trim();
      if (!name) return toast('Hãy nhập tên dự án mới.', 'error');
      const res = await apiJson('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          brief_text: ($('inpNewProjBrief')?.value || '').trim(),
          auto_broll: $('chkNewProjAutoBroll')?.checked !== false,
        }),
      });
      const newProj = res.project || res.name || name;
      closeNewProjModal();
      toast(`Đã tạo thư mục dự án độc lập "Projects/${newProj}"!`, 'success');
      await loadProjects(newProj);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnRefresh')?.addEventListener('click', () => loadProjectOverview(state.project, false));

  // Left Primary Tabs (Media Pool / EDL / Brief & AI)
  document.querySelectorAll('.left-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.left-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.left-pane').forEach((p) => p.classList.add('hidden'));
      $(`tab-${btn.dataset.tab}`)?.classList.remove('hidden');
    });
  });

  // CapCut 2-Column X & Y Media Pool Navigation
  document.querySelectorAll('.pool-x-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectPoolXY(btn.dataset.px));
  });

  $('btnPoolContextUpload')?.addEventListener('click', () => {
    const yMeta = getCurrentYMeta();
    if (yMeta?.inputId) $(yMeta.inputId)?.click();
  });

  const jumpToContextAdjustment = () => {
    const yMeta = getCurrentYMeta();
    openAdjustmentPanel(yMeta?.adjustItab || POOL_SCHEMA[state.poolX]?.defaultItab || 'video');
  };
  $('btnPoolQuickAdjust')?.addEventListener('click', jumpToContextAdjustment);
  $('btnColYAdjust')?.addEventListener('click', jumpToContextAdjustment);
  $('btnPoolOpenAdjust')?.addEventListener('click', jumpToContextAdjustment);

  // Compact 2-Column Side Switchers & Wide Collapse Toggles
  document.querySelectorAll('.compact-wb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.compactSidePane = btn.dataset.cside;
      applyResponsiveLayout();
    });
  });
  $('btnSwapToInspectorCompact')?.addEventListener('click', () => {
    state.compactSidePane = 'right';
    applyResponsiveLayout();
  });
  $('btnSwapToPoolCompact')?.addEventListener('click', () => {
    state.compactSidePane = 'left';
    applyResponsiveLayout();
  });
  $('btnToggleLeftPanel')?.addEventListener('click', () => {
    state.leftCollapsed = !state.leftCollapsed;
    applyResponsiveLayout();
  });
  $('btnToggleRightPanel')?.addEventListener('click', () => {
    state.rightCollapsed = !state.rightCollapsed;
    applyResponsiveLayout();
  });
  $('btnToggleTimelineCollapse')?.addEventListener('click', () => {
    state.tlCollapsed = !state.tlCollapsed;
    applyResponsiveLayout();
  });

  // Overflow Menus (Header & Timeline)
  $('btnHeaderOverflow')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('headerOverflowDropdown')?.classList.toggle('hidden');
  });
  $('btnTlOverflow')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('tlOverflowDropdown')?.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#headerOverflowWrap')) $('headerOverflowDropdown')?.classList.add('hidden');
    if (!e.target.closest('#tlOverflowWrap')) $('tlOverflowDropdown')?.classList.add('hidden');
  });

  // EDL Filters
  document.querySelectorAll('.edl-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.edl-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.edlFilter = btn.dataset.filter;
      renderEdlList();
    });
  });

  // Inspector Tabs (6 tabs)
  document.querySelectorAll('.insp-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.insp-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.insp-pane').forEach((p) => p.classList.add('hidden'));
      $(`itab-${btn.dataset.itab}`)?.classList.remove('hidden');
    });
  });

  // Jump back from Inspector -> Media Pool
  $('btnOpenPoolColor')?.addEventListener('click', () => openPoolCategory('color', 'lut_all'));
  $('btnOpenPoolBroll')?.addEventListener('click', () => openPoolCategory('media', 'broll'));
  $('btnJumpAssets')?.addEventListener('click', () => openPoolCategory('media', 'broll'));

  // Smart Color & 10 LUTs Controls (in Right Inspector)
  $('btnToggleAutoColor')?.addEventListener('click', () => {
    const c = ensureColorObject();
    if (!c) return;
    pushUndoState('toggle_auto_color');
    c.autoColorEnabled = !c.autoColorEnabled;
    renderColorAndLuts();
    renderTimeline();
    applyLiveStageColorFilter();
    toast(c.autoColorEnabled ? 'Đã bật AI Auto Color (Cân sáng & màu da)' : 'Đã tắt AI Auto Color');
  });

  $('inpAutoColorIntensity')?.addEventListener('input', (e) => {
    const c = ensureColorObject();
    if (!c) return;
    c.autoColorIntensity = Number(e.target.value);
    if ($('valAutoColorIntensity')) $('valAutoColorIntensity').textContent = `${c.autoColorIntensity}%`;
    applyLiveStageColorFilter();
  });

  $('chkAdjustmentLayer')?.addEventListener('change', (e) => {
    const c = ensureColorObject();
    if (!c) return;
    c.adjustmentLayerEnabled = e.target.checked;
    renderTimeline();
    toast(c.adjustmentLayerEnabled ? 'Đã bật Adjustment Layer trên Timeline' : 'Đã tắt Adjustment Layer');
  });

  $('btnColorSyncAll')?.addEventListener('click', async () => {
    try {
      const c = ensureColorObject();
      const res = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/color-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: c }),
      });
      toast(`Đã đồng bộ màu & LUT sang toàn bộ ${res.synced_clips} đoạn cắt!`, 'success');
      await loadProjectOverview(state.project, false);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  ['inpColorBright', 'inpColorContrast', 'inpColorSat'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      syncInspectorToLayers();
      renderColorAndLuts();
    });
  });

  // AI Auto B-Roll Toggle in Right Inspector
  $('chkAutoBrollToggle')?.addEventListener('change', async (e) => {
    if (!state.layers) return;
    state.layers.autoBrollEnabled = e.target.checked;
    if (e.target.checked && !(state.layers.broll || []).length && !state.isAiBusy) {
      toast('Đang chạy AI Auto B-Roll cận cảnh...');
      await saveAllEdlAndLayers(true);
      const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/auto-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fetch_logos: false,
          generate_broll: true,
          ensure_music: true,
          tts_text: '',
          tts_at_sec: 0,
          tts_voice: 'vi-VN-NamMinhNeural',
        }),
      });
      pollJob(data.job_id, 'AI Auto B-Roll đã tự động dựng & chèn cảnh vào Timeline!');
    } else {
      toast(e.target.checked ? 'Đã bật chế độ AI Auto B-Roll' : 'Đã chuyển sang nạp B-Roll thủ công');
    }
  });

  // Live inspector bindings
  ['inpSpeechSpeed', 'inpMusicDb', 'inpSfxDb'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      if (id === 'inpSpeechSpeed') $('valSpeechSpeed').textContent = `${Number($('inpSpeechSpeed').value).toFixed(2)}x`;
      if (id === 'inpMusicDb') $('valMusicDb').textContent = `${$('inpMusicDb').value} dB`;
      if (id === 'inpSfxDb') $('valSfxDb').textContent = `${$('inpSfxDb').value} dB`;
      syncInspectorToLayers();
      renderTimeline();
    });
  });

  ['inpVideoScale', 'inpVideoOffsetX', 'inpVideoOffsetY'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      syncInspectorToLayers();
    });
  });

  $('btnResetStageTransform')?.addEventListener('click', () => {
    if (!state.layers) return;
    pushUndoState('reset_stage_transform');
    state.layers.video = {
      ...(state.layers.video || {}),
      videoScale: 1.0,
      videoOffsetX: 0,
      videoOffsetY: 0,
    };
    renderInspector();
    toast('Đã đặt lại khung hình 9:16 về mặc định (100%)');
  });

  [
    'inpWatermark', 'chkSubtleZoom', 'chkPreserveRes', 'chkOtherPlatforms',
    'chkHookEnabled', 'inpHookEyebrow', 'inpHookTitle', 'inpHookStart', 'inpHookEnd', 'inpHookTop', 'inpStylePreset',
    'inpAccentColor', 'inpNumberColor', 'inpCaptionColor', 'inpCaptionSize', 'inpCaptionBottom',
    'chkDenoiseSpeech', 'chkNormalizeSpeech', 'inpMusicFile', 'chkEnableSfx',
  ].forEach((id) => {
    $(id)?.addEventListener('input', syncInspectorToLayers);
  });

  // Add cards / scenes / badges
  $('btnAddInfoCard')?.addEventListener('click', () => {
    if (!state.layers) return;
    const f0 = Math.round(state.timelineSec * 30);
    state.layers.infoCards.push({ id: `IC_${Date.now().toString().slice(-3)}`, icon: 'bolt', label: 'Điểm cần nhớ', detail: '', startFrame: f0, endFrame: f0 + 75 });
    state.layers.infoCards_edited = true;
    renderCardsAndLogosEditor();
    renderTimeline();
  });
  $('btnAddDarkScene')?.addEventListener('click', () => {
    if (!state.layers) return;
    const f0 = Math.round(state.timelineSec * 30);
    state.layers.darkScenes.push({ id: `DS_${Date.now().toString().slice(-3)}`, title: 'TÓM TẮT NHANH', metric: 'ĐIỂM CHÍNH', bullets: ['Ý chính 1: Nội dung cô đọng', 'Ý chính 2: Ứng dụng thực tế'], startFrame: f0, endFrame: f0 + 84 });
    state.layers.darkScenes_edited = true;
    renderCardsAndLogosEditor();
    renderTimeline();
  });
  $('btnAddLogoBadge')?.addEventListener('click', () => {
    if (!state.layers) return;
    const f0 = Math.round(state.timelineSec * 30);
    state.layers.logoBadges.push({ id: `LG_${Date.now().toString().slice(-3)}`, brand: 'brand', label: 'Brand', src: '', position: 'top_right', startFrame: f0, endFrame: f0 + 75 });
    state.layers.logoBadges_edited = true;
    renderCardsAndLogosEditor();
    renderTimeline();
  });

  // Stage Controls
  $('btnModeOutput')?.addEventListener('click', () => {
    state.stageMode = 'output';
    state.overlaysEnabled = false;
    configureStageMedia(false);
  });
  $('btnModeSource')?.addEventListener('click', () => {
    state.stageMode = 'source';
    state.overlaysEnabled = true;
    configureStageMedia(false);
  });
  $('btnToggleOverlays')?.addEventListener('click', () => {
    state.overlaysEnabled = !state.overlaysEnabled;
    $('btnToggleOverlays').textContent = state.overlaysEnabled ? 'Overlay: Bật' : 'Overlay: Tắt';
    updateLiveOverlays();
  });
  $('btnToggleSafeZone')?.addEventListener('click', () => {
    state.safeZoneEnabled = !state.safeZoneEnabled;
    $('safeZoneOverlay')?.classList.toggle('hidden', !state.safeZoneEnabled);
  });

  // Transport & Video Events
  const player = $('previewPlayer');
  const togglePlay = () => {
    if (!state.activeVideoUrl || !player) return;
    if (player.paused) {
      const p = player.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      player.pause();
    }
  };
  $('btnPlayPause')?.addEventListener('click', togglePlay);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      togglePlay();
    }
  });
  $('btnPrevSeg')?.addEventListener('click', () => {
    const idx = Math.max(0, state.selectedEdlIdx - 1);
    selectAndPreviewEdlRow(idx);
  });
  $('btnNextSeg')?.addEventListener('click', () => {
    const idx = Math.min(state.edlRows.length - 1, state.selectedEdlIdx + 1);
    selectAndPreviewEdlRow(idx);
  });

  if (player) {
    player.addEventListener('play', () => {
      if ($('playIcon')) $('playIcon').textContent = '⏸';
      if ($('playLabel')) $('playLabel').textContent = 'Tạm dừng';
    });
    player.addEventListener('pause', () => {
      if ($('playIcon')) $('playIcon').textContent = '▶';
      if ($('playLabel')) $('playLabel').textContent = 'Phát';
    });
    player.addEventListener('timeupdate', () => {
      state.timelineSec = getActiveTimelineSec();
      updatePlayheadVisual();
      updateLiveOverlays();
    });
    player.addEventListener('error', () => {
      if (state.activeVideoUrl && /\.mov/i.test($('stageSourceInfo')?.textContent || '')) {
        toast('File .MOV dùng codec chưa hỗ trợ xem trực tiếp trên trình duyệt — vẫn ghép & xuất MP4 bình thường.', 'info');
      }
    });
  }

  // Timeline Scrubbing, Real-time Playhead Drag, DaVinci Thumbnail Height, Zoom & Height Resize
  $('tlZoomRange')?.addEventListener('input', (e) => {
    setTimelineZoom(e.target.value);
  });
  $('tlThumbHeightRange')?.addEventListener('input', (e) => {
    state.tlThumbHeight = Number(e.target.value) || 44;
    renderTimeline();
  });
  $('btnTlZoomOut')?.addEventListener('click', () => setTimelineZoom(state.pxPerSec - 10));
  $('btnTlZoomIn')?.addEventListener('click', () => setTimelineZoom(state.pxPerSec + 10));
  $('btnTlZoomFit')?.addEventListener('click', fitTimelineZoom);
  $('btnCycleTimelineSize')?.addEventListener('click', cycleTimelineSize);

  const startPlayheadScrub = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.tl-block')) return;
    e.preventDefault();
    const updateAtClientX = (clientX) => {
      const canvasEl = $('tlCanvas');
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left);
      scrubToSeconds(x / state.pxPerSec, false);
    };
    updateAtClientX(e.clientX);
    const onMove = (ev) => updateAtClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  $('tlRuler')?.addEventListener('pointerdown', startPlayheadScrub);
  $('tlPlayhead')?.addEventListener('pointerdown', startPlayheadScrub);
  $('tlViewport')?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tl-block')) return;
    updateContextualInspectorTabs(null);
    startPlayheadScrub(e);
  });

  // File Uploads (Raw, B-Roll .mov/.mp4/img, Style Ref, Music, SFX, LUT .cube/.3dl)
  $('inputUploadRaw')?.addEventListener('change', (e) => uploadMultipleFiles(e.target.files, 'raw', e.target));
  $('inputUploadBroll')?.addEventListener('change', (e) => uploadMultipleFiles(e.target.files, 'broll', e.target));
  $('inputUploadStyleRef')?.addEventListener('change', (e) => uploadStyleRefFiles(e.target.files, e.target));
  $('inputUploadMusic')?.addEventListener('change', (e) => uploadMultipleFiles(e.target.files, 'music', e.target));
  $('inputUploadSfx')?.addEventListener('change', (e) => uploadMultipleFiles(e.target.files, 'sfx', e.target));

  // Style Ref Actions (_style_refs/)
  $('btnJumpStyleRefs')?.addEventListener('click', () => openPoolCategory('media', 'style_refs'));
  $('btnOpenStyleRefsFolder')?.addEventListener('click', async () => {
    try {
      await apiJson('/api/style-refs/open-folder', { method: 'POST' });
      toast('Đã mở thư mục _style_refs/ trong Finder / Explorer');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  $('btnAnalyzeStyleRefs')?.addEventListener('click', async () => {
    if (state.isAiBusy) return toast('Hệ thống đang xử lý tác vụ khác, vui lòng đợi...', 'info');
    try {
      const data = await apiJson('/api/style-refs/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval_sec: 2.0,
          whisper_model: $('whisperModel')?.value || 'small',
        }),
      });
      toast('Đang phân tích video mẫu trong _style_refs/...');
      pollJob(data.job_id, 'Đã phân tích xong _style_refs/ & cập nhật style.md!', {
        onDone: async () => {
          await loadStyleRefs();
        },
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  $('btnSaveStyleMd')?.addEventListener('click', async () => {
    try {
      const text = $('txtStyleMdPreview')?.value ?? '';
      await apiJson('/api/style-refs/save-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      state.styleRefs = state.styleRefs || { videos: [], metrics: [] };
      state.styleRefs.style_md = text;
      toast('Đã lưu quy tắc phong cách vào style.md!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  $('inputUploadLut')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFile(f, 'lut');
    e.target.value = '';
    const c = ensureColorObject();
    if (c) {
      c.lutId = f.name;
      renderColorAndLuts();
      applyLiveStageColorFilter();
    }
  });

  bindPoolAndTimelineDragDrop();

  // Top Actions & Pipeline Buttons
  $('btnSaveAll')?.addEventListener('click', () => saveAllEdlAndLayers(false));
  $('btnSaveLayers')?.addEventListener('click', () => saveAllEdlAndLayers(false));

  $('btnSaveBrief')?.addEventListener('click', async () => {
    try {
      await apiJson(`/api/projects/${encodeURIComponent(state.project)}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: $('txtProjectBrief').value, filename: 'brief.md' }),
      });
      toast('Đã lưu Brief & cập nhật gợi ý source trám!', 'success');
      await loadProjectOverview(state.project, false);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnGapAlertPill')?.addEventListener('click', () => {
    document.querySelector('[data-tab="pipeline"]')?.click();
    if (state.layoutMode === 'compact') { state.compactSidePane = 'left'; applyResponsiveLayout(); }
    else if (state.layoutMode === 'mobile') switchMobilePane('edl');
  });

  $('btnAutoFillAll')?.addEventListener('click', async () => {
    if (state.isAiBusy) return toast('Đang xử lý tác vụ trước, vui lòng đợi...', 'info');
    await saveAllEdlAndLayers(true);
    const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/auto-fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fetch_logos: false,
        generate_broll: true,
        ensure_music: true,
        tts_text: ($('inpTtsText')?.value || '').trim(),
        tts_at_sec: state.timelineSec || 0,
        tts_voice: $('selTtsVoice')?.value || 'vi-VN-NamMinhNeural',
      }),
    });
    pollJob(data.job_id, 'Đã tự tạo B-Roll cận cảnh + Thẻ thông tin + Nhạc nền thành công!');
  });

  // Built-in AI Chat Assistant Bindings (Bottom Dock Timeline Toggle)
  $('btnQuickAiChat')?.addEventListener('click', () => {
    toggleBottomAiChat();
  });
  $('btnToggleBottomAiChat')?.addEventListener('click', () => {
    toggleBottomAiChat();
  });
  $('btnOpenBottomAiChatFromTab')?.addEventListener('click', () => {
    toggleBottomAiChat(true);
  });
  $('btnBackToTimelineFromChat')?.addEventListener('click', () => {
    toggleBottomAiChat(false);
  });

  // Home Launcher Screen Bindings
  $('btnOpenHomeLauncher')?.addEventListener('click', openHomeLauncher);
  $('btnCloseHomeToEditor')?.addEventListener('click', closeHomeLauncher);
  $('btnHomeCreateProject')?.addEventListener('click', () => {
    closeHomeLauncher();
    $('btnNewProject')?.click();
  });
  $('btnHomeNavProjects')?.addEventListener('click', () => renderHomeProjectCards($('inpHomeSearchProject')?.value || ''));
  $('btnHomeNavStyleRefs')?.addEventListener('click', () => {
    closeHomeLauncher();
    openPoolCategory('media', 'style_refs');
  });
  $('btnHomeNavSettings')?.addEventListener('click', () => {
    $('btnOpenSettings')?.click();
  });
  $('inpHomeSearchProject')?.addEventListener('input', (e) => {
    renderHomeProjectCards(e.target.value);
  });
  $('formHomeEditPilot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const promptTxt = ($('inpHomeEditPilot')?.value || '').trim();
    if (!promptTxt) return;
    $('inpHomeEditPilot').value = '';
    closeHomeLauncher();
    toggleBottomAiChat(true);
    await sendAiChatMessage(promptTxt);
  });
  document.querySelectorAll('[data-home-action]').forEach((tile) => {
    tile.addEventListener('click', async () => {
      const act = tile.getAttribute('data-home-action');
      closeHomeLauncher();
      if (act === 'auto_cut') {
        $('btnRunPipeline')?.click();
      } else if (act === 'traffic_filter') {
        toggleBottomAiChat(true);
        await sendAiChatMessage('Lọc bỏ toàn bộ từ buôn bán, giá cả, chốt đơn có nguy cơ bóp traffic');
      } else if (act === 'auto_broll') {
        $('btnAutoFillAll')?.click();
      } else if (act === 'remotion_export') {
        if ($('selRenderEngine')) $('selRenderEngine').value = 'remotion';
        openExportModal('config');
      }
    });
  });

  // Render Engine Selector + Immediate Apply Button
  $('selRenderEngine')?.addEventListener('change', (e) => {
    const val = e.target.value || 'remotion';
    if ($('selSettingsDefaultEngine')) $('selSettingsDefaultEngine').value = val;
    document.querySelectorAll('input[name="expEngine"]').forEach((r) => {
      r.checked = r.value === val;
    });
    toast(`Đã chuyển chế độ sang ${val === 'remotion' ? 'Remotion Full' : 'Nhanh GPU'}. Bấm "Áp dụng" để cập nhật ngay.`);
  });
  $('btnApplyEngineNow')?.addEventListener('click', () => {
    const val = $('selRenderEngine')?.value || 'remotion';
    document.querySelectorAll('input[name="expEngine"]').forEach((r) => {
      r.checked = r.value === val;
    });
    openExportModal('config');
  });

  $('formAiChat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = ($('inpAiChatMessage')?.value || '').trim();
    if (!txt) return;
    await sendAiChatMessage(txt);
  });

  $('inpAiChatMessage')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('formAiChat')?.requestSubmit();
    }
  });

  document.querySelectorAll('#aiChatQuickChips [data-chat-prompt]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-chat-prompt');
      if (prompt) sendAiChatMessage(prompt);
    });
  });

  $('btnClearAiChatView')?.addEventListener('click', () => {
    renderAiChatHistory([]);
    toast('Đã làm mới khung hiển thị Chat AI');
  });

  $('btnGenTtsVo')?.addEventListener('click', async () => {
    try {
      const txt = ($('inpTtsText')?.value || '').trim();
      if (!txt) return toast('Hãy nhập câu thoại cần đọc bằng Voice AI.', 'error');
      toast('Đang tổng hợp giọng đọc tiếng Việt (edge-tts)...');
      const res = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: txt,
          voice: $('selTtsVoice').value,
          rate: '+12%',
          at_sec: state.timelineSec || 0,
          export_speaker_ref: false,
        }),
      });
      $('inpTtsText').value = '';
      toast(`Đã tạo Voice AI (${res.info.duration_sec}s) chèn tại ${fmtSec(state.timelineSec)}!`, 'success');
      await loadProjectOverview(state.project, false);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnExportSpeakerRef')?.addEventListener('click', async () => {
    try {
      toast('Đang trích mẫu giọng sạch 22s cho BetterBox-TTS / OmniVoice...');
      const res = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ export_speaker_ref: true }),
      });
      toast(`Đã xuất mẫu giọng: 03_working/${res.info.filename} (${res.info.duration_sec}s)`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnRunPipeline')?.addEventListener('click', async () => {
    if (state.isAiBusy) return toast('Tác vụ đang chạy, không gọi lặp!', 'info');
    const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/run-pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whisper_model: $('whisperModel').value,
        target_duration: Number($('targetDuration').value) || 0,
        force_ai: $('forceAiCheck').checked,
        preset: $('aiPresetSelect').value,
      }),
    });
    pollJob(data.job_id, 'Đã chạy xong Pipeline Bước 1–3!');
  });

  $('btnRunAiRestructure')?.addEventListener('click', async () => {
    if (state.isAiBusy) return toast('Đang chạy AI, đã chặn gọi lặp để bảo vệ Token!', 'info');
    await saveAllEdlAndLayers(true);
    const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/ai-restructure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset: $('aiPresetSelect').value,
        only_noted: false,
        target_duration: Number($('targetDuration').value) || 0,
      }),
    });
    pollJob(data.job_id, 'Đã tối ưu EDL theo nội dung & Brief (SHA-256 Cached)!');
  });

  $('btnRunAiNoted')?.addEventListener('click', async () => {
    if (state.isAiBusy) return toast('Đang chạy AI, đã chặn gọi lặp để bảo vệ Token!', 'info');
    await saveAllEdlAndLayers(true);
    const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/ai-restructure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset: $('aiPresetSelect').value,
        only_noted: true,
        target_duration: Number($('targetDuration').value) || 0,
      }),
    });
    pollJob(data.job_id, 'Đã xử lý xong các cảnh có Note!');
  });

  $('btnLoadDiff')?.addEventListener('click', async () => {
    try {
      const diff = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/diff`);
      $('diffPreview').textContent = JSON.stringify(diff, null, 2);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const toggleAppFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  const toggleStageFullscreen = () => {
    const sf = $('stageFrame');
    if (!sf) return;
    if (!document.fullscreenElement) {
      sf.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  $('btnToggleAppFullscreen')?.addEventListener('click', toggleAppFullscreen);
  $('btnToggleStageFullscreen')?.addEventListener('click', toggleStageFullscreen);

  $('chkExportRunAiMode')?.addEventListener('change', (e) => {
    $('exportAiModeBody')?.classList.toggle('hidden', !e.target.checked);
  });

  document.querySelectorAll('.bcount-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cnt = Number(btn.dataset.bcount || 0);
      state.autoBrollCount = cnt;
      if ($('valAutoBrollCount')) $('valAutoBrollCount').textContent = cnt === 0 ? 'Tắt' : `${cnt} thẻ`;
      document.querySelectorAll('.bcount-btn').forEach((b) => {
        const isMe = b === btn;
        b.className = isMe
          ? 'bcount-btn active h-6 rounded border border-cyan-500 bg-cyan-500 text-zinc-950 text-[11px] font-mono font-bold'
          : 'bcount-btn h-6 rounded border border-[#262934] bg-[#1A1D24] text-[11px] font-mono text-zinc-300 hover:bg-zinc-800';
      });
    });
  });

  const triggerAutoAiEdit = async (renderAfter = true) => {
    try {
      if (state.isAiBusy) return toast('Hệ thống đang chạy Auto AI Edit, vui lòng đợi...', 'info');
      const briefTxt = ($('txtProjectBrief')?.value || '').trim();
      if (briefTxt) {
        await apiJson(`/api/projects/${encodeURIComponent(state.project)}/brief`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: briefTxt, filename: 'brief.md' }),
        });
      }
      const topic = ($('expInpTopic')?.value || '').trim() || ($('inpTopic')?.value || '').trim() || state.project;
      const engine = $('selSettingsDefaultEngine')?.value || $('selRenderEngine')?.value || 'remotion';
      const preset = $('selAutoEditMode')?.value || 'retake_select';
      const bCount = Number(state.autoBrollCount ?? 3);
      const demoBroll = $('chkAutoDemoBroll')?.checked !== false;
      const dynZoom = $('chkAutoDynamicZoom')?.checked !== false;
      const autoCol = $('chkAutoAiColor')?.checked !== false;
      const useMusic = $('chkAutoMusic')?.checked !== false;

      if (renderAfter) {
        updateExportProgressModal({ progress_pct: 5, step_label: `Đang chạy AI Mode (${bCount} thẻ B-Roll) & Xuất...`, elapsed_sec: 0, logs: [] });
      } else {
        $('modalExport')?.classList.add('hidden');
        toast(`Đang dựng tự động Timeline (${bCount} thẻ B-Roll)...`);
      }

      const data = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/auto-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whisper_model: $('whisperModel')?.value || 'small',
          target_duration: Number($('targetDuration')?.value) || 0,
          preset,
          topic,
          render_engine: engine,
          other_platforms: false,
          auto_color: autoCol,
          auto_broll: bCount > 0 || demoBroll,
          broll_count: bCount,
          extract_demo_broll: demoBroll,
          dynamic_zoom: dynZoom,
          ensure_music: useMusic,
          render_after: renderAfter,
        }),
      });
      if (renderAfter) state.exportJobId = data.job_id;
      pollJob(
        data.job_id,
        renderAfter
          ? 'Auto AI Edit & Xuất Video hoàn tất!'
          : 'Đã dựng xong Timeline & B-Roll!'
      );
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  $('btnAutoAiEdit')?.addEventListener('click', () => triggerAutoAiEdit(true));
  $('btnAutoBuildOnly')?.addEventListener('click', () => triggerAutoAiEdit(false));

  $('btnRender')?.addEventListener('click', () => {
    openExportModal(state.exportJobId && state.isAiBusy ? 'progress' : 'config');
  });

  // CapCut Export Modal Bindings (Integrated AI Mode + Render)
  const closeExportModal = () => $('modalExport')?.classList.add('hidden');
  $('btnCloseExport')?.addEventListener('click', closeExportModal);
  $('btnCancelExport')?.addEventListener('click', closeExportModal);
  $('expInpTopic')?.addEventListener('input', updateExportFilenamePreview);
  $('expChkOverwrite')?.addEventListener('change', updateExportFilenamePreview);
  $('btnStartExport')?.addEventListener('click', async () => {
    try {
      if ($('chkExportRunAiMode')?.checked) {
        await triggerAutoAiEdit(true);
      } else {
        await startExportFromModal();
      }
    } catch (err) {
      state.exportJobId = null;
      updateExportProgressModal({ progress_pct: 10, error: err.message, logs: [err.message] }, true);
      toast(err.message, 'error');
    }
  });
  $('jobProgressWrap')?.addEventListener('click', () => {
    if (state.exportJobId) {
      openExportModal('progress');
    } else {
      renderLogsModalContent();
      $('modalBridge')?.classList.remove('hidden');
      document.querySelector('#settingsTabBar [data-stab="general"]')?.click();
    }
  });
  $('btnExpPlayNow')?.addEventListener('click', () => {
    const fn = state.lastExportResult?.fileName || state.overview?.outputs?.slice(-1)[0];
    closeExportModal();
    if (fn) {
      window.playOutputFile(fn);
    } else {
      toast('Không tìm thấy file output để phát.', 'error');
    }
  });
  $('btnExpOpenFolder')?.addEventListener('click', async () => {
    try {
      const fn = state.lastExportResult?.fileName || '';
      await apiJson(`/api/projects/${encodeURIComponent(state.project)}/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'output', file: fn }),
      });
      toast('Đã mở thư mục chứa file đã xuất (05_output/tiktok_9x16/)!');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Modals (CapCut 4-Tab Settings: Draft / Edit / Performance / General)
  const refreshSettingsCacheInfo = async () => {
    try {
      const info = await apiJson('/api/system/cache');
      if ($('lblCacheSizeMb')) $('lblCacheSizeMb').textContent = `${Number(info.cache_mb || 0).toFixed(2)} MB`;
      if ($('inpSettingsProjectsPath')) $('inpSettingsProjectsPath').value = info.projects_path || 'Projects/';
      if ($('inpSettingsStyleRefsPath')) $('inpSettingsStyleRefsPath').value = info.style_refs_path || 'StyleRefs/';
    } catch {
      /* ignore */
    }
  };
  const openBridge = () => {
    $('modalBridge')?.classList.remove('hidden');
    refreshSettingsCacheInfo();
  };
  const closeBridge = () => $('modalBridge')?.classList.add('hidden');
  $('btnOpenSettings')?.addEventListener('click', openBridge);
  $('btnOpenBridge')?.addEventListener('click', openBridge);
  $('btnOpenBridgeInline')?.addEventListener('click', openBridge);
  $('btnAiStatusPill')?.addEventListener('click', openBridge);
  $('btnHardwarePill')?.addEventListener('click', openBridge);
  $('btnCloseBridge')?.addEventListener('click', closeBridge);
  $('btnCancelSettingsModal')?.addEventListener('click', closeBridge);

  document.querySelectorAll('#settingsTabBar .stab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.stab;
      document.querySelectorAll('#settingsTabBar .stab-btn').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.classList.toggle('bg-[#2A2D36]', active);
        b.classList.toggle('text-zinc-100', active);
        b.classList.toggle('font-semibold', active);
        b.classList.toggle('text-zinc-400', !active);
      });
      document.querySelectorAll('.stab-pane').forEach((p) => {
        p.classList.toggle('hidden', p.id !== `stab-${tab}`);
      });
    });
  });

  $('btnSettingsOpenProjectsDir')?.addEventListener('click', async () => {
    await apiJson(`/api/projects/${encodeURIComponent(state.project || 'Demo')}/open-folder`, { method: 'POST' });
    toast('Đã mở thư mục dự án trong Finder / Explorer');
  });
  $('btnSettingsOpenStyleRefsDir')?.addEventListener('click', async () => {
    await apiJson('/api/style-refs/open-folder', { method: 'POST' });
    toast('Đã mở thư mục StyleRefs trong Finder / Explorer');
  });
  $('btnClearCacheNow')?.addEventListener('click', async () => {
    const res = await apiJson('/api/system/clear-cache', { method: 'POST' });
    toast(`Đã dọn sạch ${Number(res.freed_mb || 0).toFixed(2)} MB bộ nhớ đệm!`, 'success');
    await refreshSettingsCacheInfo();
  });
  $('selSettingsDefaultEngine')?.addEventListener('change', (e) => {
    const val = e.target.value || 'remotion';
    if ($('selRenderEngine')) $('selRenderEngine').value = val;
  });

  $('btnGenerateBridgePrompt')?.addEventListener('click', async () => {
    try {
      const preset = $('bridgePreset').value;
      const dur = Number($('targetDuration').value) || 0;
      const res = await apiJson(`/api/projects/${encodeURIComponent(state.project)}/ai-bridge-prompt?preset=${encodeURIComponent(preset)}&target_duration=${dur}`);
      $('txtBridgePrompt').value = res.prompt_text;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(res.prompt_text);
        toast(`Đã tạo & copy Prompt (${res.item_count} dòng tối ưu token) — dán vào Antigravity!`, 'success');
      } else {
        $('txtBridgePrompt').select();
        toast('Đã tạo Prompt! Hãy nhấn Ctrl+C để copy.', 'info');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnApplyBridgeJson')?.addEventListener('click', async () => {
    try {
      const rawJson = $('txtBridgeJson').value.trim();
      if (!rawJson) return toast('Hãy dán JSON từ Antigravity vào ô trên.', 'error');
      await apiJson(`/api/projects/${encodeURIComponent(state.project)}/ai-bridge-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_json: rawJson, preset: $('bridgePreset').value }),
      });
      $('modalBridge').classList.add('hidden');
      toast('Đã áp dụng kết quả Antigravity vào EDL!', 'success');
      await loadProjectOverview(state.project, false);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnSaveApiKey')?.addEventListener('click', async () => {
    try {
      const res = await apiJson('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_key: $('inpGeminiKey').value,
          openai_api_key: $('inpOpenAiKey').value,
          model: $('inpLlmModel').value,
          base_url: $('inpLlmBaseUrl').value,
          clear_keys: false,
        }),
      });
      toast(`Đã lưu cấu hình AI (${res.active_provider})`, 'success');
      await loadProjectOverview(state.project, false);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnClearApiKey')?.addEventListener('click', async () => {
    await apiJson('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_keys: true }),
    });
    $('inpGeminiKey').value = '';
    $('inpOpenAiKey').value = '';
    toast('Đã chuyển sang chế độ Smart Local (0 API Key)', 'success');
    await loadProjectOverview(state.project, false);
  });

  $('btnOpenLogs')?.addEventListener('click', () => {
    renderLogsModalContent();
    $('modalLogs')?.classList.remove('hidden');
  });
  $('btnCloseLogs')?.addEventListener('click', () => $('modalLogs')?.classList.add('hidden'));

  $('btnOpenFolder')?.addEventListener('click', async () => {
    await apiJson(`/api/projects/${encodeURIComponent(state.project)}/open-folder`, { method: 'POST' });
    toast('Đã mở thư mục dự án trong Explorer / Finder');
  });

  $('btnLaunchNativeWindow')?.addEventListener('click', async () => {
    await apiJson('/api/system/open-window', { method: 'POST' });
    toast('Đang mở cửa sổ phần mềm độc lập (Native App Window)...', 'success');
  });

  $('btnCopyLanUrl')?.addEventListener('click', async () => {
    const url = $('inpLanUrl').value;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast(`Đã copy link LAN: ${url}`, 'success');
    }
  });

  $('btnSaveHardware')?.addEventListener('click', async () => {
    try {
      await apiJson('/api/system/hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          power_mode: $('selPowerMode').value,
          lan_access: true,
          remote_webhook_url: $('inpWebhookUrl').value.trim(),
          prefer_native_window: $('chkPreferNativeWindow').checked,
        }),
      });
      if ($('inpGeminiKey')?.value || $('inpOpenAiKey')?.value || $('inpLlmModel')?.value || $('inpLlmBaseUrl')?.value) {
        await apiJson('/api/ai/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gemini_api_key: $('inpGeminiKey').value,
            openai_api_key: $('inpOpenAiKey').value,
            model: $('inpLlmModel').value,
            base_url: $('inpLlmBaseUrl').value,
            clear_keys: false,
          }),
        });
      }
      if ($('selSettingsDefaultEngine')?.value && $('selRenderEngine')) {
        $('selRenderEngine').value = $('selSettingsDefaultEngine').value;
      }
      $('modalBridge')?.classList.add('hidden');
      toast('Đã lưu toàn bộ Cài đặt WishEdit!', 'success');
      await loadProjectOverview(state.project, false);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // CapCut / Resolve Toolbar: Undo, Redo, Split, Delete, In/Out Range & Stage Dragging
  bindStageCanvasDragging();
  $('btnUndo')?.addEventListener('click', undoEdit);
  $('btnRedo')?.addEventListener('click', redoEdit);
  $('btnSplitAtPlayhead')?.addEventListener('click', splitAtPlayhead);
  $('btnDeleteSelected')?.addEventListener('click', deleteSelected);

  const setMarkIn = () => {
    state.rangeInSec = Number(state.timelineSec.toFixed(2));
    if (state.rangeOutSec == null || state.rangeOutSec <= state.rangeInSec) {
      state.rangeOutSec = Number(Math.min(state.totalOutSec || 60, state.rangeInSec + 3.0).toFixed(2));
    }
    updateInOutRangeVisual();
    toast(`[I] Đã đặt điểm Đầu tại ${state.rangeInSec.toFixed(1)}s`);
  };
  const setMarkOut = () => {
    state.rangeOutSec = Number(state.timelineSec.toFixed(2));
    if (state.rangeInSec == null || state.rangeInSec >= state.rangeOutSec) {
      state.rangeInSec = Number(Math.max(0, state.rangeOutSec - 3.0).toFixed(2));
    }
    updateInOutRangeVisual();
    toast(`[O] Đã đặt điểm Cuối tại ${state.rangeOutSec.toFixed(1)}s`);
  };
  const openRangeModal = () => {
    const tIn = state.rangeInSec ?? Number(state.timelineSec.toFixed(1));
    const tOut = state.rangeOutSec != null && state.rangeOutSec > tIn ? state.rangeOutSec : Number((tIn + 3.0).toFixed(1));
    state.rangeInSec = tIn;
    state.rangeOutSec = tOut;
    updateInOutRangeVisual();
    $('inpRangeIn').value = tIn.toFixed(1);
    $('inpRangeOut').value = tOut.toFixed(1);
    $('rangeModalTimeLabel').textContent = `${fmtSec(tIn)} → ${fmtSec(tOut)} (${(tOut - tIn).toFixed(1)}s)`;
    $('modalRangeMarker').classList.remove('hidden');
    $('inpRangeNote').focus();
  };

  $('btnMarkIn')?.addEventListener('click', setMarkIn);
  $('btnMarkOut')?.addEventListener('click', setMarkOut);
  $('btnOpenRangeModal')?.addEventListener('click', openRangeModal);
  $('btnCloseRangeModal')?.addEventListener('click', () => $('modalRangeMarker').classList.add('hidden'));

  $('btnSaveRangeNote')?.addEventListener('click', () => {
    if (!state.layers) return;
    const t0 = Math.max(0, Number($('inpRangeIn').value) || 0);
    const t1 = Math.max(t0 + 0.5, Number($('inpRangeOut').value) || t0 + 3.0);
    const noteTxt = $('inpRangeNote').value.trim() || `Chèn B-Roll ${t0.toFixed(1)}s–${t1.toFixed(1)}s`;
    pushUndoState('add_marker');
    state.layers.markers = state.layers.markers || [];
    state.layers.markers.push({
      id: `MK_${Date.now().toString().slice(-4)}`,
      startSec: t0,
      endSec: t1,
      note: noteTxt,
    });
    state.keptOffsets.forEach((k) => {
      if (k.tStart < t1 && k.tEnd > t0) {
        k.row.note = k.row.note ? `${k.row.note}; [${t0.toFixed(1)}-${t1.toFixed(1)}s] ${noteTxt}` : `[${t0.toFixed(1)}-${t1.toFixed(1)}s] ${noteTxt}`;
      }
    });
    $('inpRangeNote').value = '';
    $('modalRangeMarker').classList.add('hidden');
    renderEdlList();
    renderTimeline();
    toast(`Đã gắn Note khoảng [${t0.toFixed(1)}s–${t1.toFixed(1)}s]!`, 'success');
  });

  $('btnCreateRangeBroll')?.addEventListener('click', () => {
    if (!state.layers) return;
    const fps = Number(state.props?.fps || 30);
    const t0 = Math.max(0, Number($('inpRangeIn').value) || 0);
    const t1 = Math.max(t0 + 0.8, Number($('inpRangeOut').value) || t0 + 2.8);
    const labelTxt = $('inpRangeNote').value.trim() || 'Điểm nhấn thực chiến';
    pushUndoState('range_infocard');
    state.layers.infoCards = state.layers.infoCards || [];
    state.layers.infoCards.push({
      id: `IC_${Date.now().toString().slice(-3)}`,
      icon: 'bolt',
      label: labelTxt,
      detail: `Khoảng ${t0.toFixed(1)}s–${t1.toFixed(1)}s`,
      startFrame: Math.round(t0 * fps),
      endFrame: Math.round(t1 * fps),
    });
    state.layers.infoCards_edited = true;
    $('modalRangeMarker').classList.add('hidden');
    renderInspector();
    renderTimeline();
    updateLiveOverlays();
    toast(`Đã tạo Thẻ / B-Roll tại [${t0.toFixed(1)}s–${t1.toFixed(1)}s]!`, 'success');
  });

  $('btnCutOutRange')?.addEventListener('click', () => {
    const t0 = Math.max(0, Number($('inpRangeIn').value) || 0);
    const t1 = Math.max(t0 + 0.4, Number($('inpRangeOut').value) || t0 + 2.0);
    pushUndoState('cut_range');
    let cutCount = 0;
    state.keptOffsets.forEach((k) => {
      if (k.tStart >= t0 - 0.15 && k.tEnd <= t1 + 0.15) {
        k.row.keep = 0;
        k.row.label = 'drop';
        k.row.note = 'dropped_by_in_out_range';
        cutCount += 1;
      }
    });
    $('modalRangeMarker').classList.add('hidden');
    computeKeptOffsets();
    updateTopBadges();
    renderEdlList();
    renderTimeline();
    toast(cutCount ? `Đã cắt bỏ ${cutCount} đoạn trong khoảng [${t0.toFixed(1)}s–${t1.toFixed(1)}s]` : 'Khoảng chọn nằm giữa 1 câu — hãy bấm Tách đôi (B) tại 2 đầu rồi bấm Xóa (Del).', cutCount ? 'success' : 'info');
  });

  // Mobile Bottom Workspace Switcher (< 768px)
  document.querySelectorAll('.mnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchMobilePane(btn.dataset.mnav));
  });

  // Responsive Observers & Splitters
  bindPanelSplitters();
  if (typeof ResizeObserver !== 'undefined') {
    if ($('stageDropArea')) new ResizeObserver(() => fitStageFrame()).observe($('stageDropArea'));
    if ($('topHeader')) new ResizeObserver(() => adaptHeaderOverflow()).observe($('topHeader'));
    if ($('hdrLeftCluster')) new ResizeObserver(() => adaptHeaderOverflow()).observe($('hdrLeftCluster'));
    if ($('tlToolbar')) new ResizeObserver(() => adaptTimelineOverflow()).observe($('tlToolbar'));
  }
  window.addEventListener('resize', applyResponsiveLayout);

  document.addEventListener('keydown', (e) => {
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveAllEdlAndLayers(false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
      e.preventDefault();
      undoEdit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inField) {
      e.preventDefault();
      redoEdit();
      return;
    }
    if (inField) return;
    const k = e.key.toLowerCase();
    if (k === 'b') {
      e.preventDefault();
      splitAtPlayhead();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    } else if (k === 'i') {
      e.preventDefault();
      setMarkIn();
    } else if (k === 'o') {
      e.preventDefault();
      setMarkOut();
    } else if (k === 'm') {
      e.preventDefault();
      openRangeModal();
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  selectPoolXY('media', 'raw');
  applyResponsiveLayout();
  try {
    await loadProjects();
  } catch (err) {
    toast(`Không tải được dữ liệu: ${err.message}`, 'error');
  }
});
