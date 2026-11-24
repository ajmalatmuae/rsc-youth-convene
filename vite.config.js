import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages workflow (for example "/youth-convene/"). Everywhere else it is "/".
// appType 'spa' makes the dev and preview servers answer /scanner with index.html.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  appType: 'spa',
});
