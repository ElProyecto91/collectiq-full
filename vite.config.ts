import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// The commit this build was made from (Vercel provides it), shown in Profile so you can tell which version a device runs.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(commit) },
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
