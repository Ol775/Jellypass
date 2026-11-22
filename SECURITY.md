# Security policy

Jellypass sits in front of a private media server and handles sign-ins, so security reports are taken seriously.

## Supported versions

Only the **latest release** receives security fixes. Jellypass tells admins when a newer release exists (a banner on the admin pages, and Settings, Server, "About and updates"), so staying current is one click away. See the [changelog](CHANGELOG.md) for what each release fixed.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting instead: go to the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/Ol775/Jellypass/security/advisories/new)). Only the maintainer can see the report, and we can discuss and fix it privately in the same place.

Please include:

- What you found and the impact (what an attacker could do, and what they would need first).
- The Jellypass **version** and how it is installed (Docker, Portainer, behind a proxy or tunnel, HTTPS or not).
- Steps to reproduce, ideally with a minimal proof of concept.
- Whether you have already told anyone else.

Jellypass is a one-person hobby project, so there is no formal service level. In practice: expect an acknowledgement within about a week, an assessment shortly after, and fixes for confirmed issues in order of severity, with progress reported in the advisory. There is no bug bounty.

**Coordinated disclosure.** Please give me a reasonable time to ship a fix before you publish details. Once a fixed release is out I will publish the advisory and credit you, if you would like that.

## What is in scope

- The application code in this repository, including the self-hosted server (`selfhost/`).
- The published Docker image and the supplied `docker-compose.yml`.
- Security advice in the documentation that turns out to be wrong or unsafe.

**Out of scope:** vulnerabilities in Jellyfin, Seerr, Tracearr, Portainer, Docker, Cloudflare or other software Jellypass talks to (report those to their projects); anything that needs access an attacker does not already have; and behaviour that is documented below as a known limitation.

## How Jellypass protects you

| Area | What it does |
| --- | --- |
| **Sign-in** | Passwords are checked by Jellyfin; Jellypass never stores them. It does not keep the Jellyfin session token either (it signs it out straight away). Optional two-step sign-in with an authenticator app or a passkey, and optional Cloudflare Turnstile on the sign-in page |
| **Brute force** | Five failed sign-ins in 15 minutes lock that IP address and that username until the window ends |
| **Sessions** | A random session id, signed with a server secret, with the record kept server-side. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when the public address is `https`. Sessions last 12 hours |
| **Requests** | Every state-changing request needs a per-session CSRF token. Admin pages and APIs re-check with Jellyfin, on every request, that you are still an administrator, and ordinary sessions are re-checked periodically so disabled accounts lose access |
| **Browser** | A strict Content Security Policy (no inline scripts, no framing), `X-Content-Type-Options: nosniff`, API responses are never cached |
| **Invites** | Invite links are random tokens, stored only as a hash. Their use and expiry are enforced on the server |
| **Secrets at rest** | Two-step secrets are encrypted. API keys and the Turnstile secret are saved in `config.json`, created readable only by the container user, and are never written to the audit log or shown again in the interface |
| **Privacy** | No analytics or telemetry. Poster images and map data are fetched and served by your own server, so browsing does not reveal member IP addresses to third parties. The exceptions are things you switch on: Cloudflare Turnstile (the visitor's browser contacts Cloudflare, and the server passes the visitor's IP address to Cloudflare to verify the challenge) and the optional daily update check |
| **Container** | Runs as a non-root user (uid 1000). No secrets are baked into the image |
| **Supply chain** | The image is built by GitHub Actions from a tagged release. Actions are pinned to full commit SHAs and updated by Dependabot. Code scanning (CodeQL), secret scanning with push protection and Dependabot alerts are on |

## Known limitations

Be aware of these when you run it:

- **First-run setup has no password.** Whoever opens the site first can finish setup (and so choose which Jellyfin server it talks to). Complete setup before you expose the port or a hostname to anyone else. After setup the page is gone.
- **`config.json` holds your API keys in plain text.** It is protected by file permissions only. Anyone who can read the data volume or a backup of it can read the keys. Treat volume backups as secrets.
- **Admins can point Jellypass at addresses.** Administrators set the Jellyfin, Seerr and Tracearr addresses, and Jellypass connects to them from inside your network. That is by design (they are usually on your LAN). Obvious cloud-metadata and link-local addresses are refused by name, but addresses are not resolved first, so do not give administrator access to people you would not trust with network access from the Jellypass container.
- **Client IP addresses behind a proxy.** With **Trust the proxy** on, Jellypass believes the address headers a proxy sends. Only turn it on when the proxy is the only way to reach the container, otherwise anyone can fake their address and dodge the sign-in lockout. Bind to localhost (`BIND_ADDR=127.0.0.1`) or use a private Docker network.
- **No HSTS header.** Jellypass does not set `Strict-Transport-Security`. If you serve it over HTTPS, add it at your proxy.
- **Plain HTTP is for trials.** Over plain HTTP the sign-in cookie is not marked secure and traffic is readable on the network. Use HTTPS (a tunnel, a reverse proxy, or the built-in certificate) for anything beyond your own LAN.
- **Self-signed certificates** protect against eavesdropping but not impersonation until you add the certificate to your devices' trust store.
- **The update check contacts GitHub** once a day to ask for the newest release number (it sends nothing about your server). You can switch it off in Settings, Server.

## Data Jellypass stores

In the database on your server: invites (token hashes), access levels and end dates, members' preferences, optional contact emails, sign-in records (device name, IP address and approximate location from the optional GeoIP database), the audit log, notices and push subscriptions. What members watch is read live from Jellyfin and Seerr and is not copied. A daily job prunes old records. Back up and protect the data volume accordingly; see [docs/INSTALL.md](docs/INSTALL.md#backup-and-restore).

## Hardening checklist

- Finish setup before exposing the site; use HTTPS.
- Give Jellyfin administrators strong passwords, and turn on two-step sign-in for admin accounts in Jellypass.
- Keep Jellypass updated (it will tell you when).
- Keep the container reachable only through your proxy or tunnel, with **Trust the proxy** on only in that case.
- Turn on the sign-in challenge (Turnstile) if the site is on the public internet.
- Protect the data volume and its backups; they contain your API keys.
- Use a Jellyfin API key made just for Jellypass so you can revoke it independently.
