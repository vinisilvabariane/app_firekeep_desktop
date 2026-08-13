import { memo, useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import {
  checkoutGitBranch,
  commitGit,
  discardGitWorkingChanges,
  fetchDirectory,
  fetchGitAvailability,
  fetchGitDiff,
  fetchGitOverview,
  fetchGitStatus,
  pullGit,
  pushGit,
  resolveGitConflict,
  stageGitFile,
  unstageGitFile,
} from "../../shared/api";

export const GitWorkspace = memo(function GitWorkspace({ open, onClose, gridClassName = "", gridDraggable = false, onGridDragStart, onGridDragOver, onGridDrop }) {
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [diff, setDiff] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folder, setFolder] = useState(null);
  const [folderPathDraft, setFolderPathDraft] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchSelection, setBranchSelection] = useState("");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [gitAvailable, setGitAvailable] = useState(null);

  const checkGitAvailability = useCallback(async () => {
    try {
      const result = await fetchGitAvailability();
      setGitAvailable(result.available);
      return result.available;
    } catch {
      setGitAvailable(false);
      return false;
    }
  }, []);

  const refresh = useCallback(async (root = projectPath) => {
    const target = root.trim();
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const [nextStatus, nextOverview] = await Promise.all([
        fetchGitStatus(target),
        fetchGitOverview(target),
      ]);
      setStatus(nextStatus);
      setBranches(nextOverview.branches ?? []);
      setBranchSelection(nextStatus.branch);
      setProjectPath(nextStatus.root);
    } catch (cause) {
      setStatus(null);
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }, [projectPath]);

  useEffect(() => {
    if (!open) return;
    localStorage.removeItem("firekeep:gitProjectPath");
    checkGitAvailability();
  // Reabre apenas o último repositório confirmado, sem consultar a cada edição do campo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkGitAvailability, open]);

  const selectChange = useCallback(async (change, staged) => {
    setSelected({ ...change, staged });
    setDiff("");
    setError("");
    try {
      setDiff((await fetchGitDiff(projectPath, change.path, staged)).content);
    } catch (cause) {
      setError(cause.message);
    }
  }, [projectPath]);

  const act = useCallback(async (operation) => {
    setBusy(true);
    setError("");
    try {
      const next = await operation();
      setStatus(next);
      setSelected(null);
      setDiff("");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadFolder = useCallback(async (folderPath) => {
    try {
      const nextFolder = await fetchDirectory(folderPath);
      setFolder(nextFolder);
      setFolderPathDraft(nextFolder.path);
    } catch (cause) {
      setError(cause.message);
    }
  }, []);

  function openFolderPicker() {
    setFolderDialogOpen(true);
    loadFolder("C:\\");
  }

  async function selectFolder() {
    if (!folder?.path) return;
    setFolderDialogOpen(false);
    await refresh(folder.path);
  }

  async function switchBranch() {
    if (!branchSelection || branchSelection === status?.branch) return;
    await act(async () => {
      const next = await checkoutGitBranch(projectPath, branchSelection);
      setBranches(next.branches ?? []);
      setBranchSelection(next.branch);
      return next;
    });
  }

  if (!open) return null;
  if (gitAvailable === false) return (
    <Paper className={`gitWorkspace ${gridClassName} gitUnavailable`} elevation={14}>
      <Box className="gitUnavailableCard">
        <Box className="gitUnavailableMark"><Icon name="git" fontSize="medium" /></Box>
        <Typography variant="h6">Instale o Git para usar este painel</Typography>
        <Typography variant="body2">O Firekeep usa o Git instalado no computador para ver alterações, criar commits e sincronizar seu projeto.</Typography>
        <Box className="gitUnavailableActions">
          <Button component="a" href="https://git-scm.com/install/windows" target="_blank" rel="noreferrer" variant="contained">Instalar Git para Windows</Button>
          <Button onClick={checkGitAvailability}>Já instalei, verificar</Button>
        </Box>
      </Box>
    </Paper>
  );
  const changes = status?.changes ?? [];
  const conflicts = changes.filter(isConflict);
  const staged = changes.filter((item) => !isConflict(item) && item.index !== " " && item.index !== "?");
  const unstaged = changes.filter((item) => !isConflict(item) && (item.worktree !== " " || item.index === "?"));

  return (
    <Paper className={`gitWorkspace ${gridClassName}`} elevation={14} onDragOver={onGridDragOver} onDrop={onGridDrop}>
      {gridDraggable ? <GridDragHandle onDragStart={onGridDragStart} /> : null}
      <Box className="gitHeader">
        <Box className="gitTitle">
          <Icon name="git" fontSize="small" />
          <Box>
            <Typography className="gitEyebrow">CONTROLE DE VERSÃO</Typography>
            <Typography className="gitBranch">{status?.branch ?? "Abra um repositório"}</Typography>
          </Box>
        </Box>
        <Box className="gitHeaderActions">
          <Tooltip title="Atualizar"><span><IconButton onClick={() => refresh()} disabled={busy || !projectPath.trim()}><Icon name="refresh" fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title="Fechar Git"><IconButton onClick={onClose}><Icon name="close" fontSize="small" /></IconButton></Tooltip>
        </Box>
      </Box>

      <Box className="gitToolbar">
        <TextField value={projectPath} onChange={(event) => setProjectPath(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") refresh(); }} placeholder="Pasta do repositório" size="small" fullWidth disabled={busy} />
        <Button size="small" onClick={openFolderPicker} disabled={busy}>Procurar</Button>
        <Button size="small" variant="contained" onClick={() => refresh()} disabled={busy || !projectPath.trim()}>Abrir</Button>
      </Box>

      {status ? (
        <Box className="gitRepositoryBar">
          <Typography variant="caption" title={status.root}>{status.root}</Typography>
          <Box className="gitRepositoryActions">
            {status.upstream ? <Typography variant="caption">{status.ahead || 0} à frente · {status.behind || 0} atrás</Typography> : null}
            <Button size="small" color="error" onClick={() => setDiscardDialogOpen(true)} disabled={busy || !unstaged.length}>Desfazer locais</Button>
            <Button size="small" onClick={() => act(() => pullGit(projectPath))} disabled={busy || !status.upstream}>Pull</Button>
            <Button size="small" variant="contained" onClick={() => act(() => pushGit(projectPath))} disabled={busy || !status.upstream}>Push</Button>
          </Box>
        </Box>
      ) : null}

      <Box className="gitBody">
        <Box className="gitChanges">
          <Box className="gitChangesHeading"><Typography className="gitSectionTitle">ALTERAÇÕES</Typography><Typography variant="caption">{changes.length}</Typography></Box>
          {conflicts.length ? <ConflictList items={conflicts} busy={busy} onResolve={(item, strategy) => act(() => resolveGitConflict(projectPath, item.path, strategy))} /> : null}
          <GitList title={`Prontos para commit · ${staged.length}`} items={staged} selected={selected} onSelect={(item) => selectChange(item, true)} action="−" onAction={(item) => act(() => unstageGitFile(projectPath, item.path))} />
          <GitList title={`Alterações locais · ${unstaged.length}`} items={unstaged} selected={selected} onSelect={(item) => selectChange(item, false)} action="+" onAction={(item) => act(() => stageGitFile(projectPath, item.path))} />
        </Box>
        <Box className="gitDiff">
          <Typography className="gitSectionTitle">{selected ? `${selected.staged ? "PREPARADO" : "LOCAL"} · ${selected.path}` : "DIFF"}</Typography>
          <DiffContent content={diff} empty={selected ? "Sem diferenças de texto para exibir." : "Selecione um arquivo para revisar as mudanças."} />
        </Box>
      </Box>

      <Box className="gitFooter">
        <Box className="gitBranchControl">
          <select value={branchSelection} onChange={(event) => setBranchSelection(event.target.value)} disabled={busy || !status} aria-label="Escolher branch">
            {branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.current ? `✓ ${branch.name}` : branch.name}</option>)}
          </select>
          <Button size="small" onClick={switchBranch} disabled={busy || !branchSelection || branchSelection === status?.branch}>Trocar</Button>
        </Box>
        <Box className="gitCommit">
          <TextField value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Mensagem do commit" size="small" fullWidth disabled={busy || !status} />
          <Button variant="contained" onClick={() => act(async () => { const next = await commitGit(projectPath, message); setMessage(""); return next; })} disabled={busy || !message.trim() || !staged.length}>Commit</Button>
        </Box>
      </Box>

      {error ? <Box className="gitError">{error}</Box> : null}

      <Dialog open={discardDialogOpen} onClose={() => setDiscardDialogOpen(false)} PaperProps={{ className: "gitConfirmDialog" }}>
        <DialogContent><Typography variant="subtitle2" fontWeight={800}>Desfazer alterações locais?</Typography><Typography variant="body2">As mudanças não preparadas serão substituídas pela última versão do Git. Arquivos não rastreados e itens já preparados não serão alterados.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDiscardDialogOpen(false)}>Cancelar</Button><Button color="error" variant="contained" onClick={() => { setDiscardDialogOpen(false); act(() => discardGitWorkingChanges(projectPath)); }}>Desfazer alterações</Button></DialogActions>
      </Dialog>

      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} PaperProps={{ className: "gitFolderDialog" }}>
        <DialogContent className="gitFolderDialogContent">
          <Box className="gitFolderDialogHead"><Box className="gitFolderDialogIcon"><Icon name="folderOpen" fontSize="small" /></Box><Box><Typography variant="subtitle2" fontWeight={900}>Abrir repositório</Typography><Typography variant="caption">Escolha a pasta raiz do projeto.</Typography></Box></Box>
          <Box className="gitFolderGo"><TextField value={folderPathDraft} onChange={(event) => setFolderPathDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") loadFolder(folderPathDraft); }} size="small" fullWidth /><Button onClick={() => loadFolder(folderPathDraft)} disabled={!folderPathDraft.trim()}>Ir</Button></Box>
          <Typography className="gitFolderPath">{folder?.path ?? "Carregando..."}</Typography>
          <Box className="gitFolderList">{folder?.parent ? <button type="button" onClick={() => loadFolder(folder.parent)}><Icon name="folderUp" fontSize="inherit" /> Subir um nível</button> : null}{folder?.entries?.filter((entry) => entry.type === "dir").map((entry) => <button type="button" key={entry.path} onClick={() => loadFolder(entry.path)}><Icon name="folder" fontSize="inherit" /> {entry.name}</button>)}</Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setFolderDialogOpen(false)}>Cancelar</Button><Button variant="contained" onClick={selectFolder} disabled={!folder?.path}>Usar pasta</Button></DialogActions>
      </Dialog>
    </Paper>
  );
});

function GridDragHandle({ onDragStart }) {
  return <Box className="gridDragHandle" draggable onDragStart={onDragStart} aria-label="Arraste para trocar a posição desta tela"><Icon name="grid" fontSize="inherit" /> Mover</Box>;
}

function GitList({ title, items, selected, onSelect, action, onAction }) {
  return <Box className="gitList"><Typography className="gitListTitle">{title}</Typography>{items.length ? items.map((item) => <Box key={`${item.index}${item.worktree}${item.path}`} className={selected?.path === item.path ? "gitFile isSelected" : "gitFile"}><button type="button" className="gitFileOpen" onClick={() => onSelect(item)}><span className="gitStatus">{item.index}{item.worktree}</span><span>{item.path}</span></button><IconButton className="gitFileAction" size="small" onClick={() => onAction(item)} aria-label={action === "+" ? "Preparar arquivo" : "Retirar arquivo do commit"}><Typography component="span">{action}</Typography></IconButton></Box>) : <Typography className="gitEmpty">Nenhuma alteração</Typography>}</Box>;
}

function ConflictList({ items, busy, onResolve }) {
  return <Box className="gitConflictList"><Typography className="gitListTitle">CONFLITOS · {items.length}</Typography>{items.map((item) => <Box key={item.path} className="gitConflict"><Typography>{item.path}</Typography><Box><Button size="small" onClick={() => onResolve(item, "ours")} disabled={busy}>Manter minha</Button><Button size="small" variant="contained" onClick={() => onResolve(item, "theirs")} disabled={busy}>Manter recebida</Button></Box></Box>)}</Box>;
}

function DiffContent({ content, empty }) {
  if (!content) return <Typography className="gitDiffEmpty">{empty}</Typography>;
  return <pre className="gitDiffContent">{content.split("\n").map((line, index) => <span key={`${index}-${line}`} className={line.startsWith("+") && !line.startsWith("+++") ? "isAdded" : line.startsWith("-") && !line.startsWith("---") ? "isRemoved" : line.startsWith("@@") ? "isHunk" : ""}>{line || " "}{"\n"}</span>)}</pre>;
}

function isConflict(item) {
  return item.index === "U" || item.worktree === "U" || ["AA", "DD"].includes(`${item.index}${item.worktree}`);
}
