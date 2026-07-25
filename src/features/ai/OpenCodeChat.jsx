import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import {
  abortOpenCodeMessage,
  createOpenCodeSession,
  fetchOpenCodeStatus,
  sendOpenCodeMessage,
  startOpenCode,
} from "../../shared/api";

export const OpenCodeChat = memo(function OpenCodeChat({ open, onClose, gridClassName = "", gridDraggable = false, onGridDragStart, onGridDragOver, onGridDrop }) {
  const [status, setStatus] = useState({ checking: true, connected: false, version: "" });
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const transcriptRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    setStatus((current) => ({ ...current, checking: true }));
    try {
      const next = await fetchOpenCodeStatus();
      setStatus({ ...next, checking: false });
    } catch (requestError) {
      setStatus({ checking: false, connected: false, version: "" });
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    if (open) refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, sending]);

  const start = useCallback(async () => {
    setError("");
    setStatus((current) => ({ ...current, checking: true }));
    try {
      const next = await startOpenCode();
      setStatus({ ...next, checking: false, connected: true });
    } catch (requestError) {
      setStatus({ checking: false, connected: false, version: "" });
      setError(requestError.message);
    }
  }, []);

  const createSession = useCallback(async () => {
    const response = await createOpenCodeSession();
    setSessionId(response.session.id);
    return response.session.id;
  }, []);

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      const prompt = draft.trim();
      if (!prompt || sending || !status.connected) return;

      setSending(true);
      setError("");
      setDraft("");
      setMessages((current) => [...current, { info: { role: "user", id: `local-${Date.now()}` }, parts: [{ type: "text", text: prompt }] }]);
      try {
        const id = sessionId ?? (await createSession());
        const response = await sendOpenCodeMessage(id, prompt);
        setMessages((current) => [...current, response.message]);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSending(false);
      }
    },
    [createSession, draft, sending, sessionId, status.connected],
  );

  const abort = useCallback(async () => {
    if (!sessionId) return;
    try {
      await abortOpenCodeMessage(sessionId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }, [sessionId]);

  const visibleMessages = useMemo(() => messages.filter((message) => readMessageText(message)), [messages]);
  if (!open) return null;

  return (
    <Paper elevation={14} className={`aiWorkspace ${gridClassName}`} onDragOver={onGridDragOver} onDrop={onGridDrop}>
      {gridDraggable ? <GridDragHandle onDragStart={onGridDragStart} /> : null}
      <Box className="aiHeader">
        <Box className="rowCenter">
          <Box className="aiMark">
            <Icon name="chat" fontSize="small" />
          </Box>
          <Box>
            <Typography className="aiTitle">Firekeep AI</Typography>
            <Typography variant="caption" color="text.secondary">
              {status.connected ? `OpenCode local${status.version ? ` · ${status.version}` : ""}` : "OpenCode desconectado"}
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Fechar AI">
          <IconButton className="glassButton" onClick={onClose} aria-label="Fechar AI">
            <Icon name="close" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {!status.connected ? (
        <Box className="aiEmpty">
          <Icon name="chat" fontSize="large" />
          <Typography variant="h6">Conecte o OpenCode</Typography>
          <Typography variant="body2" color="text.secondary">
            O Firekeep inicia o servidor local e usa o agente de planejamento, sem editar arquivos ou executar comandos.
          </Typography>
          <Button className="startButton" variant="contained" onClick={start} disabled={status.checking} startIcon={<Icon name="play" />}>
            {status.checking ? "Verificando…" : "Iniciar OpenCode"}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Requer o CLI do OpenCode instalado e um provedor configurado.
          </Typography>
        </Box>
      ) : (
        <>
          <Box ref={transcriptRef} className="aiTranscript" aria-live="polite">
            {visibleMessages.length ? (
              visibleMessages.map((message, index) => (
                <Box key={message.info?.id ?? index} className={message.info?.role === "user" ? "aiMessage isUser" : "aiMessage"}>
                  <Typography className="aiMessageLabel">{message.info?.role === "user" ? "Você" : "OpenCode"}</Typography>
                  <Typography component="div" className="aiMessageText">
                    {readMessageText(message)}
                  </Typography>
                </Box>
              ))
            ) : (
              <Box className="aiWelcome">
                <Typography variant="h6">Pronto para pensar no projeto.</Typography>
                <Typography variant="body2" color="text.secondary">
                  Peça uma explicação, uma revisão ou um plano de alteração. Esta primeira versão opera em modo de leitura.
                </Typography>
              </Box>
            )}
            {sending ? <Typography className="aiThinking">OpenCode está pensando…</Typography> : null}
          </Box>
          <Box component="form" className="aiComposer" onSubmit={submit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Pergunte sobre o projeto…"
              rows={2}
              disabled={sending}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) submit(event);
              }}
            />
            {sending ? (
              <Tooltip title="Interromper resposta">
                <IconButton className="aiAbortButton" onClick={abort} aria-label="Interromper resposta">
                  <Icon name="close" fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <IconButton className="aiSendButton" type="submit" aria-label="Enviar mensagem" disabled={!draft.trim()}>
                <Icon name="arrowUp" fontSize="small" />
              </IconButton>
            )}
          </Box>
        </>
      )}
      {error ? <Box className="aiError">{error}</Box> : null}
    </Paper>
  );
});

function GridDragHandle({ onDragStart }) {
  return (
    <Box className="gridDragHandle" draggable onDragStart={onDragStart} aria-label="Arraste para trocar a posição desta tela">
      <Icon name="grid" fontSize="inherit" />
      Mover
    </Box>
  );
}

function readMessageText(message) {
  return (message?.parts ?? [])
    .filter((part) => part?.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}
