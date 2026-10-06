import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAgent } from './agent.mjs'
import { installedSnapshot } from './config.mjs'

try {
  const result = await runAgent(
    {
      prompt:
        process.argv.slice(2).join(' ') ||
        '检查本机网络，对比 api.deepseek.com 的直连与 Clash 代理连通性，给出有证据的诊断。请勿提出配置变更。',
      snapshot: await installedSnapshot(),
      envFile:
        process.env.NETWORK_AGENT_ENV_FILE ||
        resolve(fileURLToPath(new URL('../../', import.meta.url)), '.env'),
    },
    (event) => {
      if (event.type === 'tool_start')
        process.stderr.write(`[tool] ${event.name}\n`)
      if (event.type === 'tool_end')
        process.stderr.write(
          `[tool] ${event.name}: ${event.isError ? 'failed' : 'completed'}\n`,
        )
    },
  )
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
