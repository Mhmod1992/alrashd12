
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// FIX: Import process to provide correct typings for process.cwd() in a modular context.
import process from 'process';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['.ngrok-free.dev']
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          devOptions: {
            enabled: true, // تفعيل PWA في وضع التطوير للاختبار
            type: 'module',
          },
          includeAssets: ['icon.svg'], 
          manifest: {
            id: '/',
            name: 'نظام إدارة ورشة سيارات',
            short_name: 'Aero Workshop',
            description: 'نظام شامل لإدارة ورش صيانة السيارات والفحص الفني',
            theme_color: '#3b82f6',
            background_color: '#ffffff',
            display: 'standalone',
            scope: '/',
            start_url: '/',
            orientation: 'portrait',
            icons: [
              { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
              { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
              { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
              { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            cleanupOutdatedCaches: true,
            navigateFallback: 'index.html',
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'supabase-images-cache',
                  expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 } // 1 year
                }
              },
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'supabase-api-cache',
                  networkTimeoutSeconds: 3,
                  expiration: { maxEntries: 200, maxAgeSeconds: 5 * 60 }, // 5 minutes
                  cacheableResponse: { statuses: [0, 200] }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});
