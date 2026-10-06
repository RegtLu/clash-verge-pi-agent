import { runAgent } from './agent.mjs'

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
try {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
    if (input.length > 256000) throw new Error('The request is too large.')
  }
  emit({ type: 'result', result: await runAgent(JSON.parse(input), emit) })
} catch (error) {
  emit({ type: 'error', error: error.message })
  process.exitCode = 1
}
