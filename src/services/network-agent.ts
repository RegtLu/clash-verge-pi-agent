import { Channel, invoke } from '@tauri-apps/api/core'

export interface NetworkChange {
  id: string
  field: 'mode' | 'systemProxy' | 'tun' | 'ipv6'
  before: string | boolean
  after: string | boolean
  reason: string
}

export interface NetworkAgentResult {
  text: string
  proposals: NetworkChange[]
  checks: number
  model: string
  usage: number
}

export interface NetworkAgentEvent {
  type: 'text' | 'tool_start' | 'tool_end'
  text?: string
  id?: string
  name?: string
  args?: unknown
  result?: unknown
  isError?: boolean
}

export interface NetworkAgentStatus {
  mode: string
  systemProxy: boolean
  tun: boolean
  ipv6: boolean
  mixedPort: number
  undoAvailable: boolean
}

export function chatWithNetworkAgent(
  id: string,
  prompt: string,
  history: { role: string; text: string }[],
  receive: (event: NetworkAgentEvent) => void,
) {
  const onEvent = new Channel<NetworkAgentEvent>()
  onEvent.onmessage = receive
  return invoke<NetworkAgentResult>('network_agent_chat', {
    id,
    prompt,
    history,
    onEvent,
  })
}

export const cancelNetworkAgent = (id: string) =>
  invoke<void>('network_agent_cancel', { id })

export const networkAgentStatus = () =>
  invoke<NetworkAgentStatus>('network_agent_status')

export const applyNetworkChange = (change: NetworkChange) =>
  invoke<NetworkAgentStatus>('network_agent_apply', { change })

export const undoNetworkChange = () =>
  invoke<NetworkAgentStatus>('network_agent_undo')
