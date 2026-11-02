/**
 * ============================================================
 *  THIỀN ĐƯỜNG LIVE OVERLAY - Backend
 *  Node.js + Express + Socket.IO + tiktok-live-connector (v2)
 *
 *  - Phục vụ 2 trang: "/" (bảng điều khiển) và "/overlay" (nguồn OBS)
 *  - Kết nối TikTok Live theo username, chuẩn hóa sự kiện
 *  - Quản lý chỗ ngồi (bồ đoàn), hàng chờ, điểm "chăm chỉ", thử thách
 *  - Chế độ GIẢ LẬP để test khi chưa live
 *  - Lưu trạng thái ra data/state.json
 * ============================================================
 */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

// Thư viện TikTok có thể chưa cài -> vẫn cho chạy giả lập
let TikTok = null;
try {
  TikTok = require('tiktok-live-connector');
} catch (e) {
  console.warn('[!] Chưa cài tiktok-live-connector. Chạy "npm install". Chế độ giả lập vẫn dùng được.');
}

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
let io = null; // Socket.IO server (khởi tạo ở mục 10)

// ------------------------------------------------------------
// 1. CẤU HÌNH
// ------------------------------------------------------------
function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}
let config = loadConfig();

/** Cấu hình gửi cho trình duyệt (ẩn khóa bí mật) */
function publicConfig() {
  const c = JSON.parse(JSON.stringify(config));
  if (c.tiktok) delete c.tiktok.signApiKey;
  c.seats = seatCount();
  // Gắn ảnh icon quà cho từng nghi lễ + danh sách quà TikTok đã biết
  c.rituals = (c.rituals || []).map((r) => Object.assign(r, { image: ritualImage(r), tiktokGift: tiktokGiftLabel(r) }));
  c.giftCatalog = Object.values(giftCatalog).sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));
  // Ảnh / âm thanh đã tải lên (có ?v= để overlay tự lấy bản mới)
  c.assets = assetsInfo();
  c.scene = c.scene || {};
  const bg = String(c.scene.background || 'assets/background.jpg');
  if (/^assets\/background\.[a-z]+$/i.test(bg)) c.scene.background = c.assets.background.url || bg;
  c.audio = c.audio || {};
  const bgm = String(c.audio.bgmFile || '');
  if (!bgm || /^assets\/bgm\.[a-z0-9]+$/i.test(bgm)) c.audio.bgmFile = c.assets.bgm.url || '';
  c.audio.sfx = { mo: c.assets.mo.url, bell: c.assets.bell.url, chime: c.assets.chime.url };
  return c;
}

// ------------------------------------------------------------
// 1b. DANH MỤC QUÀ TIKTOK (tên, giá xu, ảnh icon)
//  - Tự tải khi kết nối vào phòng live, tự học thêm khi có người tặng
//  - Lưu ở data/gifts.json để lần sau không live vẫn có ảnh
// ------------------------------------------------------------
const GIFTS_PATH = path.join(DATA_DIR, 'gifts.json');
let giftCatalog = {};
try {
  if (fs.existsSync(GIFTS_PATH)) giftCatalog = JSON.parse(fs.readFileSync(GIFTS_PATH, 'utf8')) || {};
} catch (_) {
  giftCatalog = {};
}

function giftImg(g) {
  if (!g) return null;
  const im = g.image || g.icon || {};
  return (im.url_list || im.urlList || im.url || [])[0] || null;
}

/** Ghi nhận 1 quà; trả về true nếu có thay đổi */
function learnGift(name, coins, image) {
  if (!name) return false;
  const k = String(name).toLowerCase().trim();
  const cur = giftCatalog[k];
  const img = typeof image === 'string' && /^https:\/\//i.test(image) ? image : null;
  const next = { name: String(name), coins: Number(coins) || (cur && cur.coins) || 0, image: img || (cur && cur.image) || null };
  if (cur && cur.coins === next.coins && cur.image === next.image) return false;
  giftCatalog[k] = next;
  return true;
}

let giftSaveTimer = null;
function giftsChanged() {
  clearTimeout(giftSaveTimer);
  giftSaveTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(GIFTS_PATH, JSON.stringify(giftCatalog));
    } catch (e) {
      console.error('Lỗi lưu gifts.json:', e.message);
    }
    if (io) io.emit('config', publicConfig());
  }, 1500);
}

