import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

createApp().listen(PORT, () => {
  console.log(`Justif backend started on http://localhost:${PORT}`);
});
