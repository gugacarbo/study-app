import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '#': '/src',
    },
  },
  ssr: {
    noExternal: ['espells', 'iterare', 'dictionary-pt'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/*.test.tsx', '**/node_modules/**', '**/dist/**'],
    server: {
      deps: {
        inline: ['espells', 'iterare', 'dictionary-pt'],
      },
    },
  },
});
