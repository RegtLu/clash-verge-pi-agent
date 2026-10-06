import {
  applyNetworkChange,
  cancelNetworkAgent,
  chatWithNetworkAgent,
  networkAgentStatus,
  undoNetworkChange,
  type NetworkAgentEvent,
  type NetworkAgentStatus,
  type NetworkChange,
} from './network-agent'

interface NetworkCheck {
  id: string
  name: string
  args?: unknown
  result?: unknown
  done?: boolean
  isError?: boolean
}

export interface NetworkMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  checks?: NetworkCheck[]
  status?: 'running' | 'done' | 'interrupted'
}

interface SessionState {
  messages: NetworkMessage[]
  proposals: NetworkChange[]
  draft: string
  model: string
  busy: boolean
  changing: boolean
  error: string
  storageError: boolean
  notice: 'applied' | 'undone' | 'stopped' | ''
  status?: NetworkAgentStatus
}

const STORAGE_KEY = 'network-agent-conversation-v1'
const listeners = new Set<() => void>()
let state: SessionState = {
  messages: [],
  proposals: [],
  draft: '',
  model: 'DeepSeek',
  busy: false,
  changing: false,
  error: '',
  storageError: false,
  notice: '',
}
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  if (saved?.version === 1 && Array.isArray(saved.messages)) {
    state.messages = saved.messages.map((message: NetworkMessage) => ({
      ...message,
      status: message.status === 'running' ? 'interrupted' : message.status,
      checks: message.checks?.map((check) => ({
        ...check,
        isError: check.done ? check.isError : true,
        done: true,
      })),
    }))
    state.draft = saved.draft || ''
    state.model = saved.model || 'DeepSeek'
    state.proposals = saved.proposals || []
  }
} catch {
  state.storageError = true
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let activeId: string | undefined
let stopRequested = false

function networkAgentError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'detail' in error)
    return String(error.detail)
  return error instanceof Error ? error.message : String(error)
}

function save() {
  clearTimeout(saveTimer)
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        messages: state.messages.slice(-80).map((message) => ({
          ...message,
          checks: message.checks?.map((check) => {
            const result = JSON.stringify(check.result)
            return result?.length > 8192
              ? { ...check, result: result.slice(0, 8192) + '\n[truncated]' }
              : check
          }),
        })),
        draft: state.draft,
        model: state.model,
        proposals: state.proposals,
      }),
    )
  } catch {
    state = { ...state, storageError: true }
    listeners.forEach((listener) => listener())
  }
}

function update(patch: Partial<SessionState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 300)
}

function updateMessage(id: string, patch: Partial<NetworkMessage>) {
  update({
    messages: state.messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    ),
  })
}

window.addEventListener('pagehide', () => {
  save()
  if (activeId) void cancelNetworkAgent(activeId)
})

export const getNetworkSession = () => state
export const subscribeNetworkSession = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const setNetworkDraft = (draft: string) => update({ draft })

export async function refreshNetworkStatus() {
  try {
    update({ status: await networkAgentStatus() })
  } catch (error) {
    update({ error: networkAgentError(error) })
  }
}

export async function sendNetworkMessage(text: string) {
  if (state.busy || state.changing || !text.trim()) return
  const id = crypto.randomUUID()
  const assistantId = crypto.randomUUID()
  const history = state.messages
    .filter((message) => message.text.trim())
    .slice(-24)
    .map(({ role, text }) => ({ role, text: text.slice(-8000) }))
  activeId = id
  stopRequested = false
  update({
    busy: true,
    draft: '',
    error: '',
    notice: '',
    proposals: [],
    messages: [
      ...state.messages,
      { id: crypto.randomUUID(), role: 'user', text },
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        checks: [],
        status: 'running',
      },
    ],
  })
  let streamId: string | undefined
  let prefix = ''
  let pendingText = ''
  let textTimer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(textTimer)
    textTimer = undefined
    updateMessage(assistantId, { text: pendingText })
  }
  const receive = (event: NetworkAgentEvent) => {
    if (activeId !== id) return
    if (event.type === 'text') {
      if (streamId && streamId !== event.id) prefix = pendingText
      streamId = event.id
      pendingText = [prefix, event.text].filter(Boolean).join('\n\n')
      textTimer ??= setTimeout(flush, 80)
    } else {
      const message = state.messages.find((item) => item.id === assistantId)
      const checks = message?.checks || []
      updateMessage(assistantId, {
        checks:
          event.type === 'tool_start'
            ? [
                ...checks,
                { id: event.id!, name: event.name!, args: event.args },
              ]
            : checks.map((check) =>
                check.id === event.id
                  ? {
                      ...check,
                      result: event.result,
                      done: event.type === 'tool_end',
                      isError: event.isError,
                    }
                  : check,
              ),
      })
    }
  }
  try {
    const result = await chatWithNetworkAgent(id, text, history, receive)
    clearTimeout(textTimer)
    updateMessage(assistantId, {
      text: [prefix, result.text].filter(Boolean).join('\n\n'),
      status: 'done',
    })
    update({ proposals: result.proposals, model: result.model })
  } catch (error) {
    flush()
    const message = state.messages.find((item) => item.id === assistantId)
    updateMessage(assistantId, {
      status: 'interrupted',
      checks: message?.checks?.map((check) =>
        check.done ? check : { ...check, done: true, isError: true },
      ),
    })
    const detail = networkAgentError(error)
    update(
      stopRequested && /cancel|abort/i.test(detail)
        ? { error: '', notice: 'stopped' }
        : { error: detail },
    )
  } finally {
    activeId = undefined
    update({ busy: false })
    save()
  }
}

export async function stopNetworkMessage() {
  if (!activeId) return
  stopRequested = true
  try {
    await cancelNetworkAgent(activeId)
  } catch (error) {
    update({ error: networkAgentError(error) })
  }
}

export async function applySessionChange(change: NetworkChange) {
  if (state.busy || state.changing) return
  update({ changing: true, error: '' })
  try {
    await applyNetworkChange(change)
    update({
      proposals: state.proposals.filter((item) => item.id !== change.id),
      notice: 'applied',
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: `[Clash setting applied] ${change.field}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`,
        },
      ],
    })
  } catch (error) {
    update({ error: networkAgentError(error) })
  } finally {
    await refreshNetworkStatus()
    update({ changing: false })
  }
}

export async function undoSessionChange() {
  if (state.busy || state.changing) return
  update({ changing: true, error: '' })
  try {
    await undoNetworkChange()
    update({
      notice: 'undone',
      proposals: [],
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: '[Latest Clash setting undone]',
        },
      ],
    })
  } catch (error) {
    update({ error: networkAgentError(error) })
  } finally {
    await refreshNetworkStatus()
    update({ changing: false })
  }
}

export function clearNetworkConversation() {
  if (state.busy || state.changing) return
  update({ messages: [], proposals: [], draft: '', error: '', notice: '' })
  save()
}
