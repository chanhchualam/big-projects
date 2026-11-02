/**
 * CẢNH CHÁNH ĐIỆN (Canvas 2D)
 *  - Nhân vật sư cố định, người xem ngồi thiền trên bồ đoàn
 *  - Khói hương, cánh hoa, hạt sáng, chùm sáng
 *  - Các hiệu ứng: tim, mõ, chuông, sen nở, hoa đăng, hái lộc, Phật quang...
 *  - Nền chánh điện dự phòng (vẽ bằng code) khi chưa có ảnh nền
 */
window.TD = window.TD || {};

(function () {
  const W = 1080, H = 1920;
  const FONT = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';
  const SERIF = '"Noto Serif", "Times New Roman", serif';
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

  // ---------------------------------------------------------
  // Tiện ích vẽ
  // ---------------------------------------------------------
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }
  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
        if (lines.length === maxLines) break;
      } else cur = test;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
      lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1] + ' …', maxW);
    }
    return lines.map((l) => fitText(ctx, l, maxW));
  }

  // ---------------------------------------------------------
  // Sprite dựng sẵn (vẽ 1 lần, dùng drawImage cho nhanh)
  // ---------------------------------------------------------
  function radial(size, stops) {
    const c = mk(size, size);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  }
  function heartPath(g, cx, cy, s) {
    g.beginPath();
    g.moveTo(cx, cy + s * 0.35);
    g.bezierCurveTo(cx - s * 0.9, cy - s * 0.25, cx - s * 0.4, cy - s * 0.95, cx, cy - s * 0.45);
    g.bezierCurveTo(cx + s * 0.4, cy - s * 0.95, cx + s * 0.9, cy - s * 0.25, cx, cy + s * 0.35);
    g.closePath();
  }
  function makeSprites() {
    const S = {};
    S.smoke = radial(96, [[0, 'rgba(235,225,215,.55)'], [0.45, 'rgba(210,200,190,.22)'], [1, 'rgba(200,190,180,0)']]);
    S.glow = radial(64, [[0, 'rgba(255,250,215,1)'], [0.25, 'rgba(255,215,120,.75)'], [1, 'rgba(255,170,40,0)']]);
    S.bigGlow = radial(256, [[0, 'rgba(255,240,190,.9)'], [0.4, 'rgba(255,200,90,.35)'], [1, 'rgba(255,160,30,0)']]);
    S.cushionGlow = radial(160, [[0, 'rgba(255,225,140,.85)'], [0.5, 'rgba(255,190,80,.35)'], [1, 'rgba(255,160,40,0)']]);

    // Cánh hoa (hồng / vàng / trắng)
    const petal = (c1, c2) => {
      const c = mk(32, 32);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 4, 0, 28);
      gr.addColorStop(0, c1);
      gr.addColorStop(1, c2);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(16, 2);
      g.quadraticCurveTo(30, 12, 16, 30);
      g.quadraticCurveTo(2, 12, 16, 2);
      g.fill();
      return c;
    };
    S.petal = petal('#ffe1ec', '#ff8fb5');
    S.petalGold = petal('#fff6c8', '#f3b83a');
    S.petalWhite = petal('#ffffff', '#f2dfe6');
    S.petalRed = petal('#ff9a9a', '#d4162c');

    // Trái tim
    S.heart = (() => {
      const c = mk(64, 64);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 8, 0, 56);
      gr.addColorStop(0, '#ff9ec2');
      gr.addColorStop(1, '#ff2d6f');
      g.fillStyle = gr;
      g.shadowColor = 'rgba(255,60,120,.8)';
      g.shadowBlur = 8;
      heartPath(g, 32, 34, 28);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath();
      g.ellipse(22, 22, 6, 4, -0.6, 0, TAU);
      g.fill();
      return c;
    })();

    // Hoa hồng
    S.rose = (() => {
      const c = mk(64, 64);
      const g = c.getContext('2d');
      g.fillStyle = '#2e8b3a';
      g.beginPath(); g.ellipse(18, 44, 12, 6, -0.6, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(46, 44, 12, 6, 0.6, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) {
        g.fillStyle = ['#a30d22', '#d01a35', '#f0435a'][i];
        g.beginPath(); g.arc(32, 30, 20 - i * 6, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(90,0,10,.6)';
      g.lineWidth = 2;
      g.beginPath();
      for (let a = 0; a < 12; a += 0.3) g.lineTo(32 + Math.cos(a) * a * 1.4, 30 + Math.sin(a) * a * 1.4);
      g.stroke();
      return c;
    })();

    // Đồng xu vàng
    S.coin = (() => {
      const c = mk(48, 48);
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(18, 16, 2, 24, 24, 24);
      gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.6, '#f2bd38'); gr.addColorStop(1, '#a96d06');
      g.fillStyle = gr;
      g.beginPath(); g.arc(24, 24, 22, 0, TAU); g.fill();
      g.strokeStyle = '#8a5a05'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#7a4a03'; g.fillRect(18, 18, 12, 12);
      return c;
    })();

    // Bao lì xì (lộc)
    S.envelope = (() => {
      const c = mk(56, 76);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 56, 76);
      gr.addColorStop(0, '#ff3b2f'); gr.addColorStop(1, '#a50d0d');
      g.fillStyle = gr;
      rr(g, 2, 2, 52, 72, 6); g.fill();
      g.strokeStyle = '#ffd36b'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#ffd36b';
      g.beginPath(); g.arc(28, 34, 13, 0, TAU); g.fill();
      g.fillStyle = '#b3120d';
      g.font = `900 15px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Lộc', 28, 35);
      return c;
    })();

    // Hoa đăng (đèn hoa sen)
    S.lantern = (() => {
      const c = mk(128, 128);
      const g = c.getContext('2d');
      const gl = g.createRadialGradient(64, 54, 4, 64, 54, 40);
      gl.addColorStop(0, 'rgba(255,250,200,1)'); gl.addColorStop(1, 'rgba(255,190,60,0)');
      g.fillStyle = gl; g.fillRect(0, 0, 128, 128);
      drawLotus(g, 64, 92, 46, 1, ['#ffd1e1', '#ff7fa8', '#e2457a']);
      g.fillStyle = '#fff5c0';
      g.beginPath(); g.ellipse(64, 60, 6, 14, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff9d2e';
      g.beginPath(); g.ellipse(64, 64, 4, 9, 0, 0, TAU); g.fill();
      return c;
    })();

    // Chùm sáng rọi xuống
    S.beam = (() => {
      const c = mk(160, 600);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 600);
      gr.addColorStop(0, 'rgba(255,230,160,0)');
      gr.addColorStop(0.55, 'rgba(255,220,140,.12)');
      gr.addColorStop(1, 'rgba(255,210,120,.32)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(62, 0); g.lineTo(98, 0); g.lineTo(160, 600); g.lineTo(0, 600);
      g.closePath();
      g.fill();
      return c;
    })();

    // Tia sáng Phật quang
    S.ray = (() => {
      const c = mk(120, 1100);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 1100, 0, 0);
      gr.addColorStop(0, 'rgba(255,240,180,.9)');
      gr.addColorStop(0.5, 'rgba(255,200,80,.3)');
      gr.addColorStop(1, 'rgba(255,170,40,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(60, 1100); g.lineTo(0, 0); g.lineTo(120, 0); g.closePath(); g.fill();
      return c;
    })();
    return S;
  }

  /** Vẽ hoa sen; open = 0..1 độ nở */
  function drawLotus(g, x, y, size, open, cols) {
    const [c1, c2, c3] = cols || ['#ffe0ea', '#ff8fb5', '#e44b80'];
    const layers = [
      { n: 7, len: 1.0, wid: 0.32, spread: 1.25 },
      { n: 5, len: 0.85, wid: 0.3, spread: 0.85 },
      { n: 3, len: 0.7, wid: 0.28, spread: 0.45 },
    ];
    layers.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
        const t = L.n === 1 ? 0 : i / (L.n - 1) - 0.5;
        const ang = -Math.PI / 2 + t * L.spread * 2 * (0.25 + 0.75 * open);
        g.save();
        g.translate(x, y);
        g.rotate(ang + Math.PI / 2);
        const len = size * L.len * (0.4 + 0.6 * open);
        const wid = size * L.wid;
        const gr = g.createLinearGradient(0, 0, 0, -len);
        gr.addColorStop(0, li === 0 ? c3 : c2);
        gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-wid, -len * 0.5, 0, -len);
        g.quadraticCurveTo(wid, -len * 0.5, 0, 0);
        g.fill();
        g.restore();
      }
    });
    g.fillStyle = '#ffd34d';
    g.beginPath();
    g.ellipse(x, y - size * 0.12, size * 0.16, size * 0.07, 0, 0, TAU);
    g.fill();
  }

  // ---------------------------------------------------------
  // Nhân vật chibi ngồi thiền
  // ---------------------------------------------------------
  const ROBES = {
    nam: { robe: '#7a5536', dark: '#5a3b22', hair: '#2a1a12' },
    nu: { robe: '#8ea4bd', dark: '#6a7f98', hair: '#1e1410' },
    monk: { robe: '#e3962b', dark: '#b46d14', hair: null },
    abbot: { robe: '#e08a24', dark: '#a85c10', hair: null },
  };

  function drawChibi(g, x, y, s, o) {
    const type = o.abbot ? 'abbot' : o.monk ? 'monk' : o.gender === 'nu' ? 'nu' : 'nam';
    const C = ROBES[type];
    const b = o.bow || 0;
    const br = Math.sin(o.breathe || 0);
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;

    const shoulderY = -48 + b * 22 + br * 0.6;
    const headY = -66 + b * 34 + br * 0.9;

    // Bóng đổ
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(0, 2, 42, 10, 0, 0, TAU); g.fill();

    // Chân xếp bằng
    g.fillStyle = C.dark;
    g.beginPath(); g.ellipse(0, -8, 40, 14, 0, 0, TAU); g.fill();
    g.fillStyle = C.robe;
    g.beginPath(); g.ellipse(0, -11, 36, 11, 0, 0, TAU); g.fill();

    // Thân áo
    const gr = g.createLinearGradient(-30, shoulderY, 30, -10);
    gr.addColorStop(0, C.robe);
    gr.addColorStop(1, C.dark);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-30, -12);
    g.quadraticCurveTo(-31, shoulderY + 4, -14, shoulderY);
    g.lineTo(14, shoulderY);
    g.quadraticCurveTo(31, shoulderY + 4, 30, -12);
    g.closePath();
    g.fill();

    // Cà sa (sư trụ trì)
    if (type === 'abbot') {
      g.fillStyle = '#a3241a';
      g.beginPath();
      g.moveTo(-14, shoulderY); g.lineTo(-4, shoulderY); g.lineTo(28, -14); g.lineTo(16, -12);
      g.closePath(); g.fill();
      g.strokeStyle = '#f3c75b'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#f3c75b';
      g.beginPath(); g.arc(-6, shoulderY + 6, 2.5, 0, TAU); g.fill();
    }

    // Cổ áo chữ V
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-8, shoulderY); g.lineTo(0, shoulderY + 11); g.lineTo(8, shoulderY); g.stroke();

    // Tay: thiền ấn (để trên đùi) hoặc chắp tay khi lạy
    g.fillStyle = '#f4cba4';
    if (b > 0.15) {
      g.beginPath(); g.ellipse(0, shoulderY + 14, 5, 9, 0, 0, TAU); g.fill();
    } else {
      g.beginPath(); g.ellipse(0, -16, 10, 5, 0, 0, TAU); g.fill();
    }

    // Đầu
    const hr = 17;
    if (o.avatarImg && o.avatarImg.complete && o.avatarImg.naturalWidth) {
      g.save();
      g.beginPath(); g.arc(0, headY, hr + 2, 0, TAU); g.clip();
      g.drawImage(o.avatarImg, -hr - 2, headY - hr - 2, (hr + 2) * 2, (hr + 2) * 2);
      g.restore();
      g.strokeStyle = '#f3c75b'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, headY, hr + 2, 0, TAU); g.stroke();
    } else {
      // Tóc dài phía sau (nữ)
      if (type === 'nu') {
        g.fillStyle = C.hair;
        g.beginPath();
        g.moveTo(-18, headY - 2);
        g.quadraticCurveTo(-22, headY + 22, -14, shoulderY + 8);
        g.lineTo(14, shoulderY + 8);
        g.quadraticCurveTo(22, headY + 22, 18, headY - 2);
        g.fill();
      }
      const sk = g.createRadialGradient(-5, headY - 6, 2, 0, headY, hr);
      sk.addColorStop(0, '#ffe2c8');
      sk.addColorStop(1, '#efbf96');
      g.fillStyle = sk;
      g.beginPath(); g.arc(0, headY, hr, 0, TAU); g.fill();
      // Tai
      g.beginPath(); g.ellipse(-hr + 1, headY + 2, 3.5, 5, 0, 0, TAU); g.ellipse(hr - 1, headY + 2, 3.5, 5, 0, 0, TAU); g.fill();

      if (C.hair) {
        g.fillStyle = C.hair;
        g.beginPath();
        g.arc(0, headY - 1, hr + 1, Math.PI * 1.02, Math.PI * 1.98);
        g.quadraticCurveTo(6, headY - 9, -hr - 1, headY - 2);
        g.fill();
        if (type === 'nu') {
          g.beginPath(); g.arc(0, headY - hr - 4, 8, 0, TAU); g.fill(); // búi tóc
          g.fillStyle = '#f3c75b';
          g.fillRect(-9, headY - hr - 4, 18, 2);
        }
      } else {
        // Đầu trọc: vệt sáng
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.ellipse(-5, headY - 9, 6, 3.5, -0.4, 0, TAU); g.fill();
      }

      // Mặt (mắt nhắm, má hồng) — khi cúi lạy thì mặt khuất dần
      const faceA = 1 - clamp((b - 0.4) * 2.2, 0, 1);
      if (faceA > 0) {
        g.globalAlpha *= faceA;
        const fy = headY + 3 + b * 4;
        g.strokeStyle = '#4a2a18';
        g.lineWidth = 1.8;
        g.lineCap = 'round';
        g.beginPath(); g.arc(-6, fy - 1, 3.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.beginPath(); g.arc(6, fy - 1, 3.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.fillStyle = 'rgba(255,120,120,.35)';
        g.beginPath(); g.arc(-10, fy + 5, 3.2, 0, TAU); g.arc(10, fy + 5, 3.2, 0, TAU); g.fill();
        g.beginPath(); g.arc(0, fy + 6, 2.6, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
        if (!C.hair) { // chấm bạch hào cho sư
          g.fillStyle = '#d0503a';
          g.beginPath(); g.arc(0, fy - 8, 1.4, 0, TAU); g.fill();
        }
      }
    }

    // Bông hồng cài áo
    if (o.rose && o.sprites) g.drawImage(o.sprites.rose, 6, shoulderY + 2, 20, 20);

    g.restore();
  }

  function drawCushion(g, x, y, s, occupied, num, t, sprites) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    if (occupied) {
      const p = 0.75 + Math.sin(t * 2.4 + x) * 0.25;
      g.globalAlpha = p;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(sprites.cushionGlow, -80, -40, 160, 80);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    // Đệm tròn
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(0, 6, 44, 13, 0, 0, TAU); g.fill();
    const gr = g.createLinearGradient(0, -14, 0, 14);
    gr.addColorStop(0, occupied ? '#e2483a' : '#b5302a');
    gr.addColorStop(1, occupied ? '#7a160f' : '#5a120c');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, 42, 15, 0, 0, TAU); g.fill();
    g.strokeStyle = occupied ? '#ffe08a' : '#c99a3a';
    g.lineWidth = occupied ? 3 : 2;
    g.stroke();
    g.strokeStyle = 'rgba(255,220,140,.35)';
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, -1, 28, 9, 0, 0, TAU); g.stroke();
    if (!occupied) {
      g.fillStyle = '#ffe7a8';
      g.font = `800 17px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(num), 0, 0);
    }
    g.restore();
  }

  // ---------------------------------------------------------
  // Nhãn tên, bong bóng chat (cache ra canvas)
  // ---------------------------------------------------------
  function buildTag(name, img, theme = 'viewer') {
    const t = mk(10, 10).getContext('2d');
    const fsz = theme === 'monk' ? 24 : 18;
    t.font = `800 ${fsz}px ${FONT}`;
    const maxW = theme === 'monk' ? 220 : 98;
    const text = fitText(t, name || '', maxW);
    const tw = t.measureText(text).width;
    const av = theme === 'monk' ? 0 : 24;
    const h = theme === 'monk' ? 40 : 30;
    const w = Math.ceil((av ? av + 8 : 16) + tw + 12);
    const c = mk(w + 6, h + 6);
    const g = c.getContext('2d');
    g.translate(3, 3);
    rr(g, 0, 0, w, h, h / 2);
    if (theme === 'monk') {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#fff0b8'); gr.addColorStop(1, '#e2a63a');
      g.fillStyle = gr;
    } else g.fillStyle = 'rgba(70,10,6,.88)';
    g.fill();
    g.strokeStyle = theme === 'monk' ? '#7a2a08' : '#f3c75b';
    g.lineWidth = 2;
    g.stroke();
    if (av) {
      const cx = 3 + av / 2, cy = h / 2;
      g.save();
      g.beginPath(); g.arc(cx, cy, av / 2, 0, TAU); g.clip();
      if (img && img.complete && img.naturalWidth) {
        g.drawImage(img, cx - av / 2, cy - av / 2, av, av);
      } else {
        g.fillStyle = `hsl(${hashHue(name || '')},55%,45%)`;
        g.fillRect(cx - av / 2, cy - av / 2, av, av);
        g.fillStyle = '#fff';
        g.font = `800 13px ${FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText((name || '?').trim().charAt(0).toUpperCase(), cx, cy + 1);
      }
      g.restore();
      g.strokeStyle = '#f3c75b'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, av / 2, 0, TAU); g.stroke();
    }
    g.font = `800 ${fsz}px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillStyle = theme === 'monk' ? '#5a1500' : '#fff3cf';
    g.fillText(text, av ? av + 8 : 8, h / 2 + 1);
    return c;
  }

  function buildBadge(name) {
    const t = mk(10, 10).getContext('2d');
    t.font = `800 20px ${FONT}`;
    const nm = name ? fitText(t, name, 200) : 'Chờ người chăm chỉ nhất';
    const w = Math.max(210, t.measureText(nm).width + 30);
    const h = 58;
    const c = mk(w + 6, h + 6);
    const g = c.getContext('2d');
    g.translate(3, 3);
    rr(g, 0, 0, w, h, 12);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#8a1c12'); gr.addColorStop(1, '#4a0b06');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = '#f3c75b'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd96b';
    g.font = `900 17px ${SERIF}`;
    g.fillText('🏆 TOP CHĂM CHỈ', w / 2, 17);
    g.fillStyle = '#fff3cf';
    g.font = `800 20px ${FONT}`;
    g.fillText(nm, w / 2, 40);
    return c;
  }

  function buildBubble(text, kind = 'chat') {
    const t = mk(10, 10).getContext('2d');
    const fsz = kind === 'pray' ? 23 : 21;
    const font = kind === 'pray' ? `italic 700 ${fsz}px ${FONT}` : `600 ${fsz}px ${FONT}`;
    t.font = font;
    const maxW = kind === 'pray' ? 300 : 240;
    const lines = wrap(t, kind === 'pray' ? '🙏 ' + text : text, maxW, kind === 'pray' ? 3 : 2);
    const tw = Math.max(...lines.map((l) => t.measureText(l).width), 30);
    const lh = fsz + 6;
    const w = tw + 28, h = lines.length * lh + 18;
    const c = mk(w + 8, h + 20);
    const g = c.getContext('2d');
    g.translate(4, 4);
    rr(g, 0, 0, w, h, kind === 'pray' ? 18 : 14);
    if (kind === 'pray') {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,248,215,.97)'); gr.addColorStop(1, 'rgba(255,214,120,.97)');
      g.fillStyle = gr;
      g.shadowColor = 'rgba(255,200,80,.9)'; g.shadowBlur = 0;
    } else g.fillStyle = 'rgba(255,255,255,.96)';
    g.fill();
    g.strokeStyle = kind === 'pray' ? '#c98a1d' : 'rgba(120,40,20,.5)';
    g.lineWidth = 2;
    g.stroke();
    // đuôi bong bóng
    g.beginPath();
    g.moveTo(w / 2 - 9, h - 1); g.lineTo(w / 2, h + 12); g.lineTo(w / 2 + 9, h - 1);
    g.closePath(); g.fill();
    g.fillStyle = kind === 'pray' ? '#6a1a05' : '#2b120a';
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, w / 2, 9 + lh * i + lh / 2));
    return c;
  }

  // ---------------------------------------------------------
  // NỀN CHÁNH ĐIỆN DỰ PHÒNG (khi chưa có ảnh nền)
  // ---------------------------------------------------------
  function drawFallbackBackground(cv, L) {
    const g = cv.getContext('2d');
    const bx = L.buddha.x, by = L.buddha.y, r = L.buddha.r;
    // Tường
    let gr = g.createLinearGradient(0, 0, 0, 1050);
    gr.addColorStop(0, '#2a0703'); gr.addColorStop(0.5, '#5c160a'); gr.addColorStop(1, '#3a0c05');
    g.fillStyle = gr; g.fillRect(0, 0, W, 1050);
    // Hoa văn tường
    g.strokeStyle = 'rgba(243,199,91,.08)'; g.lineWidth = 2;
    for (let x = 0; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1050); g.stroke(); }
    // Ánh sáng ấm sau tượng
    gr = g.createRadialGradient(bx, by, 10, bx, by, r * 1.6);
    gr.addColorStop(0, 'rgba(255,220,130,.85)'); gr.addColorStop(0.35, 'rgba(255,160,50,.35)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 1100);
    // Hào quang tròn
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(255,220,120,${0.5 - i * 0.13})`; g.lineWidth = 6 - i * 1.5;
      g.beginPath(); g.arc(bx, by - r * 0.32, r * (0.42 + i * 0.12), 0, TAU); g.stroke();
    }
    // Tượng Phật (cách điệu)
    const gold = (y0, y1) => {
      const q = g.createLinearGradient(bx - r, y0, bx + r, y1);
      q.addColorStop(0, '#9a5d0c'); q.addColorStop(0.35, '#f6d36f'); q.addColorStop(0.55, '#fff0b0'); q.addColorStop(0.8, '#d79a2b'); q.addColorStop(1, '#7a4508');
      return q;
    };
    // Đài sen
    g.save();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i + 0.5) * (Math.PI / 9);
      const px = bx + Math.cos(a) * r * 0.75, py = by + r * 0.72 + Math.sin(a) * -r * 0.08;
      g.fillStyle = i % 2 ? '#e88aa8' : '#f4a9c0';
      g.beginPath(); g.ellipse(px, py, r * 0.14, r * 0.2, a + Math.PI / 2, 0, TAU); g.fill();
    }
    g.fillStyle = gold(by + r * 0.6, by + r);
    g.beginPath(); g.ellipse(bx, by + r * 0.8, r * 0.85, r * 0.13, 0, 0, TAU); g.fill();
    g.restore();
    // Chân xếp
    g.fillStyle = gold(by + 0.3 * r, by + 0.75 * r);
    g.beginPath(); g.ellipse(bx, by + r * 0.55, r * 0.72, r * 0.2, 0, 0, TAU); g.fill();
    // Thân
    g.fillStyle = gold(by - 0.3 * r, by + 0.6 * r);
    g.beginPath();
    g.moveTo(bx - r * 0.62, by + r * 0.55);
    g.quadraticCurveTo(bx - r * 0.6, by - r * 0.18, bx - r * 0.22, by - r * 0.26);
    g.lineTo(bx + r * 0.22, by - r * 0.26);
    g.quadraticCurveTo(bx + r * 0.6, by - r * 0.18, bx + r * 0.62, by + r * 0.55);
    g.closePath(); g.fill();
    // Tay ấn thiền
    g.fillStyle = '#f2c65c';
    g.beginPath(); g.ellipse(bx, by + r * 0.38, r * 0.2, r * 0.07, 0, 0, TAU); g.fill();
    // Đầu
    const hy = by - r * 0.46;
    g.fillStyle = gold(hy - r * 0.2, hy + r * 0.2);
    g.beginPath(); g.ellipse(bx, hy, r * 0.17, r * 0.2, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(bx - r * 0.17, hy + r * 0.05, r * 0.035, r * 0.1, 0, 0, TAU); g.ellipse(bx + r * 0.17, hy + r * 0.05, r * 0.035, r * 0.1, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a3208';
    g.beginPath(); g.ellipse(bx, hy - r * 0.12, r * 0.16, r * 0.11, 0, Math.PI, TAU); g.fill();
    g.beginPath(); g.arc(bx, hy - r * 0.24, r * 0.06, 0, TAU); g.fill();
    g.strokeStyle = '#7a4508'; g.lineWidth = 3;
    g.beginPath(); g.arc(bx - r * 0.065, hy + r * 0.01, r * 0.035, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.arc(bx + r * 0.065, hy + r * 0.01, r * 0.035, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.arc(bx, hy + r * 0.1, r * 0.03, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.fillStyle = '#c0392b'; g.beginPath(); g.arc(bx, hy - r * 0.06, 3, 0, TAU); g.fill();

    // Hai cột rồng
    [95, W - 95].forEach((cx, side) => {
      const cg = g.createLinearGradient(cx - 55, 0, cx + 55, 0);
      cg.addColorStop(0, '#4a0805'); cg.addColorStop(0.45, '#b3261a'); cg.addColorStop(1, '#3a0603');
      g.fillStyle = cg; g.fillRect(cx - 55, 0, 110, 1130);
      g.fillStyle = '#d9a53a';
      g.fillRect(cx - 62, 1080, 124, 50); g.fillRect(cx - 62, 0, 124, 26);
      // Rồng uốn quanh cột
      g.strokeStyle = '#f2c55a'; g.lineWidth = 16; g.lineCap = 'round';
      g.beginPath();
      for (let y = 60; y < 1060; y += 8) {
        const x = cx + Math.sin(y / 70 + side) * 48;
        y === 60 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = '#a8701a'; g.lineWidth = 3; g.setLineDash([4, 8]); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#f6d36f';
      g.beginPath(); g.ellipse(cx + Math.sin(60 / 70 + side) * 48, 70, 22, 16, 0, 0, TAU); g.fill();
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(cx + Math.sin(60 / 70 + side) * 48 + 8, 66, 4, 0, TAU); g.fill();
    });

    // Sàn gỗ
    gr = g.createLinearGradient(0, 1010, 0, H);
    gr.addColorStop(0, '#5a2a12'); gr.addColorStop(0.4, '#7a3f1c'); gr.addColorStop(1, '#4a200c');
    g.fillStyle = gr; g.fillRect(0, 1010, W, H - 1010);
    g.strokeStyle = 'rgba(30,10,0,.35)'; g.lineWidth = 2;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(540 + i * 30, 1010); g.lineTo(540 + i * 140, H); g.stroke(); }
    for (let k = 0, y = 1020; y < H; k++, y += 18 + k * 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // Thảm đỏ lối giữa
    g.fillStyle = '#8a160e';
    g.beginPath(); g.moveTo(470, 1120); g.lineTo(610, 1120); g.lineTo(700, H); g.lineTo(380, H); g.closePath(); g.fill();
    g.strokeStyle = '#d9a53a'; g.lineWidth = 5; g.stroke();
    // Vũng sáng ấm
    gr = g.createRadialGradient(540, 1250, 50, 540, 1250, 700);
    gr.addColorStop(0, 'rgba(255,190,90,.25)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr; g.fillRect(0, 1000, W, 920);

    // Bàn thờ
    const ax = 250, ay = 850, aw = 580, ah = 165;
    gr = g.createLinearGradient(0, ay, 0, ay + ah);
    gr.addColorStop(0, '#c62d1f'); gr.addColorStop(1, '#6a0f08');
    g.fillStyle = gr; g.fillRect(ax, ay, aw, ah);
    g.fillStyle = '#e3b04a'; g.fillRect(ax - 14, ay - 14, aw + 28, 18); g.fillRect(ax, ay + ah - 12, aw, 10);
    g.strokeStyle = '#e3b04a'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) rr(g, ax + 20 + i * 140, ay + 26, 120, 100, 10), g.stroke();
    g.fillStyle = 'rgba(243,199,91,.8)'; g.font = `900 40px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['卍', '福', '壽', '卍'].forEach((ch, i) => g.fillText(ch, ax + 80 + i * 140, ay + 78));
    // Nến hai bên
    [ax + 40, ax + aw - 40].forEach((cx) => {
      g.fillStyle = '#f2ead0'; g.fillRect(cx - 8, ay - 70, 16, 58);
      const fg = g.createRadialGradient(cx, ay - 82, 1, cx, ay - 82, 40);
      fg.addColorStop(0, 'rgba(255,240,180,1)'); fg.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = fg; g.fillRect(cx - 40, ay - 122, 80, 80);
      g.fillStyle = '#ffb02e'; g.beginPath(); g.ellipse(cx, ay - 80, 5, 11, 0, 0, TAU); g.fill();
    });
    // Bình hoa
    [ax + 120, ax + aw - 120].forEach((cx) => {
      g.fillStyle = '#d9a53a'; g.beginPath(); g.ellipse(cx, ay - 30, 22, 26, 0, 0, TAU); g.fill();
      for (let i = 0; i < 5; i++) drawLotus(g, cx - 30 + i * 15, ay - 70 - (i % 2) * 18, 20, 0.7);
    });
    // Lư hương
    const lx = L.burner.x, ly = L.burner.y;
    g.fillStyle = '#5a3a12'; g.fillRect(lx - 32, ly + 10, 8, 26); g.fillRect(lx + 24, ly + 10, 8, 26);
    gr = g.createLinearGradient(lx - 50, 0, lx + 50, 0);
    gr.addColorStop(0, '#6b4210'); gr.addColorStop(0.5, '#f2c55a'); gr.addColorStop(1, '#6b4210');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(lx, ly + 6, 50, 30, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.ellipse(lx, ly - 6, 56, 12, 0, 0, TAU); g.fill();
    g.fillStyle = '#3a2208'; g.beginPath(); g.ellipse(lx, ly - 7, 46, 8, 0, 0, TAU); g.fill();

    // Viền tối (vignette)
    gr = g.createRadialGradient(540, 900, 400, 540, 900, 1200);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------
  // LỚP SCENE
  // ---------------------------------------------------------
  class Scene {
    constructor(canvas) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.sp = makeSprites();
      this.t = 0;
      this.chars = [];
      this.back = [];      // hạt phía sau (khói lư hương)
      this.front = [];     // hạt phía trước
      this.texts = [];
      this.rings = [];
      this.blooms = [];
      this.flyers = [];
      this.prayers = [];
      this.spawners = [];
      this.sticks = [];
      this.monkAnim = {};
      this.quang = null;   // hiệu ứng Phật quang
      this.avatarCache = new Map();
      this.badge = buildBadge('');
      this.top1 = '';
      this.ambientCount = 0;
      this.cfg = null;
    }

    // ---- Cấu hình & bố cục ----
    configure(cfg) {
      this.cfg = cfg;
      const S = cfg.scene || {};
      const n = cfg.seats || 24;
      let seats = [];
      if (Array.isArray(S.seatPositions) && S.seatPositions.length) {
        seats = S.seatPositions.map((p) => ({ x: p.x, y: p.y, s: p.s || p.scale || 1 }));
      } else {
        const G = S.seatGrid || {};
        const rows = G.rows || 4;
        const L = G.leftX || [125, 260, 395];
        const R = G.rightX || [685, 820, 955];
        const pos = (xs) => {
          for (let r = 0; r < rows; r++) {
            const s = (G.scale0 || 0.95) + r * (G.scaleStep || 0.04);
            xs.forEach((x) => seats.push({ x: 540 + (x - 540) * (0.94 + r * 0.03), y: (G.y0 || 1245) + r * (G.dy || 106), s }));
          }
        };
        pos(L);
        pos(R);
      }
      // Nếu số ghế config khác lưới -> bổ sung/cắt bớt
      while (seats.length < n) seats.push({ x: rand(150, 930), y: rand(1220, 1520), s: 0.9 });
      this.seats = seats.slice(0, n);
      this.chars.length = n;
      this.L = {
        buddha: S.buddha || { x: 540, y: 470, r: 330 },
        burner: S.burner || { x: 540, y: 905 },
        monks: (S.monks || []).map((m) => Object.assign({}, m)),
      };
      this.L.monks.forEach((m) => (m.tag = buildTag(m.name, null, 'monk')));
      this.maxParticles = S.maxParticles || 900;
      this.beams = S.lightBeams !== false;
      this.avatarAsHead = !!S.avatarAsHead;
      this.ambientWanted = (S.ambientPetals ?? 14) + (S.ambientMotes ?? 40);
      if (this.sticks.length === 0) for (let i = 0; i < 3; i++) this.addStick(true);
    }

    fallbackBackground(cv) {
      drawFallbackBackground(cv, this.L);
    }

    rebuildTags() {
      this.chars.forEach((c) => c && (c.tag = buildTag(c.user.name, this.avatar(c.user.avatar))));
      this.L.monks.forEach((m) => (m.tag = buildTag(m.name, null, 'monk')));
      this.badge = buildBadge(this.top1);
    }

    setTop1(name) {
      if (name === this.top1) return;
      this.top1 = name || '';
      this.badge = buildBadge(this.top1);
      this.badgeFlash = this.t;
    }

    avatar(url) {
      if (!url) return null;
      let img = this.avatarCache.get(url);
      if (!img) {
        img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.onload = () => {
          this.chars.forEach((c) => c && c.user.avatar === url && (c.tag = buildTag(c.user.name, img)));
        };
        img.src = url;
        this.avatarCache.set(url, img);
        if (this.avatarCache.size > 300) this.avatarCache.delete(this.avatarCache.keys().next().value);
      }
      return img;
    }

    // ---- Nhân vật người xem ----
    syncSeats(list) {
      list.forEach((u, i) => {
        const c = this.chars[i];
        if (u) {
          if (!c || c.user.id !== u.id || c.leaving) this.spawnChar(i, u, false);
          else this.updateUser(c, u);
        } else if (c && !c.leaving) c.leaving = this.t;
      });
    }

    spawnChar(i, u, fancy = true) {
      const p = this.seats[i];
      if (!p) return null;
      const c = {
        user: Object.assign({}, u),
        seat: i,
        x: p.x, y: p.y, s: p.s,
        born: this.t,
        leaving: null,
        bowStart: -10, bowDur: 1.6,
        bubble: null,
        rose: 0,
        phase: Math.random() * TAU,
        tag: buildTag(u.name, this.avatar(u.avatar)),
      };
      this.chars[i] = c;
      if (fancy) {
        this.bloom(p.x, p.y + 4, p.s * 0.9, 'pink', 1.8);
        this.sparkles(p.x, p.y - 50 * p.s, 10);
      }
      return c;
    }

    updateUser(c, u) {
      const changed = c.user.name !== u.name || c.user.avatar !== u.avatar;
      Object.assign(c.user, u);
      if (changed) c.tag = buildTag(u.name, this.avatar(u.avatar));
    }

    charAt(seat) {
      const c = seat != null ? this.chars[seat] : null;
      return c && !c.leaving ? c : null;
    }

    /** Toạ độ neo hiệu ứng cho người xem (nếu đang chờ chỗ thì ở giữa dưới) */
    anchor(user) {
      const c = user && this.charAt(user.seat);
      if (c) return { x: c.x, y: c.y, s: c.s, head: c.y - 66 * c.s, c };
      return { x: 540, y: 1540, s: 1, head: 1500, c: null };
    }

    ensureChar(user) {
      if (!user || user.seat == null) return null;
      const c = this.chars[user.seat];
      if (c && c.user.id === user.id && !c.leaving) {
        this.updateUser(c, user);
        return c;
      }
      return this.spawnChar(user.seat, user, true);
    }

    removeChar(seat) {
      const c = this.chars[seat];
      if (c && !c.leaving) c.leaving = this.t;
    }

    // ---- Hành động ----
    bow(user, times = 1) {
      const c = this.charAt(user && user.seat);
      if (!c) return;
      c.bowStart = this.t;
      c.bowDur = 1.5 * times;
      c.bowTimes = times;
    }
    chat(user, text) {
      const c = this.charAt(user && user.seat);
      if (!c) return;
      c.bubble = { cv: buildBubble(text, 'chat'), t0: this.t, dur: 4.5 };
    }
    pray(user, text) {
      const a = this.anchor(user);
      if (this.prayers.length >= 6) this.prayers.shift();
      this.prayers.push({ cv: buildBubble(text, 'pray'), x: a.x, y: a.head - 70, t0: this.t, dur: 7, ph: Math.random() * TAU });
      this.sparkles(a.x, a.head, 8, 'petalGold');
    }
    setRose(user, sec = 90) {
      const c = this.charAt(user && user.seat);
      if (c) c.rose = this.t + sec;
    }
    monk(role, type) {
      const i = this.L.monks.findIndex((m) => (role === 'abbot' ? m.abbot : m.role === role));
      if (i >= 0) this.monkAnim[i] = { type, t0: this.t };
    }

    // ---- Hiệu ứng hạt ----
    add(p, layer = this.front) {
      if (!p.ambient && layer === this.front && layer.length >= this.maxParticles) return;
      p.age = 0;
      p.vx = p.vx || 0; p.vy = p.vy || 0;
      p.ax = p.ax || 0; p.ay = p.ay || 0;
      p.rot = p.rot || 0; p.vr = p.vr || 0;
      p.a = p.a == null ? 1 : p.a;
      layer.push(p);
    }
    hearts(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.add({ sp: 'heart', x: x + rand(-20, 20), y, vx: rand(-60, 60), vy: rand(-230, -140), ay: 30, size: rand(30, 46), life: rand(1.6, 2.4), sway: rand(20, 50), swf: rand(2, 4), ph: rand(0, TAU), grow: 0.2 });
      }
      for (let i = 0; i < Math.ceil(n / 2); i++) this.petals(x, y, 1);
    }
    petals(x, y, n, sp = 'petal', spread = 40) {
      for (let i = 0; i < n; i++) {
        this.add({ sp, x: x + rand(-spread, spread), y: y + rand(-10, 10), vx: rand(-80, 80), vy: rand(-200, -80), ay: 60, size: rand(16, 26), life: rand(2, 3.2), rot: rand(0, TAU), vr: rand(-4, 4), sway: 30, swf: rand(1, 3), ph: rand(0, TAU) });
      }
    }
    sparkles(x, y, n, sp = 'glow') {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), v = rand(60, 220);
        this.add({ sp, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, drag: 2.2, size: rand(10, 24), life: rand(0.7, 1.3), comp: sp === 'glow' ? 'lighter' : null, rot: rand(0, TAU), vr: rand(-5, 5) });
      }
    }
    roses(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI * 0.9, -Math.PI * 0.1), v = rand(160, 320);
        this.add({ sp: 'rose', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 260, drag: 0.6, size: rand(30, 44), life: rand(1.6, 2.4), rot: rand(-1, 1), vr: rand(-3, 3) });
      }
      this.petals(x, y, n, 'petalRed', 30);
    }
    smoke(x, y, k = 1, layer = this.back) {
      this.add({ sp: 'smoke', x: x + rand(-4, 4), y, vx: rand(-6, 6), vy: rand(-55, -35), size: rand(26, 40) * k, grow: rand(0.5, 0.9), life: rand(3.5, 5.5), sway: rand(10, 24), swf: rand(0.5, 1.2), ph: rand(0, TAU), a: rand(0.35, 0.6), fadeIn: 0.25 }, layer);
    }
    floatText(text, x, y, o = {}) {
      if (this.texts.length > 40) this.texts.shift();
      this.texts.push({ text, x, y, vy: o.vy ?? -55, age: 0, life: o.life || 1.6, size: o.size || 30, color: o.color || '#fff3c4', stroke: o.stroke || '#5a1500', font: o.font || FONT, pop: o.pop ?? true, wob: o.wob || 0 });
    }
    ring(x, y, o = {}) {
      this.rings.push({ x, y, r0: o.r0 || 20, r1: o.r1 || 220, age: 0, life: o.life || 1.4, color: o.color || '255,220,130', w: o.w || 6, sy: o.sy || 0.6 });
    }
    bloom(x, y, s = 1, color = 'pink', life = 3) {
      const cols = color === 'gold' ? ['#fff7d0', '#ffd25e', '#e09a1c'] : color === 'white' ? ['#ffffff', '#f3e6ff', '#cdb8f0'] : ['#ffe0ea', '#ff8fb5', '#e44b80'];
      this.blooms.push({ x, y, s, cols, age: 0, life });
    }
    spawn(dur, every, fn) {
      this.spawners.push({ until: this.t + dur, every, acc: 0, fn });
    }

    // ---- Hiệu ứng tổng hợp ----
    incense(user) {
      const a = this.anchor(user);
      this.flyers.push({ sx: a.x, sy: a.head, ex: this.L.burner.x + rand(-26, 26), ey: this.L.burner.y - 10, t0: this.t, dur: 0.9 });
    }
    addStick(permanent = false) {
      if (this.sticks.length >= 18) this.sticks.splice(this.sticks.findIndex((s) => !s.perm), 1);
      this.sticks.push({ off: permanent ? (this.sticks.length - 1) * 14 : rand(-34, 34), tilt: rand(-8, 8), born: this.t, life: permanent ? 1e9 : 45, perm: permanent, acc: 0 });
    }
    mo(user) {
      const a = this.anchor(user);
      this.floatText('cốc', a.x - 28, a.head - 30, { size: 34, color: '#ffd77a', stroke: '#3a1a05', life: 1.1, vy: -70 });
      setTimeout(() => this.floatText('cốc', a.x + 28, a.head - 50, { size: 34, color: '#ffd77a', stroke: '#3a1a05', life: 1.1, vy: -70 }), 200);
      this.ring(a.x, a.head, { r1: 70, life: 0.5, w: 3, color: '255,210,140', sy: 1 });
      this.monk('mo', 'nod');
    }
    bell(user) {
      const a = this.anchor(user);
      for (let i = 0; i < 3; i++) setTimeout(() => this.ring(a.x, a.y - 30 * a.s, { r1: 260, life: 1.8, w: 5 - i, sy: 0.55 }), i * 260);
      this.floatText('🔔 boong...', a.x, a.head - 40, { size: 30, life: 2, vy: -40 });
      this.monk('bell', 'sway');
    }
    like(user, count) {
      const a = this.anchor(user);
      const c = a.c;
      if (c) {
        if (this.t - (c.lastHeart || 0) < 0.15) return;
        c.lastHeart = this.t;
      }
      this.hearts(a.x, a.head - 10, Math.min(6, Math.max(1, Math.ceil(count / 2))));
    }
    lotusUnder(user, color = 'pink') {
      const a = this.anchor(user);
      this.bloom(a.x, a.y + 6, a.s * 1.4, color, 4);
      this.sparkles(a.x, a.y - 10, 14, color === 'gold' ? 'petalGold' : 'petal');
    }
    haiLoc(dur = 3.5) {
      this.spawn(dur, 0.06, () => {
        const env = Math.random() < 0.6;
        this.add({ sp: env ? 'envelope' : 'coin', x: rand(40, 1040), y: -60, vy: rand(160, 280), vx: rand(-30, 30), size: env ? rand(44, 60) : rand(30, 40), life: 9, rot: rand(-0.5, 0.5), vr: env ? rand(-1, 1) : rand(-5, 5), sway: rand(20, 60), swf: rand(1, 2), ph: rand(0, TAU), dieY: 1950 });
      });
    }
    lanterns(n = 9) {
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          this.add({ sp: 'lantern', glow: true, x: rand(120, 960), y: rand(1950, 2050), vy: rand(-140, -95), size: rand(90, 140), life: 16, sway: rand(25, 50), swf: rand(0.4, 0.8), ph: rand(0, TAU), fadeIn: 0.1, ambient: true, dieY: -200 });
        }, i * 380);
      }
      this.spawn(4, 0.12, () => this.petals(rand(100, 980), rand(1300, 1800), 1, 'petalGold', 10));
    }
    confetti(dur = 3) {
      const sps = ['petal', 'petalGold', 'petalWhite', 'petalRed'];
      this.spawn(dur, 0.025, () => {
        this.add({ sp: sps[(Math.random() * 4) | 0], x: rand(0, 1080), y: -30, vy: rand(150, 300), vx: rand(-40, 40), size: rand(18, 30), life: 9, rot: rand(0, TAU), vr: rand(-6, 6), sway: rand(30, 70), swf: rand(1, 3), ph: rand(0, TAU), dieY: 1950 });
      });
    }
    phatQuang(dur = 9) {
      this.quang = { t0: this.t, dur };
      const b = this.L.buddha;
      for (let i = 0; i < 4; i++) setTimeout(() => this.ring(b.x, b.y - b.r * 0.3, { r0: b.r * 0.3, r1: 900, life: 2.6, w: 10, sy: 1, color: '255,230,150' }), i * 700);
      this.spawn(dur * 0.85, 0.05, () => {
        this.add({ sp: 'glow', comp: 'lighter', x: b.x + rand(-b.r, b.r), y: b.y + rand(-b.r, b.r * 0.6), vx: rand(-30, 30), vy: rand(-60, -20), size: rand(12, 30), life: rand(1.5, 3), fadeIn: 0.3 });
      });
      this.confetti(dur * 0.6);
      this.monk('abbot', 'bow');
    }
    celebrate() {
      this.confetti(3.5);
      this.chars.forEach((c) => c && !c.leaving && this.bloom(c.x, c.y + 6, c.s * 1.2, 'gold', 3.5));
      for (let i = 0; i < 5; i++) setTimeout(() => this.ring(rand(200, 880), rand(500, 1100), { r1: 300, life: 1.6, w: 6, sy: 1, color: '255,200,120' }), i * 300);
    }

    // ---------------------------------------------------------
    // CẬP NHẬT
    // ---------------------------------------------------------
    update(dt) {
      this.t += dt;
      const t = this.t;

      // Khói từ các nén hương
      for (const s of this.sticks) {
        s.acc += dt;
        if (s.acc > (s.perm ? 0.32 : 0.45)) {
          s.acc = 0;
          this.smoke(this.L.burner.x + s.off + s.tilt, this.L.burner.y - 74, s.perm ? 1 : 0.8);
        }
      }
      this.sticks = this.sticks.filter((s) => t - s.born < s.life);

      // Hương bay từ người xem tới lư
      this.flyers = this.flyers.filter((f) => {
        if (t - f.t0 >= f.dur) {
          this.addStick();
          for (let i = 0; i < 4; i++) this.smoke(f.ex, f.ey - 50, 1.3);
          this.sparkles(f.ex, f.ey - 60, 6);
          return false;
        }
        return true;
      });

      // Bộ phát hạt định kỳ
      this.spawners = this.spawners.filter((s) => {
        s.acc += dt;
        while (s.acc >= s.every) {
          s.acc -= s.every;
          s.fn();
        }
        return t < s.until;
      });

      // Hạt môi trường: cánh hoa & bụi sáng bay chậm
      if (this.ambientCount < this.ambientWanted && Math.random() < 0.3) {
        this.ambientCount++;
        const motes = (this.cfg.scene?.ambientMotes ?? 40);
        const isMote = Math.random() < motes / Math.max(1, this.ambientWanted);
        if (isMote) {
          this.add({ amb: true, ambient: true, sp: 'glow', comp: 'lighter', x: rand(0, 1080), y: rand(150, 1700), vx: rand(-8, 8), vy: rand(-18, -6), size: rand(6, 14), life: rand(5, 10), sway: rand(10, 30), swf: rand(0.3, 0.8), ph: rand(0, TAU), fadeIn: 0.3, twinkle: rand(2, 5) });
        } else {
          this.add({ amb: true, ambient: true, sp: Math.random() < 0.7 ? 'petal' : 'petalWhite', x: rand(-50, 1100), y: -30, vx: rand(10, 30), vy: rand(35, 70), size: rand(14, 22), life: 40, rot: rand(0, TAU), vr: rand(-1.5, 1.5), sway: rand(30, 60), swf: rand(0.4, 0.9), ph: rand(0, TAU), a: 0.85, dieY: 1950 });
        }
      }

      const step = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i];
          p.age += dt;
          if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
          p.vx += p.ax * dt;
          p.vy += p.ay * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.age >= p.life || (p.dieY && (p.vy > 0 ? p.y > p.dieY : p.y < p.dieY))) {
            if (p.amb) this.ambientCount--;
            arr.splice(i, 1);
          }
        }
      };
      step(this.back);
      step(this.front);

      for (const x of this.texts) x.age += dt;
      this.texts = this.texts.filter((x) => x.age < x.life);
      for (const r of this.rings) r.age += dt;
      this.rings = this.rings.filter((r) => r.age < r.life);
      for (const b of this.blooms) b.age += dt;
      this.blooms = this.blooms.filter((b) => b.age < b.life);
      this.prayers = this.prayers.filter((p) => t - p.t0 < p.dur);
      if (this.quang && t - this.quang.t0 > this.quang.dur) this.quang = null;

      // Dọn nhân vật đã rời
      this.chars.forEach((c, i) => {
        if (c && c.leaving && t - c.leaving > 0.7) this.chars[i] = null;
        if (c && c.bubble && t - c.bubble.t0 > c.bubble.dur) c.bubble = null;
      });
    }

    // ---------------------------------------------------------
    // VẼ
    // ---------------------------------------------------------
    drawParticles(arr) {
      const g = this.g;
      for (const p of arr) {
        const img = this.sp[p.sp];
        if (!img) continue;
        const k = p.age / p.life;
        let a = p.a;
        if (p.fadeIn && k < p.fadeIn) a *= k / p.fadeIn;
        if (k > 0.7) a *= (1 - k) / 0.3;
        if (p.twinkle) a *= 0.55 + 0.45 * Math.sin(p.age * p.twinkle + p.ph);
        if (a <= 0.01) continue;
        const size = p.size * (1 + (p.grow || 0) * p.age);
        const x = p.x + (p.sway ? Math.sin(p.age * p.swf * TAU / 2 + p.ph) * p.sway : 0);
        g.globalAlpha = a;
        if (p.comp) g.globalCompositeOperation = p.comp;
        if (p.glow) {
          g.globalCompositeOperation = 'lighter';
          g.drawImage(this.sp.bigGlow, x - size, p.y - size * 1.1, size * 2, size * 2);
          g.globalCompositeOperation = 'source-over';
        }
        if (p.rot) {
          g.save();
          g.translate(x, p.y);
          g.rotate(p.rot);
          g.drawImage(img, -size / 2, -size / 2, size, size * (img.height / img.width));
          g.restore();
        } else {
          g.drawImage(img, x - size / 2, p.y - size / 2, size, size * (img.height / img.width));
        }
        if (p.comp) g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
    }

    drawQuang(front) {
      const q = this.quang;
      if (!q) return;
      const g = this.g;
      const k = (this.t - q.t0) / q.dur;
      const env = Math.min(1, k * 5) * Math.min(1, (1 - k) * 4);
      const b = this.L.buddha;
      const cy = b.y - b.r * 0.25;
      g.save();
      g.globalCompositeOperation = 'lighter';
      if (!front) {
        g.globalAlpha = env * 0.55;
        g.translate(b.x, cy);
        const n = 22;
        for (let i = 0; i < n; i++) {
          g.save();
          g.rotate((i / n) * TAU + this.t * 0.25);
          g.drawImage(this.sp.ray, -50, -1100, 100, 1100);
          g.restore();
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = env * (0.8 + Math.sin(this.t * 4) * 0.2);
        g.drawImage(this.sp.bigGlow, b.x - b.r * 1.3, cy - b.r * 1.3, b.r * 2.6, b.r * 2.6);
      } else {
        g.globalAlpha = env * 0.22;
        g.fillStyle = 'rgb(255,190,80)';
        g.fillRect(0, 0, W, H);
      }
      g.restore();
    }

    draw() {
      const g = this.g;
      const t = this.t;
      g.clearRect(0, 0, W, H);

      this.drawQuang(false);

      // Nén hương trên lư
      const bx = this.L.burner.x, by = this.L.burner.y;
      for (const s of this.sticks) {
        const age = t - s.born;
        const burn = s.perm ? 0 : Math.min(1, age / s.life) * 30;
        const x0 = bx + s.off, y0 = by - 8, x1 = bx + s.off + s.tilt, y1 = by - 76 + burn;
        g.strokeStyle = '#8a3b1a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.7 + Math.sin(t * 9 + s.off) * 0.3;
        g.drawImage(this.sp.glow, x1 - 9, y1 - 9, 18, 18);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#ff4a1c';
        g.beginPath(); g.arc(x1, y1, 2.4, 0, TAU); g.fill();
      }
      this.drawParticles(this.back);

      // Hương đang bay
      for (const f of this.flyers) {
        const p = ease((t - f.t0) / f.dur);
        const x = f.sx + (f.ex - f.sx) * p;
        const y = f.sy + (f.ey - 70 - f.sy) * p - Math.sin(p * Math.PI) * 160;
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(p * Math.PI) * 0.5);
        g.strokeStyle = '#8a3b1a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 46); g.stroke();
        g.globalCompositeOperation = 'lighter';
        g.drawImage(this.sp.glow, -12, -12, 24, 24);
        g.restore();
        if (Math.random() < 0.5) this.smoke(x, y, 0.4, this.front);
      }

      // Các sư
      this.L.monks.forEach((m, i) => {
        const an = this.monkAnim[i];
        let bow = 0, dx = 0;
        if (an) {
          const k = (t - an.t0) / (an.type === 'bow' ? 3 : 0.8);
          if (k > 1) delete this.monkAnim[i];
          else if (an.type === 'nod') bow = Math.sin(k * Math.PI * 2) ** 2 * 0.35;
          else if (an.type === 'sway') dx = Math.sin(k * Math.PI * 3) * 4;
          else if (an.type === 'bow') bow = Math.sin(k * Math.PI) ** 2;
        }
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.45;
        g.drawImage(this.sp.cushionGlow, m.x - 70 * m.scale, m.y - 30 * m.scale, 140 * m.scale, 60 * m.scale);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        drawCushion(g, m.x, m.y, m.scale, true, '', t, this.sp);
        drawChibi(g, m.x + dx, m.y - 4, m.scale, { monk: true, abbot: m.abbot, bow, breathe: t * 1.1 + i });
      });

      // Chùm sáng rọi xuống bồ đoàn có người
      if (this.beams) {
        g.globalCompositeOperation = 'lighter';
        this.chars.forEach((c) => {
          if (!c) return;
          const k = c.leaving ? 1 - (t - c.leaving) / 0.7 : Math.min(1, (t - c.born) / 0.6);
          g.globalAlpha = Math.max(0, k) * (0.75 + Math.sin(t * 1.3 + c.phase) * 0.2);
          g.drawImage(this.sp.beam, c.x - 80 * c.s, c.y - 600 * c.s + 10, 160 * c.s, 600 * c.s);
        });
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }

      // Bồ đoàn
      this.seats.forEach((p, i) => drawCushion(g, p.x, p.y, p.s, !!this.chars[i] && !this.chars[i].leaving, i + 1, t, this.sp));

      // Sen nở
      for (const b of this.blooms) {
        const k = b.age / b.life;
        g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
        drawLotus(g, b.x, b.y, 46 * b.s, ease(b.age / 0.8), b.cols);
      }
      g.globalAlpha = 1;

      // Người xem (vẽ theo thứ tự y để hàng sau không đè hàng trước)
      const order = this.chars.filter(Boolean).sort((a, b) => a.y - b.y);
      for (const c of order) {
        const ap = Math.min(1, (t - c.born) / 0.45);
        let s = c.s * (ap < 1 ? 0.4 + 0.6 * ease(ap) + Math.sin(ap * Math.PI) * 0.12 : 1);
        let alpha = ap;
        if (c.leaving) {
          const lk = (t - c.leaving) / 0.7;
          alpha = 1 - lk;
          s *= 1 - lk * 0.3;
        }
        let bow = 0;
        const bk = (t - c.bowStart) / c.bowDur;
        if (bk >= 0 && bk < 1) bow = Math.sin(bk * Math.PI * (c.bowTimes || 1)) ** 2;
        drawChibi(g, c.x, c.y - 4 * c.s, s, {
          gender: c.user.gender,
          bow,
          breathe: t * 1.3 + c.phase,
          alpha: Math.max(0, alpha),
          rose: c.rose > t,
          sprites: this.sp,
          avatarImg: this.avatarAsHead ? this.avatar(c.user.avatar) : null,
        });
      }

      this.drawParticles(this.front);

      // Sóng âm
      for (const r of this.rings) {
        const k = r.age / r.life;
        const rad = r.r0 + (r.r1 - r.r0) * ease(k);
        g.strokeStyle = `rgba(${r.color},${(1 - k) * 0.85})`;
        g.lineWidth = r.w * (1 - k * 0.6);
        g.beginPath();
        g.ellipse(r.x, r.y, rad, rad * r.sy, 0, 0, TAU);
        g.stroke();
      }

      // Nhãn tên sư + huy hiệu Top Chăm Chỉ
      this.L.monks.forEach((m) => {
        const tg = m.tag;
        g.drawImage(tg, m.x - tg.width / 2, m.y - 112 * m.scale - tg.height);
        if (m.abbot) {
          const bd = this.badge;
          let sc = 1;
          if (this.badgeFlash != null && t - this.badgeFlash < 1) sc = 1 + Math.sin((t - this.badgeFlash) * Math.PI) * 0.15;
          const w = bd.width * sc, h = bd.height * sc;
          g.drawImage(bd, m.x - w / 2, m.y + 20 - (h - bd.height) / 2, w, h);
        }
      });

      // Nhãn tên & bong bóng người xem
      for (const c of order) {
        const alpha = c.leaving ? Math.max(0, 1 - (t - c.leaving) / 0.5) : Math.min(1, (t - c.born) / 0.4);
        g.globalAlpha = alpha;
        const tg = c.tag;
        const ty = c.y - 90 * c.s - tg.height;
        g.drawImage(tg, c.x - tg.width / 2, ty);
        if (c.bubble) {
          const bk = (t - c.bubble.t0) / c.bubble.dur;
          const ba = Math.min(1, bk * 8) * Math.min(1, (1 - bk) * 6);
          const cv = c.bubble.cv;
          g.globalAlpha = alpha * ba;
          const bx2 = clamp(c.x - cv.width / 2, 4, W - cv.width - 4);
          g.drawImage(cv, bx2, ty - cv.height + 6 - (1 - Math.min(1, bk * 8)) * 10);
        }
        g.globalAlpha = 1;
      }

      // Lời cầu nguyện bay lên
      for (const p of this.prayers) {
        const k = (t - p.t0) / p.dur;
        const a = Math.min(1, k * 6) * Math.min(1, (1 - k) * 4);
        const y = p.y - ease(k) * 260;
        const x = clamp(p.x + Math.sin(t * 1.5 + p.ph) * 12 - p.cv.width / 2, 4, W - p.cv.width - 4);
        g.globalAlpha = a;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(this.sp.bigGlow, x - 30, y - 40, p.cv.width + 60, p.cv.height + 80);
        g.globalCompositeOperation = 'source-over';
        g.drawImage(p.cv, x, y);
      }
      g.globalAlpha = 1;

      // Chữ nổi
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const x of this.texts) {
        const k = x.age / x.life;
        const pop = x.pop ? 1 + Math.max(0, 0.4 - x.age * 2) : 1;
        g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        g.font = `900 ${Math.round(x.size * pop)}px ${x.font}`;
        g.lineWidth = 6;
        g.strokeStyle = x.stroke;
        g.lineJoin = 'round';
        const yy = x.y + x.vy * x.age;
        g.strokeText(x.text, x.x, yy);
        g.fillStyle = x.color;
        g.fillText(x.text, x.x, yy);
      }
      g.globalAlpha = 1;

      this.drawQuang(true);
    }
  }

  TD.Scene = Scene;
})();
