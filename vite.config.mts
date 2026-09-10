import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const preview = process.env.GITHUB_REPOSITORY === 'runinit/ergogen-gui-preview';
const deploymentPath = preview ? '/ergogen-gui-preview/' : '/ergogen-gui/';

// We will use standard React plugin and PWA plugin in injectManifest mode
export default defineConfig(({ mode }) => {
  // Collect all REACT_APP_* environment variables to inject them into the client bundle
  const envDefines: Record<string, any> = {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.PUBLIC_URL': JSON.stringify(deploymentPath.slice(0, -1)),
    'process.env.REACT_APP_DEPLOYMENT_CHANNEL': JSON.stringify(preview ? 'preview' : 'production'),
    'process.env.REACT_APP_BUILD_REVISION': JSON.stringify(process.env.GITHUB_SHA || 'local'),
  };

  for (const key in process.env) {
    if (key.startsWith('REACT_APP_')) {
      envDefines[`process.env.${key}`] = JSON.stringify(process.env[key]);
    }
  }

  // Ensure REACT_APP_ERGOGEN_VERSION is always defined, checking both variables
  if (!envDefines['process.env.REACT_APP_ERGOGEN_VERSION']) {
    envDefines['process.env.REACT_APP_ERGOGEN_VERSION'] = JSON.stringify(
      process.env.REACT_APP_ERGOGEN_VERSION || process.env.ERGOGEN_VERSION || ''
    );
  }

  return {
    plugins: [
      // React support
      react(),

      // PWA / Service Worker support
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'service-worker.ts',
        injectRegister: false, // We register manually in serviceWorkerRegistration.ts
        manifest: false, // We use the existing public/manifest.json
        injectManifest: {
          injectionPoint: 'self.__WB_MANIFEST',
          globPatterns: ['**/*.{js,css,html,woff,woff2}', 'components/**/*'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
    base: deploymentPath,
    define: envDefines,
    server: {
      port: 3000,
      open: true,
    },
    build: {
      outDir: 'dist',
      commonjsOptions: {include: [/node_modules/, /public\/dependencies\/openjscad\.js$/]},
    },
    worker: {
      format: 'es',
    },
  };
});
