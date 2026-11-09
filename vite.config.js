import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from "vite-plugin-pwa";
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';
import { createHash } from 'crypto';
import vitePluginFaviconsInject from 'vite-plugin-favicons-inject';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'fs';

const staticSourceDir = resolve(__dirname, 'static');
const faviconSource = resolve(__dirname, 'src/assets/favicon.png');

const stackeditStaticBundle = () => ({
  name: 'stackedit-static-bundle',
  closeBundle: {
    sequential: true,
    order: 'pre',
    handler() {
      const staticOutputDir = resolve(__dirname, 'dist/static');
      const targets = ['landing', 'oauth2', 'themes', 'sitemap.xml'];

      targets.forEach((target) => {
        rmSync(resolve(staticOutputDir, target), { recursive: true, force: true });
        cpSync(resolve(staticSourceDir, target), resolve(staticOutputDir, target), {
          recursive: true,
          force: true,
        });
      });

      mkdirSync(staticOutputDir, { recursive: true });
      cpSync(faviconSource, resolve(staticOutputDir, 'favicon.png'), { force: true });
      // Static hosting needs files for the existing Flask routes.
      const pages = {
        'app/index.html': 'index.html',
        'oauth2/callback/index.html': 'static/oauth2/callback.html',
        'share.html': 'static/landing/share.html',
        'gistshare.html': 'static/landing/gistshare.html',
      };
      Object.entries(pages).forEach(([target, source]) => {
        const destination = resolve(__dirname, 'dist', target);
        mkdirSync(resolve(destination, '..'), { recursive: true });
        cpSync(resolve(__dirname, 'dist', source), destination);
      });
    },
  },
});

const revisionForFile = (filePath) =>
  createHash('md5').update(readFileSync(filePath)).digest('hex');

