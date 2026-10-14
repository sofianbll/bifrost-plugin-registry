// Local Vite dev server for ui/ that proxies /api to the test copy's Registry panel (ssh tunnel on 127.0.0.1:8099).
// The admin token comes from the environment and is added server-side, so the browser never holds it.
const ui = process.env.UI_ROOT || new URL("../../ui", import.meta.url).pathname;
const { createServer } = await import(`${ui}/node_modules/vite/dist/node/index.js`);
const react = (await import(`${ui}/node_modules/@vitejs/plugin-react/dist/index.js`)).default;
const tailwind = (await import(`${ui}/node_modules/@tailwindcss/vite/dist/index.mjs`)).default;
const token = process.env.REGISTRY_ADMIN_TOKEN;
if (!token) throw new Error("REGISTRY_ADMIN_TOKEN is missing");
const server = await createServer({
  configFile: false, root: ui, base: "./",
  plugins: [react(), tailwind()],
  resolve: { alias: { "@": `${ui}/src` } },
  server: { host: "127.0.0.1", port: 8773, strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8099", headers: { Authorization: `Bearer ${token}` } } } },
});
await server.listen();
console.log("live panel on http://127.0.0.1:8773/");
