import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Providers from './lib/Providers'
import { StoreProvider } from './lib/store'
import ErrorBoundary from './components/ErrorBoundary'
import Shell from './components/Shell'
import Explore from './screens/Explore'
import CharmDetail from './screens/CharmDetail'
import Chats from './screens/Chats'
import ChatThread from './screens/ChatThread'
import Launch from './screens/Launch'
import Profile from './screens/Profile'
import Settings from './screens/Settings'
import EditProfile from './screens/EditProfile'
import Leaderboard from './screens/Leaderboard'
import Referral from './screens/Referral'
import AiAccess from './screens/AiAccess'
import Terms from './screens/Terms'
import Privacy from './screens/Privacy'
import About from './screens/About'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <Providers>
    <StoreProvider>
      <BrowserRouter>
        <ScrollTop />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Shell />}>
              <Route index element={<Explore />} />
              <Route path="c/:id" element={<CharmDetail />} />
              <Route path="chats" element={<Chats />} />
              <Route path="chat/:id" element={<ChatThread />} />
              <Route path="launch" element={<Launch />} />
              <Route path="you" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/profile" element={<EditProfile />} />
              <Route path="settings/referral" element={<Referral />} />
              <Route path="settings/ai" element={<AiAccess />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="terms" element={<Terms />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="about" element={<About />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </StoreProvider>
    </Providers>
  )
}
