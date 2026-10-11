import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ["pixi.js"],
          react: ["react", "react-dom"],
          network: ["msw", "axios", "@tanstack/react-query"],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
