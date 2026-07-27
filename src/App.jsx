import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider } from './lib/store'
import Shell from './components/Shell'
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
          <Route path="/" element={<Shell />}>
            <Route index element={<Explore />} />
            <Route path="c/:id" element={<CharmDetail />} />
            <Route path="chats" element={<Chats />} />
            <Route path="chat/:id" element={<ChatThread />} />
            <Route path="create" element={<Create />} />
            <Route path="you" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
