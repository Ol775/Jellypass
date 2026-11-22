/** The logo in every email is served by the install itself. Set once from PUBLIC_URL (an install has exactly one address). */
let emailBase = "https://jellypass.example.com";
export function setEmailBase(url: string) { emailBase = url.replace(/\/$/, ""); }
export const logoUrl = () => `${emailBase}/assets/email-logo.png`;
import type { InlineAttachment } from "../mail";
export type EmailName = 'invite' | 'welcome' | 'reset_code' | 'password_changed' | 'access_ending' | 'new_signin' | 'verify_email' | 'email_changed' | 'outage' | 'stream_warning' | 'weekly' | 'request_ready' | 'admin_digest' | 'magic_link';

export interface EmailData {
  invite: { link: string; presetName: string; grants: string[]; expiresAt: string; invitedBy?: string };
  welcome: { name: string; link: string };
  reset_code: { code: string; minutes: number };
  password_changed: { name: string; when: string };
  access_ending: { name: string; date: string; daysLeft: number };
  new_signin: { name: string; device: string; city: string | null; when: string; link: string };
  verify_email: { code: string; minutes: number };
  email_changed: { name: string; when: string };
  outage: { service: string; when: string };
  stream_warning: { name: string; places: number; link: string };
  weekly: { name: string; watched: string; added: string[]; accessEnds: string | null; link: string };
  request_ready: { name: string; title: string; link: string };
  admin_digest: { lines: string[]; link: string };
  magic_link: { name: string; link: string; minutes: number };
}

// Content stays unescaped until the HTML renderer; the text version uses the same blocks.
type Inline = string | { strong: string };
type RichText = string | Inline[];
type Block = string | { paragraph: Inline[] } | { bullets: RichText[]; ordered?: boolean } | { label: string; link: string }
  | { code: string } | { muted: string } | { details: RichText[] };
type Content = { subject: string; title: string; footer: string; blocks: Block[] };

const securityFooter = "You're getting this security notice because it's about your account.";
const codeFooter = 'Never share this code. Jellypass staff will never ask for it.';

