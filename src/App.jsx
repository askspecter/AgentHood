import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider } from './lib/store'
import Shell from './components/Shell'
import Explore from './screens/Explore'
import Trade from './screens/Trade'
import Launch from './screens/Launch'
import Profile from './screens/Profile'
import Settings from './screens/Settings'

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
            <Route path="trade" element={<Trade />} />
            <Route path="launch" element={<Launch />} />
            <Route path="you" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
