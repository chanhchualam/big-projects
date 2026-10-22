// src/i18n/index.jsx
// Giao diện đa ngôn ngữ cho khách: Tiếng Việt (mặc định) và English.
// t('Chuỗi gốc', { n: 3 }) → tra từ điển theo ngôn ngữ đang chọn; không có bản dịch thì giữ chuỗi gốc.
// Chuỗi gốc là chữ đang viết trong code (tiếng Việt hoặc tiếng Anh), nên mỗi từ điển dịch sang ngôn ngữ của nó.
// Tiền tệ hiển thị (VNĐ / USD) chọn riêng; giá gốc của sản phẩm và đơn hàng vẫn lưu bằng USD.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import en from './en';
import vi from './vi';
import { usdToVnd, formatVndAmount } from '../utils/currency';

export const LANGUAGES = [
  { code: 'vi', label: 'VI', name: 'Tiếng Việt' },
  { code: 'en', label: 'EN', name: 'English' }
];
const DICTS = { vi, en };
const STORAGE_KEY = 'point-tcg-lang';
const CURRENCY_KEY = 'point-tcg-currency';

export const CURRENCIES = [
  { code: 'vnd', label: '₫ VND', name: 'Việt Nam Đồng' },
  { code: 'usd', label: '$ USD', name: 'US Dollar' }
];

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (DICTS[saved]) return saved;
  } catch {
    // localStorage không khả dụng
  }
  return 'vi';
}

let currentLang = initialLang();

function initialCurrency() {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (CURRENCIES.some((c) => c.code === saved)) return saved;
  } catch {
    // localStorage không khả dụng
  }
  return 'vnd';
}

let currentCurrency = initialCurrency();
export const getCurrency = () => currentCurrency;

// Giá USD → chuỗi theo tiền tệ đang chọn: "4.600.000₫" hoặc "$173.60"
export function formatMoney(usd, currency = currentCurrency) {
  if (currency === 'usd') return `$${(Number(usd) || 0).toFixed(2)}`;
  return formatVndAmount(usdToVnd(usd));
}

// Tiền tệ còn lại, để hiện kèm trong ngoặc ở chỗ cần cả hai (trang sản phẩm, thanh toán, đơn hàng)
export const formatMoneyAlt = (usd, currency = currentCurrency) =>
  formatMoney(usd, currency === 'usd' ? 'vnd' : 'usd');

// Dùng được cả ngoài component (utils tạo thông báo, nhãn trạng thái...)
export function translate(text, vars, lang = currentLang) {
  if (text == null) return '';
  let out = DICTS[lang]?.[text] ?? text;
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  }
  return out;
}

export const getLang = () => currentLang;
export const getLocale = (lang = currentLang) => (lang === 'en' ? 'en-US' : 'vi-VN');

const I18nContext = createContext({
  lang: currentLang,
  setLang: () => {},
  t: translate,
  currency: currentCurrency,
  setCurrency: () => {},
  money: formatMoney,
  moneyAlt: formatMoneyAlt
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);
  const [currency, setCurrencyState] = useState(currentCurrency);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // bỏ qua
    }
    document.documentElement.lang = next;
    setLangState(next);
  }, []);

  const setCurrency = useCallback((next) => {
    if (!CURRENCIES.some((c) => c.code === next)) return;
    currentCurrency = next;
    try {
      localStorage.setItem(CURRENCY_KEY, next);
    } catch {
      // bỏ qua
    }
    setCurrencyState(next);
  }, []);

  if (typeof document !== 'undefined') document.documentElement.lang = lang;

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (text, vars) => translate(text, vars, lang),
    currency,
    setCurrency,
    money: (usd) => formatMoney(usd, currency),
    moneyAlt: (usd) => formatMoneyAlt(usd, currency)
  }), [lang, setLang, currency, setCurrency]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