const templates: { [K in EmailName]: (data: EmailData[K]) => Content } = {
  invite: ({ link, presetName, grants, expiresAt, invitedBy }) => ({
    subject: "You're invited to Jellypass",
    title: invitedBy ? `${invitedBy} invited you to Jellypass` : "You're invited to Jellypass",
    footer: "If you weren't expecting this invitation, you can ignore this email.",
    blocks: [
      { paragraph: ["Jellypass is a private library of films and TV. You've been given ", { strong: presetName }, ' access.'] },
      'Accept the invite to create your account. It takes about two minutes.',
      { paragraph: [{ strong: 'What you get' }] },
      { bullets: grants },
      { label: 'Accept invite', link },
      { muted: `This link works once and expires on ${expiresAt}. If you weren't expecting this, ignore this email. Nothing happens unless you accept.` },
    ],
  }),
  welcome: ({ name, link }) => ({
    subject: 'Welcome to Jellypass',
    title: `Welcome, ${name}`,
    footer: "You're receiving this because you created a Jellypass account. Need a hand? Open Help in the portal.",
    blocks: [
      "Your account is ready. Here's the quickest way to start:",
      { ordered: true, bullets: [
        ['Install the ', { strong: 'Jellyfin' }, ' app on your TV or phone.'],
        ['Choose ', { strong: 'Quick Connect' }, ' and enter the code from your portal.'],
        ["Ask for anything that's missing under ", { strong: 'Discover and request' }, " (Seerr emails you when it's ready)."],
      ] },
      { label: 'Open my portal', link },
      { muted: 'We never email your password.' },
    ],
  }),
  reset_code: ({ code, minutes }) => ({
    subject: `Your Jellypass code: ${code}`,
    title: 'Your password reset code',
    footer: codeFooter,
    blocks: [
      'Enter this code on the reset page:',
      { code },
      `It expires in ${minutes} minutes and works only once.`,
      { muted: "If you didn't ask for this code, you can ignore this email. Your password hasn't changed." },
    ],
  }),
  password_changed: ({ name, when }) => ({
    subject: 'Your Jellypass password was changed',
    title: 'Your password was changed',
    footer: securityFooter,
    blocks: [
      `Hi ${name},`,
      'Your Jellypass password was changed.',
      { details: [when] },
      "If this was you, there's nothing to do.",
      { muted: 'If this was not you, sign in and change your password, or ask an admin for help.' },
    ],
  }),
  access_ending: ({ name, date, daysLeft }) => ({
    subject: `Your access ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
    title: `Your access ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
    footer: "You're getting this because you turned on expiry reminders.",
    blocks: [
      `Hi ${name},`,
      `Your Jellypass access ends on ${date}, in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`,
      "After that you won't be able to sign in.",
      'Want to keep it? Let an admin know and they can extend it.',
      { muted: 'Nothing is deleted when access ends. Your history is kept.' },
    ],
  }),
  verify_email: ({ code, minutes }) => ({
    subject: `Confirm your email address: ${code}`,
    title: 'Confirm your email address',
    footer: codeFooter,
    blocks: [
      'Enter this code in Jellypass to confirm this email address:',
      { code },
      `It expires in ${minutes} minutes and works only once.`,
      { muted: "If you didn't ask for this, you can ignore this email." },
    ],
  }),
  email_changed: ({ name, when }) => ({
    subject: 'The email address on your Jellypass account was changed',
    title: 'Your email address was changed',
    footer: securityFooter,
    blocks: [
      `Hi ${name},`,
      'The contact email on your Jellypass account was changed.',
      { details: [when] },
      "If this was you, there's nothing to do.",
      { muted: 'If this was not you, sign in and change your password, or ask an admin for help.' },
    ],
  }),
  outage: ({ service, when }) => ({
    subject: `${service} is having problems`,
    title: `${service} is having problems`,
    footer: "You're receiving this because you turned on outage notifications.",
    blocks: [
      `${service} has been unavailable since ${when}.`,
      'We know about it and are looking into it.',
      { muted: 'The Status page in Jellypass has the latest.' },
    ],
  }),
  new_signin: ({ name, device, city, when, link }) => ({
    subject: 'New sign-in to your account',
    title: city ? `New sign-in from ${city}` : 'New sign-in to your account',
    footer: securityFooter,
    blocks: [
      `Hi ${name},`,
      'We noticed a sign-in to your account from somewhere new.',
      { details: [[{ strong: device }], city ?? 'an unknown location', when] },
      "If this wasn't you, use the button below. It signs you out everywhere and helps you choose a new password.",
      { label: "This wasn't me", link },
      { muted: 'If this was you, there is nothing to do.' },
    ],
  }),
  stream_warning: ({ name, places, link }) => ({
    subject: 'Your account is being used in more than one place',
    title: 'Your account is playing in more than one place',
    footer: securityFooter,
    blocks: [
      `Hi ${name},`,
      `Your account was playing something from ${places} different places at the same time just now.`,
      'If that was you and someone at home, there is nothing to do. If not, someone else may have your password.',
      { label: "This wasn't me", link },
    ],
  }),
  weekly: ({ name, watched, added, accessEnds, link }) => ({
    subject: 'Your week on Jellyfin',
    title: 'Your week on Jellyfin',
    footer: "You're getting this because you turned on the weekly summary in Settings.",
    blocks: [
      `Hi ${name},`,
      watched,
      ...(added.length ? ['Recently added:', { bullets: added.map((a) => [a]) }] as Block[] : []),
      ...(accessEnds ? [`Your access ends on ${accessEnds}.`] : []),
      { label: 'Open my portal', link },
    ],
  }),
  request_ready: ({ name, title, link }) => ({
    subject: `${title} is ready to watch`,
    title: `${title} is ready`,
    footer: "You're getting this because you turned on request emails in Settings.",
    blocks: [`Hi ${name},`, `Your request for ${title} is now in Jellyfin.`, { label: 'Open Jellyfin', link }],
  }),
  magic_link: ({ name, link, minutes }) => ({
    subject: 'Your Jellypass sign-in link',
    title: 'Sign in to Jellypass',
    footer: "You're getting this because someone asked for a sign-in link for your account. If it wasn't you, ignore this email: nothing happens until the link is opened, and you can turn sign-in links off in Settings.",
    blocks: [`Hi ${name},`, `Use this button to sign in. The link works once and expires in ${minutes} minutes.`, { label: 'Sign in to Jellypass', link }, { muted: "Don't forward this email. Anyone with the link can sign in as you until it is used or expires." }],
  }),
  admin_digest: ({ lines, link }) => ({
    subject: 'Jellypass daily security digest',
    title: 'Daily security digest',
    footer: "You're getting this because you set this address in Jellypass admin Settings.",
    blocks: [...(lines.length ? [{ bullets: lines.map((l) => [l]) }] as Block[] : ['Nothing unusual in the last 24 hours.']), { label: 'Open Security', link }],
  }),
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Rich text is structured rather than raw HTML so emphasized values are escaped too.
function plainText(value: RichText): string {
  return typeof value === 'string' ? value : value.map((part) => typeof part === 'string' ? part : part.strong).join('');
}

function renderInline(value: RichText): string {
  return typeof value === 'string' ? escapeHtml(value) : value.map((part) =>
    typeof part === 'string' ? escapeHtml(part) : `<strong style="font-weight:700;">${escapeHtml(part.strong)}</strong>`).join('');
}

function renderBlock(block: Block): string {
  if (typeof block === 'string') return `<p style="margin:0 0 14px;color:#3d3a34;">${escapeHtml(block)}</p>`;
  if ('paragraph' in block) return `<p style="margin:0 0 14px;color:#3d3a34;">${renderInline(block.paragraph)}</p>`;
  if ('muted' in block) return `<p style="margin:14px 0 0;color:#736f66;font-size:13px;line-height:1.55;">${escapeHtml(block.muted)}</p>`;
  if ('bullets' in block) {
    const tag = block.ordered ? 'ol' : 'ul';
    return `<${tag} style="margin:0 0 14px;padding-left:20px;color:#3d3a34;">${block.bullets.map((item) => `<li style="padding:0 0 6px;">${renderInline(item)}</li>`).join('')}</${tag}>`;
  }
  if ('code' in block) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;margin:0 0 14px;"><tr><td data-email-code="true" align="center" style="background-color:#f6f5f2;border:1px solid #e8e6e0;border-radius:10px;padding:16px 8px;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:700;line-height:1.25;letter-spacing:0.25em;color:#0f766e;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(block.code)}</td></tr></table>`;
  }
  if ('details' in block) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;margin:0 0 14px;"><tr><td style="background-color:#f6f5f2;border-radius:10px;padding:12px 14px;color:#3d3a34;font-size:14px;">${block.details.map(renderInline).join('<br>')}</td></tr></table>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0;"><tr><td bgcolor="#0f766e" style="background-color:#0f766e;border-radius:8px;text-align:center;"><a data-email-button="true" href="${escapeHtml(block.link)}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:22px;padding:12px 22px;border-radius:8px;mso-padding-alt:0;text-align:center;">${escapeHtml(block.label)}</a></td></tr></table>`;
}

