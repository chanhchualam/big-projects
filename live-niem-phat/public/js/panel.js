/**
 * BẢNG ĐIỀU KHIỂN – gửi lệnh tới server qua Socket.IO
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const socket = io();
  let config = null;
  let muted = false;

  // ---------- Danh sách hành động (phím tắt 1–9) ----------
  const ACTIONS = [
    { key: '1', icon: '🕯', label: 'Thắp hương', send: { type: 'chat', text: '1' } },
    { key: '2', icon: '🙏', label: 'Lạy Phật', send: { type: 'chat', text: '2' } },
    { key: '3', icon: '🪵', label: 'Gõ mõ', send: { type: 'chat', text: '3' } },
    { key: '4', icon: '🔔', label: 'Thỉnh chuông', send: { type: 'chat', text: '4' } },
    { key: '5', icon: '❤️', label: 'Thả tim', send: { type: 'like', count: 8 } },
    { key: '6', icon: '🎋', label: 'Xin xăm', send: { type: 'chat', text: 'xăm' } },
    { key: '7', icon: '➕', label: 'Theo dõi', send: { type: 'follow' } },
    { key: '8', icon: '↗', label: 'Chia sẻ', send: { type: 'share' } },
    { key: '9', icon: '🪷', label: 'Vào thiền', send: { type: 'join' } },
    { icon: '👨', label: 'Đổi hình Nam', send: { type: 'chat', text: 'nam' } },
    { icon: '👩', label: 'Đổi hình Nữ', send: { type: 'chat', text: 'nữ' } },
    { icon: '🪷', label: 'Niệm Phật', send: { type: 'chat', text: 'Nam mô A Di Đà Phật' } },
    { icon: '🔥', label: '5 người cùng niệm', send: { type: 'niemGroup', count: 5 } },
    { icon: '📿', label: 'Cầu nguyện', send: () => ({ type: 'chat', text: 'cầu ' + ($('v-msg').value.replace(/^cầu\s+/i, '').trim() || 'gia đình bình an') }) },
    { icon: '💬', label: 'Bình luận', send: () => ({ type: 'chat', text: $('v-msg').value.trim() || 'A Di Đà Phật 🙏' }) },
    { icon: '🚪', label: 'Rời chỗ', send: { type: 'leave' } },
  ];

  function trigger(payload, btn) {
    const p = typeof payload === 'function' ? payload() : Object.assign({}, payload);
    p.name = $('v-name').value.trim();
    if (p.type === 'gift') p.phapDanh = $('v-phapdanh').value.trim();
    socket.emit('panel:trigger', p);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
    }
  }

  function makeBtn(icon, label, key, extra) {
    const b = document.createElement('button');
    b.append(icon + ' ' + label);
    if (extra) {
      const c = document.createElement('span');
      c.className = 'c';
      c.textContent = extra;
      b.append(' ', c);
    }
    if (key) {
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = key;
      b.append(k);
    }
    return b;
  }

  const actionBtns = {};
  ACTIONS.forEach((a) => {
    const b = makeBtn(a.icon, a.label, a.key);
    b.onclick = () => trigger(a.send, b);
    if (a.key) actionBtns[a.key] = b;
    $('actions').append(b);
  });

  // ---------- Khay quà kiểu TikTok ----------
  let ritualBtns = [];
  function giftTile(o) {
    const b = document.createElement('button');
    b.className = 'gift';
    b.title = o.title || '';
    const im = document.createElement('div');
    im.className = 'gimg';
    const emoji = () => {
      const sp = document.createElement('span');
      sp.textContent = o.icon || '🎁';
      return sp;
    };
    if (o.image) {
      const img = document.createElement('img');
      img.src = o.image;
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.replaceWith(emoji());
      im.append(img);
    } else im.append(emoji());
    const nm = document.createElement('div');
    nm.className = 'gname';
    nm.textContent = o.name;
    const coin = document.createElement('div');
    coin.className = 'gcoin';
    const c = document.createElement('i');
    c.className = 'coin';
    coin.append(c, String(o.coins));
    const send = document.createElement('div');
    send.className = 'gsend';
    send.textContent = 'Tặng';
    b.append(im, nm, coin, send);
    if (o.sub) {
      const sub = document.createElement('div');
      sub.className = 'gsub';
      sub.textContent = o.sub;
      b.append(sub);
    }
    if (o.key) {
      const k = document.createElement('span');
      k.className = 'gkey';
      k.textContent = o.key;
      b.append(k);
    }
    return b;
  }
  const giftCount = () => Math.max(1, Math.min(99, Number($('gift-count').value) || 1));

  function renderRituals() {
    const box = $('rituals');
    box.textContent = '';
    ritualBtns = [];
    (config.rituals || []).forEach((r, i) => {
      const b = giftTile({
        name: r.name, coins: r.coins, icon: r.icon, image: r.image,
        key: i < 9 ? '⇧' + (i + 1) : '',
        sub: r.tiktokGift ? '🎁 ' + r.tiktokGift : '',
        title: 'Quà TikTok kích hoạt: ' + (r.giftNames || []).join(', '),
      });
      b.onclick = () => trigger({ type: 'gift', ritualId: r.id, count: giftCount() }, b);
      ritualBtns.push(b);
      box.append(b);
    });
    // Tất cả quà TikTok đã tải
    const cat = $('catalog');
    cat.textContent = '';
    const list = config.giftCatalog || [];
    $('catalog-count').textContent = list.length ? '(' + list.length + ')' : '';
    list.forEach((g) => {
      const r = matchRitual(g);
      const b = giftTile({ name: g.name, coins: g.coins, image: g.image, sub: r ? '→ ' + r.name : '', title: r ? 'Sẽ chạy nghi lễ: ' + r.name : 'Không khớp nghi lễ nào' });
      b.onclick = () => trigger({ type: 'gift', giftName: g.name, count: giftCount() }, b);
      cat.append(b);
    });
    $('catalog-note').classList.toggle('hidden', list.length > 0 && !$('catalog').classList.contains('hidden'));
  }
  /** Mô phỏng cách server ghép quà -> nghi lễ (để hiện gợi ý) */
  function matchRitual(g) {
    const rs = config.rituals || [];
    const n = g.name.toLowerCase();
    const byName = rs.find((r) => (r.giftNames || []).some((x) => String(x).toLowerCase() === n));
    if (byName) return byName;
    if (config.matchByCoins === false) return null;
    return rs.filter((r) => r.coins <= g.coins).sort((a, b) => b.coins - a.coins)[0] || null;
  }
  document.querySelectorAll('.tray-tabs .tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tray-tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
      $('rituals').classList.toggle('hidden', t.dataset.tab !== 'rituals');
      $('catalog').classList.toggle('hidden', t.dataset.tab !== 'catalog');
      $('catalog-note').classList.toggle('hidden', t.dataset.tab === 'catalog' && (config.giftCatalog || []).length > 0);
    };
  });

  // ---------- Phím tắt ----------
  addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
    if (!m) return;
    const n = m[1];
    e.preventDefault();
    if (e.shiftKey) {
      const b = ritualBtns[Number(n) - 1];
      if (b) b.click();
    } else if (actionBtns[n]) actionBtns[n].click();
  });

  // ---------- Kết nối ----------
  $('btn-connect').onclick = () => {
    const u = $('tt-user').value.trim();
    localStorage.setItem('td.username', u);
    socket.emit('panel:connect', { username: u });
  };
  $('tt-user').value = localStorage.getItem('td.username') || '';
  $('tt-user').addEventListener('keydown', (e) => e.key === 'Enter' && $('btn-connect').click());
  $('btn-disconnect').onclick = () => socket.emit('panel:disconnect');
  $('sim-toggle').onchange = (e) => socket.emit('panel:sim', { on: e.target.checked });

  // ---------- Người xem test ----------
  $('btn-randname').onclick = () => {
    const names = (config && config.simulator && config.simulator.names) || ['Khách'];
    $('v-name').value = names[Math.floor(Math.random() * names.length)];
  };
  $('btn-send').onclick = () => {
    const text = $('v-msg').value.trim();
    if (!text) return $('v-msg').focus();
    trigger({ type: 'chat', text }, $('btn-send'));
  };
  $('v-msg').addEventListener('keydown', (e) => e.key === 'Enter' && $('btn-send').click());

  // ---------- Công cụ ----------
  const obsUrl = location.origin + '/overlay';
  $('obs-url').value = obsUrl;
  $('btn-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(obsUrl);
    } catch (_) {
      $('obs-url').select();
      document.execCommand('copy');
    }
    const b = $('btn-copy');
    const old = b.textContent;
    b.textContent = '✔ Đã copy!';
    setTimeout(() => (b.textContent = old), 1500);
  };
  $('btn-open').onclick = () => window.open('/overlay?debug=1', '_blank');
  $('btn-mute').onclick = () => socket.emit('panel:mute', { muted: !muted });
  // Tắt/bật khung xem trước: khi tắt, iframe được gỡ hẳn để không tốn CPU/GPU vẽ overlay thứ hai
  function setPreview(on) {
    const f = $('preview');
    $('preview-on').checked = on;
    $('preview-off').classList.toggle('hidden', on);
    f.classList.toggle('hidden', !on);
    const want = on ? '/overlay?preview=1' : 'about:blank';
    if (f.getAttribute('src') !== want) f.setAttribute('src', want);
    if (!on) $('fps-preview').textContent = 'Preview: đã tắt';
    localStorage.setItem('td_preview', on ? '1' : '0');
  }
  $('preview-on').onchange = (e) => setPreview(e.target.checked);
  setPreview(localStorage.getItem('td_preview') !== '0');

  $('preview-audio').onchange = (e) => {
    $('preview').contentWindow.postMessage({ type: 'previewAudio', on: e.target.checked }, location.origin);
  };
  $('btn-fill').onclick = () => socket.emit('panel:trigger', { type: 'fillSeats' });
  $('btn-challenge').onclick = () => socket.emit('panel:trigger', { type: 'challenge' });
  $('btn-reset').onclick = () => {
    if (confirm('Reset phiên? Toàn bộ điểm sẽ về 0 và mọi bồ đoàn được giải phóng.')) socket.emit('panel:reset');
  };
  $('btn-clearlog').onclick = () => ($('log').textContent = '');

  // ---------- Log ----------
  function addLog(e) {
    const box = $('log');
    const d = document.createElement('div');
    d.className = e.level || 'info';
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = new Date(e.t).toLocaleTimeString('vi-VN');
    d.append(t, document.createTextNode(e.msg));
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
    box.append(d);
    while (box.children.length > 400) box.firstChild.remove();
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  // ---------- Socket ----------
  function pill(id, text, cls) {
    const p = $(id);
    p.textContent = text;
    p.className = 'pill ' + (cls || '');
  }

  // ---------- Hình ảnh & âm thanh: tải lên, nghe thử, về mặc định ----------
  const ASSET_ICON = { background: '🏯', bgm: '🎵', mo: '🪵', bell: '🔔', chime: '✨' };
  const ASSET_HINT = {
    background: 'Mặc định: nền vẽ bằng code',
    bgm: 'Mặc định: nhạc thiền tổng hợp',
    mo: 'Mặc định: tiếng mõ tổng hợp',
    bell: 'Mặc định: chuông tổng hợp',
    chime: 'Mặc định: chuông nhỏ tổng hợp',
  };
  let uploadSlotName = null;
  let previewAudio = null;

  function assetMsg(text, cls) {
    const m = $('asset-msg');
    m.textContent = text;
    m.className = 'tray-note ' + (cls || '');
  }

  async function uploadAsset(slot, file, label) {
    if (!file) return;
    assetMsg(`Đang tải lên "${file.name}" cho ${label}…`, 'warn');
    try {
      const r = await fetch('/api/assets/' + encodeURIComponent(slot), {
        method: 'POST',
        headers: { 'X-TD-Panel': '1', 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      assetMsg(`✔ Đã cập nhật ${label}. Overlay và OBS đã đổi theo.`, 'ok');
    } catch (e) {
      assetMsg(`✖ ${label}: ${e.message}`, 'err');
    }
  }

  async function resetAsset(slot, label) {
    if (!confirm(`Xoá file của bạn và dùng lại ${label} mặc định?`)) return;
    const r = await fetch('/api/assets/' + encodeURIComponent(slot), { method: 'DELETE', headers: { 'X-TD-Panel': '1' } });
    const j = await r.json().catch(() => ({}));
    assetMsg(r.ok ? `↩ ${label}: đã về mặc định.` : `✖ ${j.error || 'Lỗi'}`, r.ok ? 'ok' : 'err');
  }

  function pickFile(slot, kind, label) {
    const inp = $('asset-file');
    uploadSlotName = { slot, label };
    inp.accept = kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'audio/*,.mp3,.m4a,.ogg,.wav';
    inp.value = '';
    inp.click();
  }
  $('asset-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f && uploadSlotName) uploadAsset(uploadSlotName.slot, f, uploadSlotName.label);
  });

  /** Cho phép kéo thả file vào một ô */
  function dropZone(el, slot, label) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drag');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) uploadAsset(slot, f, label);
    });
  }

  function mkBtn(text, cls, onClick) {
    const b = document.createElement('button');
    b.className = 'mini ' + (cls || '');
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderAssets() {
    const box = $('assets');
    box.textContent = '';
    const info = (config && config.assets) || {};
    for (const [slot, a] of Object.entries(info)) {
      const row = document.createElement('div');
      row.className = 'asset' + (a.url ? ' custom' : '');
      const thumb = document.createElement('div');
      thumb.className = 'athumb' + (a.kind === 'image' ? ' tall' : '');
      if (a.kind === 'image' && a.url) {
        const im = document.createElement('img');
        im.src = a.url;
        im.alt = '';
        thumb.appendChild(im);
      } else thumb.textContent = ASSET_ICON[slot] || '📁';
      const txt = document.createElement('div');
      txt.className = 'atext';
      const b = document.createElement('b');
      b.textContent = a.label;
      const sm = document.createElement('small');
      sm.textContent = a.url ? '✔ Đang dùng file của bạn' : ASSET_HINT[slot] || 'Mặc định';
      txt.append(b, sm);
      const acts = document.createElement('div');
      acts.className = 'aacts';
      if (a.kind === 'audio') {
        acts.appendChild(mkBtn('▶ Nghe', '', () => {
          if (!a.url) return assetMsg('Âm mặc định được tổng hợp trong overlay. Bấm nút Gõ mõ / Thỉnh chuông ở mục 3 để nghe.', '');
          if (previewAudio) previewAudio.pause();
          previewAudio = new Audio(a.url);
          previewAudio.play().catch(() => {});
        }));
      }
      acts.appendChild(mkBtn('⬆ Tải lên', 'primary', () => pickFile(slot, a.kind, a.label)));
      if (a.url) acts.appendChild(mkBtn('↩ Mặc định', '', () => resetAsset(slot, a.label)));
      row.append(thumb, txt, acts);
      dropZone(row, slot, a.label);
      box.appendChild(row);
    }

    // Ảnh quà từng nghi lễ
    const g = $('asset-gifts');
    g.textContent = '';
    for (const r of (config && config.rituals) || []) {
      const slot = 'gift-' + r.id;
      const own = typeof r.image === 'string' && r.image.startsWith('assets/gifts/');
      const t = document.createElement('div');
      t.className = 'agift' + (own ? ' custom' : '');
      t.title = 'Bấm để tải ảnh cho ' + r.name;
      const th = document.createElement('div');
      th.className = 'gimg';
      if (r.image) {
        const im = document.createElement('img');
        im.src = r.image;
        im.alt = '';
        th.appendChild(im);
      } else th.textContent = r.icon || '🎁';
      const n = document.createElement('div');
      n.className = 'gname';
      n.textContent = r.name;
      const st = document.createElement('div');
      st.className = 'gsub';
      st.textContent = own ? '✔ ảnh của bạn' : '⬆ tải ảnh';
      t.append(th, n, st);
      t.addEventListener('click', () => pickFile(slot, 'image', 'ảnh quà ' + r.name));
      if (own) {
        const x = mkBtn('↩', 'areset', (e) => {
          e.stopPropagation();
          resetAsset(slot, 'ảnh quà ' + r.name);
        });
        x.title = 'Về ảnh mặc định';
        t.appendChild(x);
      }
      dropZone(t, slot, 'ảnh quà ' + r.name);
      g.appendChild(t);
    }
  }

  socket.on('connect', () => {
    pill('pill-socket', 'Socket: đã kết nối', 'ok');
    socket.emit('hello', { role: 'panel' });
  });
  socket.on('disconnect', () => pill('pill-socket', 'Socket: mất kết nối server', 'err'));
  socket.on('config', (c) => {
    config = c;
    renderRituals();
    renderAssets();
    if (!$('tt-user').value && c.tiktok && c.tiktok.username) $('tt-user').value = c.tiktok.username;
  });
  socket.on('logs', (list) => {
    $('log').textContent = '';
    list.forEach(addLog);
  });
  socket.on('log', addLog);

  const TT_LABEL = {
    idle: ['chưa kết nối', ''],
    connecting: ['đang kết nối…', 'warn'],
    connected: ['ĐANG LIVE', 'ok'],
    reconnecting: ['đang kết nối lại…', 'warn'],
    waiting: ['chờ lên live…', 'warn'],
    error: ['lỗi', 'err'],
  };
  socket.on('status', (s) => {
    const [lbl, cls] = TT_LABEL[s.tiktok.status] || [s.tiktok.status, ''];
    pill('pill-tiktok', 'TikTok: ' + lbl + (s.tiktok.username && s.tiktok.status !== 'idle' ? ' @' + s.tiktok.username : ''), cls);
    const st = $('tt-status');
    st.textContent = s.tiktok.message;
    st.className = 'status ' + cls;
    pill('pill-sim', 'Giả lập: ' + (s.sim ? 'BẬT' : 'tắt'), s.sim ? 'ok' : '');
    $('sim-toggle').checked = !!s.sim;
    muted = !!s.muted;
    $('btn-mute').textContent = muted ? '🔇 Bật tiếng overlay' : '🔊 Tắt tiếng overlay';
    const obs = (s.overlays || []).filter((o) => !o.preview);
    $('fps-obs').textContent = obs.length ? `OBS/tab khác: ${obs.length} overlay · ${obs.map((o) => o.fps).join(', ')} FPS` : 'OBS: chưa có overlay';
  });

  // FPS của khung xem trước
  addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data && e.data.type === 'overlayFps') $('fps-preview').textContent = `Preview: ${e.data.fps} FPS`;
  });
})();
