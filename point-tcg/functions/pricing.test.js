// Chạy: cd functions && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderPrice, parseOrderIdFromContent, shippingFeeOf, VND_RATE } from './pricing.js';

const products = new Map([['a', { price: 50 }], ['b', { price: 10 }]]);
const baseOrder = {
  items: [{ id: 'a', title: 'A', price: 50, qty: 2 }],
  shippingMethod: 'Tiêu chuẩn (Tamper-Proof Box)',
  couponCode: '',
  total: 100
};

test('đơn hợp lệ không có cảnh báo', () => {
  const r = computeOrderPrice(baseOrder, products, null);
  assert.deepEqual(r.issues, []);
  assert.equal(r.total, 100);
  assert.equal(r.amountVnd, 2650000);
});

test('phát hiện khách sửa đơn giá', () => {
  const r = computeOrderPrice({ ...baseOrder, items: [{ id: 'a', title: 'A', price: 1, qty: 2 }], total: 2 }, products, null);
  assert.equal(r.total, 100);
  assert.equal(r.issues.length, 2);
});

test('ship tiêu chuẩn 8.5 khi dưới 75, miễn phí với mã freeShip', () => {
  const small = { ...baseOrder, items: [{ id: 'b', title: 'B', price: 10, qty: 1 }], total: 18.5 };
  assert.deepEqual(computeOrderPrice(small, products, null).issues, []);
  const withCoupon = { ...small, couponCode: 'FREESHIP', total: 10 };
  assert.deepEqual(computeOrderPrice(withCoupon, products, { freeShip: true, percent: 0 }).issues, []);
});

test('mã giảm % và mã không tồn tại', () => {
  const r = computeOrderPrice({ ...baseOrder, couponCode: 'SALE10', total: 90 }, products, { percent: 10 });
  assert.deepEqual(r.issues, []);
  const bad = computeOrderPrice({ ...baseOrder, couponCode: 'FAKE', total: 90 }, products, null);
  assert.ok(bad.issues.some((i) => i.includes('FAKE')));
});

test('đọc mã đơn từ nội dung chuyển khoản', () => {
  assert.deepEqual(parseOrderIdFromContent('PTCG PTCG-12345678'), ['PTCG-12345678']);
  assert.deepEqual(parseOrderIdFromContent('MBVCB.123 ptcg ptcg12345678 FT2610'), ['PTCG-12345678']);
  assert.deepEqual(parseOrderIdFromContent('chuyen tien'), []);
});

import { computeLimitIssues, depositPercentOf } from './pricing.js';

test('đặt trước: tiền cọc đúng 30% không có cảnh báo', () => {
  const pre = new Map([['p', { price: 100, preorder: true, depositPercent: 30 }]]);
  const order = { items: [{ id: 'p', title: 'P', price: 100, qty: 1 }], shippingMethod: 'Tiêu chuẩn', couponCode: '', total: 100,
    isPreorder: true, preorderProductId: 'p', depositPercent: 30, depositVnd: 795000 };
  const r = computeOrderPrice(order, pre, null);
  assert.deepEqual(r.issues, []);
  assert.equal(r.depositVnd, 795000);
});

test('đặt trước: khách sửa tiền cọc / tỷ lệ cọc bị phát hiện', () => {
  const pre = new Map([['p', { price: 100, preorder: true, depositPercent: 30 }]]);
  const order = { items: [{ id: 'p', title: 'P', price: 100, qty: 1 }], shippingMethod: 'Tiêu chuẩn', couponCode: '', total: 100,
    isPreorder: true, preorderProductId: 'p', depositPercent: 10, depositVnd: 265000 };
  const r = computeOrderPrice(order, pre, null);
  assert.equal(r.issues.length, 2);
});

test('đặt trước: sản phẩm đã tắt đặt trước bị cảnh báo', () => {
  const pre = new Map([['p', { price: 100, preorder: false, depositPercent: 30 }]]);
  const order = { items: [{ id: 'p', title: 'P', price: 100, qty: 1 }], shippingMethod: 'Tiêu chuẩn', couponCode: '', total: 100,
    isPreorder: true, preorderProductId: 'p', depositPercent: 30, depositVnd: 795000 };
  assert.ok(computeOrderPrice(order, pre, null).issues.some((i) => i.includes('không còn nhận đặt trước')));
});

