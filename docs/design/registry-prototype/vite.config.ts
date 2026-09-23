import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  base: "/bifrost-registry/",
  plugins: [react(), tailwind()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
