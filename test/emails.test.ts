import { expect, test } from 'vitest';
import { logoUrl, renderEmail, type EmailData, type EmailName } from '../src/emails';

const samples: EmailData = {
  invite: { link: 'https://example.test/invite?a=1&b=2', presetName: 'Friends', grants: ['Watch films', 'Watch programmes'], expiresAt: '20 November 2026', invitedBy: 'Sam' },
  welcome: { name: 'Alex', link: 'https://example.test/home' },
  reset_code: { code: '012345', minutes: 15 },
  password_changed: { name: 'Alex', when: '14 November 2026 at 10:30' },
  access_ending: { name: 'Alex', date: '21 November 2026', daysLeft: 7 },
  new_signin: { name: 'Alex', device: 'Firefox on Linux', city: 'London', when: '14 November 2026 at 10:30', link: 'https://example.test/secure' },
  verify_email: { code: '654321', minutes: 10 },
  email_changed: { name: 'Alex', when: '14 November 2026 at 10:30' },
  outage: { service: 'Jellyfin', when: '14 November 2026 at 10:30' },
  stream_warning: { name: 'Alex', places: 2, link: 'https://example.test/secure/x' },
  weekly: { name: 'Alex', watched: 'You watched 3 titles this week, about 4 hours in all.', added: ['Slow Horses', 'Heat'], accessEnds: '21 Nov 2026', link: 'https://example.test' },
  request_ready: { name: 'Alex', title: 'Heat', link: 'https://example.test/web/#/search?query=Heat' },
  magic_link: { name: 'Alex', link: 'https://example.test/magic/abc', minutes: 15 },
  admin_digest: { lines: ['7 failed sign-ins.'], link: 'https://example.test/admin/security' },
};
const subjects: Record<EmailName, string> = {
  invite: "You're invited to Jellypass",
  welcome: 'Welcome to Jellypass',
  reset_code: 'Your Jellypass code: 012345',
  password_changed: 'Your Jellypass password was changed',
  access_ending: 'Your access ends in 7 days',
  new_signin: 'New sign-in to your account',
  verify_email: 'Confirm your email address: 654321',
  email_changed: 'The email address on your Jellypass account was changed',
  outage: 'Jellyfin is having problems',
  stream_warning: 'Your account is being used in more than one place',
  weekly: 'Your week on Jellyfin',
  request_ready: 'Heat is ready to watch',
  magic_link: 'Your Jellypass sign-in link',
  admin_digest: 'Jellypass daily security digest',
};