/** Ảnh cho nghi lễ: "image" trong config > file public/assets/gifts/<id>.png > ảnh quà TikTok đã tải */
function ritualImage(r) {
  if (r.image) return r.image;
  const own = findAsset(`gifts/${r.id}`, IMG_EXT);
  if (own) return own;
  for (const n of r.giftNames || []) {
    const g = giftCatalog[String(n).toLowerCase().trim()];
    if (g && g.image) return g.image;
  }
  return null;
}
// ------------------------------------------------------------
// 1c. ẢNH & ÂM THANH DO NGƯỜI DÙNG TẢI LÊN (bảng điều khiển → mục "Hình ảnh & âm thanh")
//  - Lưu trong public/assets/, tên file cố định theo "ô" (slot), đuôi theo loại file thật
//  - URL trả về có ?v=<thời gian sửa> để trình duyệt/OBS không dùng bản cũ trong cache
// ------------------------------------------------------------
const ASSETS_DIR = path.join(ROOT, 'public', 'assets');
const IMG_EXT = ['png', 'jpg', 'webp', 'gif'];
const AUD_EXT = ['mp3', 'm4a', 'ogg', 'wav'];
const UPLOAD_MAX = { image: 10 * 1024 * 1024, audio: 25 * 1024 * 1024 };
const UPLOAD_SLOTS = {
  background: { file: 'background', kind: 'image', label: 'Ảnh nền chánh điện' },
  bgm: { file: 'bgm', kind: 'audio', label: 'Nhạc nền' },
  mo: { file: 'sounds/mo', kind: 'audio', label: 'Tiếng mõ' },
  bell: { file: 'sounds/bell', kind: 'audio', label: 'Tiếng chuông' },
  chime: { file: 'sounds/chime', kind: 'audio', label: 'Tiếng vào thiền / quà nhỏ' },
};
/** Ô tải lên hợp lệ: các ô cố định ở trên, hoặc "gift-<id nghi lễ>" (chống ghi file tuỳ ý) */
function uploadSlot(name) {
  if (Object.prototype.hasOwnProperty.call(UPLOAD_SLOTS, name)) return UPLOAD_SLOTS[name];
  const m = /^gift-([a-z0-9_-]{1,40})$/i.exec(name || '');
  const r = m && (config.rituals || []).find((x) => x.id === m[1]);
  return r ? { file: `gifts/${r.id}`, kind: 'image', label: 'Ảnh quà ' + r.name } : null;
}
const extsOf = (kind) => (kind === 'image' ? IMG_EXT : AUD_EXT);
/** Tìm file đã có của một ô, trả về URL kèm ?v= hoặc null */
function findAsset(base, exts) {
  for (const ext of exts) {
    try {
      const st = fs.statSync(path.join(ASSETS_DIR, `${base}.${ext}`));
      return `assets/${base}.${ext}?v=${Math.floor(st.mtimeMs)}`;
    } catch (_) {}
  }
  return null;
}
/** Nhận diện loại file bằng các byte đầu (không tin đuôi file hay Content-Type) */
function sniffType(buf) {
  if (!buf || buf.length < 12) return null;
  const s = (a, b) => buf.subarray(a, b).toString('latin1');
  if (buf[0] === 0x89 && s(1, 4) === 'PNG') return { kind: 'image', ext: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: 'image', ext: 'jpg' };
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return { kind: 'image', ext: 'webp' };
  if (s(0, 4) === 'GIF8') return { kind: 'image', ext: 'gif' };
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WAVE') return { kind: 'audio', ext: 'wav' };
  if (s(0, 4) === 'OggS') return { kind: 'audio', ext: 'ogg' };
  if (s(4, 8) === 'ftyp') return { kind: 'audio', ext: 'm4a' };
  if (s(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { kind: 'audio', ext: 'mp3' };
  return null;
}
function removeAsset(base, exts) {
  for (const ext of exts) {
    try {
      fs.unlinkSync(path.join(ASSETS_DIR, `${base}.${ext}`));
    } catch (_) {}
  }
}
/** Lưu file tải lên: ghi file tạm rồi đổi tên (không bao giờ để file dở dang) */
function saveUpload(slotName, buf) {
  const slot = uploadSlot(slotName);
  if (!slot) throw new Error('Ô tải lên không hợp lệ');
  const t = sniffType(buf);
  if (!t) throw new Error('Không nhận ra định dạng file. Ảnh: PNG/JPG/WEBP/GIF; âm thanh: MP3/M4A/OGG/WAV');
  if (t.kind !== slot.kind) throw new Error(slot.kind === 'image' ? 'Ô này cần file ẢNH' : 'Ô này cần file ÂM THANH');
  if (buf.length > UPLOAD_MAX[t.kind]) throw new Error(`File quá lớn (tối đa ${UPLOAD_MAX[t.kind] / 1048576} MB)`);
  const dest = path.join(ASSETS_DIR, `${slot.file}.${t.ext}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.uploading';
  fs.writeFileSync(tmp, buf);
  removeAsset(slot.file, extsOf(slot.kind)); // xoá bản cũ (có thể khác đuôi)
  fs.renameSync(tmp, dest);
  return slot;
}
/** Thông tin các ô để bảng điều khiển hiển thị */
function assetsInfo() {
  const out = {};
  for (const [k, s] of Object.entries(UPLOAD_SLOTS)) out[k] = { label: s.label, kind: s.kind, url: findAsset(s.file, extsOf(s.kind)) };
  return out;
}
function assetsChanged(msg) {
  log(msg);
  if (io) io.emit('config', publicConfig());
}

function tiktokGiftLabel(r) {
  const n = (r.giftNames || [])[0];
  return n ? (giftCatalog[String(n).toLowerCase().trim()] || {}).name || n : '';
}
function seatCount() {
  return Math.max(1, Math.min(60, Number(config.seats) || 24));
}

// ------------------------------------------------------------
// 2. LOG HỆ THỐNG (in ra console + gửi về bảng điều khiển)
// ------------------------------------------------------------
const logBuffer = [];
function log(msg, level = 'info') {
  const entry = { t: Date.now(), level, msg };
  logBuffer.push(entry);
  if (logBuffer.length > 300) logBuffer.shift();
  const tag = level === 'error' ? '✖' : level === 'warn' ? '!' : '•';
  console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ${tag} ${msg}`);
  if (io) io.to('panel').emit('log', entry);
}

// ------------------------------------------------------------
// 3. TRẠNG THÁI PHIÊN + LƯU FILE
// ------------------------------------------------------------
function freshState() {
  return {
    users: {},                          // id -> hồ sơ người xem
    seats: Array(seatCount()).fill(null), // index -> userId
    queue: [],                          // danh sách userId đang chờ
    merit: 0,                           // tổng công đức (tổng điểm cả phòng)
    likesTotal: 0,
    viewers: 0,
    sessionStart: Date.now(),
    challenge: { round: 1, progress: 0, goal: Number(config.challenge?.goal) || 150 },
    muted: false,
  };
}

let state = freshState();

function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return;
    const saved = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    state = Object.assign(freshState(), saved);
    // Đồng bộ số ghế nếu config đổi
    resizeSeats();
    // Dọn ghế trỏ tới người không tồn tại
    state.seats = state.seats.map((id) => (id && state.users[id] ? id : null));
    state.queue = state.queue.filter((id) => state.users[id] && state.users[id].seat == null);
    for (const u of Object.values(state.users)) {
      if (u.seat != null && state.seats[u.seat] !== u.id) u.seat = null;
    }
    log(`Đã nạp dữ liệu: ${Object.keys(state.users).length} người xem, công đức ${state.merit}`);
  } catch (e) {
    log('Không đọc được data/state.json, tạo phiên mới: ' + e.message, 'warn');
    state = freshState();
  }
}

let saveTimer = null;
function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 2000);
}
function saveNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    pruneUsers();
    const tmp = STATE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STATE_PATH); // ghi nguyên tử, tránh hỏng file khi tắt đột ngột
  } catch (e) {
    console.error('Lỗi lưu state:', e.message);
  }
}
/** Giới hạn số hồ sơ lưu để file không phình quá to */
function pruneUsers() {
  const ids = Object.keys(state.users);
  if (ids.length <= 5000) return;
  const removable = ids
    .map((id) => state.users[id])
    .filter((u) => u.seat == null && !state.queue.includes(u.id))
    .sort((a, b) => a.points - b.points || a.lastActive - b.lastActive);
  for (const u of removable.slice(0, ids.length - 5000)) delete state.users[u.id];
}

