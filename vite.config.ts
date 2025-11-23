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
        // Use || '' to ensure it returns a string even if the env var is undefined during build
        // We only define process.env.API_KEY manually for the Gemini SDK compatibility.
        // VITE_ variables are automatically handled by import.meta.env.
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});