export function renderEmail<K extends EmailName>(name: K, data: EmailData[K]): { subject: string; html: string; text: string; inline?: InlineAttachment[] } {
  const { subject, title, footer, blocks } = templates[name](data);
  const body = blocks.map(renderBlock).join('\n');
  const text = ['Jellypass', title, ...blocks.map((block) => {
    if (typeof block === 'string') return block;
    if ('paragraph' in block) return plainText(block.paragraph);
    if ('muted' in block) return block.muted;
    if ('code' in block) return block.code;
    if ('details' in block) return block.details.map(plainText).join('\n');
    if ('bullets' in block) return block.bullets.map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${plainText(item)}`).join('\n');
    return `${block.label}: ${block.link}`;
  }), footer].join('\n\n');

  // Presentation tables and inline styles survive clients that strip document CSS.
  // The logo is a hosted image: some mail apps drop CID attachments and show a broken icon.
  const html = `<!doctype html>
<html lang="en-GB" style="color-scheme:light;">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f1f0ec;color:#1b1a17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color-scheme:light;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f0ec" style="width:100%;background-color:#f1f0ec;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;margin:0 auto;table-layout:fixed;overflow-wrap:anywhere;word-break:break-word;">
<tr><td data-email-header="true" style="padding:0 0 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" height="44"><img src="${logoUrl()}" width="44" height="44" alt="Jellypass" style="display:block;border:0;border-radius:10px;"></td><td style="padding-left:10px;color:#0f766e;font-size:16px;font-weight:700;">Jellypass</td></tr></table>
</td></tr>
<tr><td data-email-card="true" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e8e6e0;border-radius:12px;padding:28px;">
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.25;letter-spacing:-0.02em;color:#1b1a17;">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td data-email-footer="true" style="padding:16px 4px 0;color:#736f66;font-size:12.5px;line-height:1.55;">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