function resizeSeats() {
  const n = seatCount();
  if (state.seats.length === n) return;
  if (state.seats.length > n) {
    for (let i = n; i < state.seats.length; i++) {
      const id = state.seats[i];
      if (id && state.users[id]) state.users[id].seat = null;
    }
    state.seats = state.seats.slice(0, n);
  } else {
    state.seats = state.seats.concat(Array(n - state.seats.length).fill(null));
  }
}

// ------------------------------------------------------------
// 4. NGƯỜI XEM, CHỖ NGỒI, HÀNG CHỜ
// ------------------------------------------------------------
const cooldowns = new Map(); // "userId:action" -> thời điểm

function safeAvatar(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url) ? url : null;
}

/** Tạo/cập nhật hồ sơ người xem từ dữ liệu đã chuẩn hóa {id,name,avatar} */
function upsertUser(p) {
  const id = String(p.id || p.name || 'anon').slice(0, 64);
  let u = state.users[id];
  if (!u) {
    u = state.users[id] = {
      id,
      name: '',
      avatar: null,
      points: 0,
      gender: Math.random() < 0.5 ? 'nam' : 'nu',
      phapDanh: null,
      seat: null,
      lastActive: Date.now(),
    };
  }
  if (p.name) u.name = String(p.name).slice(0, 40);
  if (!u.name) u.name = id;
  const av = safeAvatar(p.avatar);
  if (av) u.avatar = av;
  u.lastActive = Date.now();
  return u;
}

function userPublic(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, avatar: u.avatar, gender: u.gender, points: u.points, seat: u.seat, phapDanh: u.phapDanh };
}

/** Thứ tự ưu tiên chọn ghế: hàng trước, sát lối đi giữa, xen kẽ hai bên */
function seatOrder() {
  const n = seatCount();
  const grid = config.scene?.seatGrid || {};
  const perSide = (grid.leftX || [0, 0, 0]).length;
  const rows = grid.rows || 4;
  if (config.scene?.seatPositions || perSide * 2 * rows !== n) {
    return [...Array(n).keys()];
  }
  // Ghế 0..(perSide*rows-1) là dãy trái (theo hàng), phần sau là dãy phải
  const order = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < perSide; k++) {
      const leftIdx = r * perSide + (perSide - 1 - k); // cột sát lối đi trước
      const rightIdx = perSide * rows + r * perSide + k;
      order.push(leftIdx, rightIdx);
    }
  }
  return order;
}

/** Cho người xem ngồi; trả về số ghế hoặc -1 nếu phải xếp hàng */
function seatUser(u) {
  if (u.seat != null && state.seats[u.seat] === u.id) return u.seat;
  const free = seatOrder().filter((i) => !state.seats[i]);
  if (free.length === 0) {
    if (!state.queue.includes(u.id) && state.queue.length < (config.queueMax || 200)) {
      state.queue.push(u.id);
      emitEvt('queue', u, { position: state.queue.length });
    }
    return -1;
  }
  // Chọn ngẫu nhiên trong 4 ghế ưu tiên đầu để cảnh tự nhiên hơn
  const pick = free[Math.floor(Math.random() * Math.min(4, free.length))];
  state.seats[pick] = u.id;
  u.seat = pick;
  u.lastActive = Date.now();
  state.queue = state.queue.filter((id) => id !== u.id);
  addPoints(u, config.points?.join || 0);
  emitEvt('join', u);
  return pick;
}

function releaseSeat(idx, reason = 'idle') {
  const id = state.seats[idx];
  if (!id) return;
  const u = state.users[id];
  state.seats[idx] = null;
  if (u) {
    u.seat = null;
    emitEvt('leave', u, { seat: idx, reason });
  }
  fillFromQueue();
}

function fillFromQueue() {
  while (state.queue.length && state.seats.some((s) => !s)) {
    const id = state.queue.shift();
    const u = state.users[id];
    if (u && u.seat == null) seatUser(u);
  }
  scheduleState();
}

/** Kiểm tra người không tương tác -> tự rời chỗ (chạy mỗi giây để mốc thời gian ngắn như 15s vẫn chính xác) */
setInterval(() => {
  const now = Date.now();
  const idleSec = Number(config.idleTimeoutSec) || 600;
  const queueIdleSec = Number(config.idleTimeoutWhenQueueSec) || idleSec;
  // Có người đang chờ thì dùng mốc ngắn hơn trong hai mốc
  const limit = (state.queue.length > 0 ? Math.min(idleSec, queueIdleSec) : idleSec) * 1000;
  state.seats.forEach((id, idx) => {
    if (!id) return;
    const u = state.users[id];
    if (!u || now - u.lastActive > limit) releaseSeat(idx, 'idle');
  });
  // Người chờ quá lâu không tương tác thì rời hàng
  const qLimit = (Number(config.queueTimeoutSec) || 300) * 1000;
  const before = state.queue.length;
  state.queue = state.queue.filter((id) => state.users[id] && now - state.users[id].lastActive < qLimit);
  if (before !== state.queue.length) scheduleState();
}, 1000);

// ------------------------------------------------------------
// 5. ĐIỂM, CÔNG ĐỨC, THỬ THÁCH
// ------------------------------------------------------------
function addPoints(u, n) {
  n = Math.round(Number(n) || 0);
  if (!u || n <= 0) return 0;
  u.points += n;
  state.merit += n;
  addChallenge('merit', n);
  scheduleState();
  saveSoon();
  return n;
}

function challengeGoalFor(round) {
  const base = Number(config.challenge?.goal) || 150;
  const step = Number(config.challenge?.goalStep) || 0;
  return base + step * (round - 1);
}

function addChallenge(type, n) {
  if ((config.challenge?.type || 'likes') !== type || n <= 0) return;
  const ch = state.challenge;
  ch.progress += n;
  if (ch.progress >= ch.goal) {
    io.emit('evt', {
      kind: 'challenge_done',
      round: ch.round,
      goal: ch.goal,
      title: config.challenge?.doneTitle || 'VIÊN MÃN!',
      text: config.challenge?.doneText || '',
      t: Date.now(),
    });
    log(`🎉 Hoàn thành thử thách vòng ${ch.round} (${ch.goal})`);
    ch.round += 1;
    ch.progress = 0;
    ch.goal = challengeGoalFor(ch.round);
  }
  scheduleState();
}

function challengeTitle() {
  const t = config.challenge?.title || 'Cả điện thả {goal} tim';
  return t.replace('{goal}', state.challenge.goal);
}

function topUsers(n = 3) {
  return Object.values(state.users)
    .filter((u) => u.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, n)
    .map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, avatar: u.avatar, points: u.points }));
}

