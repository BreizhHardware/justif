import { Router } from "express";
import { getRateCached, listSupportedCurrencies } from "../services/currencyService.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const currencies = await listSupportedCurrencies();
    res.json(currencies);
  } catch (err) {
    console.error("[currencies] Frankfurter error:", err);
    res.status(502).json({ error: "Currency service unavailable" });
  }
});

router.get("/rate", async (req, res) => {
  const { from, to = "EUR", date } = req.query as { from?: string; to?: string; date?: string };
  if (!from || !date) {
    res.status(400).json({ error: "Parameters 'from' and 'date' are required" });
    return;
  }
  try {
    const result = await getRateCached(from, to, date);
    res.json(result);
  } catch (err) {
    console.error("[currencies] Rate error:", err);
    res.status(502).json({ error: "Conversion unavailable" });
  }
});

export default router;
