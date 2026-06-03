import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Builds the SPA directly into the backend's public folder so the backend
// serves it without any extra copy step.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "..", "backend", "public"),
    emptyOutDir: true,
  },
});
