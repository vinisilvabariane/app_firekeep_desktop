import { memo, useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  createFileSystemEntry,
  deleteFileSystemEntry,
  fetchDirectory,
  moveFileSystemEntry,
} from "../../shared/api";
import { Icon } from "../../shared/Icon";

export const FileExplorer = memo(function FileExplorer({
  open,
  onToggleOpen,
  onOpenFile,
  activePath,
  gridClassName = "",
}) {
  const [dir, setDir] = useState(null);
  const [error, setError] = useState(null);
  const [createTargetPath, setCreateTargetPath] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [createName, setCreateName] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshRequest, setRefreshRequest] = useState(null);
  const createInputRef = useRef(null);
  const loadRequestRef = useRef(0);

  const load = useCallback((dirPath) => {
    const requestId = ++loadRequestRef.current;
    fetchDirectory(dirPath)
      .then((data) => {
        if (requestId !== loadRequestRef.current) return;
        setDir(data);
        setCreateTargetPath(data.path);
        setError(null);
      })
      .catch((loadError) => {
        if (requestId === loadRequestRef.current) setError(loadError.message);
      });
  }, []);

  useEffect(() => {
    if (open && !dir) load(undefined);
  }, [dir, load, open]);

  useEffect(() => {
    if (createDraft) {
      createInputRef.current?.focus();
      createInputRef.current?.select();
    }
  }, [createDraft]);

  function openCreateDraft(type, target) {
    setCreateTargetPath(target.path);
    setCreateName(type === "dir" ? "Nova pasta" : "novo-arquivo.txt");
    setCreateDraft({ type, target });
    setContextMenu(null);
    setError(null);
  }

  function closeCreateDraft() {
    setCreateDraft(null);
    setCreateName("");
  }

  async function createEntry(event) {
    event?.preventDefault();
    const type = createDraft?.type;
    const name = normalizeCreateName(createName, type);
    const basePath = createDraft?.target.path || createTargetPath || dir?.path;
    if (!name || !basePath) return;

    try {
      await createFileSystemEntry(basePath, name, type);
      closeCreateDraft();
      if (dir?.path === basePath) {
        load(basePath);
      } else {
        load(dir?.path);
      }
      setRefreshRequest({ path: basePath, id: Date.now() });
    } catch (createError) {
      setError(`${createError.message} Destino: ${basePath}`);
    }
  }

  function requestDeleteEntry(target) {
    setContextMenu(null);
    setDeleteTarget(target);
  }

  async function copyTargetPath(target) {
    if (!target?.path) return;

    try {
      if (typeof window.firekeepWindow?.copyToClipboard === "function") {
        await window.firekeepWindow.copyToClipboard(target.path);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(target.path);
      } else {
        throw new Error("Area de transferencia indisponivel.");
      }
      setContextMenu(null);
      setError(null);
    } catch (copyError) {
      setError(`Nao foi possivel copiar o caminho: ${copyError.message}`);
    }
  }

  async function confirmDeleteEntry() {
    if (!deleteTarget) return;
    try {
      const result = await deleteFileSystemEntry(deleteTarget.path);
      closeCreateDraft();
      setDeleteTarget(null);
      load(dir?.path);
      setRefreshRequest({ path: result.entry.parent, id: Date.now() });
    } catch (deleteError) {
      setError(`${deleteError.message} Item: ${deleteTarget.path}`);
    }
  }

  async function moveEntry(source, destination) {
    if (source.path === destination.path) return;

    try {
      const result = await moveFileSystemEntry(source.path, destination.path);
      closeCreateDraft();
      load(dir?.path);
      setRefreshRequest({ path: result.entry.parent, extraPath: result.entry.oldParent, id: Date.now() });
    } catch (moveError) {
      setError(`${moveError.message} Destino: ${destination.path}`);
    }
  }

  function handleEntryContextMenu(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (target.type === "dir") {
      setCreateTargetPath(target.path);
    }
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      target,
    });
  }

  if (!open) {
    return null;
  }

  return (
    <Paper elevation={10} className={`fileExplorer ${gridClassName}`}>
      <Box className="explorerHeader">
        <Box className="widgetIcon explorerIcon">
          <Icon name="folder" fontSize="small" />
        </Box>
        <Typography variant="subtitle2" fontWeight={900} noWrap>
          Explorador
        </Typography>
        <Tooltip title="Subir um nivel">
          <span>
            <IconButton
              size="small"
              disabled={!dir?.parent}
              onClick={() => dir?.parent && load(dir.parent)}
              aria-label="Subir um nivel no explorador"
            >
              <Icon name="folderUp" fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Recolher">
          <IconButton size="small" onClick={onToggleOpen} aria-label="Recolher explorador">
            <Icon name="chevronLeft" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Typography variant="caption" className="explorerPath" noWrap>
        {dir?.path ?? "..."}
      </Typography>

      {createDraft ? (
        <Box component="form" className="explorerCreateBar" onSubmit={createEntry}>
          <Typography
            variant="caption"
            className="explorerCreateTarget"
            noWrap
            title={createDraft.target.path}
          >
            {createDraft.type === "dir" ? "Nova pasta" : "Novo arquivo"} em: {createDraft.target.name}
          </Typography>
          <Box className="explorerCreateControls">
            <input
              ref={createInputRef}
              className="explorerCreateInput"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeCreateDraft();
                }
              }}
              placeholder="nome"
              aria-label="Nome do novo arquivo ou pasta"
            />
            <Tooltip title="Criar">
              <span>
                <IconButton
                  className="explorerCreateButton"
                  size="small"
                  type="submit"
                  disabled={!createName.trim()}
                  aria-label="Criar"
                >
                  <Icon name="add" fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Cancelar">
              <IconButton
                className="explorerCreateButton"
                size="small"
                type="button"
                onClick={closeCreateDraft}
                aria-label="Cancelar criacao"
              >
                <Icon name="close" fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ) : null}

      {error ? (
        <Typography variant="caption" color="error" className="explorerError">
          {error}
        </Typography>
      ) : null}

      <Box
        className="explorerTree"
        onContextMenu={(event) => {
          if (dir && event.target === event.currentTarget) {
            handleEntryContextMenu(event, { name: "pasta atual", path: dir.path, type: "dir" });
          }
        }}
      >
        {(dir?.entries ?? []).map((entry) => (
          <TreeNode
            key={entry.path}
            node={entry}
            depth={0}
            onEnterDirectory={load}
            onOpenFile={onOpenFile}
            onMoveEntry={moveEntry}
            onOpenEntryMenu={handleEntryContextMenu}
            onSelectDirectory={setCreateTargetPath}
            selectedDirectoryPath={createTargetPath}
            activePath={activePath}
            refreshRequest={refreshRequest}
          />
        ))}
      </Box>
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        slotProps={{ paper: { className: "explorerContextMenu" } }}
      >
        <MenuItem onClick={() => copyTargetPath(contextMenu?.target)}>
          <Icon name="copy" fontSize="small" />
          Copiar caminho
        </MenuItem>
        {contextMenu?.target.type === "dir" ? (
          <MenuItem onClick={() => openCreateDraft("dir", contextMenu.target)}>
            <Icon name="folderAdd" fontSize="small" />
            Nova pasta
          </MenuItem>
        ) : null}
        {contextMenu?.target.type === "dir" ? (
          <MenuItem onClick={() => openCreateDraft("file", contextMenu.target)}>
            <Icon name="fileAdd" fontSize="small" />
            Novo arquivo
          </MenuItem>
        ) : null}
        {contextMenu?.target.path !== dir?.path ? (
          <MenuItem className="isDanger" onClick={() => requestDeleteEntry(contextMenu.target)}>
            <Icon name="trash" fontSize="small" />
            Apagar
          </MenuItem>
        ) : null}
      </Menu>
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{ className: "deleteDialog" }}
      >
        <DialogContent className="deleteDialogContent">
          <Box className="deleteDialogIcon">
            <Icon name="trash" fontSize="small" />
          </Box>
          <Box className="deleteDialogCopy">
            <Typography variant="subtitle2" fontWeight={900}>
              Apagar {deleteTarget?.type === "dir" ? "pasta" : "arquivo"}
            </Typography>
            <Typography variant="body2">
              {deleteTarget?.name}
            </Typography>
            <Typography variant="caption">
              Esta acao remove o item do disco.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions className="deleteDialogActions">
          <Button onClick={() => setDeleteTarget(null)} className="deleteDialogCancel">
            Cancelar
          </Button>
          <Button onClick={confirmDeleteEntry} className="deleteDialogConfirm" autoFocus>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
});

