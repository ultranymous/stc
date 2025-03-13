import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path';
import {VitePWA} from 'vite-plugin-pwa'

export default defineConfig(({mode}) => {
    process.env = {...process.env, ...loadEnv(mode, process.cwd())};
    const IPFS_URL = `${process.env.IPFS_URL ?? 'http://localhost:8080'}`;

    return {
        server: {
            proxy: {
                '/data': `${IPFS_URL}/ipns/libstc.cc`,
                '/repo': `${IPFS_URL}/ipns/libstc.cc`,
            },
        },
        plugins: [vue(), VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'Library STC',
                short_name: 'STC',
                description: 'Search the entirety of humanity knowledge, including books and scholarly publications',
                theme_color: '#d97706',
                icons: [
                    {
                        "src": "/android-chrome-192x192.png",
                        "sizes": "192x192",
                        "type": "image/png"
                    },
                    {
                        "src": "/android-chrome-512x512.png",
                        "sizes": "512x512",
                        "type": "image/png",
                    },
                    {
                        "src": "/android-chrome-maskable-192x192.png",
                        "sizes": "192x192",
                        "type": "image/png",
                        "purpose": "maskable"
                    },
                    {
                        "src": "/android-chrome-maskable-512x512.png",
                        "sizes": "512x512",
                        "type": "image/png",
                        "purpose": "maskable"
                    }
                ]
            },
            workbox: {
                navigateFallbackDenylist: [/^\/(?:dois|repo)\//],
                maximumFileSizeToCacheInBytes: 1024 * 1024 * 100,
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/covers\.openlibrary\.org/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'covers',
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 30
                            },
                            cacheableResponse: {
                                statuses: [200]
                            },
                        },
                    }, {
                        urlPattern: /\/data\//,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'data',
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 90
                            },
                            cacheableResponse: {
                                statuses: [200]
                            },
                            rangeRequests: true
                        }
                    }]
            }
        })],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            target: "es2022"
        },
        esbuild: {
            target: "es2022"
        },
        optimizeDeps: {
            esbuildOptions: {
                target: "es2022",
            }
        }
    };
});
