import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'; // UNCOMMENT FOR PWA DEPLOYMENT

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Base must be relative for Electron to load assets from file:// protocol
      // and works well for GitHub Pages sub-directories
      base: './', 
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        chunkSizeWarningLimit: 2000,
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          external: [
            // No longer needed on the client, will be handled by proxy
          ],
        },
      },
      plugins: [
        react(),
        // UNCOMMENT THE SECTION BELOW TO ENABLE PWA (Offline Support)
        
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          manifest: {
            name: 'Business Contacts Manager',
            short_name: 'Contacts',
            description: 'Manage your business contacts and jobs offline.',
            theme_color: '#0ea5e9',
            icons: [
              {
                src: 'icons/icon.svg', 
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
        
      ],
      define: {
        // VITE_ variables are automatically handled by import.meta.env.
        // The Gemini API key is no longer exposed to the client.
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});
