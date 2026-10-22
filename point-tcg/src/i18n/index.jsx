// src/i18n/index.jsx
// Giao diện đa ngôn ngữ cho khách: Tiếng Việt (mặc định) và English.
// t('Chuỗi gốc', { n: 3 }) → tra từ điển theo ngôn ngữ đang chọn; không có bản dịch thì giữ chuỗi gốc.
// Chuỗi gốc là chữ đang viết trong code (tiếng Việt hoặc tiếng Anh), nên mỗi từ điển dịch sang ngôn ngữ của nó.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import en from './en';
import vi from './vi';

export const LANGUAGES = [
  { code: 'vi', label: 'VI', name: 'Tiếng Việt' },
  { code: 'en', label: 'EN', name: 'English' }
];
const DICTS = { vi, en };
const STORAGE_KEY = 'point-tcg-lang';

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

const I18nContext = createContext({ lang: currentLang, setLang: () => {}, t: translate });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

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

  if (typeof document !== 'undefined') document.documentElement.lang = lang;

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (text, vars) => translate(text, vars, lang)
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
