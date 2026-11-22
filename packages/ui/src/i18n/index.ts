import i18next from 'i18next';
import type { LangCode } from '@hocus/core';
import { en } from './en.ts';
import { hi } from './hi.ts';
import { ta } from './ta.ts';

export type UiKey = keyof typeof en;

void i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, hi: { translation: hi }, ta: { translation: ta } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function setUiLang(lang: LangCode) {
  void i18next.changeLanguage(lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function t(key: UiKey, params?: Record<string, string | number>): string {
  return i18next.t(key, params ?? {});
}