function normalizeCreateName(value, type) {
  const name = value.trim();
  if (!name || type !== "file") return name;
  if (/\.[^.]+$/.test(name)) return name;
  return `${name.replace(/\.+$/, "")}.txt`;
}

function TreeNode({
  node,
  depth,
  onEnterDirectory,
  onOpenFile,
  onMoveEntry,
  onOpenEntryMenu,
  onSelectDirectory,
  selectedDirectoryPath,
  activePath,
  refreshRequest,
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDirectory(node.path);
      setChildren(data.entries);
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [node.path]);

  useEffect(() => {
    const shouldRefresh = refreshRequest?.path === node.path || refreshRequest?.extraPath === node.path;
    if (node.type === "dir" && expanded && shouldRefresh) {
      loadChildren();
    }
  }, [
    expanded,
    loadChildren,
    node.path,
    node.type,
    refreshRequest?.extraPath,
    refreshRequest?.id,
    refreshRequest?.path,
  ]);

  async function handleClick() {
    if (node.type !== "dir") {
      onOpenFile(node);
      return;
    }

    onSelectDirectory?.(node.path);
    if (!expanded && !children) {
      await loadChildren();
    }
    setExpanded((current) => !current);
  }

  const isActive = node.type === "file" && activePath === node.path;
  const isSelectedDirectory = node.type === "dir" && selectedDirectoryPath === node.path;
  const glyph = node.type === "dir" ? (expanded ? "chevronDown" : "chevronRight") : "file";
  const className = [
    "treeRow",
    isActive ? "isActive" : "",
    isSelectedDirectory ? "isSelectedDirectory" : "",
    dragOver ? "isDropTarget" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Box
        component="div"
        role="button"
        tabIndex={0}
        draggable
        className={className}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
        onContextMenu={(event) => {
          onOpenEntryMenu(event, node);
        }}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "copyMove";
          event.dataTransfer.setData("application/firekeep-path", JSON.stringify(node));
          event.dataTransfer.setData("text/plain", node.path);
        }}
        onDragOver={(event) => {
          if (node.type === "dir") {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDragEnter={(event) => {
          if (node.type === "dir") {
            event.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          if (node.type === "dir" && !event.currentTarget.contains(event.relatedTarget)) {
            setDragOver(false);
          }
        }}
        onDrop={(event) => {
          if (node.type !== "dir") return;
          event.preventDefault();
          event.stopPropagation();
          setDragOver(false);
          const raw = event.dataTransfer.getData("application/firekeep-path");
          if (!raw) return;
          try {
            const source = JSON.parse(raw);
            onMoveEntry?.(source, node);
          } catch {
            setDragOver(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
      >
        <Icon name={glyph} fontSize="small" className={node.type === "dir" ? "treeGlyph" : "treeGlyph isFile"} />
        <span className="treeLabel">{node.name}</span>
        {node.type === "dir" ? (
          <span className="treeFolderNav">
            <Tooltip title="Entrar na pasta">
              <IconButton
                className="treeLevelButton"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDirectory?.(node.path);
                  onEnterDirectory(node.path);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label={`Entrar na pasta ${node.name}`}
              >
                <Icon name="folderOpen" fontSize="small" />
              </IconButton>
            </Tooltip>
          </span>
        ) : null}
        {loading ? <span className="treeLoading">...</span> : null}
      </Box>
      {expanded && children
        ? children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onEnterDirectory={onEnterDirectory}
              onOpenFile={onOpenFile}
              onMoveEntry={onMoveEntry}
              onOpenEntryMenu={onOpenEntryMenu}
              onSelectDirectory={onSelectDirectory}
              selectedDirectoryPath={selectedDirectoryPath}
              activePath={activePath}
              refreshRequest={refreshRequest}
            />
          ))
        : null}
    </>
  );
}
