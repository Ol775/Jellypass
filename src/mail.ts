import type { Env } from "./env";

export interface InlineAttachment { contentId: string; filename: string; type: string; contentBase64: string }

export interface Mailer { send(to: string, subject: string, html: string, text: string, inline?: InlineAttachment[]): Promise<void> }

export const emailOn = (env: Env) => env.EMAIL_OFF !== "true";

/** Cloudflare Email Sending (Workers Paid: 3,000/month included, then $0.35 per 1,000). */
export function cloudflareMailer(env: Env): Mailer {
  return {
    async send(to, subject, html, text, inline) {
      if (!emailOn(env)) throw new Error("email is turned off"); // background senders already treat a failed send as "skip"
      const t = Date.now();
      let ok = 1;
      try { await env.EMAIL.send({ from: { email: env.MAIL_FROM, name: "Jellypass" }, to, subject, html, text, ...(inline ? { attachments: inline.map(i => ({ content: i.contentBase64, filename: i.filename, type: i.type, disposition: "inline" as const, contentId: i.contentId })) } : {}) }); }
      catch (e) { ok = 0; throw e; }
      finally {
        // Real send outcomes are the status page's "email delivery" signal.
        await env.DB.prepare("INSERT INTO status_checks (service, ok, latency_ms, at) VALUES ('email', ?, ?, ?)").bind(ok, Date.now() - t, new Date().toISOString()).run().catch(() => {});
      }
    },
  };
}
