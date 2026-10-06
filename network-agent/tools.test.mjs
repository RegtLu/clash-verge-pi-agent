import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeSnapshot } from './config.mjs'
import { connectivity, createTools, validateChange } from './tools.mjs'

test('diagnostic snapshots exclude controller and subscription credentials', () => {
  const snapshot = safeSnapshot(
    {
      mode: 'rule',
      secret: 'controller-secret',
      proxies: [{ password: 'node-password' }],
      'proxy-providers': {
        subscription: { url: 'https://example.com/private-token' },
      },
      dns: { enable: true, 'enhanced-mode': 'fake-ip' },
    },
    { webdav_password: 'webdav-secret', enable_system_proxy: true },
  )
  const text = JSON.stringify(snapshot)
  for (const value of [
    'controller-secret',
    'node-password',
    'private-token',
    'webdav-secret',
  ]) {
    assert.ok(!text.includes(value))
  }
  assert.equal(snapshot.dns.enhancedMode, 'fake-ip')
})

test('configuration tools only produce validated previews', async () => {
  const snapshot = safeSnapshot({ ipv6: true })
  const before = JSON.stringify(snapshot)
  const proposals = []
  const tools = createTools(snapshot, proposals)
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      'network_status',
      'system_diagnostics',
      'check_connectivity',
      'propose_change',
    ],
  )
  const tool = tools.find((entry) => entry.name === 'propose_change')
  const result = await tool.execute('preview', {
    field: 'ipv6',
    value: false,
    reason: 'Explicit user request.',
  })
  assert.equal(result.details.status, 'pending_user_approval')
  assert.equal(proposals[0].before, true)
  assert.equal(proposals[0].after, false)
  assert.equal(JSON.stringify(snapshot), before)
  assert.throws(() => validateChange({ field: 'secret', after: 'new-secret' }))
  assert.throws(() => validateChange({ field: 'tun', after: 'true' }))
  assert.throws(() => validateChange({ field: 'mode', after: 'invalid' }))
})

test('connectivity checks reject shell fragments and arbitrary URL paths', async () => {
  for (const host of [
    'example.com; touch /tmp/unexpected',
    'https://example.com/path',
    '-o/tmp/unexpected',
  ]) {
    await assert.rejects(connectivity(host, 'direct', 7890), /hostname or IP/)
  }
})
