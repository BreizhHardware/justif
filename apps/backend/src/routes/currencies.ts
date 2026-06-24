import { Router } from "express";
import { getRateCached, listSupportedCurrencies } from "../services/currencyService.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const currencies = await listSupportedCurrencies();
    res.json(currencies);
  } catch (err) {
    console.error("[currencies] Erreur Frankfurter:", err);
    res.status(502).json({ error: "Service de devises indisponible" });
  }
});

router.get("/rate", async (req, res) => {
  const { from, to = "EUR", date } = req.query as { from?: string; to?: string; date?: string };
  if (!from || !date) {
    res.status(400).json({ error: "Paramètres from et date requis" });
    return;
  }
  try {
    const result = await getRateCached(from, to, date);
    res.json(result);
  } catch (err) {
    console.error("[currencies] Erreur taux:", err);
    res.status(502).json({ error: "Conversion indisponible" });
  }
});

export default router;
