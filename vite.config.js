import { defineConfig } from "vite";

// GitHub Pages project sites are served from /<repo>/. Local dev stays at /.
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
