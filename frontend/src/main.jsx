import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted rather than pulled from Google Fonts: vercel.json sets font-src 'self' data:,
// so a CDN request would be blocked outright. These packages ship woff2 files that Vite
// fingerprints into dist/assets/, which keeps them same-origin. Only the weights actually
// used are imported - Montserrat for headings, Raleway for everything else.
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/raleway/400.css'
import '@fontsource/raleway/600.css'
import '@fontsource/raleway/700.css'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
