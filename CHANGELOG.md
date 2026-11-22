# Changelog

All notable changes to Jellypass are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [1.0.0] - 2026-11-22

First public release of the self-hosted version.

### Added
- Run Jellypass in Docker with a compose file that works in Portainer: one container, a SQLite database in a volume, no Cloudflare account needed.
- A first-run setup wizard in the Jellypass theme: connects Jellyfin (required), Seerr and Tracearr (optional), tests each connection before saving, and shows a poster background from your own library.
- Settings, Connections: change the Jellyfin, Seerr and Tracearr address and API key from the app. Every change is tested before it is saved.
- Settings, Server: public address, HTTPS (off, self-signed, or your own certificate), proxy trust, Cloudflare Turnstile with a quick-setup guide, and SMTP email with provider presets and a test button. Changes apply without a restart.
- Email is optional. With it off, nothing is sent and the email-only screens are hidden.
- Built-in HTTPS, Cloudflare Tunnel and reverse proxy support.
- Admins skip the welcome and email-verification step.
- Version number, this changelog, and a notice when a newer release is available.
