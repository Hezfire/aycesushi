/**
 * Entry point — mounts the React app with client-side routes.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import RestaurantPage from './pages/RestaurantPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import './index.css'
import './App.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/restaurants/:restaurantId" element={<RestaurantPage />} />
        <Route path="/restaurants/:restaurantId/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