// ------------------------------------------------------------
// 6. PHÁT SỰ KIỆN & TRẠNG THÁI TỚI CLIENT
// ------------------------------------------------------------
function emitEvt(kind, u, extra = {}) {
  const ev = Object.assign({ kind, user: userPublic(u), t: Date.now() }, extra);
  io.emit('evt', ev);
  return ev;
}

function snapshot() {
  return {
    seats: state.seats.map((id) => (id ? userPublic(state.users[id]) : null)),
    total: state.seats.length,
    seated: state.seats.filter(Boolean).length,
    queue: state.queue.length,
    merit: state.merit,
    viewers: state.viewers,
    likesTotal: state.likesTotal,
    sessionStart: state.sessionStart,
    top: topUsers(3),
    challenge: {
      title: challengeTitle(),
      type: config.challenge?.type || 'likes',
      goal: state.challenge.goal,
      progress: state.challenge.progress,
      round: state.challenge.round,
    },
  };
}

let stateTimer = null;
function scheduleState() {
  if (stateTimer) return;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    io.emit('state', snapshot());
  }, 200); // gom nhiều thay đổi trong 200ms thành 1 lần gửi
}

// ------------------------------------------------------------
// 7. XỬ LÝ TƯƠNG TÁC (dùng chung cho TikTok thật, giả lập, nút test)
// ------------------------------------------------------------
function onCooldown(u, action, ms) {
  const key = u.id + ':' + action;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < ms) return true;
  cooldowns.set(key, now);
  if (cooldowns.size > 20000) cooldowns.clear();
  return false;
}

/** Bỏ dấu tiếng Việt: "Nam Mô A Di Đà Phật" -> "nam mo a di da phat" */
function stripVN(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}
/** Có phải câu niệm Phật không (có dấu / không dấu / viết liền / kèm emoji đều được) */
function isNiemPhat(text) {
  const k = stripVN(text).replace(/[^a-z]/g, '');
  return /adidaphat|adidaphac|adidaphap/.test(k) || /^nammo(adida|quanthe|bonsu)/.test(k);
}

/** Phân tích bình luận thành lệnh */
function parseCommand(text) {
  const raw = String(text || '').normalize('NFC').trim();
  const l = raw.toLowerCase().replace(/[.!?,]+$/, '').trim();
  if (l === '1') return { cmd: 'incense' };
  if (l === '2') return { cmd: 'bow' };
  if (l === '3') return { cmd: 'mo' };
  if (l === '4') return { cmd: 'bell' };
  if (l === 'nam') return { cmd: 'gender', gender: 'nam' };
  if (l === 'nữ' || l === 'nu' || l === 'nư') return { cmd: 'gender', gender: 'nu' };
  if (/^(xin\s+|rút\s+|rut\s+)?(xăm|xam|xâm|quẻ|que)$/.test(l)) return { cmd: 'xam' };
  if (isNiemPhat(l)) {
    const k = stripVN(l).replace(/[^a-z]/g, '');
    const phrase = /quanthe/.test(k) ? 'Nam Mô Quán Thế Âm Bồ Tát' : /bonsu/.test(k) ? 'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật' : 'Nam Mô A Di Đà Phật';
    return { cmd: 'niem', phrase };
  }
  const m = raw.match(/^(cầu|cau|cầu nguyện|cau nguyen)\s+(.+)$/i);
  if (m) return { cmd: 'pray', text: m[2].trim().slice(0, 80) };
  return { cmd: 'chat', text: raw.slice(0, 80) };
}

