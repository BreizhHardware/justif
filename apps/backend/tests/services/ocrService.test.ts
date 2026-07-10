import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "../../src/services/ocrService.js";

describe("getSystemPrompt", () => {
  it("returns the base prompt when no override is given", () => {
    const prompt = getSystemPrompt("en");
    expect(prompt).not.toContain("Additional administrator instructions");
  });

  it("returns the base prompt when the override is empty or whitespace-only", () => {
    expect(getSystemPrompt("en", "")).toBe(getSystemPrompt("en"));
    expect(getSystemPrompt("en", "   \n  ")).toBe(getSystemPrompt("en"));
  });

  it("appends a trimmed override wrapped in a language/format guardrail", () => {
    const prompt = getSystemPrompt("en", "  Watch for reference numbers circled in red.  ");
    expect(prompt.startsWith(getSystemPrompt("en"))).toBe(true);
    expect(prompt).toContain("--- Additional administrator instructions ---");
    expect(prompt).toContain("without changing the response language or the JSON format");
    expect(prompt).toContain("Watch for reference numbers circled in red.");
    expect(prompt.endsWith("red.")).toBe(true);
  });

  it("wraps the override in French when the locale is French", () => {
    const prompt = getSystemPrompt("fr", "Vérifie toujours le numéro de TVA.");
    expect(prompt).toContain("--- Instructions supplémentaires de l'administrateur ---");
    expect(prompt).toContain("sans changer la langue de réponse");
    expect(prompt).toContain("Vérifie toujours le numéro de TVA.");
  });

  it("falls back to the English prompt for an unknown locale", () => {
    expect(getSystemPrompt("de")).toBe(getSystemPrompt("en"));
  });

  it("does not add the reference-number instruction when extraction is not requested", () => {
    expect(getSystemPrompt("en")).not.toContain("Also look for a reference or ticket number");
    expect(getSystemPrompt("en", undefined, false)).not.toContain(
      "Also look for a reference or ticket number",
    );
  });

  it("adds the reference-number instruction only when requested", () => {
    const prompt = getSystemPrompt("en", undefined, true);
    expect(prompt).toContain("Also look for a reference or ticket number");
    expect(prompt).toContain("numero_reference");

    const promptFr = getSystemPrompt("fr", undefined, true);
    expect(promptFr).toContain("numéro de référence ou de ticket");
  });
});
