import { runAgent } from './agent.mjs'

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
const cancellation = new AbortController()
process.once('SIGTERM', () => cancellation.abort())
process.once('SIGINT', () => cancellation.abort())
try {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
    if (input.length > 256000) throw new Error('The request is too large.')
  }
  emit({
    type: 'result',
    result: await runAgent(JSON.parse(input), emit, cancellation.signal),
  })
} catch (error) {
  emit({ type: 'error', error: error.message })
  process.exitCode = 1
}
