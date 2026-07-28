import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider } from './lib/store'
import Shell from './components/Shell'
import Explore from './screens/Explore'
import CharmDetail from './screens/CharmDetail'
import Chats from './screens/Chats'
import ChatThread from './screens/ChatThread'
import Create from './screens/Create'
import Profile from './screens/Profile'
import Settings from './screens/Settings'
import Trade from './screens/Trade'
import Launch from './screens/Launch'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Shell />}>
            <Route index element={<Explore />} />
            <Route path="c/:id" element={<CharmDetail />} />
            <Route path="chats" element={<Chats />} />
            <Route path="chat/:id" element={<ChatThread />} />
            <Route path="create" element={<Create />} />
            <Route path="you" element={<Profile />} />
            <Route path="trade" element={<Trade />} />
            <Route path="launch" element={<Launch />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
