import { homedir } from 'node:os'
import {
  createBashTool,
  createPowerShellTool,
} from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

export function redact(value, secrets = []) {
  if (typeof value === 'string') {
    for (const secret of secrets.filter(Boolean))
      value = value.replaceAll(secret, '[redacted]')
    return value
      .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[redacted]')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1[redacted]')
      .replace(/((?:https?|socks5h?):\/\/)[^\s/@]+:[^\s@]+@/gi, '$1[redacted]@')
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry, secrets))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        redact(entry, secrets),
      ]),
    )
  return value
}

export function createTerminalTool({ cwd, secrets = [] } = {}) {
  cwd ||= process.env.NETWORK_AGENT_WORK_DIR || homedir()
  const factory =
    process.platform === 'win32' ? createPowerShellTool : createBashTool
  const original = factory(cwd, {
    exposeSessionEnvironment: false,
    spawnHook: (context) => {
      delete context.env.DEEPSEEK_API_KEY
      return context
    },
  })
  return {
    ...original,
    executionMode: 'sequential',
    description: `Execute terminal commands as the current user in ${cwd}. Inspect network settings, files and services, or make changes the user requests. Save a backup before editing existing configuration. Commands run for at most 60 seconds and can be stopped. Do not read credentials or dump the entire environment.`,
    parameters: Type.Object({
      command: Type.String({ minLength: 1, maxLength: 8192 }),
      timeout: Type.Optional(Type.Number({ minimum: 1, maximum: 60 })),
    }),
    execute: async (id, args, signal, onUpdate) => {
      if (!args.command?.trim() || args.command.length > 8192)
        throw new Error('Provide a terminal command of 1–8192 characters.')
      const timeout = args.timeout ?? 30
      if (!Number.isFinite(timeout) || timeout < 1 || timeout > 60)
        throw new Error('Terminal timeout must be between 1 and 60 seconds.')
      try {
        return redact(
          await original.execute(id, { ...args, timeout }, signal, (update) =>
            onUpdate?.(redact(update, secrets)),
          ),
          secrets,
        )
      } catch (error) {
        throw new Error(redact(error.message, secrets), { cause: error })
      }
    },
  }
}
