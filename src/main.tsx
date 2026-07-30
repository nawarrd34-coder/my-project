import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import OnSetApp from './onset/OnSetApp.tsx'
import LithosHero from './lithos/LithosHero.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OnSetApp />} />
        <Route path="/lithos" element={<LithosHero />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
