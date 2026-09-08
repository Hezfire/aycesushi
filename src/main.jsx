/**
 * Entry point — mounts the React app with client-side routes.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import FindRestaurantPage from './pages/FindRestaurantPage.jsx'
import RestaurantPage from './pages/RestaurantPage.jsx'
import MealPage from './pages/MealPage.jsx'
import ResultPage from './pages/ResultPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import './index.css'
import './App.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/find" element={<FindRestaurantPage />} />
        <Route path="/restaurants/:restaurantId" element={<RestaurantPage />} />
        <Route path="/restaurants/:restaurantId/meal" element={<MealPage />} />
        <Route path="/restaurants/:restaurantId/meal/result" element={<ResultPage />} />
        <Route path="/restaurants/:restaurantId/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
