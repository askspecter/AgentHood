import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider } from './lib/store'
import Shell from './components/Shell'
import Landing from './pages/Landing'
import Explore from './pages/Explore'
import CharmDetail from './pages/CharmDetail'
import Chats from './pages/Chats'
import ChatThread from './pages/ChatThread'
import Create from './pages/Create'
import Profile from './pages/Profile'

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
          <Route path="/" element={<Landing />} />
          <Route path="/c/:id" element={<Shell />}>
            <Route index element={<CharmDetail />} />
          </Route>
          <Route path="/app" element={<Shell />}>
            <Route index element={<Explore />} />
            <Route path="chats" element={<Chats />} />
            <Route path="chat/:id" element={<ChatThread />} />
            <Route path="create" element={<Create />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
