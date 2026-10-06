import { DeleteOutlined, ExpandMore, Send, Stop } from '@mui/icons-material'
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
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { memo, useEffect, useRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { BasePage } from '@/components/base'
import {
  applySessionChange,
  clearNetworkConversation,
  getNetworkSession,
  refreshNetworkStatus,
  sendNetworkMessage,
  setNetworkDraft,
  stopNetworkMessage,
  subscribeNetworkSession,
  undoSessionChange,
  type NetworkMessage,
} from '@/services/network-agent-session'

const MessageCard = memo(({ message }: { message: NetworkMessage }) => {
  const { t } = useTranslation()
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        flexShrink: 0,
        ml: message.role === 'user' ? 4 : 0,
        bgcolor: message.role === 'user' ? 'action.hover' : 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {message.role === 'user'
            ? t('networkAgent.you')
            : t('networkAgent.assistant')}
        </Typography>
        {message.status === 'running' && <CircularProgress size={12} />}
        {message.status === 'interrupted' && (
          <Typography variant="caption" color="text.secondary">
            {t('networkAgent.interrupted')}
          </Typography>
        )}
      </Stack>
      <Box
        sx={{
          fontSize: 14,
          lineHeight: 1.7,
          overflowWrap: 'anywhere',
          '& > :first-of-type': { mt: 0 },
          '& > :last-child': { mb: 0 },
          '& h1': { fontSize: '1.35em' },
          '& h2': { fontSize: '1.2em' },
          '& h3': { fontSize: '1.1em' },
          '& pre': {
            overflow: 'auto',
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
          },
          '& table': {
            borderCollapse: 'collapse',
            display: 'block',
            overflowX: 'auto',
          },
          '& td, & th': { border: '1px solid', borderColor: 'divider', p: 0.5 },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.text}
        </ReactMarkdown>
      </Box>
      {!!message.checks?.length && (
        <Accordion disableGutters elevation={0} sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="body2">
              {t('networkAgent.evidence')} ({message.checks.length})
              {message.status === 'running'
                ? ` · ${message.checks.at(-1)?.name}`
                : ''}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {message.checks.map((check) => (
              <Box key={check.id} sx={{ mb: 1 }}>
                <Chip
                  size="small"
                  color={
                    check.isError ? 'error' : check.done ? 'success' : 'default'
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
      {!message.text && message.status === 'running' && (
        <Typography variant="body2" color="text.secondary">
          {t('networkAgent.running')}
        </Typography>
      )}
    </Card>
  )
})

const NetworkAgentPage = () => {
  const { t } = useTranslation()
  const session = useSyncExternalStore(
    subscribeNetworkSession,
    getNetworkSession,
  )
  const {
    messages,
    proposals,
    draft,
    busy,
    changing,
    status,
    error,
    notice,
    model,
    storageError,
  } = session
  const scrollRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)

  useEffect(() => {
    void refreshNetworkStatus()
  }, [])
  useEffect(() => {
    const element = scrollRef.current
    if (element && followRef.current) element.scrollTop = element.scrollHeight
  }, [messages, proposals, error, notice])
  const send = (text: string) => {
    followRef.current = true
    void sendNetworkMessage(text)
  }

  return (
    <BasePage
      title={t('networkAgent.title')}
      full
      contentStyle={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      header={
        <Tooltip title={t('networkAgent.clear')}>
          <span>
            <IconButton
              size="small"
              disabled={busy || changing || !messages.length}
              onClick={clearNetworkConversation}
            >
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Chip label={`Pi · ${model}`} color="primary" size="small" />
          <Chip
            label={t('networkAgent.terminalEnabled')}
            size="small"
            variant="outlined"
          />
          {status && (
            <Chip
              size="small"
              label={`${status.mode} · :${status.mixedPort}`}
            />
          )}
          <Button
            size="small"
            disabled={busy || changing || !status?.undoAvailable}
            onClick={() => void undoSessionChange()}
          >
            {t('networkAgent.undo')}
          </Button>
        </Stack>
      </Box>
      <Box
        ref={scrollRef}
        onScroll={() => {
          const element = scrollRef.current
          if (element)
            followRef.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80
        }}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          px: 2,
          py: 2,
          scrollbarGutter: 'stable',
        }}
      >
        <Stack spacing={1.5} sx={{ maxWidth: 1000, mx: 'auto' }}>
          {!messages.length && (
            <Box sx={{ py: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('networkAgent.welcome')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('networkAgent.description')}
              </Typography>
            </Box>
          )}
          {messages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
          {error && <Alert severity="error">{error}</Alert>}
          {storageError && (
            <Alert severity="warning">{t('networkAgent.storageError')}</Alert>
          )}
          {notice && (
            <Alert severity="success">{t(`networkAgent.${notice}`)}</Alert>
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
                onClick={() => void applySessionChange(change)}
              >
                {t('networkAgent.apply')}
              </Button>
            </Card>
          ))}
        </Stack>
      </Box>
      <Box
        sx={{
          px: 2,
          pt: 1,
          pb: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Stack spacing={1} sx={{ maxWidth: 1000, mx: 'auto' }}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              disabled={busy || changing}
              onClick={() => send(t('networkAgent.diagnosisPrompt'))}
            >
              {t('networkAgent.diagnose')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busy || changing}
              onClick={() => send(t('networkAgent.configurationPrompt'))}
            >
              {t('networkAgent.configure')}
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              value={draft}
              disabled={changing}
              placeholder={t('networkAgent.placeholder')}
              onChange={(event) => setNetworkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  event.nativeEvent.keyCode !== 229
                ) {
                  event.preventDefault()
                  if (!busy && !changing) send(draft)
                }
              }}
            />
            {busy ? (
              <Button
                variant="outlined"
                startIcon={<Stop />}
                sx={{ flexShrink: 0, minWidth: 88, whiteSpace: 'nowrap' }}
                onClick={() => void stopNetworkMessage()}
              >
                {t('networkAgent.stop')}
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={!draft.trim() || changing}
                startIcon={<Send />}
                sx={{ flexShrink: 0, minWidth: 88, whiteSpace: 'nowrap' }}
                onClick={() => send(draft)}
              >
                {t('networkAgent.send')}
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('networkAgent.inputHint')}
          </Typography>
        </Stack>
      </Box>
    </BasePage>
  )
}

export default NetworkAgentPage
