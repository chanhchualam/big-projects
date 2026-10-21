// src/components/AdminExtraTabs.jsx
// Các tab bổ sung của trang quản trị: Thống kê & xuất đơn, Mã giảm giá, Báo có hàng, và ô nhập mã vận đơn
import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchCouponsFromDb,
  saveCouponToDb,
  deleteCouponFromDb,
  fetchRestockRequestsFromDb,
  deleteRestockRequestFromDb,
  fetchSettingsFromDb,
  saveSettingsToDb,
  fetchAnnouncementsFromDb,
  saveAnnouncementToDb,
  deleteAnnouncementFromDb
} from '../services/firestoreService';
import { CARRIERS } from '../utils/orderStatus';
import { orderVndRate } from '../utils/currency';

// Đơn được tính doanh thu: admin đã xác nhận thanh toán trở đi
export const REVENUE_STATUSES = [
  'Đã thanh toán (Chờ chuẩn bị hàng)',
  'Đang chuẩn bị hàng',
  'Đang giao hàng',
  'Giao thành công'
];

const vnd = (n) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;
const orderVnd = (o) => o.amountVnd || Math.round((Number(o.total) || 0) * orderVndRate(o));

// Ngày đặt đơn: ưu tiên mốc ISO đầu tiên trong statusHistory, nếu không thì đọc chuỗi vi-VN "hh:mm:ss dd/mm/yyyy"
export function getOrderDate(order) {
  const first = Array.isArray(order.statusHistory) && order.statusHistory[0]?.at;
  if (first) return new Date(first);
  const s = order.createdAt || '';
  const d = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!d) return null;
  const t = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return new Date(+d[3], +d[2] - 1, +d[1], t ? +t[1] : 0, t ? +t[2] : 0, t && t[3] ? +t[3] : 0);
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// =============================================================
// XUẤT CSV (mở được bằng Excel, có BOM để giữ tiếng Việt)
// =============================================================
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportOrdersCsv(orders, filename) {
  const header = [
    'Mã đơn', 'Ngày đặt', 'Trạng thái', 'Khách hàng', 'Số điện thoại', 'Email', 'Địa chỉ',
    'Sản phẩm', 'Tạm tính (USD)', 'Phí ship (USD)', 'Giảm giá (USD)', 'Mã giảm giá',
    'Tổng (USD)', 'Tổng (VNĐ)', 'Nội dung chuyển khoản', 'Thanh toán', 'Gói giao',
    'Đơn vị vận chuyển', 'Mã vận đơn', 'Ghi chú'
  ];
  const rows = orders.map((o) => {
    const d = getOrderDate(o);
    return [
      o.id,
      d ? d.toLocaleString('vi-VN') : o.createdAt,
      o.status,
      o.customerName,
      o.customerPhone,
      o.customerEmail,
      o.shippingAddress,
      (o.items || []).map((i) => `${i.title} x${i.qty}`).join('; '),
      Number(o.subtotal || 0).toFixed(2),
      Number(o.shippingFee || 0).toFixed(2),
      Number(o.discountAmount || 0).toFixed(2),
      o.couponCode || '',
      Number(o.total || 0).toFixed(2),
      orderVnd(o),
      `PTCG ${o.id}`,
      o.paymentMethod,
      o.shippingMethod,
      o.carrier || '',
      o.trackingCode || '',
      o.orderNotes || ''
    ];
  });
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================
// 1. THỐNG KÊ DOANH THU + CẢNH BÁO SẮP HẾT HÀNG + XUẤT ĐƠN
// =============================================================
const RANGES = [
  { value: '7d', label: '7 ngày', days: 7, by: 'day' },
  { value: '30d', label: '30 ngày', days: 30, by: 'day' },
  { value: '12m', label: '12 tháng', days: 366, by: 'month' },
  { value: 'all', label: 'Tất cả', days: null, by: 'month' }
];

function RevenueBars({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  return (
    <div className="rev-chart" role="img" aria-label="Biểu đồ doanh thu">
      {buckets.map((b) => (
        <div key={b.key} className="rev-col" title={`${b.label}: ${vnd(b.revenue)} · ${b.count} đơn`}>
          <div className="rev-bar-track">
            <div className="rev-bar" style={{ height: `${(b.revenue / max) * 100}%` }} />
          </div>
          <span className="rev-col-label">{b.short}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsTab({ orders = [], products = [] }) {
  const [range, setRange] = useState('30d');
  const [threshold, setThreshold] = useState(5);
  const [thresholdDraft, setThresholdDraft] = useState('5');
  const [thresholdMsg, setThresholdMsg] = useState('');

  useEffect(() => {
    fetchSettingsFromDb('shop').then((s) => {
      if (typeof s?.lowStockThreshold === 'number') {
        setThreshold(s.lowStockThreshold);
        setThresholdDraft(String(s.lowStockThreshold));
      }
    });
  }, []);

  const rangeDef = RANGES.find((r) => r.value === range);

  const ordersInRange = useMemo(() => {
    if (!rangeDef.days) return orders;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    if (rangeDef.by === 'day') from.setDate(from.getDate() - (rangeDef.days - 1));
    else from.setMonth(from.getMonth() - 11, 1);
    return orders.filter((o) => {
      const d = getOrderDate(o);
      return d && d >= from;
    });
  }, [orders, range]);

  const paidOrders = useMemo(() => ordersInRange.filter((o) => REVENUE_STATUSES.includes(o.status)), [ordersInRange]);
  const revenue = paidOrders.reduce((sum, o) => sum + orderVnd(o), 0);

  const buckets = useMemo(() => {
    const list = [];
    const now = new Date();
    if (rangeDef.by === 'day') {
      for (let i = rangeDef.days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        list.push({ key: dayKey(d), label: d.toLocaleDateString('vi-VN'), short: `${d.getDate()}/${d.getMonth() + 1}`, revenue: 0, count: 0 });
      }
    } else {
      const dates = paidOrders.map(getOrderDate).filter(Boolean);
      const start = rangeDef.days
        ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
        : dates.length ? new Date(Math.min(...dates)) : now;
      for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= now; d.setMonth(d.getMonth() + 1)) {
        list.push({ key: monthKey(d), label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`, short: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`, revenue: 0, count: 0 });
      }
    }
    const byKey = new Map(list.map((b) => [b.key, b]));
    paidOrders.forEach((o) => {
      const d = getOrderDate(o);
      const b = d && byKey.get(rangeDef.by === 'day' ? dayKey(d) : monthKey(d));
      if (b) {
        b.revenue += orderVnd(o);
        b.count += 1;
      }
    });
    return list;
  }, [paidOrders, range]);

  const topProducts = useMemo(() => {
    const map = new Map();
    paidOrders.forEach((o) => {
      (o.items || []).forEach((i) => {
        const key = String(i.id || i.title);
        const row = map.get(key) || { title: i.title, qty: 0, revenue: 0 };
        row.qty += Number(i.qty) || 0;
        row.revenue += (Number(i.price) || 0) * (Number(i.qty) || 0) * orderVndRate(o);
        map.set(key, row);
      });
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [paidOrders]);

  const statusCounts = useMemo(() => {
    const map = new Map();
    ordersInRange.forEach((o) => map.set(o.status || '(không rõ)', (map.get(o.status || '(không rõ)') || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [ordersInRange]);

  const lowStock = useMemo(
    () => products
      .filter((p) => typeof p.stock === 'number' && p.stock <= threshold)
      .sort((a, b) => a.stock - b.stock),
    [products, threshold]
  );

  const saveThreshold = async () => {
    const n = Math.max(0, Math.floor(Number(thresholdDraft) || 0));
    const ok = await saveSettingsToDb('shop', { lowStockThreshold: n });
    if (ok) setThreshold(n);
    setThresholdMsg(ok ? 'Đã lưu' : 'Lỗi khi lưu');
    setTimeout(() => setThresholdMsg(''), 2000);
  };

  return (
    <div className="xadmin-panel">
      <div className="xadmin-toolbar">
        <div className="xadmin-segment" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((r) => (
            <button key={r.value} type="button" className={range === r.value ? 'active' : ''} onClick={() => setRange(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="xadmin-btn"
          onClick={() => exportOrdersCsv(ordersInRange, `don-hang-point-tcg-${range}-${dayKey(new Date())}.csv`)}
          disabled={ordersInRange.length === 0}
        >
          ⬇️ Xuất {ordersInRange.length} đơn ra Excel (CSV)
        </button>
      </div>

      <div className="xadmin-tiles">
        <div className="xadmin-tile">
          <div className="xadmin-tile-label">Doanh thu (đơn đã thanh toán)</div>
          <div className="xadmin-tile-value">{vnd(revenue)}</div>
        </div>
        <div className="xadmin-tile">
          <div className="xadmin-tile-label">Đơn đã thanh toán</div>
          <div className="xadmin-tile-value">{paidOrders.length}</div>
        </div>
        <div className="xadmin-tile">
          <div className="xadmin-tile-label">Tổng số đơn</div>
          <div className="xadmin-tile-value">{ordersInRange.length}</div>
        </div>
        <div className="xadmin-tile">
          <div className="xadmin-tile-label">Giá trị TB / đơn</div>
          <div className="xadmin-tile-value">{vnd(paidOrders.length ? revenue / paidOrders.length : 0)}</div>
        </div>
      </div>

      <section className="xadmin-card">
        <h3>Doanh thu theo {rangeDef.by === 'day' ? 'ngày' : 'tháng'}</h3>
        {paidOrders.length === 0 ? (
          <p className="xadmin-muted">Chưa có đơn đã thanh toán trong khoảng này.</p>
        ) : (
          <>
            <RevenueBars buckets={buckets} />
            <details className="xadmin-table-toggle">
              <summary>Xem bảng số liệu</summary>
              <table className="xadmin-table">
                <thead><tr><th>Thời gian</th><th>Số đơn</th><th>Doanh thu</th></tr></thead>
                <tbody>
                  {buckets.filter((b) => b.count > 0).map((b) => (
                    <tr key={b.key}><td>{b.label}</td><td>{b.count}</td><td>{vnd(b.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      <div className="xadmin-two-col">
        <section className="xadmin-card">
          <h3>Sản phẩm bán chạy</h3>
          {topProducts.length === 0 ? (
            <p className="xadmin-muted">Chưa có dữ liệu.</p>
          ) : (
            <table className="xadmin-table">
              <thead><tr><th>#</th><th>Sản phẩm</th><th>Đã bán</th><th>Doanh thu</th></tr></thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.title + i}><td>{i + 1}</td><td>{p.title}</td><td>{p.qty}</td><td>{vnd(p.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="xadmin-card">
          <h3>Số đơn theo trạng thái</h3>
          {statusCounts.length === 0 ? (
            <p className="xadmin-muted">Chưa có đơn.</p>
          ) : (
            <table className="xadmin-table">
              <tbody>
                {statusCounts.map(([status, count]) => (
                  <tr key={status}><td>{status}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="xadmin-card">
        <div className="xadmin-card-head">
          <h3>⚠️ Sắp hết hàng ({lowStock.length})</h3>
          <label className="xadmin-inline-field">
            Cảnh báo khi tồn kho ≤
            <input
              type="number"
              min="0"
              value={thresholdDraft}
              onChange={(e) => setThresholdDraft(e.target.value)}
            />
            <button type="button" className="xadmin-btn-small" onClick={saveThreshold}>Lưu</button>
            {thresholdMsg && <span className="xadmin-muted">{thresholdMsg}</span>}
          </label>
        </div>
        {lowStock.length === 0 ? (
          <p className="xadmin-muted">Không có sản phẩm nào có tồn kho ≤ {threshold}.</p>
        ) : (
          <table className="xadmin-table">
            <thead><tr><th>Sản phẩm</th><th>Tồn kho</th></tr></thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>
                    <span className={p.stock === 0 ? 'xadmin-pill-red' : 'xadmin-pill-amber'}>
                      {p.stock === 0 ? '✕ Hết hàng' : `! Còn ${p.stock}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// =============================================================
// 2. MÃ GIẢM GIÁ
// =============================================================
const EMPTY_COUPON = { code: '', percent: 10, freeShip: false, minOrder: 0, maxUses: 0, expiresAt: '', active: true };

export function CouponsTab() {
  const [coupons, setCoupons] = useState(null);
  const [form, setForm] = useState(EMPTY_COUPON);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => fetchCouponsFromDb().then((list) => setCoupons(list || []));
  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      setMsg('Mã chỉ gồm chữ không dấu, số, "-" hoặc "_", dài 3–30 ký tự.');
      return;
    }
    const percent = Math.min(100, Math.max(0, Number(form.percent) || 0));
    if (percent === 0 && !form.freeShip) {
      setMsg('Mã cần có % giảm hoặc miễn phí ship.');
      return;
    }
    const existing = coupons?.find((c) => c.code === code);
    if (!editing && existing) {
      setMsg(`Mã ${code} đã tồn tại.`);
      return;
    }
    const ok = await saveCouponToDb({
      code,
      percent,
      freeShip: !!form.freeShip,
      minOrder: Math.max(0, Number(form.minOrder) || 0),
      maxUses: Math.max(0, Math.floor(Number(form.maxUses) || 0)),
      expiresAt: form.expiresAt || '',
      active: !!form.active,
      usedCount: existing?.usedCount || 0
    });
    setMsg(ok ? `Đã lưu mã ${code}.` : 'Không lưu được mã (không có quyền hoặc lỗi kết nối).');
    if (ok) {
      setForm(EMPTY_COUPON);
      setEditing(false);
      load();
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Xoá mã ${code}?`)) return;
    if (await deleteCouponFromDb(code)) load();
  };

  const status = (c) => {
    if (c.active === false) return ['Tắt', 'xadmin-pill-gray'];
    if (c.expiresAt && new Date(`${c.expiresAt}T23:59:59`) < new Date()) return ['Hết hạn', 'xadmin-pill-red'];
    if (c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses) return ['Hết lượt', 'xadmin-pill-red'];
    return ['Đang dùng', 'xadmin-pill-green'];
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="xadmin-panel">
      <section className="xadmin-card">
        <h3>{editing ? `Sửa mã ${form.code}` : 'Tạo mã giảm giá'}</h3>
        <form className="xadmin-form-grid" onSubmit={handleSave}>
          <label>Mã
            <input value={form.code} onChange={set('code')} disabled={editing} placeholder="VD: POINTTCG" required />
          </label>
          <label>Giảm (%)
            <input type="number" min="0" max="100" value={form.percent} onChange={set('percent')} />
          </label>
          <label>Đơn tối thiểu ($)
            <input type="number" min="0" step="0.01" value={form.minOrder} onChange={set('minOrder')} />
          </label>
          <label>Số lượt dùng (0 = không giới hạn)
            <input type="number" min="0" value={form.maxUses} onChange={set('maxUses')} />
          </label>
          <label>Hạn dùng (để trống = không hết hạn)
            <input type="date" value={form.expiresAt} onChange={set('expiresAt')} />
          </label>
          <div className="xadmin-checks">
            <label><input type="checkbox" checked={form.freeShip} onChange={set('freeShip')} /> Miễn phí ship tiêu chuẩn</label>
            <label><input type="checkbox" checked={form.active} onChange={set('active')} /> Đang bật</label>
          </div>
          <div className="xadmin-form-actions">
            <button type="submit" className="xadmin-btn">{editing ? 'Lưu thay đổi' : 'Tạo mã'}</button>
            {editing && (
              <button type="button" className="xadmin-btn-small" onClick={() => { setEditing(false); setForm(EMPTY_COUPON); setMsg(''); }}>
                Huỷ
              </button>
            )}
            {msg && <span className="xadmin-muted">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="xadmin-card">
        <h3>Danh sách mã ({coupons?.length || 0})</h3>
        {coupons === null ? (
          <p className="xadmin-muted">Đang tải...</p>
        ) : coupons.length === 0 ? (
          <p className="xadmin-muted">Chưa có mã nào. Các mã cũ (POINTTCG, FREESHIP…) không còn hoạt động — hãy tạo lại ở trên nếu muốn dùng tiếp.</p>
        ) : (
          <div className="xadmin-table-scroll">
            <table className="xadmin-table">
              <thead>
                <tr><th>Mã</th><th>Ưu đãi</th><th>Đơn tối thiểu</th><th>Đã dùng</th><th>Hạn</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const [label, cls] = status(c);
                  return (
                    <tr key={c.code}>
                      <td><strong>{c.code}</strong></td>
                      <td>{[c.percent > 0 && `-${c.percent}%`, c.freeShip && 'Free ship'].filter(Boolean).join(' + ')}</td>
                      <td>{c.minOrder > 0 ? `$${Number(c.minOrder).toFixed(2)}` : '—'}</td>
                      <td>{c.usedCount || 0}{c.maxUses > 0 ? ` / ${c.maxUses}` : ''}</td>
                      <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('vi-VN') : '—'}</td>
                      <td><span className={cls}>{label}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="xadmin-btn-small" onClick={() => { setForm({ ...EMPTY_COUPON, ...c }); setEditing(true); setMsg(''); }}>Sửa</button>
                        <button type="button" className="xadmin-btn-small danger" onClick={() => handleDelete(c.code)}>Xoá</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================
// 3. BÁO CÓ HÀNG LẠI
// =============================================================
export function RestockTab({ products = [] }) {
  const [requests, setRequests] = useState(null);

  const load = () => fetchRestockRequestsFromDb().then((list) => setRequests(list || []));
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    (requests || []).forEach((r) => {
      const g = map.get(r.productId) || { productId: r.productId, title: r.productTitle, list: [] };
      g.list.push(r);
      map.set(r.productId, g);
    });
    return [...map.values()].map((g) => ({
      ...g,
      product: products.find((p) => String(p.id) === g.productId)
    })).sort((a, b) => b.list.length - a.list.length);
  }, [requests, products]);

  const handleDelete = async (ids) => {
    if (!window.confirm(`Xoá ${ids.length} yêu cầu?`)) return;
    await Promise.all(ids.map(deleteRestockRequestFromDb));
    load();
  };

  if (requests === null) return <p className="xadmin-muted">Đang tải...</p>;

  return (
    <div className="xadmin-panel">
      {groups.length === 0 ? (
        <section className="xadmin-card">
          <p className="xadmin-muted">Chưa có khách nào đăng ký nhận thông báo có hàng.</p>
        </section>
      ) : groups.map((g) => {
        const emails = g.list.map((r) => r.email);
        const inStock = g.product && (typeof g.product.stock !== 'number' || g.product.stock > 0);
        const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}`
          + `&subject=${encodeURIComponent(`[Point TCG] ${g.title} đã có hàng trở lại!`)}`
          + `&body=${encodeURIComponent(`Chào bạn,\n\nSản phẩm "${g.title}" bạn quan tâm đã có hàng trở lại tại https://point-tcg.web.app\n\nPoint TCG`)}`;
        return (
          <section key={g.productId} className="xadmin-card">
            <div className="xadmin-card-head">
              <h3>{g.title} — {g.list.length} khách chờ</h3>
              <span className={inStock ? 'xadmin-pill-green' : 'xadmin-pill-red'}>
                {inStock ? `✓ Đã có hàng (${g.product.stock})` : '✕ Vẫn hết hàng'}
              </span>
            </div>
            <div className="xadmin-email-list">{emails.join(', ')}</div>
            <div className="xadmin-form-actions">
              <a className="xadmin-btn" href={mailto}>✉️ Soạn email báo có hàng</a>
              <button type="button" className="xadmin-btn-small" onClick={() => navigator.clipboard?.writeText(emails.join(', '))}>
                Sao chép email
              </button>
              <button type="button" className="xadmin-btn-small danger" onClick={() => handleDelete(g.list.map((r) => r.id))}>
                Đã báo xong — xoá danh sách
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// =============================================================
// 4. Ô NHẬP MÃ VẬN ĐƠN (trong thẻ đơn hàng)
// =============================================================
export function TrackingEditor({ order, onSave }) {
  const [carrier, setCarrier] = useState(order.carrier || 'GHN');
  const [code, setCode] = useState(order.trackingCode || '');
  const [state, setState] = useState('');

  const dirty = carrier !== (order.carrier || 'GHN') || code !== (order.trackingCode || '');

  return (
    <div className="tracking-editor">
      <span className="tracking-editor-label">🚚 Vận đơn:</span>
      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Đơn vị vận chuyển">
        {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Mã vận đơn"
        aria-label="Mã vận đơn"
      />
      <button
        type="button"
        className="xadmin-btn-small"
        disabled={!dirty || state === 'saving' || !onSave}
        onClick={async () => {
          setState('saving');
          const ok = await onSave(order.id, { carrier, trackingCode: code.trim() });
          setState(ok ? 'saved' : '');
          if (ok) setTimeout(() => setState(''), 1500);
        }}
      >
        {state === 'saving' ? 'Đang lưu...' : state === 'saved' ? '✓ Đã lưu' : 'Lưu'}
      </button>
    </div>
  );
}

// =============================================================
// 5. THÔNG BÁO CỦA SHOP (thanh trên đầu trang + chuông thông báo của khách)
// =============================================================
const EMPTY_ANNOUNCEMENT = { id: '', text: '', type: 'promo', couponCode: '', link: '', linkText: '', endsAt: '', active: true };
const ANNOUNCEMENT_TYPES = [
  { value: 'promo', label: '🎉 Khuyến mãi' },
  { value: 'info', label: 'ℹ️ Tin tức / Hàng mới' },
  { value: 'warning', label: '⚠️ Lưu ý (nghỉ lễ, chậm giao...)' }
];

export function AnnouncementsTab() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(EMPTY_ANNOUNCEMENT);
  const [msg, setMsg] = useState('');

  const load = () => fetchAnnouncementsFromDb().then((list) =>
    setItems([...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))));
  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    const text = form.text.trim();
    if (!text) {
      setMsg('Vui lòng nhập nội dung thông báo.');
      return;
    }
    const now = new Date().toISOString();
    const existing = items?.find((a) => a.id === form.id);
    const id = await saveAnnouncementToDb({
      ...(form.id && { id: form.id }),
      text: text.slice(0, 200),
      type: form.type,
      couponCode: form.couponCode.trim().toUpperCase(),
      link: form.link.trim(),
      linkText: form.linkText.trim(),
      endsAt: form.endsAt || '',
      active: !!form.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
    setMsg(id ? 'Đã lưu thông báo. Khách sẽ thấy khi tải lại trang.' : 'Không lưu được (không có quyền hoặc lỗi kết nối).');
    if (id) {
      setForm(EMPTY_ANNOUNCEMENT);
      load();
    }
  };

  const toggleActive = async (a) => {
    await saveAnnouncementToDb({ id: a.id, active: a.active === false, updatedAt: new Date().toISOString() });
    load();
  };

  const handleDelete = async (a) => {
    if (!window.confirm('Xoá thông báo này?')) return;
    if (await deleteAnnouncementFromDb(a.id)) load();
  };

  const statusOf = (a) => {
    if (a.active === false) return ['Tắt', 'xadmin-pill-gray'];
    if (a.endsAt && new Date(`${a.endsAt}T23:59:59`) < new Date()) return ['Hết hạn', 'xadmin-pill-red'];
    return ['Đang hiện', 'xadmin-pill-green'];
  };

  return (
    <div className="xadmin-panel">
      <section className="xadmin-card">
        <h3>{form.id ? 'Sửa thông báo' : 'Tạo thông báo mới'}</h3>
        <form className="xadmin-form-grid" onSubmit={handleSave}>
          <label style={{ gridColumn: '1 / -1' }}>Nội dung (tối đa 200 ký tự)
            <input
              value={form.text}
              onChange={set('text')}
              maxLength={200}
              placeholder="VD: 🔥 Giảm 10% toàn bộ Booster Box đến hết Chủ nhật!"
              required
            />
          </label>
          <label>Loại
            <select value={form.type} onChange={set('type')}>
              {ANNOUNCEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label>Mã giảm giá kèm theo (tuỳ chọn)
            <input value={form.couponCode} onChange={set('couponCode')} placeholder="VD: POINTTCG" />
          </label>
          <label>Đường dẫn (tuỳ chọn)
            <input value={form.link} onChange={set('link')} placeholder="#product-open-1 hoặc https://..." />
          </label>
          <label>Chữ trên đường dẫn
            <input value={form.linkText} onChange={set('linkText')} placeholder="Xem ngay" />
          </label>
          <label>Hiện đến hết ngày (để trống = không hết hạn)
            <input type="date" value={form.endsAt} onChange={set('endsAt')} />
          </label>
          <div className="xadmin-checks">
            <label><input type="checkbox" checked={form.active} onChange={set('active')} /> Đang bật</label>
          </div>
          {form.text.trim() && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="xadmin-muted" style={{ marginBottom: 4 }}>Xem trước:</div>
              <div className={`announce-bar announce-${form.type}`} style={{ position: 'static', borderRadius: 8 }}>
                <div className="announce-inner">
                  <span className="announce-text">{form.text}</span>
                  {form.couponCode && <span className="announce-coupon">Mã: {form.couponCode.toUpperCase()}</span>}
                  {form.link && <span className="announce-link">{form.linkText || 'Xem ngay'} →</span>}
                </div>
              </div>
            </div>
          )}
          <div className="xadmin-form-actions">
            <button type="submit" className="xadmin-btn">{form.id ? 'Lưu thay đổi' : 'Đăng thông báo'}</button>
            {form.id && (
              <button type="button" className="xadmin-btn-small" onClick={() => { setForm(EMPTY_ANNOUNCEMENT); setMsg(''); }}>
                Huỷ
              </button>
            )}
            {msg && <span className="xadmin-muted">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="xadmin-card">
        <h3>Các thông báo ({items?.length || 0})</h3>
        {items === null ? (
          <p className="xadmin-muted">Đang tải...</p>
        ) : items.length === 0 ? (
          <p className="xadmin-muted">Chưa có thông báo nào.</p>
        ) : (
          <div className="xadmin-table-scroll">
            <table className="xadmin-table">
              <thead><tr><th>Nội dung</th><th>Mã</th><th>Hết hạn</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {items.map((a) => {
                  const [label, cls] = statusOf(a);
                  return (
                    <tr key={a.id}>
                      <td>{a.text}</td>
                      <td>{a.couponCode || '—'}</td>
                      <td>{a.endsAt ? new Date(a.endsAt).toLocaleDateString('vi-VN') : '—'}</td>
                      <td><span className={cls}>{label}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="xadmin-btn-small" onClick={() => { setForm({ ...EMPTY_ANNOUNCEMENT, ...a }); setMsg(''); }}>Sửa</button>
                        <button type="button" className="xadmin-btn-small" onClick={() => toggleActive(a)}>{a.active === false ? 'Bật' : 'Tắt'}</button>
                        <button type="button" className="xadmin-btn-small danger" onClick={() => handleDelete(a)}>Xoá</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
