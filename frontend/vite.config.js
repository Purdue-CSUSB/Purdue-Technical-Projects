import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The frontend deliberately reads no environment variables. It used to be built against
// VITE_API_BASE_URL, which had to be pointed at a separate Render host and was the reason the
// old backend needed a CORS allowlist at all. The API is now served from the same origin by the
// same deployment, so every request is a relative '/api/...' path and nothing from .env is ever
// inlined into the browser bundle. The handful of public settings live in src/config.js.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  server: {
    proxy: {
      // `vercel dev`, run from the repo root, serves the /api functions on port 3000 - the same
      // way they are served same-origin in production. Build output is unaffected by this.
      //
      // The USB Research Resources site's `vercel dev` also defaults to 3000, so don't run both
      // at once: whichever starts first takes the port, and this board would fill up with the
      // other site's documents. Run one at a time, or start this one with
      // `npx vercel dev --listen 3001` and change the port here to match.
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    // Vendor code changes far less often than the app, so keeping it in its own chunk lets a
    // returning visitor reuse the cached copy across deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
})
