import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  base: '/',
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': project } },
  build: { outDir: fileURLToPath(new URL('../dist-yandex/', import.meta.url)), emptyOutDir: true },
  server: { port: 4174 },
});
