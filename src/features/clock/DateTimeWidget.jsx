import { memo, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";

export const DateTimeWidget = memo(function DateTimeWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(now),
    [now],
  );

  const date = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(now),
    [now],
  );

  return (
    <Paper elevation={10} className="dateTimeWidget">
      <Box className="rowBetween">
        <Box className="rowCenter">
          <Box className="tinyIcon">
            <Icon name="calendar" fontSize="small" />
          </Box>
          <Typography variant="caption" color="text.secondary">
            agora
          </Typography>
        </Box>
      </Box>

      <Typography variant="h2" className="clockTime">
        {time}
      </Typography>
      <Typography variant="body2" color="text.secondary" className="clockDate">
        {date}
      </Typography>
    </Paper>
  );
});
