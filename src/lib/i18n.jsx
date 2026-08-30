import { createContext, useContext, useCallback, useEffect, useState } from 'react'

/**
 * Lightweight i18n for the AURN app.
 *
 * Three languages: English, 中文 (Simplified Chinese), 한국어 (Korean). The choice
 * is remembered per device. `useT()` returns a `t(key, fallback)` translator that
 * falls back to the key's English text (or the provided fallback) when a string
 * isn't translated yet, so the UI never shows a blank.
 */

export const LANGS = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh', label: '中文', short: '中' },
  { code: 'ko', label: '한국어', short: '한' },
]

const DICT = {
  // Navigation
  'nav.market': { en: 'Market', zh: '市场', ko: '마켓' },
  'nav.chat': { en: 'Chat', zh: '聊天', ko: '채팅' },
  'nav.portfolio': { en: 'Portfolio', zh: '资产', ko: '포트폴리오' },
  'nav.settings': { en: 'Settings', zh: '设置', ko: '설정' },
  'nav.launch': { en: 'Launch', zh: '发币', ko: '런치' },
  'nav.leaderboard': { en: 'Leaderboard', zh: '排行榜', ko: '리더보드' },

  // Wallet
  'wallet.connect': { en: 'Connect Wallet', zh: '连接钱包', ko: '지갑 연결' },
  'wallet.connecting': { en: 'Connecting…', zh: '连接中…', ko: '연결 중…' },
  'wallet.disconnect': { en: 'Disconnect', zh: '断开连接', ko: '연결 해제' },

  // Common actions
  'action.buy': { en: 'Buy', zh: '买入', ko: '매수' },
  'action.sell': { en: 'Sell', zh: '卖出', ko: '매도' },
  'action.trade': { en: 'Trade', zh: '交易', ko: '거래' },
  'action.chat': { en: 'Chat', zh: '聊天', ko: '채팅' },
  'action.viewAll': { en: 'View all', zh: '查看全部', ko: '전체 보기' },
  'action.back': { en: 'Back', zh: '返回', ko: '뒤로' },

  // Market / discover
  'market.title': { en: 'Market', zh: '市场', ko: '마켓' },
  'market.trending': { en: 'Trending', zh: '热门', ko: '인기' },
  'market.new': { en: 'New', zh: '最新', ko: '신규' },
  'market.marketCap': { en: 'Market cap', zh: '市值', ko: '시가총액' },
  'market.price': { en: 'Price', zh: '价格', ko: '가격' },
  'market.holders': { en: 'Holders', zh: '持有者', ko: '홀더' },
  'market.supply': { en: 'Supply', zh: '供应量', ko: '공급량' },
  'market.search': { en: 'Search coins…', zh: '搜索代币…', ko: '코인 검색…' },

  // Settings
  'settings.title': { en: 'Settings', zh: '设置', ko: '설정' },
  'settings.language': { en: 'Language', zh: '语言', ko: '언어' },
  'settings.appearance': { en: 'Appearance', zh: '外观', ko: '테마' },

  // Language switcher
  'lang.choose': { en: 'Language', zh: '语言', ko: '언어' },
}

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k, f) => f || k })
const STORAGE_KEY = 'aurn:lang'

function detectInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGS.some((l) => l.code === saved)) return saved
  } catch { /* storage blocked */ }
  try {
    const nav = (navigator.language || 'en').toLowerCase()
    if (nav.startsWith('zh')) return 'zh'
    if (nav.startsWith('ko')) return 'ko'
  } catch { /* no navigator */ }
  return 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en')

  useEffect(() => { setLangState(detectInitial()) }, [])
  useEffect(() => {
    try { document.documentElement.lang = lang } catch { /* ignore */ }
  }, [lang])

  const setLang = useCallback((code) => {
    if (!LANGS.some((l) => l.code === code)) return
    setLangState(code)
    try { localStorage.setItem(STORAGE_KEY, code) } catch { /* ignore */ }
  }, [])

  const t = useCallback((key, fallback) => {
    const entry = DICT[key]
    if (!entry) return fallback != null ? fallback : key
    return entry[lang] || entry.en || (fallback != null ? fallback : key)
  }, [lang])

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  const { lang, setLang } = useContext(LangContext)
  return { lang, setLang }
}

export function useT() {
  return useContext(LangContext).t
}
