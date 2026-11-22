# Self-hosting with Docker

Jellypass runs as one container with a SQLite database in a volume. You need a Jellyfin server and its admin API key; Seerr and Tracearr are optional.

## Quick start

The full install steps, with the compose file to paste, are in the [README](../README.md#install): Portainer (as a stack), Docker Compose, or plain `docker run`. In short:

1. Add the stack in Portainer (Stacks, Add stack, Web editor, paste `docker-compose.yml`, Deploy), or run `docker compose up -d`. The default image is `ghcr.io/ol775/jelly-pass:latest`; to build it yourself, run `docker build -t jellypass .` and set `JELLYPASS_IMAGE=jellypass`.
2. No variables are needed: everything is asked for on first run. (`.env.example` lists the optional starting values.)
3. Open `http://<your-server>:8787`. The setup wizard asks for Jellyfin (required), Seerr and Tracearr (optional), and tests each connection before saving.
4. Sign in with a Jellyfin administrator account. The rest of the setup is under **Settings**.

**First-run setup has no password.** Whoever opens the site first can finish setup, so do it before exposing the port or hostname to anyone else. Once Jellyfin is saved, the setup page is gone for good; to redo it, delete `/data/config.json` and restart.

## Settings you can change in the app

Settings, **Connections**: the Jellyfin, Seerr and Tracearr address and key. Every change is tested against the live service before it is saved.

Settings, **Server**:
- **About and updates**: the version, what changed, and whether a newer release exists (see Updates below).
- **Address and HTTPS**: the public address, HTTPS mode and proxy trust. Applies at once, with no restart.
- **Sign-in challenge**: Cloudflare Turnstile, with a four-step guide. It checks the secret with Cloudflare. It needs a real domain name, not a bare IP.
- **Email (SMTP)**: provider presets, a quick guide and a test button.

Anything saved in the app beats the matching environment variable; variables only give starting values.

## Email is optional

Email stays off until you add SMTP details, and the Server page has a switch to turn it off again. While off, nothing is sent and the email-only screens are hidden: forgot-password, email verification, emailed sign-in links, sign-in alerts and the email notices. Invites still work by copying the link.

## HTTPS: pick one

| Way | Set | Notes |
| --- | --- | --- |
| **Cloudflare Tunnel** | `COMPOSE_PROFILES=tunnel`, `TUNNEL_TOKEN`, `TRUST_PROXY=true`, `PUBLIC_URL=https://your.hostname` | Create the tunnel in Cloudflare Zero Trust (Networks, Tunnels) and add a public hostname pointing at `http://jellypass:8787`. Cloudflare provides the certificate. With a tunnel you can delete the `ports:` section so nothing is open on your LAN. The tunnel service in the compose file has not been run against a real tunnel by the author |
| **Reverse proxy** (Caddy, Nginx Proxy Manager, Traefik) | proxy to `http://<host>:8787`, `TRUST_PROXY=true`, `PUBLIC_URL=https://your.hostname`, `BIND_ADDR=127.0.0.1` if the proxy is on the same host | The proxy holds the certificate. Keep Jellypass reachable only through it, or members could fake their IP |
| **Built-in self-signed** | `TLS_MODE=self-signed`, `TLS_HOSTS=192.168.1.10,jellypass.lan` (your LAN address and names), `PUBLIC_URL=https://192.168.1.10:8787` | Made on first start in `/data/tls` and replaced if `TLS_HOSTS` or the address changes. Browsers show a one-off warning; accept it, or add the certificate (downloadable in Settings, Server) to your device's trust store. Phones and TVs may refuse it |
| **Built-in with your own certificate** | `TLS_MODE=custom`, then paste the certificate and key in Settings, Server (or put `cert.pem` and `key.pem` in the volume under `tls/`) | The pair is checked before it is applied |

The sign-in cookie is only marked `Secure` when the public address starts with `https`, so plain http is fine for a LAN trial, but passkeys and anything public need HTTPS.

If a bad setting locks you out, start the container once with `NETWORK_RESET=true`: it ignores the saved address, HTTPS and proxy settings so you can open the page and fix them.

A proxy or tunnel that talks to Jellypass over `https://` with the self-signed certificate must skip certificate checks (cloudflared: `noTLSVerify`, Nginx: `proxy_ssl_verify off`). Plain `http://` between proxy and container, on a private network, is simpler. Jellypass's own connections to Jellyfin, Seerr and Tracearr do check certificates, so if one of those uses a self-signed certificate, use its `http://` address on the LAN.

**Client IPs.** With `TRUST_PROXY=false` (the default) the socket address is used, so behind a proxy every member looks like one IP and rate limits are shared. Set it to `true` only when a proxy you control is the sole way in; then `cf-connecting-ip`, `x-real-ip` or the last `x-forwarded-for` entry is used. Jellypass has its own sign-in rate limits; consider one at your proxy as well.

## Updates

The version is shown in Settings, Server, and the full history is in [CHANGELOG.md](../CHANGELOG.md), also viewable there. Once a day the server asks GitHub for the newest release number and, if it is newer than yours, shows a banner on the admin pages with the release notes. Nothing about your server or members is sent. Switch it off in Settings, Server, or point it at a fork with `UPDATE_REPO=owner/name`.

To update: in Portainer open the stack and choose **Pull and redeploy**; with Docker Compose run `docker compose pull` then `docker compose up -d`. Your data lives in the volume, and database migrations apply automatically on start.

## Data and backups

Everything is in the `jellypass-data` volume: `jellypass.db` (SQLite, WAL mode), `config.json` (your saved settings, including keys, readable only by the container user) and `tls/`. Back up with `sqlite3 /data/jellypass.db ".backup /data/backup.db"` and copy `config.json`, or copy the whole volume while the container is stopped.

## Optional: maps and approximate locations

The admin Live streams map and city names for sign-ins need data files that are not bundled (their licences do not allow it). Copy them into the volume's `tiles/` folder, for example `docker cp uk.pmtiles jellypass:/data/tiles/`:

- `uk.pmtiles` and `world.pmtiles`: map extracts from [Protomaps](https://maps.protomaps.com/builds/) (`pmtiles extract <build>.pmtiles uk.pmtiles --bbox=-8.7,49.8,1.9,60.9 --maxzoom=10`, and `--maxzoom=6` for the world underlay). Choose your own bounding box.
- `geoip-city.mmdb` and `geoip-asn.mmdb`: the free GeoLite2 City and ASN databases from a MaxMind account.

Without them everything still works; the map and city names are simply blank. The Help page carries the required attributions (MaxMind, OpenStreetMap, Protomaps, GeoNames); keep them.

## How it works

Jellypass was written as a Cloudflare Worker, and the app code (`src/`) still is. `selfhost/server.ts` runs that same code on Node and provides the pieces it expects: the D1 database becomes a SQLite file, the R2 bucket a folder, email sending SMTP, and the cron trigger a five-minute timer. It also serves the setup wizard and the Server settings.

To run it without Docker for development: `npm ci`, then `npx esbuild selfhost/server.ts --bundle --platform=node --format=esm --outfile=dist/server.mjs --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"` and `DATA_DIR=./data MIGRATIONS_DIR=./migrations node dist/server.mjs` (Node 24). Run the tests with `npm test`.

## Environment variables

All optional. The app asks for what it needs on first run.

| Variable | Meaning |
| --- | --- |
| `PORT`, `BIND_ADDR` | Port inside the container (8787) and the address the compose file publishes on |
| `PUBLIC_URL`, `JELLYFIN_URL`, `JELLYFIN_ADMIN_KEY`, `SEERR_URL`, `SEERR_API_KEY`, `TRACEARR_URL`, `TRACEARR_TOKEN`, `SESSION_SECRET` | Starting values for the setup wizard. A session secret is generated if none is given |
| `TLS_MODE`, `TLS_HOSTS`, `TRUST_PROXY`, `NETWORK_RESET` | HTTPS and proxy behaviour (above) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email starting values |
| `TURNSTILE_SITEKEY`, `TURNSTILE_SECRET` | Sign-in challenge starting values |
| `KEYS_SECRET`, `VAPID_KEYS` | Optional: encrypt keys stored from the admin screen; web push (`node scripts/gen-vapid.mjs`) |
| `UPDATE_REPO` | GitHub `owner/name` checked for new releases (default `Ol775/Jellypass`) |
| `COMPOSE_PROFILES`, `TUNNEL_TOKEN` | Optional Cloudflare Tunnel service in the compose file |
