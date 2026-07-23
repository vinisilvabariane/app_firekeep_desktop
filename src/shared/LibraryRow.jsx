import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { Icon } from "./Icon";

export function LibraryRow({ active, label, onSelect, onRename, onRemove, removeLabel = "Remover" }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  function startEdit() {
    setValue(label);
    setEditing(true);
  }

  function commit() {
    const next = value.trim();
    if (next && next !== label) onRename(next);
    setEditing(false);
  }

  return (
    <Box className={active ? "videoItem isActive" : "videoItem"}>
      {editing ? (
        <TextField
          className="renameField"
          size="small"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
        />
      ) : (
        <Box component="button" className="videoSelect" type="button" onClick={onSelect}>
          {label}
        </Box>
      )}

      {editing ? (
        <Tooltip title="Confirmar">
          <IconButton size="small" onMouseDown={(event) => event.preventDefault()} onClick={commit} aria-label="Confirmar nome">
            <Icon name="save" fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <>
          <Tooltip title="Renomear">
            <IconButton size="small" onClick={startEdit} aria-label="Renomear">
              <Icon name="edit" fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={removeLabel}>
            <IconButton size="small" onClick={onRemove} aria-label={removeLabel}>
              <Icon name="close" fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