const appShellEntries = () => ({
  manifestTransforms: [
    (entries) => ({
      manifest: [
        ...entries,
        {
          url: '/',
          revision: `${revisionForFile(resolve(__dirname, 'dist/index.html'))}-${revisionForFile(resolve(__dirname, 'dist/static/landing/index.html'))}`,
        },
        {
          url: '/app',
          revision: revisionForFile(resolve(__dirname, 'dist/index.html')),
        },
        {
          url: '/oauth2/callback',
          revision: revisionForFile(resolve(__dirname, 'dist/static/oauth2/callback.html')),
        },
        {
          url: '/share.html',
          revision: revisionForFile(resolve(__dirname, 'dist/static/landing/share.html')),
        },
        {
          url: '/gistshare.html',
          revision: revisionForFile(resolve(__dirname, 'dist/static/landing/gistshare.html')),
        },
      ],
    }),
  ],
});

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    proxy: {
      // 匹配 OAuth2 请求
      '/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // 匹配其他后端请求
      '/conf': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/pdfExport': {
        target: 'http://localhost:8080', 
        changeOrigin: true
      },
      '/pandocExport': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/themes': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/prism-components': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
    }
  },
  plugins: [
    {
      name: 'startup-icon',
      transformIndexHtml(html) {
        const icon = readFileSync(resolve(__dirname, 'src/assets/iconKedit.svg'), 'utf8')
          .replaceAll('prefix__', 'startup__')
          .replace('<svg ', '<svg aria-hidden="true" ');
        return html.replace('<!-- startup-icon -->', icon);
      },
    },
    {
      name: 'preload-editor',
      transformIndexHtml: {
        order: 'post',
        handler(html, { bundle }) {
          if (!bundle) return html;
          const main = Object.values(bundle).find(chunk => chunk.type === 'chunk'
            && chunk.moduleIds.some(id => id.replaceAll('\\', '/').endsWith('/src/main.js')));
          if (!main) throw new Error('Missing editor entry chunk');
          return { html, tags: [{
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: '', href: `/${main.fileName}` },
            injectTo: 'head',
          }] };
        },
      },
    },
    vue(),
    // visualizer(), // temp off: build OOM when system free RAM is low
    viteCompression({
      deleteOriginFile: false,
      algorithm: "gzip",
      ext: '.gz',
    }),
    vitePluginFaviconsInject('src/assets/favicon.png', {
      appName: 'KEDIT',
      appShortName: 'KEDIT',
      appDescription: '笔记利器，在线Markdown编辑器。',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background: '#ffffff',
      theme_color: '#ffffff',
      manifestRelativePaths: false,
      cacheBustingQueryParam: null,
      icons: {
        favicons: ['favicon.ico', 'favicon-32x32.png'],
        appleIcon: ['apple-touch-icon-180x180.png'],
        android: ['android-chrome-192x192.png', 'android-chrome-512x512.png'],
        appleStartup: false,
        windows: false,
        yandex: false,
      },
    }),
    stackeditStaticBundle(),
    VitePWA({
      // The favicon generator owns the single manifest and its sized icons.
      manifest: false,
      registerType: 'prompt',
      useCredentials: true,
      workbox: {
        globPatterns: [
          'static/index-*.js',
          'static/js/main.*.js',
          'static/js/templateWorker-*.js',
          'static/main.*.css',
          'static/fonts/kedit-latin-*.woff2',
          'static/fonts/RobotoMono-*.woff',
          'app/index.html',
          'manifest.webmanifest',
          'static/favicon.ico',
          'static/favicon-32x32.png',
          'static/apple-touch-icon-180x180.png',
          'static/android-chrome-192x192.png',
          'static/android-chrome-512x512.png',
        ],
        globIgnores: [
          '**/.*',
          '**/*.map',
          'index.html',
          'static/oauth2/callback.html',
          'static/landing/share.html',
          'static/landing/gistshare.html',
          'static/fonts/KaTeX_*',
          'static/apple-touch-*.png',
          'static/mstile-*.png',
          'static/yandex-browser-*.png',
          'static/js/abc_*.js',
          'static/js/mermaid*.js',
          'static/js/katex*.js',
          'static/katex*.css',
          'static/landing/**',
          'logo.*.png',
          'static/favicon.png',
        ],
        navigateFallback: '/app',
        navigateFallbackDenylist: [/^\/oauth2\/callback/],
        ignoreURLParametersMatching: [
          /^id$/,
          /^code$/,
          /^state$/,
          /^scope$/,
          /^authuser$/,
          /^prompt$/,
          /^hd$/,
          /^error$/,
          /^error_description$/,
          /^utm_/,
          /^fbclid$/,
        ],
        runtimeCaching: [{
          urlPattern: ({ url, request }) => request.method === 'GET'
            && url.origin === self.location.origin
            && url.pathname.startsWith('/static/')
            && !url.pathname.includes('/themes/'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'kedit-static-runtime',
            expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        }],
        ...appShellEntries(),
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 // 设置为 3 MiB
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    extensions: ['.js', '.vue', '.json'],
  },
  build: {
    outDir: 'dist', // 设置构建输出的根目录
    assetsDir: 'static',
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4 * 1024,
    minify: 'terser',
    cssCodeSplit: true, // 如果设置为false，整个项目中的所有 CSS 将被提取到一个 CSS 文件中
    terserOptions: {
      maxWorkers: 1,
      compress: {
        // warnings: false,
        drop_console: true, // 打包时删除console
        drop_debugger: true, // 打包时删除 debugger
        pure_funcs: ['console.log']
      },
      output: {
        // 去掉注释内容
        comments: true
      }
    },
    rollupOptions: {
      output: {
        // 配置 CSS 文件的输出路径，不使用哈希值
        assetFileNames: (assetInfo) => {
          console.log(`------------name:${assetInfo.names[0]}------------ext:${assetInfo.names[0].split('.').pop()}`)
          const hash = createHash('md5').update(assetInfo.source).digest('hex').toLowerCase();
          const ext = assetInfo.names[0].split('.').pop();
          if (assetInfo.names[0] === 'index.css') {
            return `static/css/app.${hash.slice(0,7)}.css`;
          } if (ext === 'png') {
            return `[name].${hash}.[ext]`;
          } else if (ext === 'js') {
            return `static/css/[name].${hash.slice(0,20)}.[ext]`;
          } else if (ext === 'ttf' || ext === 'woff' || ext === 'woff2') {
            return `static/fonts/[name].${hash.slice(0,7)}.[ext]`;
          }
          return `static/[name].${hash.slice(0,7)}.[ext]`;
        },
        chunkFileNames: 'static/js/[name].[hash].js'
      },
    },
    // rollupOptions: {
    //  external: ['lodash']
    // output: {
    //   manualChunks: {
    //     // 拆分代码，这个就是分包，配置完后自动按需加载，现在还比不上webpack的splitchunk，不过也能用了。
    //     // vue: ['vue', 'vue-router', 'vuex'],
    //     // vue: ['vue', 'vue-router']
    //     // vant: ['vant'],
    //     // echarts: ['echarts']
    //   }
    // }
    // },
    // brotliSize: false
  },
  base: '/',
  css: {
    file: true,
    preprocessorOptions: {
      scss: {
        javascriptEnabled: true,
      },
    },
  },
})
