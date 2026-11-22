# Changelog

All notable changes to Jellypass are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [1.0.2] - 2026-11-22

### Added
- An optional **Address members use** for Jellyfin and Seerr, in Settings, Connections and in the setup wizard. Use it when Jellypass reaches Jellyfin by an address that only works inside your network (such as `192.168.1.10:8096`) but members connect by another (such as `watch.example.com`). A bare name means https.

### Fixed
- Members were given the address Jellypass uses to reach Jellyfin, even when that only works inside your network, so poster images, "Open in Jellyfin" links and the app set-up guide were broken for anyone outside it. The same address was used in "request ready" emails and push notifications. All of these now use the address members use, and fall back to the connection address when none is set. The "Open Seerr" buttons work the same way.

## [1.0.1] - 2026-11-22

### Added
- A full install guide (`docs/INSTALL.md`) and a troubleshooting guide (`docs/TROUBLESHOOTING.md`).

### Fixed
- The Docker health check reported "unhealthy" when HTTPS was switched on from the settings page. It now tries HTTPS, then HTTP.
- When the data folder is not writable, the app now says so in plain English and how to fix it, instead of only `unable to open database file`.
- The backup instructions used the `sqlite3` tool, which is not in the image. They now use a command that is, and the restore steps are written out and tested.

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
