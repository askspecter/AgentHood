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
  'settings.account': { en: 'Account', zh: '账户', ko: '계정' },
  'settings.editProfile': { en: 'Edit profile', zh: '编辑资料', ko: '프로필 편집' },
  'settings.rewards': { en: 'Rewards', zh: '奖励', ko: '리워드' },
  'settings.locked': { en: 'Locked', zh: '锁仓', ko: '잠금' },
  'settings.referral': { en: 'Referral code', zh: '邀请码', ko: '추천 코드' },
  'settings.aiAccess': { en: 'AI access (MCP)', zh: 'AI 接入 (MCP)', ko: 'AI 액세스 (MCP)' },
  'settings.resources': { en: 'Resources', zh: '资源', ko: '리소스' },
  'settings.about': { en: 'About AURN', zh: '关于 AURN', ko: 'AURN 소개' },
  'settings.terms': { en: 'Terms of service', zh: '服务条款', ko: '서비스 약관' },
  'settings.privacy': { en: 'Privacy policy', zh: '隐私政策', ko: '개인정보 처리방침' },
  'settings.followX': { en: 'Follow us on X', zh: '在 X 上关注我们', ko: 'X에서 팔로우' },
  'settings.support': { en: 'Support', zh: '支持', ko: '지원' },
  'settings.docs': { en: 'Documentation', zh: '文档', ko: '문서' },
  'settings.disconnect': { en: 'Disconnect wallet', zh: '断开钱包', ko: '지갑 연결 해제' },
  'settings.version': { en: 'AURN v0.1.0', zh: 'AURN v0.1.0', ko: 'AURN v0.1.0' },

  // Common
  'common.discover': { en: 'Discover', zh: '探索', ko: '둘러보기' },
  'common.copied': { en: 'Copied', zh: '已复制', ko: '복사됨' },
  'common.copy': { en: 'Copy', zh: '复制', ko: '복사' },
  'common.done': { en: 'Done', zh: '完成', ko: '완료' },
  'common.reset': { en: 'Reset', zh: '重置', ko: '초기화' },
  'common.or': { en: 'or', zh: '或', ko: '또는' },
  'common.tryAgain': { en: 'Try again', zh: '重试', ko: '다시 시도' },
  'common.working': { en: 'Working…', zh: '处理中…', ko: '처리 중…' },
  'common.loadingAgent': { en: 'Loading agent…', zh: '正在加载代理…', ko: '에이전트 불러오는 중…' },

  // Chats list
  'chats.title': { en: 'Chats', zh: '聊天', ko: '채팅' },
  'chats.subtitle': { en: 'Every coin on Robinhood Chain is an agent. Talk to it, then trade it.', zh: 'Robinhood Chain 上的每个代币都是一个代理。先聊天，再交易。', ko: 'Robinhood Chain의 모든 코인은 에이전트예요. 대화하고, 거래하세요.' },
  'chats.talkAnother': { en: 'Talk to another coin', zh: '和另一个代币聊天', ko: '다른 코인과 대화하기' },
  'chats.start': { en: 'Start a conversation', zh: '开始对话', ko: '대화 시작하기' },
  'chats.loading': { en: 'Loading agents…', zh: '正在加载代理…', ko: '에이전트 불러오는 중…' },
  'chats.noneA': { en: 'No coins available to chat with yet.', zh: '暂时还没有可聊天的代币。', ko: '아직 대화할 코인이 없어요.' },
  'chats.launchOne': { en: 'launch one', zh: '发射一个', ko: '하나 런치하기' },
  'chats.youPrefix': { en: 'You: ', zh: '你：', ko: '나: ' },

  // Chat thread
  'chat.notFound': { en: 'Agent not found.', zh: '未找到代理。', ko: '에이전트를 찾을 수 없어요.' },
  'chat.backToChats': { en: 'Back to chats', zh: '返回聊天', ko: '채팅으로 돌아가기' },
  'chat.online': { en: 'Online', zh: '在线', ko: '온라인' },
  'chat.messagePh': { en: 'Message {name}', zh: '给 {name} 发消息', ko: '{name}에게 메시지' },
  'chat.send': { en: 'Send', zh: '发送', ko: '보내기' },
  'chat.starter1': { en: 'gm, how are you?', zh: 'gm，最近怎么样？', ko: 'gm, 잘 지내?' },
  'chat.starter2': { en: "what's your deal, {name}?", zh: '{name}，你是干嘛的？', ko: '{name}, 넌 뭐 하는 코인이야?' },
  'chat.starter3': { en: 'should I buy?', zh: '我该买吗？', ko: '사야 할까?' },
  'chat.starter4': { en: 'how is your market cap?', zh: '你的市值怎么样？', ko: '시가총액은 어때?' },
  'chat.disclaimer': { en: '${ticker} speaks for itself - playful, not financial advice. The coin is real; trade it anytime.', zh: '${ticker} 有它自己的个性 - 只是好玩，并非投资建议。代币是真实的，随时可交易。', ko: '${ticker}는 스스로 말해요 - 재미일 뿐, 투자 조언이 아니에요. 코인은 진짜이고 언제든 거래할 수 있어요.' },

  // Coin detail
  'charm.graduated': { en: 'Graduated', zh: '已毕业', ko: '졸업' },
  'charm.chatWith': { en: 'Chat with {name}', zh: '和 {name} 聊天', ko: '{name}와 대화하기' },
  'charm.about': { en: 'About', zh: '简介', ko: '소개' },
  'charm.viewExplorer': { en: 'View on explorer', zh: '在区块浏览器查看', ko: '익스플로러에서 보기' },
  'action.share': { en: 'Share', zh: '分享', ko: '공유' },

  // Leaderboard
  'lb.tabCreator': { en: 'Top creator', zh: '顶级创作者', ko: '톱 크리에이터' },
  'lb.tabVolume': { en: 'Trade volume', zh: '交易量', ko: '거래량' },
  'lb.tabReferral': { en: 'Top referral', zh: '顶级推荐', ko: '톱 추천인' },
  'lb.loadError': { en: 'Couldn’t load the board', zh: '无法加载榜单', ko: '보드를 불러올 수 없어요' },
  'lb.loadErrorBody': { en: 'The network was slow just now. Give it another try.', zh: '刚才网络有点慢，请再试一次。', ko: '방금 네트워크가 느렸어요. 다시 시도해 주세요.' },
  'lb.creatorTitle': { en: 'Creator board is warming up', zh: '创作者榜单正在预热', ko: '크리에이터 보드가 준비 중이에요' },
  'lb.creatorBody': { en: 'This ranks people by the coins they launch on AURN - measured by the market cap they create here. It fills in as coins are launched; launch one to take the top spot.', zh: '此榜单按用户在 AURN 上发射的代币排名，以他们在此创造的市值衡量。随着代币发射而填充；发射一个即可登顶。', ko: 'AURN에서 런치한 코인의 시가총액으로 순위를 매겨요. 코인이 런치될수록 채워지며, 하나 런치하면 1위를 차지할 수 있어요.' },
  'lb.volumeTitle': { en: 'Trade volume board is warming up', zh: '交易量榜单正在预热', ko: '거래량 보드가 준비 중이에요' },
  'lb.volumeBody': { en: 'This ranks the accounts trading the most on AURN, by real WETH volume as swaps settle on-chain - no placeholder names. It fills in as trading picks up here.', zh: '此榜单按在 AURN 上交易最多的账户排名，以链上结算的真实 WETH 交易量衡量，没有占位名称。随着交易增多而填充。', ko: '온체인에서 체결된 실제 WETH 거래량 기준으로 AURN에서 가장 많이 거래한 계정을 순위 매겨요. 거래가 늘수록 채워져요.' },
  'lb.referralTitle': { en: 'Referral board is warming up', zh: '推荐榜单正在预热', ko: '추천 보드가 준비 중이에요' },
  'lb.referralBody': { en: 'Share your referral link from the Referral page. Once friends sign in through it, the biggest referrers show up here - ranked by real sign-ups, nothing invented.', zh: '在推荐页面分享你的推荐链接。当朋友通过它登录后，推荐最多的人会显示在这里，按真实注册数排名。', ko: '추천 페이지에서 링크를 공유하세요. 친구가 그 링크로 로그인하면 최다 추천인이 여기 표시돼요. 실제 가입 기준이에요.' },
  'lb.footCreator': { en: 'Ranked by total market cap of coins launched on AURN · priced live on-chain', zh: '按在 AURN 发射代币的总市值排名 · 链上实时定价', ko: 'AURN에서 런치한 코인의 총 시가총액 기준 · 온체인 실시간 가격' },
  'lb.footVolume': { en: 'Ranked by cumulative WETH traded on AURN · updates as swaps settle', zh: '按在 AURN 累计 WETH 交易量排名 · 随交易结算更新', ko: 'AURN에서 누적 거래된 WETH 기준 · 체결될 때마다 갱신' },
  'lb.footReferral': { en: 'Ranked by friends who signed in through your referral link', zh: '按通过你的推荐链接登录的朋友数排名', ko: '추천 링크로 로그인한 친구 수 기준' },
  'lb.volumeTraded': { en: 'volume traded', zh: '交易量', ko: '거래량' },
  'lb.friendsJoined': { en: 'friends joined', zh: '位朋友加入', ko: '명 가입' },
  'lb.friendJoined': { en: 'friend joined', zh: '位朋友加入', ko: '명 가입' },
  'lb.mcapCreated': { en: 'mcap created', zh: '创造市值', ko: '창출 시총' },
  'lb.coins': { en: 'coins', zh: '个代币', ko: '개 코인' },
  'lb.coin': { en: 'coin', zh: '个代币', ko: '개 코인' },
  'lb.top': { en: 'top', zh: '最高', ko: '최고' },

  // Rewards
  'reward.holdEarn': { en: 'Hold $AURN · earn the pool', zh: '持有 $AURN · 赚取奖池', ko: '$AURN 보유 · 풀 획득' },
  'reward.connectCheck': { en: 'Connect to check your rewards.', zh: '连接钱包查看你的奖励。', ko: '지갑을 연결해 리워드를 확인하세요.' },
  'reward.held': { en: '$AURN held', zh: '持有 $AURN', ko: '$AURN 보유' },
  'reward.ofSupply': { en: 'of supply', zh: '占供应量', ko: '공급량 대비' },
  'reward.pastePh': { en: 'Paste any 0x address to check…', zh: '粘贴任意 0x 地址查询…', ko: '확인할 0x 주소를 붙여넣으세요…' },
  'reward.checkingAddress': { en: 'address', zh: '地址', ko: '주소' },
  'reward.checkingWallet': { en: 'your wallet', zh: '你的钱包', ko: '내 지갑' },
  'reward.checking': { en: 'Checking', zh: '正在查询', ko: '확인 중' },
  'reward.checkAnother': { en: 'Check another', zh: '查询其他', ko: '다른 주소 확인' },
  'reward.epochTitle': { en: "This epoch's rewards", zh: '本轮奖励', ko: '이번 에폭 리워드' },
  'reward.left': { en: 'left', zh: '剩余', ko: '남음' },
  'reward.pool': { en: 'pool', zh: '奖池', ko: '풀' },
  'reward.footer': { en: 'Estimated from the current pool and your live $AURN balance, split across the supply. Rewards accrue to holders each epoch - keep holding $AURN to keep earning. Non-custodial: AURN never holds your keys.', zh: '根据当前奖池和你实时的 $AURN 余额估算，按总供应量分配。奖励每轮累积给持有者 - 持续持有 $AURN 即可持续赚取。非托管：AURN 永不持有你的私钥。', ko: '현재 풀과 실시간 $AURN 잔액을 공급량에 나눠 추정한 값이에요. 리워드는 매 에폭 홀더에게 쌓여요 - $AURN을 계속 보유하면 계속 받아요. 비수탁: AURN은 절대 키를 보관하지 않아요.' },

  // Referral
  'ref.connectBody': { en: 'Connect your wallet to get your personal referral code and link.', zh: '连接钱包以获取你的专属推荐码和链接。', ko: '지갑을 연결하면 개인 추천 코드와 링크를 받을 수 있어요.' },
  'ref.yourCode': { en: 'Your code', zh: '你的推荐码', ko: '내 코드' },
  'ref.copyCode': { en: 'Copy code', zh: '复制推荐码', ko: '코드 복사' },
  'ref.inviteLink': { en: 'Invite link', zh: '邀请链接', ko: '초대 링크' },
  'ref.shareInvite': { en: 'Share invite', zh: '分享邀请', ko: '초대 공유' },
  'ref.howTitle': { en: 'How it works', zh: '运作方式', ko: '작동 방식' },
  'ref.step1': { en: 'Share your code or link with a friend.', zh: '把你的推荐码或链接分享给朋友。', ko: '코드나 링크를 친구에게 공유하세요.' },
  'ref.step2': { en: 'They connect their wallet through your link.', zh: '他们通过你的链接连接钱包。', ko: '친구가 링크로 지갑을 연결해요.' },
  'ref.step3': { en: 'You climb the referral leaderboard as friends join.', zh: '随着朋友加入，你在推荐榜上攀升。', ko: '친구가 늘수록 추천 리더보드 순위가 올라가요.' },
  'ref.shareText': { en: 'Trade agents on AURN - real coins on Robinhood Chain. Join with my code {code}:', zh: '在 AURN 交易代理 - Robinhood Chain 上的真实代币。用我的推荐码 {code} 加入：', ko: 'AURN에서 에이전트를 거래하세요 - Robinhood Chain의 진짜 코인이에요. 제 코드 {code}로 참여하세요:' },

  // Edit profile
  'edit.connectBody': { en: 'Connect your wallet to edit your name and photo.', zh: '连接钱包以编辑你的名称和头像。', ko: '지갑을 연결해 이름과 사진을 편집하세요.' },
  'edit.photo': { en: 'Photo', zh: '头像', ko: '사진' },
  'edit.changePhoto': { en: 'Change photo', zh: '更换头像', ko: '사진 변경' },
  'edit.uploadPhoto': { en: 'Upload photo', zh: '上传头像', ko: '사진 업로드' },
  'edit.reading': { en: 'Reading…', zh: '读取中…', ko: '불러오는 중…' },
  'edit.displayName': { en: 'Display name', zh: '显示名称', ko: '표시 이름' },
  'edit.namePh': { en: 'Your name', zh: '你的名称', ko: '이름' },
  'edit.wallet': { en: 'Wallet', zh: '钱包', ko: '지갑' },
  'edit.connected': { en: 'connected', zh: '已连接', ko: '연결됨' },
  'edit.walletHint': { en: 'This is your connected wallet address - your identity on-chain.', zh: '这是你已连接的钱包地址 - 你的链上身份。', ko: '연결된 지갑 주소예요 - 온체인 신원입니다.' },
  'edit.save': { en: 'Save changes', zh: '保存更改', ko: '변경 저장' },
  'edit.saved': { en: 'Saved', zh: '已保存', ko: '저장됨' },
  'edit.errImage': { en: 'Please choose an image file.', zh: '请选择一个图片文件。', ko: '이미지 파일을 선택하세요.' },
  'edit.errRead': { en: 'That image could not be read. Try another.', zh: '无法读取该图片，请换一张。', ko: '이미지를 읽을 수 없어요. 다른 걸 시도하세요.' },

  // AI access
  'ai.title': { en: 'AI access', zh: 'AI 接入', ko: 'AI 액세스' },
  'ai.connectBody': { en: 'Connect your wallet to generate your AURN API key and connect your AI.', zh: '连接钱包以生成你的 AURN API 密钥并接入你的 AI。', ko: '지갑을 연결해 AURN API 키를 만들고 AI를 연결하세요.' },
  'ai.connectTitle': { en: 'Connect AURN to your AI', zh: '将 AURN 接入你的 AI', ko: 'AURN을 AI에 연결하기' },
  'ai.intro': { en: 'AURN runs an MCP server, so an AI client (Claude, ChatGPT, Cursor, …) can browse coins, get quotes, read your portfolio, and even prepare a trade or launch a coin for you. It stays non-custodial: the AI hands you a one-tap link and your own wallet signs, so it can never move your funds.', zh: 'AURN 运行一个 MCP 服务器，AI 客户端（Claude、ChatGPT、Cursor 等）可以浏览代币、获取报价、读取你的资产，甚至为你准备交易或发射代币。全程非托管：AI 只给你一个一键链接，由你自己的钱包签名，因此它永远无法转移你的资金。', ko: 'AURN은 MCP 서버를 운영해요. AI 클라이언트(Claude, ChatGPT, Cursor 등)가 코인을 둘러보고, 시세를 받고, 포트폴리오를 읽고, 거래나 코인 런치까지 준비해 줄 수 있어요. 비수탁 방식이라 AI는 원탭 링크만 건네고 서명은 본인 지갑이 하므로 자금을 옮길 수 없어요.' },
  'ai.endpoint': { en: 'MCP endpoint', zh: 'MCP 端点', ko: 'MCP 엔드포인트' },
  'ai.yourKey': { en: 'Your API key', zh: '你的 API 密钥', ko: '내 API 키' },
  'ai.copyKey': { en: 'Copy key', zh: '复制密钥', ko: '키 복사' },
  'ai.copied': { en: 'Copied', zh: '已复制', ko: '복사됨' },
  'ai.keyWarn': { en: "Copy it now - it isn't shown again. This key gives read access to your AURN account; treat it like a password and never paste it publicly.", zh: '现在就复制 - 它不会再次显示。此密钥可读取你的 AURN 账户，请像对待密码一样对待它，切勿公开粘贴。', ko: '지금 복사하세요 - 다시 표시되지 않아요. 이 키는 AURN 계정 읽기 권한을 주니 비밀번호처럼 다루고 공개적으로 붙여넣지 마세요.' },
  'ai.keyIntro': { en: "Generate a personal read-only key for browsing, quotes, and your portfolio. It can't move funds, but only paste it into an AI client you trust.", zh: '生成一个只读的个人密钥，用于浏览、报价和查看资产。它无法转移资金，但请只粘贴到你信任的 AI 客户端中。', ko: '둘러보기, 시세, 포트폴리오용 읽기 전용 개인 키를 만드세요. 자금은 옮길 수 없지만, 신뢰하는 AI 클라이언트에만 붙여넣으세요.' },
  'ai.generate': { en: 'Generate API key', zh: '生成 API 密钥', ko: 'API 키 생성' },
  'ai.generating': { en: 'Generating…', zh: '生成中…', ko: '생성 중…' },
  'ai.howTitle': { en: 'How to connect', zh: '如何连接', ko: '연결 방법' },
  'ai.step1a': { en: 'Add', zh: '添加', ko: '추가' },
  'ai.step1b': { en: 'as an MCP server in your client (Claude, ChatGPT, Cursor, …).', zh: '作为 MCP 服务器添加到你的客户端（Claude、ChatGPT、Cursor 等）。', ko: '를 클라이언트(Claude, ChatGPT, Cursor 등)에 MCP 서버로 추가하세요.' },
  'ai.step2a': { en: 'Set the auth header', zh: '设置认证请求头', ko: '인증 헤더 설정' },
  'ai.step3': { en: 'Ask your AI to list coins, quote a trade, read your portfolio, or launch a coin.', zh: '让你的 AI 列出代币、报价、读取资产或发射代币。', ko: 'AI에게 코인 목록, 거래 견적, 포트폴리오 조회, 코인 런치를 요청하세요.' },
  'ai.step4': { en: 'When it prepares a trade or launch, it gives you a one-tap link. Open it, review, and sign in your own wallet - the AI never can.', zh: '当它准备交易或发射时，会给你一个一键链接。打开、检查，然后用你自己的钱包签名 - AI 永远无法代签。', ko: '거래나 런치를 준비하면 원탭 링크를 줘요. 열어서 확인하고 본인 지갑으로 서명하세요 - AI는 절대 할 수 없어요.' },

  // Locked screen
  'locked.lockTitle': { en: 'Lock token supply', zh: '锁定代币供应', ko: '토큰 공급 잠금' },
  'locked.descLive': { en: 'Lock a token you hold on Robinhood Chain for a fixed term. Tokens move into the AurnLocker contract and only you can withdraw them, only after the term ends.', zh: '将你在 Robinhood Chain 上持有的代币锁定固定期限。代币进入 AurnLocker 合约，只有你能在期限结束后取回。', ko: 'Robinhood Chain에서 보유한 토큰을 정해진 기간 동안 잠가요. 토큰은 AurnLocker 컨트랙트로 이동하고 기간이 끝난 후에만 본인이 인출할 수 있어요.' },
  'locked.descLocal': { en: 'Lock a token you hold on Robinhood Chain for a fixed term. Recorded to your wallet until the on-chain locker is set.', zh: '将你在 Robinhood Chain 上持有的代币锁定固定期限。在链上锁定器设置好之前，记录在你的钱包中。', ko: 'Robinhood Chain에서 보유한 토큰을 정해진 기간 동안 잠가요. 온체인 로커가 설정될 때까지 지갑에 기록돼요.' },
  'locked.connectToLock': { en: 'Connect Wallet to lock', zh: '连接钱包以锁定', ko: '지갑 연결 후 잠금' },
  'locked.token': { en: 'Token', zh: '代币', ko: '토큰' },
  'locked.selectToken': { en: 'Select a token…', zh: '选择代币…', ko: '토큰 선택…' },
  'locked.change': { en: 'Change', zh: '更换', ko: '변경' },
  'locked.searchPh': { en: 'Search AURN coins or paste a token address…', zh: '搜索 AURN 代币或粘贴代币地址…', ko: 'AURN 코인 검색 또는 토큰 주소 붙여넣기…' },
  'locked.useAddress': { en: 'Use address', zh: '使用该地址', ko: '주소 사용' },
  'locked.noMatch': { en: 'No match. Paste a token address to lock any Robinhood Chain token.', zh: '无匹配。粘贴代币地址即可锁定任意 Robinhood Chain 代币。', ko: '일치 항목 없음. 토큰 주소를 붙여넣으면 어떤 Robinhood Chain 토큰이든 잠글 수 있어요.' },
  'locked.amount': { en: 'Amount', zh: '数量', ko: '수량' },
  'locked.reading': { en: 'reading…', zh: '读取中…', ko: '읽는 중…' },
  'locked.balance': { en: 'Balance', zh: '余额', ko: '잔액' },
  'locked.max': { en: 'Max', zh: '最大', ko: '최대' },
  'locked.lockedOnchain': { en: 'Locked on-chain - view', zh: '已链上锁定 - 查看', ko: '온체인 잠금 완료 - 보기' },
  'locked.notDeployedA': { en: 'The on-chain locker isn’t deployed yet. Deploy', zh: '链上锁定器尚未部署。请部署', ko: '온체인 로커가 아직 배포되지 않았어요. 배포하세요' },
  'locked.notDeployedB': { en: 'and set', zh: '并设置', ko: '그리고 설정' },
  'locked.notDeployedC': { en: '- then every lock shows here publicly, no wallet needed.', zh: '- 之后每一笔锁仓都会公开显示在这里，无需钱包。', ko: '- 그러면 모든 잠금이 여기 공개로 표시돼요, 지갑 불필요.' },
  'locked.lockFor': { en: 'Lock for', zh: '锁定期限', ko: '잠금 기간' },
  'locked.unlocks': { en: 'Unlocks', zh: '解锁于', ko: '해제' },
  'locked.lockBtn': { en: 'Lock', zh: '锁定', ko: '잠그기' },
  'locked.yourLocks': { en: 'Your locks', zh: '你的锁仓', ko: '내 잠금' },
  'locked.lockedTokens': { en: 'Locked tokens', zh: '已锁定代币', ko: '잠긴 토큰' },
  'locked.onchain': { en: 'on-chain', zh: '链上', ko: '온체인' },
  'locked.reg': { en: 'Reading the lock registry…', zh: '正在读取锁仓记录…', ko: '잠금 레지스트리를 읽는 중…' },
  'locked.noneYet': { en: 'No tokens are locked yet. Be the first - lock supply above.', zh: '还没有代币被锁定。成为第一个 - 在上方锁定供应。', ko: '아직 잠긴 토큰이 없어요. 위에서 첫 번째로 잠가보세요.' },
  'locked.unlock': { en: 'Unlock', zh: '解锁', ko: '해제' },
  'locked.unlocked': { en: 'Unlocked', zh: '已解锁', ko: '해제됨' },
  'locked.untilUnlock': { en: 'until unlock', zh: '后解锁', ko: '해제까지' },
  'locked.lockedOn': { en: 'Locked', zh: '锁定于', ko: '잠금' },
  'locked.ready': { en: 'Ready', zh: '就绪', ko: '준비됨' },
  'locked.by': { en: 'by', zh: '来自', ko: '보유자' },
  'locked.footerLive': { en: 'Non-custodial - AURN never holds your keys. Locks are enforced on-chain by the AurnLocker contract.', zh: '非托管 - AURN 永不持有你的私钥。锁仓由 AurnLocker 合约在链上强制执行。', ko: '비수탁 - AURN은 키를 보관하지 않아요. 잠금은 AurnLocker 컨트랙트가 온체인으로 강제해요.' },
  'locked.footerLocal': { en: 'Non-custodial - AURN never holds your keys. On-chain enforcement activates once the locker contract is deployed.', zh: '非托管 - AURN 永不持有你的私钥。锁定器合约部署后即启用链上强制执行。', ko: '비수탁 - AURN은 키를 보관하지 않아요. 로커 컨트랙트가 배포되면 온체인 강제가 활성화돼요.' },

  // Creator fees
  'fees.title': { en: 'Creator fees', zh: '创作者费用', ko: '크리에이터 수수료' },
  'fees.desc': { en: 'Pool fees accrue without unlocking the permanent liquidity position. Signed by your own wallet.', zh: '池费用无需解锁永久流动性头寸即可累积。由你自己的钱包签名。', ko: '영구 유동성 포지션을 풀지 않고도 풀 수수료가 쌓여요. 본인 지갑으로 서명해요.' },
  'fees.accrued': { en: 'Accrued', zh: '已累积', ko: '누적' },
  'fees.you': { en: 'you', zh: '你', ko: '나' },
  'fees.protocol': { en: 'protocol', zh: '协议', ko: '프로토콜' },
  'fees.payout': { en: 'Payout wallet', zh: '收款钱包', ko: '지급 지갑' },
  'fees.redirect': { en: 'fee redirect', zh: '费用转发', ko: '수수료 리디렉션' },
  'fees.yourWallet': { en: 'your wallet', zh: '你的钱包', ko: '내 지갑' },
  'fees.claimed': { en: 'Fees claimed to your wallet.', zh: '费用已领取到你的钱包。', ko: '수수료가 지갑으로 지급됐어요.' },
  'fees.claiming': { en: 'Claiming…', zh: '领取中…', ko: '청구 중…' },
  'fees.noneYet': { en: 'No fees to claim yet', zh: '暂无可领取的费用', ko: '아직 청구할 수수료가 없어요' },
  'fees.claim': { en: 'Claim fees', zh: '领取费用', ko: '수수료 청구' },
  'fees.view': { en: 'view', zh: '查看', ko: '보기' },

  // Trade panel
  'trade.amountInEth': { en: 'Amount in ETH', zh: 'ETH 数量', ko: 'ETH 수량' },
  'trade.amountIn': { en: 'Amount in', zh: '数量', ko: '수량' },
  'trade.balance': { en: 'Balance', zh: '余额', ko: '잔액' },
  'trade.pricing': { en: 'Pricing…', zh: '报价中…', ko: '가격 산정 중…' },
  'trade.insufficient': { en: 'Insufficient', zh: '余额不足', ko: '잔액 부족' },
  'trade.balanceSuffix': { en: 'balance.', zh: '。', ko: '.' },
  'trade.slippage': { en: 'Slippage', zh: '滑点', ko: '슬리피지' },
  'trade.max': { en: 'Max', zh: '最大', ko: '최대' },
  'trade.sent': { en: 'Trade sent - view on explorer', zh: '交易已发送 - 在区块浏览器查看', ko: '거래 전송됨 - 익스플로러에서 보기' },
  'trade.sellNote': { en: 'A pool sell settles in WETH - unwrap to ETH in your wallet.', zh: '池卖出以 WETH 结算 - 在钱包中兑换回 ETH。', ko: '풀 매도는 WETH로 정산돼요 - 지갑에서 ETH로 언랩하세요.' },

  // Legal pages (chrome only; clause bodies stay in English)
  'legal.updated': { en: 'Last updated', zh: '最后更新', ko: '최종 업데이트' },
  'legal.disclaimer': { en: 'This document is provided for transparency about how AURN works and is written in plain language. It is not legal advice. For questions, reach us at', zh: '本文件旨在透明地说明 AURN 的运作方式，以通俗语言撰写，不构成法律建议。如有疑问，请联系', ko: '이 문서는 AURN의 작동 방식을 투명하게 설명하기 위해 평이한 언어로 작성되었으며 법률 자문이 아니에요. 문의는 다음으로 연락하세요' },
  'legal.aboutTitle': { en: 'About AURN', zh: '关于 AURN', ko: 'AURN 소개' },
  'legal.termsTitle': { en: 'Terms of Service', zh: '服务条款', ko: '서비스 약관' },
  'legal.privacyTitle': { en: 'Privacy Policy', zh: '隐私政策', ko: '개인정보 처리방침' },

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
