import { memo } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import firekeepSymbol from "../../assets/logo-sem-fundo.png";
import { Icon } from "../../shared/Icon";

export const WindowChrome = memo(function WindowChrome({ version }) {
  const windowApi = globalThis.window?.firekeepWindow;
  if (!windowApi) return null;

  return (
    <Box className="windowChrome">
      <Box className="windowBrand">
        <Box className="windowAppIcon" component="img" src={firekeepSymbol} alt="" />
        <span className="windowWordmark">Firekeep</span>
        <span className="windowVersion">v{version}</span>
      </Box>
      <Box className="windowControls">
        <Tooltip title="Minimizar">
          <IconButton size="small" onClick={windowApi.minimize} aria-label="Minimizar janela">
            <Icon name="minimize" fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Maximizar">
          <IconButton size="small" onClick={windowApi.toggleMaximize} aria-label="Maximizar janela">
            <Icon name="maximize" fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fechar">
          <IconButton className="closeWindowButton" size="small" onClick={windowApi.close} aria-label="Fechar janela">
            <Icon name="close" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
});
