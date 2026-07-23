import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import { LibraryRow } from "../../shared/LibraryRow";

export function VisualPanel({
  visualName,
  activeUrl,
  backgrounds,
  draftName,
  visualBrightness,
  onDraftNameChange,
  onUploadVisual,
  onSelectBackground,
  onRenameBackground,
  onRemoveBackground,
  onClearVisual,
  onBrightnessChange,
}) {
  const [listOpen, setListOpen] = useState(false);

  return (
    <Paper elevation={10} className="sidePanel visualPanel">
      <Box className="rowBetween">
        <Box className="rowCenter">
          <Box className="tinyIcon">
            <Icon name="image" fontSize="small" />
          </Box>
          <Typography variant="subtitle2" fontWeight={900}>
            Fundo
          </Typography>
        </Box>
        <Box
          component="button"
          type="button"
          className={listOpen ? "musicListToggle isOpen" : "musicListToggle"}
          onClick={() => setListOpen((current) => !current)}
        >
          {backgrounds.length} salvos
          <Icon name={listOpen ? "chevronDown" : "chevronRight"} fontSize="small" />
        </Box>
      </Box>

      {visualName ? (
        <Box className="visualFile rowBetween">
          <Typography variant="body2" noWrap>
            {visualName}
          </Typography>
          <Tooltip title="Tirar fundo">
            <IconButton size="small" onClick={onClearVisual} aria-label="Tirar fundo atual">
              <Icon name="close" fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}

      <Box className="settingLine">
        <Typography variant="body2" color="text.secondary">
          Brilho
        </Typography>
        <Box className="brightnessControl">
          <Slider
            size="small"
            min={20}
            max={100}
            step={5}
            value={visualBrightness}
            onChange={(_event, value) => onBrightnessChange(value)}
            aria-label="Brilho do fundo"
          />
          <Typography variant="caption" className="brightnessValue">
            {visualBrightness}%
          </Typography>
        </Box>
      </Box>

      <Collapse in={listOpen} unmountOnExit>
        <Box className="stackCol">
          <TextField
            fullWidth
            size="small"
            label="Nome do fundo"
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
          />
          <Button variant="outlined" component="label" size="small" startIcon={<Icon name="image" fontSize="small" />}>
            Subir imagem ou GIF
            <input hidden type="file" accept="image/*,.gif" onChange={onUploadVisual} />
          </Button>

          <Box className="videoList">
            {backgrounds.length ? (
              backgrounds.map((background) => (
                <LibraryRow
                  key={background.url}
                  active={activeUrl === background.url}
                  label={background.name}
                  onSelect={() => onSelectBackground(background)}
                  onRename={(name) => onRenameBackground(background.url, name)}
                  onRemove={() => onRemoveBackground(background.url)}
                  removeLabel="Remover fundo"
                />
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                Nenhum fundo salvo ainda.
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
