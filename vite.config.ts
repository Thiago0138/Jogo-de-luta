import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: ['es2020', 'safari14'],
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
