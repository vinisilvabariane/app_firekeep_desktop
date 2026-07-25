import { Component } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { Icon } from "../../shared/Icon";

// Rede de seguranca: um erro dentro do editor (Monaco, workers, etc.) fica
// contido aqui e mostra um aviso, em vez de derrubar o app inteiro para uma
// tela em branco.
export class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[firekeep] editor falhou:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Paper elevation={12} className={`codeEditor ${this.props.gridClassName ?? ""}`}>
          <Stack className="codeEditorHeader" direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography variant="body2" fontWeight={900} sx={{ flex: 1 }}>
              Nao consegui abrir o editor
            </Typography>
            <Tooltip title="Fechar editor">
              <IconButton size="small" onClick={this.props.onClose} aria-label="Fechar editor">
                <Icon name="close" fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              Ocorreu um erro ao carregar o editor de codigo. O restante do Firekeep
              continua funcionando normalmente.
            </Typography>
            <Typography variant="caption" className="codeEditorPath" sx={{ opacity: 0.7 }}>
              {String(this.state.error?.message || this.state.error)}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Icon name="refresh" fontSize="small" />}
              onClick={() => this.setState({ error: null })}
            >
              Tentar de novo
            </Button>
          </Stack>
        </Paper>
      );
    }
    return this.props.children;
  }
}
