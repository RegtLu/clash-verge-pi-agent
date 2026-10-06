import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createTerminalTool } from './terminal.mjs'

test('Pi terminal executes in the selected directory and redacts streamed credentials', {
  skip: process.platform === 'win32',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'network-agent-terminal-'))
  try {
    const secret = 'sk-test-secret-not-a-real-key-12345678'
    const tool = createTerminalTool({ cwd: directory, secrets: [secret] })
    const updates = []
    const result = await tool.execute(
      'check',
      {
        command: `printf '${secret}' > marker.txt; cat marker.txt`,
      },
      undefined,
      (update) => updates.push(update),
    )
    assert.equal(await readFile(join(directory, 'marker.txt'), 'utf8'), secret)
    assert.equal(result.structuredContent.exit_code, 0)
    assert.equal(result.structuredContent.output, '[redacted]')
    assert.ok(updates.length > 0)
    assert.ok(!JSON.stringify(updates).includes(secret))
    await assert.rejects(
      tool.execute('invalid', { command: 'true', timeout: 61 }),
      /60 seconds/,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('stopping a terminal command kills its background children', {
  skip: process.platform === 'win32',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'network-agent-cancel-'))
  try {
    const tool = createTerminalTool({ cwd: directory })
    const controller = new AbortController()
    const running = tool.execute(
      'cancel',
      {
        command: '(sleep 1; printf orphan > orphan.txt) & printf started; wait',
      },
      controller.signal,
      () => {},
    )
    await delay(150)
    controller.abort()
    await assert.rejects(running, /aborted/i)
    await delay(1200)
    await assert.rejects(stat(join(directory, 'orphan.txt')), {
      code: 'ENOENT',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
