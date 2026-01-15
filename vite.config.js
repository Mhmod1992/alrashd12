
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return defineConfig({
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: false, // 🔴 تعطيل الـ PWA في وضع التطوير (Dev Mode)
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
            {
              src: 'icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'maskable'
            },
            {
              src: 'icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          // استراتيجيات التخزين المؤقت (Cache) لوضع الإنتاج فقط
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          
          runtimeCaching: [
            {
              // تخزين الصور القادمة من Supabase
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-images-cache',
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 يوم
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // تخزين الخطوط
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365 
                }
              }
            },
            {
              // استراتيجية الشبكة أولاً للبيانات (لضمان الحصول على أحدث البيانات)
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 5 
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    server: {
      allowedHosts: [
        '.ngrok-free.dev'
      ],
      host: true
    }
  });
}
