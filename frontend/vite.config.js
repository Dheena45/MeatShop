import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// FreshMeat frontend dev server. Runs independently of the Spring Boot
// backend (which serves the API on http://localhost:8082).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 5173,
    strictPort: true
  }
});
