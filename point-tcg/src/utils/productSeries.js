// src/utils/productSeries.js
// Nhóm sản phẩm theo dòng / bộ (series) để trang quản trị gom các sản phẩm liên quan vào một chỗ.
// Admin có thể tự đặt product.series; nếu để trống thì đoán từ tên sản phẩm.

export const OTHER_SERIES = 'Khác';

// Thứ tự quan trọng: tên cụ thể đứng trước tên chung (Ascended Heroes trước Mega Evolution)
const KNOWN_SERIES = [
  ['30th Celebration', /30th\s*(anniversary\s*)?celebration|celebration\s*anniversary|30th\s*anniversary/i],
  ['Ascended Heroes', /ascended\s*heroes/i],
  ['Prismatic Evolutions', /prismatic\s*evolutions?/i],
  ['Phantasmal Flames', /phantasmal\s*flames/i],
  ['Black Bolt & White Flare', /black\s*bolt|white\s*flare/i],
  ['Destined Rivals', /destined\s*rivals/i],
  ['Journey Together', /journey\s*together/i],
  ['Surging Sparks', /surging\s*sparks/i],
  ['Stellar Crown', /stellar\s*crown/i],
  ['Shrouded Fable', /shrouded\s*fable/i],
  ['Twilight Masquerade', /twilight\s*masquerade/i],
  ['Temporal Forces', /temporal\s*forces/i],
  ['Paldean Fates', /paldean\s*fates/i],
  ['Paradox Rift', /paradox\s*rift/i],
  ['Scarlet & Violet 151', /\b151\b/],
  ['Obsidian Flames', /obsidian\s*flames/i],
  ['Crown Zenith', /crown\s*zenith/i],
  ['Mega Evolution', /mega\s*evolution/i]
];

export function detectSeries(title = '') {
  const hit = KNOWN_SERIES.find(([, re]) => re.test(title));
  return hit ? hit[0] : '';
}

export function getProductSeries(product) {
  return (product?.series || '').trim() || detectSeries(product?.title) || OTHER_SERIES;
}

// [{ name, items }] — nhóm đông sản phẩm lên trước, "Khác" luôn cuối
export function groupProductsBySeries(products) {
  const map = new Map();
  products.forEach((p) => {
    const name = getProductSeries(p);
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(p);
  });
  return [...map.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      if (a.name === OTHER_SERIES) return 1;
      if (b.name === OTHER_SERIES) return -1;
      return b.items.length - a.items.length || a.name.localeCompare(b.name);
    });
}

export const knownSeriesNames = () => KNOWN_SERIES.map(([name]) => name);
