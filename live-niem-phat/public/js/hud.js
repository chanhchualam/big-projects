/**
 * HUD – các bảng thông tin dạng HTML phủ lên canvas
 *  - Thống kê, Top chăm chỉ, Nghi lễ, Thử thách, dòng sự kiện
 *  - Hàng đợi: toast "vào thiền", banner quà, hiệu ứng lớn giữa màn hình
 *  Mọi chữ do người xem gửi đều gán bằng textContent (chống chèn mã HTML).
 */
window.TD = window.TD || {};

(function () {
  const $ = (id) => document.getElementById(id);

  /** Tạo phần tử DOM an toàn */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(n) {
    return Number(n || 0).toLocaleString('vi-VN');
  }
  function avatarEl(cls, user) {
    if (user && user.avatar) {
      const img = el('img', cls);
      img.referrerPolicy = 'no-referrer';
      img.src = user.avatar;
      img.onerror = () => img.replaceWith(avatarEl(cls, { name: user.name }));
      return img;
    }
    const d = el('div', cls, ((user && user.name) || '?').trim().charAt(0).toUpperCase());
    d.style.display = 'grid';
    d.style.placeItems = 'center';
    d.style.fontWeight = '800';
    return d;
  }

  /** Icon quà: ảnh quà TikTok nếu có, không thì emoji */
  function giftIcon(cls, image, emoji) {
    const box = el('span', cls);
    if (image) {
      const img = el('img');
      img.referrerPolicy = 'no-referrer';
      img.src = image;
      img.onerror = () => img.replaceWith(document.createTextNode(emoji || '🎁'));
      box.append(img);
    } else box.textContent = emoji || '🎁';
    return box;
  }

  /** Hàng đợi tuần tự: mỗi mục chạy xong mới tới mục sau; dồn nhiều thì chạy nhanh hơn */
  class SeqQueue {
    constructor(maxLen = 30) {
      this.q = [];
      this.busy = false;
      this.maxLen = maxLen;
    }
    push(item) {
      if (this.q.length >= this.maxLen) this.q.shift(); // bỏ mục cũ nhất nếu quá tải
      this.q.push(item);
      if (!this.busy) this.next();
    }
    next() {
      const item = this.q.shift();
      if (!item) {
        this.busy = false;
        return;
      }
      this.busy = true;
      const speed = this.q.length > 4 ? 0.45 : this.q.length > 1 ? 0.75 : 1;
      const dur = Math.max(700, item.dur * speed);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.next();
      };
      try {
        item.run(dur, finish);
      } catch (e) {
        console.error(e);
        finish();
      }
      setTimeout(finish, dur + 900); // chốt an toàn
    }
    clear() {
      this.q = [];
    }
  }

  class HUD {
    constructor() {
      this.toastQ = new SeqQueue(12);
      this.bannerQ = new SeqQueue(25);
      this.centerQ = new SeqQueue(20);
      this.topRows = new Map();
      this.lastTop = [];
      this.last = {};
      this.sessionStart = Date.now();
      setInterval(() => this.clock(), 1000);
    }

    setConfig(cfg) {
      const ul = $('ritual-list');
      ul.textContent = '';
      (cfg.rituals || []).forEach((r) => {
        const li = el('li');
        li.dataset.id = r.id;
        const coin = el('span', 'r-coin');
        coin.append(el('i', 'coin'), document.createTextNode(String(r.coins)));
        li.append(giftIcon('r-ico', r.image, r.icon), el('span', 'r-name', r.name), coin);
        ul.append(li);
      });
    }

    clock() {
      const s = Math.max(0, Math.floor((Date.now() - this.sessionStart) / 1000));
      const p = (n) => String(n).padStart(2, '0');
      $('st-time').textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
    }

    setNum(id, val, bump = true) {
      const e = $(id);
      const txt = typeof val === 'number' ? fmt(val) : val;
      if (e.textContent === txt) return;
      e.textContent = txt;
      if (bump) {
        e.classList.remove('bump');
        void e.offsetWidth;
        e.classList.add('bump');
      }
    }

    setState(st) {
      this.sessionStart = st.sessionStart || this.sessionStart;
      this.setNum('st-seats', `${st.seated}/${st.total}`);
      this.setNum('st-merit', st.merit);
      this.setNum('st-viewers', st.viewers, false);
      this.setNum('st-queue', st.queue, false);
      $('st-queue-row').classList.toggle('hidden', !st.queue);
      this.clock();

      // Thử thách
      const ch = st.challenge || {};
      $('ch-title').textContent = ch.title || '';
      $('ch-num').textContent = `${fmt(ch.progress)}/${fmt(ch.goal)}`;
      $('ch-fill').style.width = `${Math.min(100, (ch.progress / Math.max(1, ch.goal)) * 100)}%`;

      this.setTop(st.top || []);
    }

    /** Bảng TOP: hàng di chuyển mượt khi đổi hạng */
    setTop(top) {
      const box = $('top-list');
      const rowH = 70;
      const ids = new Set(top.map((t) => t.id));
      let empty = box.querySelector('.top-empty');
      if (!top.length) {
        if (!empty) box.append(el('div', 'top-empty', 'Hãy là người chăm chỉ đầu tiên 🙏'));
      } else if (empty) empty.remove();

      for (const [id, row] of this.topRows) {
        if (!ids.has(id)) {
          row.style.opacity = '0';
          setTimeout(() => row.remove(), 400);
          this.topRows.delete(id);
        }
      }
      top.forEach((t) => {
        let row = this.topRows.get(t.id);
        const prevRank = row ? Number(row.dataset.rank) : 99;
        if (!row) {
          row = el('div', 'top-row');
          row.append(el('div', 'rank'), avatarEl('av', t), el('div', 'nm'), el('div', 'pt'));
          row.style.transform = `translateY(${3 * rowH}px)`;
          row.style.opacity = '0';
          box.append(row);
          this.topRows.set(t.id, row);
          void row.offsetWidth;
        }
        row.dataset.rank = t.rank;
        row.querySelector('.rank').textContent = t.rank;
        row.querySelector('.nm').textContent = t.name;
        row.querySelector('.pt').textContent = fmt(t.points);
        row.style.transform = `translateY(${(t.rank - 1) * rowH}px)`;
        row.style.opacity = '1';
        if (t.rank < prevRank) {
          row.classList.remove('flash');
          void row.offsetWidth;
          row.classList.add('flash');
        }
      });
    }

    highlightRitual(id) {
      const li = document.querySelector(`#ritual-list li[data-id="${CSS.escape(id)}"]`);
      if (!li) return;
      li.classList.remove('active');
      void li.offsetWidth;
      li.classList.add('active');
      clearTimeout(li._t);
      li._t = setTimeout(() => li.classList.remove('active'), 3200);
    }

    challengeDone() {
      const p = $('challenge-panel');
      p.classList.remove('done');
      void p.offsetWidth;
      p.classList.add('done');
    }

    // ---------- Dòng sự kiện ----------
    tick(parts) {
      const box = $('ticker');
      const d = el('div', 'tick');
      parts.forEach((p) => d.append(typeof p === 'string' ? document.createTextNode(p) : el('b', null, p.b)));
      box.append(d);
      while (box.children.length > 2) box.firstChild.remove();
      setTimeout(() => (d.style.opacity = '0'), 6000);
      setTimeout(() => d.remove(), 6700);
    }

    // ---------- Toast "đã vào thiền" ----------
    toast(user, text) {
      this.toastQ.push({
        dur: 1700,
        run: (dur, done) => {
          const t = el('div', 'toast');
          t.append(avatarEl('av', user), el('span', 'nm', user.name), document.createTextNode(' ' + text + ' 🪷'));
          $('toast-area').append(t);
          setTimeout(() => t.classList.add('out'), dur - 400);
          setTimeout(() => { t.remove(); done(); }, dur);
        },
      });
    }

    // ---------- Banner quà (hiệu ứng vừa) ----------
    banner(icon, name, text, count, dur = 2500, onStart, image) {
      this.bannerQ.push({
        dur,
        run: (d, done) => {
          if (onStart) onStart(d);
          const b = el('div', 'banner');
          b.append(giftIcon('ico', image, icon), el('span', 'nm', name), document.createTextNode(' ' + text));
          if (count > 1) b.append(el('span', 'cnt', 'x' + count));
          $('banner-area').append(b);
          setTimeout(() => b.classList.add('out'), d - 400);
          setTimeout(() => { b.remove(); done(); }, d);
        },
      });
    }

    // ---------- Hiệu ứng lớn giữa màn hình (chạy lần lượt) ----------
    center(build, dur, onStart) {
      this.centerQ.push({
        dur,
        run: (d, done) => {
          if (onStart) onStart(d);
          const node = build();
          node.classList.add('cfx');
          $('center-fx').append(node);
          setTimeout(() => node.classList.add('out'), d - 600);
          setTimeout(() => { node.remove(); done(); }, d);
        },
      });
    }

    flash(ms = 1200) {
      const f = $('flash');
      f.classList.add('on');
      setTimeout(() => f.classList.remove('on'), ms);
    }

    reset() {
      this.toastQ.clear();
      this.bannerQ.clear();
      this.centerQ.clear();
    }
  }

  TD.el = el;
  TD.giftIcon = giftIcon;
  TD.HUD = HUD;
})();
