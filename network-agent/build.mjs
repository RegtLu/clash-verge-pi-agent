import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
  entryPoints: [fileURLToPath(new URL('stdio.mjs', import.meta.url))],
  outfile: fileURLToPath(
    new URL('../src-tauri/resources/network-agent.mjs', import.meta.url),
  ),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})
