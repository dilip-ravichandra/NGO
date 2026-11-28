import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import siteFiles from './plugins/site-files.js';

// The AI helpers and sign-in codes are served by ../dev-server.js; start it too when you need them.
const proxy = { '/api': { target: process.env.GIGF_API || 'http://localhost:8081', changeOrigin: false } };

export default defineConfig({
  base: './',                       // works at a domain root and under /NGO/ on GitHub Pages
  publicDir: false,
  plugins: [react(), siteFiles()],
  server: { port: 5173, proxy, fs: { allow: ['..'] } },
  preview: { port: 4173, proxy, allowedHosts: ['gigf.test'] },   // gigf.test: the tests browse as a public visitor
  build: {
    assetsDir: 'static',            // "assets/" belongs to the site's own pictures
    chunkSizeWarningLimit: 700,
    rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } }
  }
});
