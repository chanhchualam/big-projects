// Chạy: cd functions && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderPrice, parseOrderIdFromContent } from './pricing.js';

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
