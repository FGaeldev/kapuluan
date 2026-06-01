/**
 * main.jsx
 *
 * Purpose:  App entry point. Mounts React root onto #root div.
 *           Must use React 18 createRoot API.
 *
 * Dependencies: React 18, ReactDOM 18
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)