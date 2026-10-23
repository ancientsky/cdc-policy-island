import { defineConfig } from "vite";

// GitHub Pages project sites are served from /<repo>/. Local dev stays at /.
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replaceAll("\\", "/");
          if (norm.includes("/node_modules/three/")) return "three";
          if (norm.endsWith("/src/i18n.js") || norm.endsWith("/src/data.js")) return "copy";
        },
      },
    },
  },
});
