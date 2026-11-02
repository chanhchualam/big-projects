/**
 * OVERLAY CHÍNH – kết nối Socket.IO, nhận sự kiện từ server
 * và điều phối cảnh (scene), HUD, âm thanh. Vòng lặp vẽ 60 FPS.
 *
 * Tham số URL:
 *   ?preview=1  dùng trong khung xem trước của bảng điều khiển (mặc định tắt tiếng)
 *   ?debug=1    hiện FPS
 *   ?nobg=1     nền trong suốt (không hiện ảnh nền / nền dự phòng)
 *   ?mute=1     tắt tiếng overlay này
 */
(function () {
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview');
  const NOBG = params.has('nobg');
  if (params.has('debug')) document.body.classList.add('debug');
  if (NOBG) document.body.classList.add('transparent');

  const stage = document.getElementById('stage');
  const scene = new TD.Scene(document.getElementById('scene'));
  const hud = new TD.HUD();
  const A = TD.Audio;
  const el = TD.el;
  let config = null;
  let configured = false;
  let pendingState = null;

  // ---------- Co giãn sân khấu 1080x1920 theo cửa sổ ----------
  function fit() {
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    stage.style.transform = `translate(${-540 * s}px, ${-960 * s}px) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  // ---------- Âm thanh ----------
  A.setLocalMuted(PREVIEW || params.has('mute'));
  const unlock = () => A.unlock();
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'previewAudio') A.setLocalMuted(!e.data.on);
  });

  // ---------- Ảnh nền ----------
  function loadBackground() {
    const img = document.getElementById('bg-img');
    const fb = document.getElementById('bg-fallback');
    if (NOBG) {
      img.classList.remove('ok');
      fb.classList.add('hidden');
      return;
    }
    const src = (config.scene && config.scene.background) || 'assets/background.jpg';
    img.onload = () => {
      img.classList.add('ok');
      fb.classList.add('hidden');
    };
    img.onerror = () => {
      // Không có ảnh -> vẽ nền chánh điện bằng code
      img.classList.remove('ok');
      fb.classList.remove('hidden');
      const g = fb.getContext('2d');
      g.clearRect(0, 0, 1080, 1920);
      scene.fallbackBackground(fb);
    };
    img.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
  }

  // ---------- Socket ----------
  const socket = io({ reconnectionDelayMax: 5000 });
  const offline = document.getElementById('offline');
  socket.on('connect', () => {
    offline.classList.add('hidden');
    socket.emit('hello', { role: 'overlay', preview: PREVIEW });
  });
  socket.on('disconnect', () => offline.classList.remove('hidden'));

  socket.on('config', (cfg) => {
    config = cfg;
    scene.configure(cfg);
    hud.setConfig(cfg);
    A.configure(cfg.audio || {});
    A.unlock(); // OBS cho phép tự phát âm thanh; trình duyệt thường sẽ chờ cú click đầu tiên
    loadBackground();
    configured = true;
    if (pendingState) applyState(pendingState);
  });

  function applyState(st) {
    if (!configured) {
      pendingState = st;
      return;
    }
    pendingState = null;
    hud.setState(st);
    scene.syncSeats(st.seats || []);
    scene.setTop1(st.top && st.top[0] ? st.top[0].name : '');
  }
  socket.on('state', applyState);
  socket.on('mute', (m) => A.setMuted(m));
  socket.on('reset', () => {
    hud.reset();
    scene.syncSeats([]);
    scene.chars.forEach((c, i) => c && scene.removeChar(i));
  });
  socket.on('evt', (ev) => {
    if (!configured) return;
    try {
      onEvent(ev);
    } catch (e) {
      console.error('Lỗi hiệu ứng', e, ev);
    }
  });

  // ---------- Xử lý sự kiện ----------
  const likeTickAt = new Map();
  const rnd = (n) => Math.floor(Math.random() * n);

  function points(u, n, extra = '') {
    if (!n) return;
    const a = scene.anchor(u);
    scene.floatText(`+${n}${extra}`, a.x + 34 * a.s, a.head - 20, { size: 24, color: '#ffe27a', stroke: '#4a1500', life: 1.3, vy: -50 });
  }

  function onEvent(ev) {
    const u = ev.user;
    if (u && u.seat != null) scene.ensureChar(u);

    switch (ev.kind) {
      case 'join':
        hud.toast(u, 'đã vào thiền');
        hud.tick([{ b: u.name }, ' đã tham gia']);
        A.chime(rnd(6), 0.12);
        break;

      case 'leave':
        scene.removeChar(ev.seat != null ? ev.seat : u.seat);
        hud.tick([{ b: u.name }, ev.reason === 'idle' ? ' đã xả thiền, nhường bồ đoàn' : ' đã rời thiền đường']);
        break;

      case 'queue':
        hud.tick([{ b: u.name }, ` đang chờ bồ đoàn trống (thứ ${ev.position})`]);
        break;

      case 'chat':
        scene.chat(u, ev.text);
        if (u.seat == null) hud.tick([{ b: u.name }, ': ' + ev.text]);
        break;

      case 'incense':
        scene.incense(u);
        points(u, ev.points, ' 🕯');
        A.chime(4, 0.08);
        break;

      case 'bow':
        scene.bow(u, 1);
        points(u, ev.points, ' 🙏');
        break;

      case 'mo':
        scene.mo(u);
        A.mo();
        break;

      case 'bell':
        scene.bell(u);
        A.bell(false);
        break;

      case 'gender': {
        const a = scene.anchor(u);
        scene.sparkles(a.x, a.head, 14, ev.gender === 'nu' ? 'petal' : 'glow');
        scene.floatText(ev.gender === 'nu' ? 'Đổi hình: Nữ' : 'Đổi hình: Nam', a.x, a.head - 40, { size: 24, life: 1.4 });
        break;
      }

      case 'pray':
        scene.pray(u, ev.text);
        A.chime(2, 0.12);
        break;

      case 'like': {
        scene.like(u, ev.count);
        const last = likeTickAt.get(u.id) || 0;
        if (Date.now() - last > 15000) {
          likeTickAt.set(u.id, Date.now());
          hud.tick([{ b: u.name }, ' đã thích phiên LIVE ❤️']);
          if (likeTickAt.size > 500) likeTickAt.clear();
        }
        break;
      }

      case 'follow':
        scene.lotusUnder(u, 'pink');
        hud.tick([{ b: u.name }, ' đã theo dõi thiền đường ➕']);
        points(u, ev.points);
        A.sparkle();
        break;

      case 'share':
        scene.lotusUnder(u, 'gold');
        hud.tick([{ b: u.name }, ' đã chia sẻ phiên LIVE ↗']);
        points(u, ev.points);
        A.sparkle();
        break;

      case 'xam':
        hud.center(() => buildXam(u, ev), 5500, () => {
          A.shake();
          scene.sparkles(540, 900, 20, 'petalGold');
        });
        break;

      case 'gift': {
        hud.banner('🎁', u.name, `tặng ${ev.giftName}`, ev.count, 2200, () => {
          const a = scene.anchor(u);
          scene.sparkles(a.x, a.head, 16);
          A.chime(3, 0.15);
        }, ev.image);
        break;
      }

      case 'ritual':
        ritual(ev);
        break;

      case 'challenge_done':
        hud.challengeDone();
        hud.center(() => buildCaption('🎉 ' + (ev.title || 'VIÊN MÃN!'), `Thử thách vòng ${ev.round} hoàn thành`, ev.text), 5000, () => {
          scene.celebrate();
          hud.flash(900);
          A.bell(true);
          A.sparkle();
        });
        break;
    }
  }

  // ---------- Nghi lễ (quà tặng) ----------
  function ritual(ev) {
    const r = ev.ritual;
    const u = ev.user;
    const dur = r.duration || 4000;
    hud.highlightRitual(r.id);

    const fx = (d) => {
      const a = scene.anchor(u);
      switch (r.effect) {
        case 'bow_roses':
          scene.bow(u, 1);
          scene.roses(a.x, a.head - 10, Math.min(14, 5 + ev.count * 2));
          A.chime(1, 0.16);
          break;
        case 'pin_rose':
          scene.setRose(u, 120);
          scene.roses(a.x, a.head, 10);
          scene.spawn(1.5, 0.05, () => scene.petals(a.x + (Math.random() - 0.5) * 300, a.y - 300 - Math.random() * 200, 1, 'petalRed', 10));
          A.sparkle();
          break;
        case 'hai_loc':
          scene.haiLoc(d / 1000);
          A.sparkle();
          setTimeout(() => A.sparkle(), 700);
          break;
        case 'xin_chu':
          scene.sparkles(540, 900, 30, 'petalGold');
          A.bell(false);
          break;
        case 'hoa_dang':
          scene.lanterns(9 + Math.min(6, ev.count * 2));
          A.bell(false);
          break;
        case 'phap_danh':
          scene.bloom(540, 1180, 3.2, 'gold', d / 1000);
          scene.confetti(2);
          A.bell(true);
          break;
        case 'phat_quang':
          scene.phatQuang(d / 1000);
          hud.flash(1500);
          A.bell(true);
          setTimeout(() => A.bell(true), 2500);
          A.sparkle();
          break;
        default:
          scene.sparkles(a.x, a.head, 20);
      }
      points(u, ev.points);
    };

    if (r.level === 'big') {
      let build;
      if (r.effect === 'xin_chu') build = () => buildXinChu(u, ev);
      else if (r.effect === 'phap_danh') build = () => buildPhapDanh(u, ev);
      else if (r.effect === 'phat_quang') build = () => buildGrand(u, ev);
      else if (r.effect === 'hoa_dang') build = () => buildCaption('🏮 Dâng hoa đăng', u.name, 'Nguyện ánh sáng soi đường an lành');
      else build = () => buildCaption(`${r.icon} ${r.name}`, u.name, ev.count > 1 ? `x${ev.count}` : '');
      hud.center(() => {
        const node = build();
        if (r.image) node.prepend(TD.giftIcon('cfx-gift', r.image, r.icon));
        return node;
      }, dur, fx);
    } else {
      hud.banner(r.icon, u.name, r.name, ev.count, Math.max(2200, dur), fx, r.image);
    }
  }

  // ---------- Thẻ hiệu ứng giữa màn hình ----------
  function buildXam(u, ev) {
    const q = ev.que || {};
    const box = el('div', 'scroll xam');
    box.append(
      el('div', 'lbl', 'QUẺ XĂM'),
      el('div', 'que-no', `Quẻ số ${ev.soQue || 1}`),
      el('div', 'hang', q.hang || ''),
      el('div', 'tho', q.tho || ''),
      el('div', 'loi', q.loi || ''),
      el('div', 'by', `🙏 ${u.name}`)
    );
    return box;
  }
  function buildXinChu(u, ev) {
    const c = ev.chu || { chu: 'Tâm', nghia: '' };
    const box = el('div', 'scroll');
    const chu = el('div', 'chu' + (c.chu.length > 4 ? ' long' : ''), c.chu);
    box.append(el('div', 'lbl', 'XIN CHỮ ĐẦU NĂM'), chu, el('div', 'nghia', c.nghia || ''), el('div', 'by', `Tặng ${u.name}`), el('div', 'seal', 'Ngàn Sen'));
    return box;
  }
  function buildPhapDanh(u, ev) {
    const box = el('div', 'scroll phapdanh');
    box.append(el('div', 'lbl', 'BAN PHÁP DANH'), el('div', 'pd', ev.phapDanh || 'Tâm An'), el('div', 'nghia', 'Nguyện giữ tâm thanh tịnh, tinh tấn tu học'), el('div', 'by', `Cho thiện hữu ${u.name}`), el('div', 'seal', 'Thiền Đường Ngàn Sen'));
    return box;
  }
  function buildGrand(u, ev) {
    const box = el('div', 'grand');
    box.append(el('div', 'g1', '☸ ĐẠI LỄ PHẬT QUANG ☸'), el('div', 'g2', u.name), el('div', 'g3', ev.count > 1 ? `Công đức vô lượng · x${ev.count}` : 'Công đức vô lượng · Phước báu tròn đầy'));
    return box;
  }
  function buildCaption(t1, t2, t3) {
    const box = el('div', 'caption');
    box.append(el('div', 'c1', t1), el('div', 'c2', t2 || ''));
    if (t3) box.append(el('div', 'c3', t3));
    return box;
  }

  // ---------- Vòng lặp 60 FPS ----------
  let last = performance.now();
  let frames = 0;
  let fpsT = last;
  let fps = 0;
  const fpsEl = document.getElementById('fps');
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (configured) {
      scene.update(dt);
      scene.draw();
    }
    frames++;
    if (now - fpsT >= 1000) {
      fps = Math.round((frames * 1000) / (now - fpsT));
      frames = 0;
      fpsT = now;
      fpsEl.textContent = fps + ' FPS';
      if (socket.connected) socket.emit('overlay:fps', { fps, preview: PREVIEW });
      if (window.parent !== window) window.parent.postMessage({ type: 'overlayFps', fps }, location.origin);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Font tải xong thì vẽ lại nhãn tên cho đẹp
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => configured && scene.rebuildTags());
  setTimeout(() => configured && scene.rebuildTags(), 2500);
})();