for (const name of Object.keys(samples) as EmailName[]) {
  test(`${name} returns the subject and self-contained light HTML and text`, () => {
    const { subject, html, text, inline } = renderEmail(name, samples[name]);
    expect(subject).toBe(subjects[name]);
    expect(html.trim().length).toBeGreaterThan(0);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(html).toContain('Jellypass');
    expect(text).toContain('Jellypass');
    expect(html).toContain('max-width:480px');
    expect(html).toContain('#0f766e');
    expect(html).toContain('color-scheme:light');
    expect(html).toContain('background-color:#ffffff');
    expect(html).not.toMatch(/<(?:svg|script|link|style|iframe)\b/i);
    expect([...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0])).toEqual(['<img src="https://jellypass.example.com/assets/email-logo.png" width="44" height="44" alt="Jellypass" style="display:block;border:0;border-radius:10px;">']);
    expect(html).not.toMatch(/url\s*\(|@import/i);
    expect(inline).toBeUndefined();
    expect(html + text).not.toMatch(/on behalf of|entered your address/i);
    const data = samples[name];
    const links = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(links).toEqual('link' in data ? [data.link.replace(/&/g, '&amp;')] : []);
    expect(html.replace(/href="[^"]*"/g, '').replace(logoUrl(), '')).not.toMatch(/https?:\/\//);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('background-color:#f1f0ec');
    const header = html.match(/<td data-email-header="true"[^>]*>([\s\S]*?)<\/table>/)?.[1];
    expect(header).toContain('Jellypass');
    expect(header).toContain(logoUrl());
    expect(header).toContain('alt="Jellypass"');
    expect(html).toMatch(/<td data-email-card="true"[^>]*background-color:#ffffff[^>]*padding:28px/);
    const footer = html.match(/<td data-email-footer="true"[^>]*>([^<]+)<\/td>/)?.[1];
    expect(footer).toBeTruthy();
    expect(footer).toMatch(/because|Never share this code|expecting this invitation/);
    expect(text).toContain(footer!.replace(/&#39;/g, "'"));
    const buttons = [...html.matchAll(/<a data-email-button="true" href="([^"]*)" style="([^"]*)">([^<]*)<\/a>/g)];
    expect(buttons.map((button) => button[1])).toEqual(links);
    for (const button of buttons) {
      expect(button[2]).toContain('background-color:#0f766e');
      expect(button[2]).toContain('color:#ffffff');
      // 22px line height plus 12px top/bottom padding = 46px tap target.
      expect(button[2]).toContain('line-height:22px');
      expect(button[2]).toContain('padding:12px 22px');
    }
    if ('link' in data) expect(text).toContain(data.link);

  });

  test(`${name} escapes every string field, including link attributes and grants`, () => {
    const value = '<script>alert("x")</script> & \'quoted\'';
    const escaped = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;';
    for (const [field, original] of Object.entries(samples[name])) {
      if (typeof original !== 'string' && !Array.isArray(original)) continue;
      const data = { ...samples[name], [field]: Array.isArray(original) ? [value] : value };
      const { html, text } = renderEmail(name, data);
      expect(html).toContain(escaped);
      expect(html).not.toContain(value);
      expect(html).not.toContain('<script>');
      expect(text).toContain(value);
      if (field === 'link') expect(html).toContain(`href="${escaped}"`);
    }
  });
}

test('invite lists grants and includes the preset, inviter and expiry in both versions', () => {
  const { html, text } = renderEmail('invite', samples.invite);
  for (const fact of ['Friends', 'Sam', '20 November 2026', ...samples.invite.grants]) {
    expect(html).toContain(fact);
    expect(text).toContain(fact);
  }
  for (const grant of samples.invite.grants) {
    expect(html).toContain(`<li style="padding:0 0 6px;">${grant}</li>`);
    expect(text).toContain(`- ${grant}`);
  }
  const withoutInviter = renderEmail('invite', { ...samples.invite, invitedBy: undefined, grants: [] });
  expect(withoutInviter.text).toContain("You're invited to Jellypass");
  expect(withoutInviter.html).not.toContain('undefined');
});

test.each([0, 1, 2, 7])('access ending uses the correct day wording for %i', (daysLeft) => {
  const { subject, html, text } = renderEmail('access_ending', { ...samples.access_ending, daysLeft });
  const wording = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
  expect(subject).toBe(`Your access ends in ${wording}`);
  expect(html).toContain(`in ${wording}.`);
  expect(text).toContain(`in ${wording}.`);
  expect(html).toContain(samples.access_ending.date);
  expect(text).toContain(samples.access_ending.date);
});

test('reset code appears everywhere with its expiry and ignore advice', () => {
  const { subject, html, text } = renderEmail('reset_code', samples.reset_code);
  for (const output of [subject, html, text]) expect(output).toContain('012345');
  for (const output of [html, text]) {
    expect(output).toContain('expires in 15 minutes');
    expect(output).toContain('ask for this code');
    expect(output).toContain('ignore this email');
  }
});

test.each(['London', null])('new sign-in includes location %s and a recovery link', (city) => {
  const { html, text } = renderEmail('new_signin', { ...samples.new_signin, city });
  for (const output of [html, text]) {
    for (const fact of ['Alex', 'Firefox on Linux', samples.new_signin.when, city ?? 'an unknown location']) {
      expect(output).toContain(fact);
    }
    expect(output).toContain('use the button below');
  }
  expect(html).toContain(`href="${samples.new_signin.link}"`);
  expect(html).toContain('This wasn&#39;t me');
  expect(text).toContain(`This wasn't me: ${samples.new_signin.link}`);
});

test('welcome and password change preserve names and account facts', () => {
  const welcome = renderEmail('welcome', samples.welcome);
  const changed = renderEmail('password_changed', samples.password_changed);
  for (const output of [welcome.html, welcome.text, changed.html, changed.text]) expect(output).toContain('Alex');
  expect(welcome.text).toContain(samples.welcome.link);
  expect(changed.html).toContain(samples.password_changed.when);
  expect(changed.text).toContain(samples.password_changed.when);
});


test.each(['reset_code', 'verify_email'] as const)('%s puts the code inside a prominent boxed block', (name) => {
  const { html, text } = renderEmail(name, samples[name]);
  const box = html.match(/<td data-email-code="true"[^>]*style="([^"]*)">([^<]*)<\/td>/);
  expect(box).not.toBeNull();
  expect(box![2]).toBe(samples[name].code);
  for (const style of ['background-color:#f6f5f2', 'border:1px solid', 'border-radius:10px', 'monospace', 'font-size:34px', 'letter-spacing:0.25em', 'text-align:center']) {
    expect(box![1]).toContain(style);
  }
  expect(text).toContain(`\n\n${samples[name].code}\n\n`);
  expect(text).toContain(`expires in ${samples[name].minutes} minutes`);
  expect(text).toContain('Never share this code');
});

test('welcome keeps the mockup onboarding steps in HTML and plain text', () => {
  const { html, text } = renderEmail('welcome', samples.welcome);
  expect(html).toContain('<ol ');
  for (const phrase of ['Install the Jellyfin app', 'Choose Quick Connect', 'Discover and request', 'We never email your password.']) {
    expect(html.replace(/<[^>]*>/g, '')).toContain(phrase);
    expect(text).toContain(phrase);
  }
  expect(text).toContain('1. Install');
  expect(text).toContain('2. Choose');
  expect(text).toContain('3. Ask');
});


test('mockup emphasis preserves escaped access names and sign-in devices', () => {
  const invite = renderEmail('invite', samples.invite);
  expect(invite.html).toContain('<strong style="font-weight:700;">Friends</strong> access.');
  expect(invite.html).toContain('<strong style="font-weight:700;">What you get</strong>');
  const signin = renderEmail('new_signin', samples.new_signin);
  expect(signin.html).toContain('<strong style="font-weight:700;">Firefox on Linux</strong>');
  const welcome = renderEmail('welcome', samples.welcome);
  for (const label of ['Jellyfin', 'Quick Connect', 'Discover and request']) {
    expect(welcome.html).toContain(`<strong style="font-weight:700;">${label}</strong>`);
  }
});

test('Cloudflare mailer sends no attachments (logo is hosted)', async () => {
  const { cloudflareMailer } = await import('../src/mail');
  const sent: any[] = [];
  const mailer = cloudflareMailer({
    MAIL_FROM: 'jellypass@example.test',
    EMAIL: { send: async (message: unknown) => { sent.push(message); } },
    DB: { prepare: () => ({ bind: () => ({ run: async () => {} }) }) },
  } as unknown as import('../src/env').Env);
  const email = renderEmail('invite', samples.invite);
  await mailer.send('member@example.test', email.subject, email.html, email.text);
  expect(sent.at(-1)).not.toHaveProperty('attachments');
  await mailer.send('member@example.test', 'Plain', '<p>Hello</p>', 'Hello');
  expect(sent.at(-1)).not.toHaveProperty('attachments');
});
