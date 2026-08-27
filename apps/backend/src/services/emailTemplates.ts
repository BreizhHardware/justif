// Shared HTML shell for transactional emails, styled to match the app's look

const BRAND = "#2D6A4F";
const BRAND_DARK = "#1A3D2B";
const SLATE_900 = "#0F172A";
const SLATE_600 = "#475569";
const SLATE_400 = "#94A3B8";
const SLATE_200 = "#E2E8F0";
const BG = "#F8FAFC";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A primary call-to-action button, styled like the app's <Button>. */
export function emailButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="border-radius: 8px; background: ${BRAND};">
          <a href="${url}" target="_blank"
             style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600;
                    color: #ffffff; text-decoration: none; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** A muted fallback link shown below the button, for clients that strip hrefs. */
export function emailFallbackLink(url: string): string {
  return `
    <p style="margin: 0 0 24px; font-size: 12px; line-height: 1.6; color: ${SLATE_400}; word-break: break-all; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      ${escapeHtml(url)}
    </p>`;
}

/**
 * Wraps `bodyHtml` (already-safe markup, callers own escaping of dynamic
 * text passed there) in the branded header/card/footer shell.
 */
export function renderEmailLayout(opts: { preheader: string; bodyHtml: string }): string {
  const fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Justif</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${BG}; font-family: ${fontFamily};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
      ${escapeHtml(opts.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BG};">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width: 480px; max-width: 100%;">
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="36" height="36"
                             style="width: 36px; height: 36px; border-radius: 10px; background: ${BRAND};">
                        <tr>
                          <td align="center" valign="middle" style="color: #ffffff; font-size: 16px; font-weight: 700; font-family: ${fontFamily};">
                            J
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="vertical-align: middle; padding-left: 10px; font-size: 18px; font-weight: 600; color: ${SLATE_900};">
                      Justif
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background: #ffffff; border: 1px solid ${SLATE_200}; border-radius: 16px; padding: 32px;">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top: 24px; font-size: 12px; color: ${SLATE_400}; line-height: 1.6;">
                Justif — gestion de notes de frais open source et auto-hébergeable<br />
                Justif — open source, self-hosted expense management
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A muted horizontal rule used to separate the FR/EN sections of an email. */
export const emailDivider = `<hr style="border: none; border-top: 1px solid ${SLATE_200}; margin: 28px 0;" />`;

export const emailTextStyle = `margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: ${SLATE_600}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;`;
export const emailTitleStyle = `margin: 0 0 16px; font-size: 17px; font-weight: 600; color: ${SLATE_900}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;`;

export { escapeHtml, BRAND, BRAND_DARK };