function pick(arr) {
  return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

/** Đếm số người khác nhau cùng niệm Phật trong một khoảng thời gian ngắn */
const niem = { hits: new Map(), level: 0 };
function niemCombo(u) {
  const cfg = config.niemCombo || {};
  const windowMs = (cfg.windowSec || 15) * 1000;
  const steps = cfg.thresholds || [3, 6, 10, 20, 40];
  const now = Date.now();
  niem.hits.set(u.id, now);
  for (const [id, t] of niem.hits) if (now - t > windowMs) niem.hits.delete(id);
  const n = niem.hits.size;
  if (n < steps[0]) {
    niem.level = 0; // nhóm cũ đã tan, lần sau bắt đầu lại từ mốc đầu
    return;
  }
  // Mốc cao nhất đã đạt; chỉ bùng nổ khi lên mốc mới (mỗi nhóm tối đa = số mốc, nên không bị spam)
  const level = steps.filter((x) => n >= x).length;
  if (level <= niem.level) return;
  niem.level = level;
  emitEvt('niem_combo', u, { count: n, level, max: steps.length });
  log(`🙏 ${n} người đồng tâm niệm Phật`);
}

/** Điểm vào chung: mọi tương tác của người xem */
function handleInteraction(type, profile, data = {}) {
  const u = upsertUser(profile);
  const P = config.points || {};
  const cd = config.commandCooldownMs || 1200;

  // Ai tương tác mà chưa có chỗ -> cho vào thiền (hoặc xếp hàng)
  if (u.seat == null && type !== 'leave') seatUser(u);

  switch (type) {
    case 'join':
      break;

    case 'chat': {
      const c = parseCommand(data.text);
      if (c.cmd === 'chat') {
        if (!c.text) break;
        const pts = onCooldown(u, 'chatpts', 3000) ? 0 : addPoints(u, P.chat);
        emitEvt('chat', u, { text: c.text, points: pts });
      } else if (c.cmd === 'gender') {
        u.gender = c.gender;
        emitEvt('gender', u, { gender: c.gender });
        scheduleState();
      } else if (c.cmd === 'xam') {
        if (onCooldown(u, 'xam', config.xamCooldownMs || 20000)) break;
        const que = pick(config.xam) || { hang: 'Thượng', tho: 'Tâm an vạn sự an', loi: '' };
        const idx = (config.xam || []).indexOf(que);
        emitEvt('xam', u, { que, soQue: idx + 1, points: addPoints(u, P.xam) });
      } else if (c.cmd === 'niem') {
        // Niệm Phật: hiệu ứng hào quang cho người niệm; nhiều người cùng niệm -> bùng nổ cả điện
        if (onCooldown(u, 'niem', config.niemCooldownMs || 4000)) break;
        emitEvt('niem', u, { phrase: c.phrase, points: addPoints(u, P.niem ?? 3) });
        niemCombo(u);
      } else if (c.cmd === 'pray') {
        if (onCooldown(u, 'pray', config.prayCooldownMs || 5000)) break;
        emitEvt('pray', u, { text: c.text, points: addPoints(u, P.pray) });
      } else {
        // incense | bow | mo | bell
        if (onCooldown(u, c.cmd, cd)) break;
        const pts = addPoints(u, P[c.cmd]);
        if (c.cmd === 'bow') addChallenge('bows', 1);
        if (c.cmd === 'incense') addChallenge('incense', 1);
        emitEvt(c.cmd, u, { points: pts });
      }
      break;
    }

    case 'like': {
      const count = Math.max(1, Math.min(Number(data.count) || 1, 100));
      state.likesTotal += count;
      const pts = addPoints(u, Math.min(count, P.likeMaxPerEvent || 15) * (P.like || 1));
      addChallenge('likes', count);
      emitEvt('like', u, { count, points: pts });
      break;
    }

    case 'follow':
      if (onCooldown(u, 'follow', 60000)) break;
      emitEvt('follow', u, { points: addPoints(u, P.follow) });
      break;

    case 'share':
      if (onCooldown(u, 'share', 10000)) break;
      emitEvt('share', u, { points: addPoints(u, P.share) });
      break;

    case 'gift':
      handleGift(u, data);
      break;

    case 'leave':
      if (u.seat != null) releaseSeat(u.seat, 'leave');
      else state.queue = state.queue.filter((id) => id !== u.id);
      break;
  }
  scheduleState();
}

/** Tìm nghi lễ tương ứng với quà */
function matchRitual(giftName, coins) {
  const rituals = config.rituals || [];
  const name = String(giftName || '').toLowerCase().trim();
  if (name) {
    const byName = rituals.find((r) =>
      (r.giftNames || []).some((g) => String(g).toLowerCase().trim() === name) ||
      String(r.name).toLowerCase() === name
    );
    if (byName) return byName;
  }
  if (config.matchByCoins !== false && coins > 0) {
    const sorted = rituals.filter((r) => r.coins <= coins).sort((a, b) => b.coins - a.coins);
    if (sorted.length) return sorted[0];
  }
  return null;
}

function makePhapDanh(u, override) {
  if (override) return String(override).slice(0, 30);
  const ov = config.phapDanh?.overrides || {};
  if (ov[u.id]) return ov[u.id];
  const a = pick(config.phapDanh?.first) || 'Tâm';
  let b = pick(config.phapDanh?.second) || 'An';
  if (b === a) b = pick(config.phapDanh?.second) || 'An';
  return `${a} ${b}`;
}

function handleGift(u, data) {
  const count = Math.max(1, Number(data.count) || 1);
  const coins = Math.max(0, Number(data.coins) || 0);
  const ritual = data.ritualId
    ? (config.rituals || []).find((r) => r.id === data.ritualId)
    : matchRitual(data.giftName, coins);

  const totalCoins = (ritual && !coins ? ritual.coins : coins) * count;
  const pts = addPoints(u, totalCoins * (config.points?.perCoin || 1));
  addChallenge('coins', totalCoins);

  if (!ritual) {
    const known = giftCatalog[String(data.giftName || '').toLowerCase().trim()];
    emitEvt('gift', u, { giftName: data.giftName || 'quà', image: (known && known.image) || null, count, coins: totalCoins, points: pts });
    log(`🎁 ${u.name} tặng ${data.giftName} x${count} (không khớp nghi lễ)`);
    return;
  }

  const extra = {};
  if (ritual.effect === 'xin_chu') extra.chu = pick(config.xinChu) || { chu: 'Tâm', nghia: '' };
  if (ritual.effect === 'phap_danh') {
    // Nếu streamer nhập pháp danh ở bảng điều khiển thì dùng, nếu không giữ pháp danh cũ hoặc tạo mới
    u.phapDanh = data.phapDanh ? makePhapDanh(u, data.phapDanh) : u.phapDanh || makePhapDanh(u);
    extra.phapDanh = u.phapDanh;
  }
  if (ritual.effect === 'bow_roses') addChallenge('bows', count);

  emitEvt('ritual', u, {
    ritual: {
      id: ritual.id,
      name: ritual.name,
      icon: ritual.icon,
      coins: ritual.coins,
      effect: ritual.effect,
      level: ritual.level || 'medium',
      duration: ritual.duration || 4000,
      image: ritualImage(ritual),
    },
    giftName: data.giftName || ritual.name,
    count,
    points: pts,
    ...extra,
  });
  log(`🎁 ${u.name} → ${ritual.icon} ${ritual.name} x${count} (+${pts} điểm)`);
}

// ------------------------------------------------------------
// 8. KẾT NỐI TIKTOK LIVE (tự reconnect)
// ------------------------------------------------------------
const tk = {
  conn: null,
  username: '',
  status: 'idle', // idle | connecting | connected | reconnecting | waiting | error
  message: 'Chưa kết nối',
  manual: true,
  retry: 0,
  timer: null,
  roomId: null,
};

function setTk(status, message) {
  tk.status = status;
  tk.message = message;
  broadcastStatus();
}

function normalizeUsername(s) {
  s = String(s || '').trim();
  const m = s.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (m) s = m[1];
  return s.replace(/^@/, '').trim();
}

/** Chuẩn hóa thông tin user từ cả v1 (phẳng) và v2 (data.user) */
function normUser(d) {
  const u = (d && d.user) || d || {};
  const id = u.uniqueId || u.displayId || d.uniqueId || u.userId || u.id || d.userId;
  const name = u.nickname || d.nickname || id;
  const avatar =
    u.profilePictureUrl ||
    d.profilePictureUrl ||
    u.profilePicture?.url?.[0] ||
    u.profilePicture?.urls?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    null;
  return { id: String(id || name || 'tiktok_user'), name: String(name || id || 'Ẩn danh'), avatar };
}

function explainError(err) {
  const name = err?.constructor?.name || err?.name || '';
  const msg = String(err?.message || err || '');
  const user = '@' + tk.username;
  if (name === 'UserOfflineError' || /offline|not live|isn't online|not currently live|LIVE has ended|status.?4/i.test(msg))
    return { code: 'offline', text: `Tài khoản ${user} hiện KHÔNG đang live. Sẽ tự thử lại khi bạn bắt đầu live.` };
  if (name === 'InvalidUniqueIdError' || /user ?not ?found|invalid.*unique|unique.?id|failed to retrieve room.?id|19881007|does not exist/i.test(msg))
    return { code: 'invalid', text: `Không tìm thấy TikTok ID ${user}. Kiểm tra lại (không cần dấu @), hoặc tài khoản chưa live.` };
  if (/rate.?limit|429|too many/i.test(msg) || name === 'SignatureRateLimitError')
    return { code: 'ratelimit', text: 'Máy chủ ký (Euler Stream) giới hạn lượt. Đợi vài phút hoặc thêm signApiKey trong config.json.' };
  if (/ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket hang up|timeout/i.test(msg))
    return { code: 'network', text: 'Lỗi mạng khi kết nối TikTok: ' + msg };
  return { code: 'unknown', text: 'Lỗi kết nối TikTok: ' + (msg || name) };
}

function clearRetry() {
  if (tk.timer) clearTimeout(tk.timer);
  tk.timer = null;
}

function scheduleReconnect(kind) {
  clearRetry();
  if (tk.manual || config.tiktok?.autoReconnect === false || !tk.username) return;
  let delay;
  if (kind === 'offline') {
    delay = (config.tiktok?.offlineRetrySec || 30) * 1000;
    setTk('waiting', `Đang chờ @${tk.username} lên live... thử lại sau ${delay / 1000}s`);
  } else {
    tk.retry += 1;
    delay = Math.min(60000, 3000 * Math.pow(2, tk.retry - 1)); // 3s,6s,12s,24s,48s,60s
    setTk('reconnecting', `Mất kết nối, tự kết nối lại sau ${Math.round(delay / 1000)}s (lần ${tk.retry})`);
  }
  log(tk.message, 'warn');
  tk.timer = setTimeout(() => tiktokConnect(tk.username, true), delay);
}

async function destroyConn() {
  const c = tk.conn;
  tk.conn = null;
  if (c) {
    try {
      c.removeAllListeners();
      await c.disconnect();
    } catch (_) {}
  }
}

async function tiktokConnect(username, isRetry = false) {
  if (!TikTok) {
    setTk('error', 'Chưa cài thư viện tiktok-live-connector (chạy npm install)');
    return;
  }
  username = normalizeUsername(username);
  if (!username) {
    setTk('error', 'Vui lòng nhập TikTok ID');
    return;
  }
  clearRetry();
  await destroyConn();
  if (!isRetry) tk.retry = 0;
  tk.username = username;
  tk.manual = false;
  setTk('connecting', `Đang kết nối @${username}...`);
  log(`Đang kết nối TikTok @${username}...`);

  const Conn = TikTok.TikTokLiveConnection || TikTok.WebcastPushConnection;
  const E = TikTok.WebcastEvent || {};
  const C = TikTok.ControlEvent || {};
  // enableExtendedGiftInfo: true sẽ gọi API danh sách quà của Euler Stream, API này nay chỉ dành
  // cho gói Business trả phí -> kết nối thất bại. Tắt đi: sự kiện quà vẫn có tên, giá xu và ảnh.
  const opts = { processInitialData: false, enableExtendedGiftInfo: false };
  if (config.tiktok?.signApiKey) opts.signApiKey = config.tiktok.signApiKey;

  let conn;
  try {
    conn = new Conn(username, opts);
  } catch (e) {
    const ex = explainError(e);
    setTk('error', ex.text);
    log(ex.text, 'error');
    return;
  }
  tk.conn = conn;
  const alive = () => tk.conn === conn; // bỏ qua sự kiện của kết nối cũ

  // --- Đăng ký sự kiện ---
  conn.on(E.MEMBER || 'member', (d) => alive() && handleInteraction('join', normUser(d)));
  conn.on(E.CHAT || 'chat', (d) => alive() && handleInteraction('chat', normUser(d), { text: d.comment ?? d.content ?? '' }));
  conn.on(E.LIKE || 'like', (d) => {
    if (!alive()) return;
    handleInteraction('like', normUser(d), { count: d.likeCount ?? d.count ?? 1 });
  });
  conn.on(E.FOLLOW || 'follow', (d) => alive() && handleInteraction('follow', normUser(d)));
  conn.on(E.SHARE || 'share', (d) => alive() && handleInteraction('share', normUser(d)));
  conn.on(E.ROOM_USER || 'roomUser', (d) => {
    if (!alive()) return;
    const v = Number(d.viewerCount ?? d.total ?? d.totalUser ?? 0);
    if (v >= 0 && v !== state.viewers) {
      state.viewers = v;
      scheduleState();
    }
  });
  conn.on(E.GIFT || 'gift', (d) => {
    if (!alive()) return;
    const g = d.gift || d.giftDetails || {};
    const ext = d.extendedGiftInfo || {};
    const giftName = g.name || g.giftName || ext.name || d.giftName || 'Quà';
    const coins = Number(g.diamondCount ?? ext.diamond_count ?? ext.diamondCount ?? d.diamondCount ?? 0);
    const giftType = g.type ?? g.giftType ?? ext.type ?? d.giftType;
    if (learnGift(giftName, coins, giftImg(g) || giftImg(ext))) giftsChanged();
    // Quà dạng combo (type 1): chỉ xử lý khi kết thúc chuỗi để không lặp hiệu ứng
    if (giftType === 1 && !d.repeatEnd) return;
    handleInteraction('gift', normUser(d), { giftName, coins, count: d.repeatCount || 1 });
  });
  conn.on(E.STREAM_END || 'streamEnd', () => {
    if (!alive()) return;
    log('Phiên live đã kết thúc.', 'warn');
    destroyConn();
    scheduleReconnect('offline');
  });
  conn.on(C.DISCONNECTED || 'disconnected', () => {
    if (!alive()) return;
    log('TikTok ngắt kết nối.', 'warn');
    tk.conn = null;
    scheduleReconnect('network');
  });
  conn.on(C.ERROR || 'error', (err) => {
    if (!alive()) return;
    log('Lỗi TikTok: ' + (err?.info || err?.exception?.message || err?.message || JSON.stringify(err)).slice(0, 200), 'warn');
  });

  // --- Kết nối ---
  try {
    const st = await conn.connect();
    if (!alive()) return;
    tk.retry = 0;
    tk.roomId = st?.roomId || null;
    setTk('connected', `Đã kết nối @${username}${tk.roomId ? ' (room ' + tk.roomId + ')' : ''}`);
    log(`✅ Đã kết nối TikTok Live @${username}`);
    loadRoomGifts(conn);
  } catch (err) {
    if (!alive()) return;
    tk.conn = null;
    const ex = explainError(err);
    log(ex.text, 'error');
    if (ex.code === 'invalid') {
      tk.manual = true;
      setTk('error', ex.text);
    } else if (ex.code === 'offline') {
      scheduleReconnect('offline');
    } else {
      setTk('error', ex.text);
      scheduleReconnect('network');
    }
  }
}

/** Tải danh sách quà của phòng live (tên, giá, ảnh icon) */
async function loadRoomGifts(conn) {
  try {
    const r = conn.availableGifts || (await conn.fetchAvailableGifts());
    const list = Array.isArray(r) ? r : (r && (r.gifts || (r.data && r.data.gifts))) || [];
    let changed = false;
    for (const g of list) changed = learnGift(g.name, g.diamond_count ?? g.diamondCount, giftImg(g)) || changed;
    if (changed) giftsChanged();
    log(`🎁 Đã tải ${list.length} quà TikTok (kèm ảnh icon)`);
  } catch (e) {
    // Không bắt buộc: ảnh quà vẫn được tự học dần mỗi khi có người tặng
    const paid = /Business plan|pricing/i.test(String(e && e.message));
    log(paid ? 'ℹ Danh sách quà đầy đủ cần gói trả phí của Euler Stream, bỏ qua. Ảnh quà sẽ tự cập nhật khi có người tặng.' : 'Không tải được danh sách quà TikTok: ' + (e.message || e), paid ? 'info' : 'warn');
  }
}

async function tiktokDisconnect() {
  tk.manual = true;
  clearRetry();
  await destroyConn();
  setTk('idle', 'Đã ngắt kết nối');
  log('Đã ngắt kết nối TikTok.');
}

// ------------------------------------------------------------
// 9. CHẾ ĐỘ GIẢ LẬP
// ------------------------------------------------------------
const sim = { on: false, timer: null };

function simProfile() {
  const names = config.simulator?.names || ['Người xem'];
  const i = Math.floor(Math.random() * names.length);
  return { id: 'sim_' + i, name: names[i], avatar: null };
}

function simStep() {
  // Ưu tiên lấy người đang ngồi để hành động trông tự nhiên
  const seated = state.seats.filter((id) => id && id.startsWith('sim_')).map((id) => state.users[id]);
  const actor = seated.length && Math.random() < 0.75 ? pick(seated) : null;
  const prof = actor ? { id: actor.id, name: actor.name } : simProfile();
  const S = config.simulator || {};
  const r = Math.random();

  if (r < 0.14) handleInteraction('join', simProfile());
  else if (r < 0.26) handleInteraction('chat', prof, { text: pick(S.chats) || 'A Di Đà Phật' });
  else if (r < 0.5) handleInteraction('chat', prof, { text: String(1 + Math.floor(Math.random() * 4)) });
  else if (r < 0.7) handleInteraction('like', prof, { count: 1 + Math.floor(Math.random() * 10) });
  else if (r < 0.74) handleInteraction('chat', prof, { text: Math.random() < 0.5 ? 'nam' : 'nữ' });
  else if (r < 0.77) handleInteraction('chat', prof, { text: 'xăm' });
  else if (r < 0.81) handleInteraction('chat', prof, { text: pick(S.prayers) || 'cầu bình an' });
  else if (r < 0.84) handleInteraction('follow', prof);
  else if (r < 0.87) handleInteraction('share', prof);
  else if (r < 0.95) {
    // Quà: phần lớn là quà nhỏ
    const rituals = config.rituals || [];
    const w = Math.random();
    const idx = w < 0.5 ? 0 : w < 0.72 ? 1 : w < 0.86 ? 2 : w < 0.94 ? 3 : w < 0.975 ? 4 : w < 0.993 ? 5 : 6;
    const rt = rituals[Math.min(idx, rituals.length - 1)];
    if (rt) handleInteraction('gift', prof, { giftName: (rt.giftNames || [])[0] || rt.name, coins: rt.coins, count: idx === 0 ? 1 + Math.floor(Math.random() * 3) : 1 });
  } else if (r < 0.97 && seated.length > 18) {
    handleInteraction('leave', prof);
  }
  // Số người xem dao động
  state.viewers = Math.max(state.seats.filter(Boolean).length, state.viewers + Math.round((Math.random() - 0.45) * 4));
}

function simLoop() {
  if (!sim.on) return;
  simStep();
  const S = config.simulator || {};
  const min = S.intervalMinMs || 500;
  const max = S.intervalMaxMs || 1400;
  sim.timer = setTimeout(simLoop, min + Math.random() * (max - min));
}

function setSim(on) {
  sim.on = !!on;
  clearTimeout(sim.timer);
  if (sim.on) {
    if (!state.viewers) state.viewers = 20;
    simLoop();
  }
  log(sim.on ? '▶ Bật chế độ giả lập' : '⏸ Tắt chế độ giả lập');
  broadcastStatus();
}

// ------------------------------------------------------------
// 10. HTTP + SOCKET.IO
// ------------------------------------------------------------
const app = express();
const server = http.createServer(app);
io = new Server(server, { cors: { origin: false } });

app.disable('x-powered-by');
app.get('/overlay', (req, res) => res.sendFile(path.join(ROOT, 'public', 'overlay.html')));
app.get('/api/state', (req, res) => res.json(snapshot()));

// Tải ảnh / âm thanh lên từ bảng điều khiển.
// Chống trang web lạ gửi file vào máy (CSRF): bắt buộc header X-TD-Panel (trình duyệt sẽ
// chặn header này khi gửi từ trang khác vì server không trả CORS) và Origin phải là chính server.
function requirePanel(req, res, next) {
  const origin = req.get('origin');
  let sameOrigin = true;
  if (origin) {
    try {
      sameOrigin = new URL(origin).host === req.get('host');
    } catch (_) {
      sameOrigin = false;
    }
  }
  if (req.get('x-td-panel') !== '1' || !sameOrigin) {
    return res.status(403).json({ error: 'Chỉ bảng điều khiển mới được tải file lên' });
  }
  next();
}
app.post('/api/assets/:slot', requirePanel, express.raw({ type: () => true, limit: UPLOAD_MAX.audio + 1024 }), (req, res) => {
  try {
    const slot = saveUpload(req.params.slot, req.body);
    assetsChanged(`🖼 Đã cập nhật ${slot.label}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/assets/:slot', requirePanel, (req, res) => {
  const slot = uploadSlot(req.params.slot);
  if (!slot) return res.status(400).json({ error: 'Ô tải lên không hợp lệ' });
  removeAsset(slot.file, extsOf(slot.kind));
  assetsChanged(`↩ Đã xoá ${slot.label}, dùng lại mặc định`);
  res.json({ ok: true });
});
// Lỗi file quá lớn từ express.raw
app.use('/api/assets', (err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'File quá lớn' });
  next(err);
});
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

const overlays = new Map(); // socket.id -> { fps, preview, t }

function statusPayload() {
  const now = Date.now();
  const list = [...overlays.values()].filter((o) => now - o.t < 6000);
  return {
    tiktok: { status: tk.status, message: tk.message, username: tk.username },
    sim: sim.on,
    muted: state.muted,
    overlays: list,
  };
}
function broadcastStatus() {
  if (io) io.to('panel').emit('status', statusPayload());
}
setInterval(broadcastStatus, 2000);

io.on('connection', (socket) => {
  socket.on('hello', (info = {}) => {
    const role = info.role === 'panel' ? 'panel' : 'overlay';
    socket.join(role);
    socket.data.role = role;
    socket.emit('config', publicConfig());
    socket.emit('state', snapshot());
    socket.emit('mute', state.muted);
    if (role === 'panel') {
      socket.emit('logs', logBuffer);
      socket.emit('status', statusPayload());
    } else {
      overlays.set(socket.id, { fps: 0, preview: !!info.preview, t: Date.now() });
    }
  });

  socket.on('overlay:fps', (d = {}) => {
    overlays.set(socket.id, { fps: Math.round(Number(d.fps) || 0), preview: !!d.preview, t: Date.now() });
  });

  socket.on('disconnect', () => overlays.delete(socket.id));

  // ---- Lệnh từ bảng điều khiển ----
  const panelOnly = (fn) => (...args) => {
    if (socket.data.role !== 'panel') return;
    try {
      fn(...args);
    } catch (e) {
      log('Lỗi xử lý lệnh: ' + e.message, 'error');
    }
  };

  socket.on('panel:connect', panelOnly((d = {}) => tiktokConnect(d.username || config.tiktok?.username)));
  socket.on('panel:disconnect', panelOnly(() => tiktokDisconnect()));
  socket.on('panel:sim', panelOnly((d = {}) => setSim(d.on)));
  socket.on('panel:mute', panelOnly((d = {}) => {
    state.muted = !!d.muted;
    io.emit('mute', state.muted);
    broadcastStatus();
    saveSoon();
  }));
  socket.on('panel:reset', panelOnly(() => {
    const users = state.users;
    const muted = state.muted;
    state = freshState();
    state.muted = muted;
    // Giữ hồ sơ (tên, giới tính, pháp danh) nhưng xóa điểm & chỗ ngồi
    for (const u of Object.values(users)) {
      u.points = 0;
      u.seat = null;
      state.users[u.id] = u;
    }
    cooldowns.clear();
    io.emit('reset');
    io.emit('state', snapshot());
    saveNow();
    log('♻ Đã reset phiên: xóa điểm, giải phóng toàn bộ chỗ ngồi.');
  }));
  socket.on('panel:trigger', panelOnly((d = {}) => {
    const name = String(d.name || '').trim() || pick(config.simulator?.names) || 'Khách';
    const profile = { id: 'test_' + name.toLowerCase().replace(/\s+/g, '_'), name };
    switch (d.type) {
      case 'join': case 'follow': case 'share': case 'leave':
        handleInteraction(d.type, profile);
        break;
      case 'like':
        handleInteraction('like', profile, { count: d.count || 5 });
        break;
      case 'chat':
        handleInteraction('chat', profile, { text: d.text || 'A Di Đà Phật' });
        break;
      case 'gift':
        if (d.giftName) {
          const g = giftCatalog[String(d.giftName).toLowerCase().trim()] || {};
          handleInteraction('gift', profile, { giftName: d.giftName, coins: g.coins || 1, count: d.count || 1, phapDanh: d.phapDanh });
        } else handleInteraction('gift', profile, { ritualId: d.ritualId, count: d.count || 1, phapDanh: d.phapDanh });
        break;
      case 'challenge':
        addChallenge(config.challenge?.type || 'likes', state.challenge.goal);
        break;
      case 'fillSeats':
        for (let i = 0; i < 30; i++) handleInteraction('join', simProfile());
        break;
      case 'niemGroup': {
        // Test: nhiều người (ưu tiên người đang ngồi) lần lượt niệm Phật -> kích hoạt bùng nổ
        const n = Math.max(1, Math.min(Number(d.count) || 5, 40));
        const seated = state.seats.filter(Boolean).map((id) => state.users[id]).filter(Boolean);
        const people = seated.sort(() => Math.random() - 0.5).slice(0, n);
        while (people.length < n) people.push(simProfile());
        people.forEach((u, i) => setTimeout(() => handleInteraction('chat', { id: u.id, name: u.name, avatar: u.avatar }, { text: 'Nam mô A Di Đà Phật 🙏' }), i * 300));
        break;
      }
    }
  }));
});

// ------------------------------------------------------------
// 11. TỰ NẠP LẠI CONFIG KHI SỬA FILE
// ------------------------------------------------------------
fs.watchFile(CONFIG_PATH, { interval: 1500 }, () => {
  try {
    config = loadConfig();
    resizeSeats();
    state.seats.forEach((id, i) => { if (id && state.users[id]) state.users[id].seat = i; });
    io.emit('config', publicConfig());
    io.emit('state', snapshot());
    log('🔄 Đã nạp lại config.json');
  } catch (e) {
    log('config.json bị lỗi cú pháp, giữ cấu hình cũ: ' + e.message, 'error');
  }
});

// ------------------------------------------------------------
// 12. KHỞI ĐỘNG
// ------------------------------------------------------------
loadState();
const PORT = Number(process.env.PORT) || config.port || 3000;
const HOST = process.env.HOST || config.host || '127.0.0.1';

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n✖ Cổng ${PORT} đang bị dùng. Tắt chương trình khác hoặc đổi "port" trong config.json.\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const base = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log('\n🪷  THIỀN ĐƯỜNG LIVE OVERLAY đã chạy');
  console.log(`   Bảng điều khiển : ${base}/`);
  console.log(`   Overlay cho OBS : ${base}/overlay   (Browser Source 1080x1920)\n`);
  if (config.tiktok?.username) tiktokConnect(config.tiktok.username);
});

function shutdown() {
  console.log('\nĐang lưu dữ liệu và thoát...');
  saveNow();
  destroyConn().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => log('Lỗi không xử lý: ' + (e?.message || e), 'error'));
