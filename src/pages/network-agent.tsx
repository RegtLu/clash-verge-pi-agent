import { ExpandMore, Send, Stop } from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { BasePage } from '@/components/base'
import {
  applyNetworkChange,
  cancelNetworkAgent,
  chatWithNetworkAgent,
  networkAgentStatus,
  undoNetworkChange,
  type NetworkAgentEvent,
  type NetworkAgentStatus,
  type NetworkChange,
} from '@/services/network-agent'

type Message = { id: string; role: 'user' | 'assistant'; text: string }
type Check = {
  id: string
  name: string
  args?: unknown
  result?: unknown
  done?: boolean
  isError?: boolean
}

function errorText(error: unknown) {
  if (typeof error === 'object' && error !== null && 'detail' in error)
    return String(error.detail)
  return error instanceof Error ? error.message : String(error)
}

const NetworkAgentPage = () => {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streamed, setStreamed] = useState('')
  const [checks, setChecks] = useState<Check[]>([])
  const [proposals, setProposals] = useState<NetworkChange[]>([])
  const [status, setStatus] = useState<NetworkAgentStatus>()
  const [busy, setBusy] = useState(false)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [model, setModel] = useState('DeepSeek')
  const requestIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    void networkAgentStatus()
      .then(setStatus)
      .catch((err) => setError(errorText(err)))
    return () => {
      mountedRef.current = false
      if (requestIdRef.current) void cancelNetworkAgent(requestIdRef.current)
    }
  }, [])

  const receive = (event: NetworkAgentEvent) => {
    if (!mountedRef.current) return
    if (event.type === 'text') setStreamed(event.text ?? '')
    if (event.type === 'tool_start') {
      setStreamed('')
      setChecks((previous) => [
        ...previous,
        { id: event.id!, name: event.name!, args: event.args },
      ])
    }
    if (event.type === 'tool_end') {
      setChecks((previous) =>
        previous.map((check) =>
          check.id === event.id
            ? {
                ...check,
                done: true,
                result: event.result,
                isError: event.isError,
              }
            : check,
        ),
      )
    }
  }

  const send = async (text: string) => {
    if (busy || changing || !text.trim()) return
    const id = crypto.randomUUID()
    requestIdRef.current = id
    setBusy(true)
    setPrompt('')
    setError('')
    setNotice('')
    setChecks([])
    setProposals([])
    setStreamed('')
    setMessages((previous) => [
      ...previous,
      { id: crypto.randomUUID(), role: 'user', text },
    ])
    try {
      const result = await chatWithNetworkAgent(
        id,
        text,
        messages.slice(-12),
        receive,
      )
      if (!mountedRef.current) return
      setMessages((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: 'assistant', text: result.text },
      ])
      setProposals(result.proposals)
      setModel(result.model)
    } catch (err) {
      if (mountedRef.current) setError(errorText(err))
    } finally {
      requestIdRef.current = null
      if (mountedRef.current) {
        setBusy(false)
        setStreamed('')
      }
    }
  }

  const apply = async (change: NetworkChange) => {
    setChanging(true)
    setError('')
    try {
      await applyNetworkChange(change)
      setStatus(await networkAgentStatus())
      setProposals((previous) =>
        previous.filter((item) => item.id !== change.id),
      )
      setNotice(t('networkAgent.applied'))
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: `${t('networkAgent.applied')}: ${change.field} ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`,
        },
      ])
    } catch (err) {
      setError(errorText(err))
      setStatus(await networkAgentStatus())
    } finally {
      setChanging(false)
    }
  }

  const undo = async () => {
    setChanging(true)
    setError('')
    try {
      await undoNetworkChange()
      setStatus(await networkAgentStatus())
      setProposals([])
      setNotice(t('networkAgent.undone'))
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: t('networkAgent.undone'),
        },
      ])
    } catch (err) {
      setError(errorText(err))
    } finally {
      setChanging(false)
    }
  }

  return (
    <BasePage title={t('networkAgent.title')}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          useFlexGap
        >
          <Chip label={`Pi · ${model}`} color="primary" size="small" />
          {status && (
            <Chip
              size="small"
              label={`${status.mode} · :${status.mixedPort}`}
            />
          )}
          <Button
            size="small"
            disabled={busy || changing || !status?.undoAvailable}
            onClick={() => void undo()}
          >
            {t('networkAgent.undo')}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('networkAgent.description')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            disabled={busy || changing}
            onClick={() => void send(t('networkAgent.diagnosisPrompt'))}
          >
            {t('networkAgent.diagnose')}
          </Button>
          <Button
            variant="outlined"
            disabled={busy || changing}
            onClick={() => void send(t('networkAgent.configurationPrompt'))}
          >
            {t('networkAgent.configure')}
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {messages.map((message) => (
          <Card key={message.id} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {message.role === 'user'
                ? t('networkAgent.you')
                : t('networkAgent.assistant')}
            </Typography>
            <Box
              sx={{
                overflowWrap: 'anywhere',
                '& pre': { overflow: 'auto' },
                '& table': { borderCollapse: 'collapse' },
                '& td, & th': {
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 0.5,
                },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
            </Box>
          </Card>
        ))}
        {checks.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2">
                {t('networkAgent.evidence')} ({checks.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {checks.map((check) => (
                <Box key={check.id} sx={{ mb: 1 }}>
                  <Chip
                    size="small"
                    color={
                      check.isError
                        ? 'error'
                        : check.done
                          ? 'success'
                          : 'default'
                    }
                    label={check.name}
                  />
                  <Box
                    component="pre"
                    sx={{ fontSize: 12, overflow: 'auto', maxHeight: 260 }}
                  >
                    {JSON.stringify(
                      { arguments: check.args, result: check.result },
                      null,
                      2,
                    )}
                  </Box>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        {busy && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={16} />
              <Typography variant="body2">
                {t('networkAgent.running')}
              </Typography>
            </Stack>
            {streamed && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamed}
              </ReactMarkdown>
            )}
          </Box>
        )}
        {proposals.map((change) => (
          <Card key={change.id} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">
              {t(`networkAgent.fields.${change.field}`)}
            </Typography>
            <Typography component="pre" variant="body2">
              {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {change.reason}
            </Typography>
            <Button
              variant="contained"
              disabled={busy || changing}
              onClick={() => void apply(change)}
            >
              {t('networkAgent.apply')}
            </Button>
          </Card>
        ))}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            value={prompt}
            disabled={busy || changing}
            placeholder={t('networkAgent.placeholder')}
            onChange={(event) => setPrompt(event.target.value)}
          />
          {busy ? (
            <Button
              variant="outlined"
              startIcon={<Stop />}
              onClick={() => {
                if (requestIdRef.current)
                  void cancelNetworkAgent(requestIdRef.current)
              }}
            >
              {t('networkAgent.stop')}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={!prompt.trim() || changing}
              startIcon={<Send />}
              onClick={() => void send(prompt)}
            >
              {t('networkAgent.send')}
            </Button>
          )}
        </Stack>
      </Stack>
    </BasePage>
  )
}

export default NetworkAgentPage
