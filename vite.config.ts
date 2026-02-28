import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    // Permite que o Vite exponha o servidor no ambiente e use a mesma origem da pré-visualização
    host: true,
    // Sem port/strictPort e sem HMR customizado para evitar conflitos de WebSocket
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));