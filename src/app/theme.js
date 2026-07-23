import { createTheme } from "@mui/material/styles";

const DISPLAY = '"Fraunces", Georgia, "Times New Roman", serif';
const MONO = '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, ui-monospace, monospace';
const BODY = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ff8c42", dark: "#e5642b", contrastText: "#0a0806" },
    secondary: { main: "#86c7c0" },
    background: {
      default: "#07080c",
      paper: "rgba(10, 12, 18, 0.4)",
    },
    text: {
      primary: "#f2ecdd",
      secondary: "rgba(242, 236, 221, 0.6)",
    },
    divider: "rgba(242, 236, 221, 0.12)",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: BODY,
    h1: { fontFamily: MONO, fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: MONO, fontWeight: 700, letterSpacing: "-0.02em" },
    subtitle1: { fontFamily: DISPLAY, fontWeight: 600, letterSpacing: 0 },
    subtitle2: { fontFamily: DISPLAY, fontWeight: 600, letterSpacing: 0 },
    overline: {
      fontFamily: MONO,
      fontWeight: 500,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
    },
    caption: { fontFamily: MONO, letterSpacing: "0.02em" },
    button: { fontWeight: 700, textTransform: "none", letterSpacing: "0.01em" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(242, 236, 221, 0.12)",
          boxShadow: "0 18px 52px rgba(0, 0, 0, 0.3)",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(242, 236, 221, 0.05)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 9 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: MONO,
          fontSize: "0.68rem",
          letterSpacing: "0.02em",
          backgroundColor: "rgba(12, 10, 14, 0.94)",
          border: "1px solid rgba(242, 236, 221, 0.12)",
        },
      },
    },
  },
});
