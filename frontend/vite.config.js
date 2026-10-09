import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where /api calls are forwarded to. docker-compose sets this to the
// backend container; outside Docker the backend runs on this machine.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000'

// One forwarding rule for both ways of serving the app
const proxy = {
  '/api': apiTarget,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // "server" is used by npm run dev
  server: {
    port: 5173,
    proxy,
  },
  // "preview" is used by npm run preview, which is what runs in Docker.
  // host: true makes it reachable from outside the container.
  preview: {
    host: true,
    port: 5173,
    proxy,
  },
})
