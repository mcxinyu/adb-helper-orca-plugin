import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

// 面板源码在 web/，构建产物直接输出到 panel/，Orca 通过 orca-plugin.json
// 的 panels[].entry 加载 panel/index.html。
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_NO__: JSON.stringify(
      (() => {
        const d = new Date()
        const p = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      })(),
    ),
  },
  build: {
    outDir: fileURLToPath(new URL('./panel', import.meta.url)),
    emptyOutDir: true,
  },
})