test('tỷ lệ cọc giới hạn trong 10–100%, mặc định 30%', () => {
  assert.equal(depositPercentOf({ depositPercent: 5 }), 10);
  assert.equal(depositPercentOf({ depositPercent: 150 }), 100);
  assert.equal(depositPercentOf({}), 30);
});

test('giới hạn mỗi khách: gộp đơn cùng SĐT khác tài khoản, bỏ qua đơn huỷ', () => {
  const prods = new Map([['a', { price: 50, maxPerCustomer: 2 }]]);
  const order = { id: 'o3', uid: 'u2', customerPhone: '+84 912 345 678', items: [{ id: 'a', title: 'A', qty: 1 }] };
  const history = [
    { id: 'o1', uid: 'u1', customerPhone: '0912345678', status: 'Giao thành công', items: [{ id: 'a', qty: 2 }] },
    { id: 'o2', uid: 'u1', customerPhone: '0912345678', status: 'Đã huỷ', items: [{ id: 'a', qty: 5 }] },
    order
  ];
  const issues = computeLimitIssues(order, history, prods);
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes('đã đặt 3'));
});

test('giới hạn mỗi khách: trong giới hạn thì không cảnh báo', () => {
  const prods = new Map([['a', { price: 50, maxPerCustomer: 2 }]]);
  const order = { id: 'o1', uid: 'u1', customerPhone: '0912345678', items: [{ id: 'a', title: 'A', qty: 2 }] };
  assert.deepEqual(computeLimitIssues(order, [order], prods), []);
});

// Bảng phí ship mới (shippingVersion 2): phí VNĐ, từ sản phẩm thứ 5 cứ mỗi 2 sản phẩm cộng một mức phụ thu
test('ship v2: 1–4 sản phẩm 30.000đ / hoả tốc 50.000đ', () => {
  const o = { shippingVersion: 2, shippingMethod: 'Tiêu chuẩn', items: [{ qty: 4 }] };
  assert.equal(Math.round(shippingFeeOf(o, 10, false) * VND_RATE), 30000);
  assert.equal(Math.round(shippingFeeOf({ ...o, shippingMethod: 'Hoả tốc' }, 10, false) * VND_RATE), 50000);
});

test('ship v2: 5–6 sản phẩm phụ thu 1 mức, 7–8 sản phẩm 2 mức', () => {
  const fee = (qty, m = 'Tiêu chuẩn') => Math.round(shippingFeeOf({ shippingVersion: 2, shippingMethod: m, items: [{ qty }] }, 10, false) * VND_RATE);
  assert.equal(fee(5), 45000);
  assert.equal(fee(6), 45000);
  assert.equal(fee(7), 60000);
  assert.equal(fee(6, 'Hoả tốc'), 75000);
  assert.equal(fee(8, 'Hoả tốc'), 100000);
});

test('ship v2: miễn phí tiêu chuẩn từ $75 / mã freeShip, hoả tốc vẫn tính phí', () => {
  const o = { shippingVersion: 2, shippingMethod: 'Tiêu chuẩn', items: [{ qty: 6 }] };
  assert.equal(shippingFeeOf(o, 80, false), 0);
  assert.equal(shippingFeeOf(o, 10, true), 0);
  assert.equal(Math.round(shippingFeeOf({ ...o, shippingMethod: 'Hoả tốc' }, 80, false) * VND_RATE), 75000);
});

test('đơn cũ (không có shippingVersion) vẫn tính phí cũ $8.5 / $15', () => {
  assert.equal(shippingFeeOf({ shippingMethod: 'Tiêu chuẩn', items: [{ qty: 6 }] }, 10, false), 8.5);
  assert.equal(shippingFeeOf({ shippingMethod: 'Hoả tốc', items: [{ qty: 1 }] }, 10, false), 15);
});

test('ship v2: tổng đơn 6 sản phẩm khớp số VNĐ chuyển khoản', () => {
  const fee = 45000 / VND_RATE;
  const order = { shippingVersion: 2, shippingMethod: 'Tiêu chuẩn', couponCode: '', items: [{ id: 'b', title: 'B', price: 10, qty: 6 }], total: 60 + fee };
  const r = computeOrderPrice(order, new Map([['b', { price: 10 }]]), null);
  assert.deepEqual(r.issues, []);
  assert.equal(r.amountVnd, Math.round((60 * VND_RATE + 45000) / 1000) * 1000);
});
