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

  // Market / Explore screen
  'explore.title': { en: 'Explore coins', zh: '探索代币', ko: '코인 둘러보기' },
  'explore.search': { en: 'Search…', zh: '搜索…', ko: '검색…' },
  'explore.badge.grad': { en: 'Grad', zh: '毕业', ko: '졸업' },
  'explore.noMatch': { en: 'No coins match', zh: '没有匹配的代币', ko: '일치하는 코인이 없어요' },
  'explore.noStock': { en: 'No stock-paired coins yet.', zh: '暂无股票配对代币。', ko: '아직 주식 페어 코인이 없어요.' },
  'explore.emptyTitle': { en: 'No coins yet', zh: '还没有代币', ko: '아직 코인이 없어요' },
  'explore.emptyBody': { en: 'Be the first - mint a token that thinks, talks, and trades on AURN.', zh: '成为第一个 - 在 AURN 铸造一个会思考、会说话、可交易的代币。', ko: '첫 주자가 되어보세요 - AURN에서 생각하고 말하고 거래되는 코인을 만들어보세요.' },
  'explore.emptyCta': { en: 'Launch the first coin', zh: '发射第一个代币', ko: '첫 코인 런치하기' },
  'filter.trending': { en: 'Trending', zh: '热门', ko: '인기' },
  'filter.stock': { en: 'Stock Paired', zh: '股票配对', ko: '주식 페어' },
  'filter.gainers': { en: 'Top Gainers', zh: '涨幅榜', ko: '상승률' },
  'filter.new': { en: 'New', zh: '最新', ko: '신규' },

  // Portfolio screen
  'portfolio.yourTitle': { en: 'Your portfolio', zh: '你的资产', ko: '내 포트폴리오' },
  'portfolio.connectBody': { en: 'Connect your wallet to see its balance and every coin it holds.', zh: '连接钱包以查看余额和持有的所有代币。', ko: '지갑을 연결하면 잔액과 보유 코인을 모두 볼 수 있어요.' },
  'portfolio.verified': { en: 'Verified', zh: '已验证', ko: '인증됨' },
  'portfolio.totalValue': { en: 'Total value', zh: '总价值', ko: '총 가치' },
  'portfolio.ethBalance': { en: 'ETH balance', zh: 'ETH 余额', ko: 'ETH 잔액' },
  'portfolio.coinsHeld': { en: 'Coins held', zh: '持有代币', ko: '보유 코인' },
  'portfolio.launchCoin': { en: 'Launch a coin', zh: '发射代币', ko: '코인 런치' },
  'portfolio.holdings': { en: 'Holdings', zh: '持仓', ko: '보유 자산' },
  'portfolio.noCoins': { en: 'No coins held', zh: '暂无持仓', ko: '보유 코인 없음' },
  'portfolio.readingWallet': { en: 'Reading your wallet…', zh: '正在读取钱包…', ko: '지갑을 읽는 중…' },
  'portfolio.noCoinsSub': { en: 'Coins you buy or launch will show up here, priced live.', zh: '你买入或发射的代币会在这里显示，实时定价。', ko: '매수하거나 런치한 코인이 여기에 실시간 가격으로 표시돼요.' },
  'portfolio.scanningSub': { en: 'Scanning balances on Robinhood Chain.', zh: '正在扫描 Robinhood Chain 上的余额。', ko: 'Robinhood Chain에서 잔액을 스캔하는 중이에요.' },
  'common.refresh': { en: 'Refresh', zh: '刷新', ko: '새로고침' },
  'common.reading': { en: 'Reading…', zh: '读取中…', ko: '불러오는 중…' },

  // Launch flow
  'action.next': { en: 'Next', zh: '下一步', ko: '다음' },
  'action.continue': { en: 'Continue', zh: '继续', ko: '계속' },
  'launch.identity': { en: 'Identity', zh: '身份', ko: '아이덴티티' },
  'launch.nameTitle': { en: 'Name your agent.', zh: '为你的代理命名。', ko: '에이전트의 이름을 정하세요.' },
  'launch.ticker': { en: 'Coin ticker', zh: '代币符号', ko: '코인 티커' },
  'launch.tickerHint': { en: 'follows the name', zh: '跟随名称', ko: '이름을 따라감' },
  'launch.idea': { en: 'Idea', zh: '灵感', ko: '아이디어' },
  'launch.lookTitle': { en: 'What does {name} look like?', zh: '{name} 长什么样？', ko: '{name}의 모습은 어떤가요?' },
  'launch.gender': { en: 'Gender', zh: '性别', ko: '성별' },
  'launch.style': { en: 'Style', zh: '风格', ko: '스타일' },
  'launch.image': { en: 'Image', zh: '图片', ko: '이미지' },
  'launch.changeImage': { en: 'Change image', zh: '更换图片', ko: '이미지 변경' },
  'launch.uploadImage': { en: 'Upload image', zh: '上传图片', ko: '이미지 업로드' },
  'launch.remove': { en: 'Remove', zh: '移除', ko: '제거' },
  'launch.logoHint': { en: 'Shown as the coin logo', zh: '将作为代币徽标显示', ko: '코인 로고로 표시됩니다' },
  'launch.lookPlaceholder': { en: 'Pick a style, then describe {name}: colors, symbol, mood, details.', zh: '选择风格，然后描述 {name}：颜色、符号、氛围、细节。', ko: '스타일을 고른 뒤 {name}을(를) 묘사하세요: 색상, 상징, 분위기, 디테일.' },
  'launch.generate': { en: 'Generate {name}', zh: '生成 {name}', ko: '{name} 생성' },
  'launch.lookHelp': { en: 'Upload an image to use it directly, or let AI generate one from your description.', zh: '上传图片直接使用，或让 AI 根据你的描述生成。', ko: '이미지를 업로드해 바로 사용하거나, AI가 설명을 바탕으로 생성하게 하세요.' },
  'launch.ready': { en: 'The look is ready.', zh: '外观已就绪。', ko: '모습이 준비됐어요.' },
  'launch.editLook': { en: 'Edit look', zh: '编辑外观', ko: '모습 편집' },
  'launch.generating': { en: 'Generating {name}…', zh: '正在生成 {name}…', ko: '{name} 생성 중…' },
  'launch.soulTitle': { en: 'Give {name} a soul.', zh: '为 {name} 注入灵魂。', ko: '{name}에게 영혼을 불어넣으세요.' },
  'launch.vibe': { en: 'Vibe', zh: '氛围', ko: '바이브' },
  'launch.upTo5': { en: 'up to 5', zh: '最多 5 个', ko: '최대 5개' },
  'launch.personality': { en: 'Personality', zh: '性格', ko: '성격' },
  'launch.upTo3': { en: 'up to 3', zh: '最多 3 个', ko: '최대 3개' },
  'launch.more': { en: 'more', zh: '更多', ko: '더보기' },
  'launch.anythingElse': { en: 'Anything else', zh: '其他补充', ko: '그 밖에' },
  'launch.optional': { en: 'optional', zh: '可选', ko: '선택' },
  'launch.soulPlaceholder': { en: 'Add any extra traits, behaviours or details that define {name}.', zh: '添加任何定义 {name} 的额外特质、行为或细节。', ko: '{name}을(를) 규정하는 추가 특성, 행동, 디테일을 넣어보세요.' },
  'launch.firstBuy': { en: 'Your first buy (ETH)', zh: '你的首次买入 (ETH)', ko: '첫 매수 (ETH)' },
  'launch.reviewTitle': { en: 'One last look.', zh: '最后确认一下。', ko: '마지막으로 확인하세요.' },
  'launch.model': { en: 'Launch model', zh: '发射模式', ko: '런치 방식' },
  'launch.v1Title': { en: 'Instant Pool', zh: '即时流动池', ko: '즉시 풀' },
  'launch.v1Desc': { en: 'One tx deploys the token + a locked Uniswap V3 pool (WETH). Tradable at once - open, no whitelist.', zh: '一笔交易部署代币 + 锁定的 Uniswap V3 池 (WETH)。立即可交易，开放且无白名单。', ko: '한 번의 트랜잭션으로 토큰과 잠긴 Uniswap V3 풀(WETH)을 배포합니다. 즉시 거래 가능, 화이트리스트 없음.' },
  'launch.v2Title': { en: 'Bonding Curve', zh: '联合曲线', ko: '본딩 커브' },
  'launch.v2Desc': { en: 'Fair launch on a bonding curve that graduates to Uniswap V4. Whitelist-gated on-chain.', zh: '在联合曲线上公平发射，毕业后进入 Uniswap V4。链上白名单限制。', ko: '본딩 커브에서 공정하게 시작해 Uniswap V4로 졸업합니다. 온체인 화이트리스트 적용.' },
  'launch.pairedAsset': { en: 'Paired asset', zh: '配对资产', ko: '페어 자산' },
  'launch.creatorTax': { en: 'Creator tax', zh: '创作者税', ko: '크리에이터 수수료' },
  'launch.description': { en: 'Description', zh: '简介', ko: '설명' },
  'launch.autoAi': { en: 'auto-written by AI', zh: 'AI 自动撰写', ko: 'AI가 자동 작성' },
  'launch.regenerate': { en: 'Regenerate', zh: '重新生成', ko: '다시 생성' },
  'launch.descBusyPh': { en: 'Writing a description…', zh: '正在撰写简介…', ko: '설명을 작성하는 중…' },
  'launch.descPh': { en: 'Generating from your agent - or write your own.', zh: '正在根据你的代理生成，或自行撰写。', ko: '에이전트로부터 생성 중 - 직접 작성해도 됩니다.' },
  'launch.network': { en: 'Network', zh: '网络', ko: '네트워크' },
  'launch.supply': { en: 'Supply', zh: '供应量', ko: '공급량' },
  'launch.liquidity': { en: 'Liquidity', zh: '流动性', ko: '유동성' },
  'launch.launchFee': { en: 'Launch fee', zh: '发射费用', ko: '런치 수수료' },
  'launch.launchFeeLive': { en: 'Read live from factory', zh: '从工厂实时读取', ko: '팩토리에서 실시간 조회' },
  'launch.signsWith': { en: 'Signs with', zh: '签名账户', ko: '서명 계정' },
  'launch.launching': { en: 'Launching…', zh: '发射中…', ko: '런치 중…' },
  'launch.connectToLaunch': { en: 'Connect Wallet to launch', zh: '连接钱包以发射', ko: '지갑 연결 후 런치' },
  'launch.deploy': { en: 'Deploy', zh: '部署', ko: '배포' },
  'launch.reviewFooter': { en: 'Non-custodial launch on Robinhood Chain via Pons - signed by your own wallet.', zh: '通过 Pons 在 Robinhood Chain 上的非托管发射，由你自己的钱包签名。', ko: 'Pons를 통해 Robinhood Chain에서 비수탁 방식으로 런치하며, 본인 지갑으로 서명합니다.' },
  'launch.live': { en: 'Live on Robinhood Chain', zh: '已在 Robinhood Chain 上线', ko: 'Robinhood Chain에 라이브' },
  'launch.isLive': { en: '{name} is live.', zh: '{name} 已上线。', ko: '{name} 출시 완료.' },
  'launch.doneDesc': { en: 'Launched via Pons on Robinhood Chain - tradeable now, with creator fees flowing to your wallet.', zh: '通过 Pons 在 Robinhood Chain 上发射，现已可交易，创作者费用直接流入你的钱包。', ko: 'Robinhood Chain에서 Pons로 런치되었습니다 - 지금 거래 가능하며, 크리에이터 수수료가 지갑으로 들어옵니다.' },
  'launch.viewTx': { en: 'View transaction', zh: '查看交易', ko: '트랜잭션 보기' },
  'launch.backToDiscover': { en: 'Back to Discover', zh: '返回探索', ko: '둘러보기로 돌아가기' },
  'launch.final': { en: 'Final', zh: '完成', ko: '마무리' },
  'launch.searchAsset': { en: 'Search asset…', zh: '搜索资产…', ko: '자산 검색…' },

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
