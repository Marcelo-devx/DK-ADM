import { useEffect, useRef } from "react";

const KEEP_ALIVE_URL =
  "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/keep-alive";

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// Intervalo de 4 minutos — antes do cold start de ~5 min do Supabase
const INTERVAL_MS = 4 * 60 * 1000;

const ping = () =>
  fetch(KEEP_ALIVE_URL, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
  }).catch(() => {
    // silencia erros de rede — não deve quebrar nada
  });

export function useKeepAlive() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Primeiro ping imediato ao montar
    ping();

    // Pings periódicos a cada 4 minutos
    timerRef.current = setInterval(ping, INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
