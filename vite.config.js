// Vite configuration file
// Vite is a modern frontend build tool that serves your project during development
// and bundles it for production. No complex setup needed!

import { defineConfig } from 'vite';

export default defineConfig({
  // Base public path when served in development or production
  base: './',
  server: {
    // Port to run the dev server on
    port: 3000,
    open: true // Automatically open the browser
  }
});
