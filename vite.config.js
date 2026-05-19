import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false },
      format: { comments: false },
    },
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        gaia: resolve(__dirname, 'gaia.html'),
      },
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/chunk-[hash].js',
        assetFileNames: (info) => {
          if (info.name.endsWith('.css')) return 'assets/css/[name]-[hash].css';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    copyPublicDir: false,
  },
  server: { port: 3000, open: false },
  plugins: [{
    name: 'copy-static',
    closeBundle: async () => {
      const fs = await import('fs');
      fs.cpSync('data', 'dist/data', { recursive: true });
      if (fs.existsSync('design')) fs.cpSync('design', 'dist/design', { recursive: true });
      console.log('✅ Static assets copied to dist/');
    },
  }],
});
