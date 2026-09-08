import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite build tool config — you usually don't need to edit this.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
  },
})
