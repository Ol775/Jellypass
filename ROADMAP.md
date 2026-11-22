# Roadmap

<p align="center"><img src="docs/images/roadmap.png" alt="Jellypass roadmap in three columns. Shipped in 1.0: Docker image and Portainer stack, first-run setup wizard, editing connections in Settings, HTTPS with a self-signed or your own certificate, Cloudflare Tunnel and proxy support, optional email and sign-in challenge, version and changelog with an update notice, and the install, troubleshooting and security guides. Up next: try the Cloudflare Tunnel setup on a real tunnel, real-device checks, scheduled automatic backups, an optional lock on first-run setup, and encrypting saved API keys. Later: sign-in page posters from your own library, resolving addresses before connecting, an HSTS switch, Unraid, Synology and TrueNAS guides, light-theme screenshots, and moving to a newer Node release." width="100%"></p>

This is where Jellypass is heading. **It is a plan, not a promise**: Jellypass is a one-person hobby project, so there are no dates, and priorities change with what breaks, what people ask for and what I have time for. The picture above is a summary; this page has the detail.

| Mark | Meaning |
| --- | --- |
| ✅ | Shipped, in the current release |
| 🗓️ | Up next: planned, roughly in this order |
| 💡 | Later: wanted, not scheduled |
| 🚫 | Not planned |

## ✅ Shipped

| Release | What arrived |
| --- | --- |
| **1.0.1** | Install guide and troubleshooting guide, a security policy, contributing guide and issue templates, CI, and fixes for the Docker health check with HTTPS, the unwritable-data-folder error and the backup instructions. See the [changelog](CHANGELOG.md) |
| **1.0.0** | The first public self-hosted release: a Docker image and compose file that work as a Portainer stack, the first-run setup wizard, editing Jellyfin, Seerr and Tracearr connections in Settings, built-in HTTPS (self-signed or your own certificate), Cloudflare Tunnel and reverse-proxy support, optional email and Cloudflare Turnstile, and a version, changelog and update notice |

## 🗓️ Up next

In rough priority order. These close gaps that the docs already admit to.

| # | Item | Why |
| --- | --- | --- |
| 1 | **Try the Cloudflare Tunnel setup on a real tunnel** | The tunnel service in the compose file is written and the steps are documented, but the author has not run it end to end against a real tunnel. Until then it is marked untested in the [self-hosting guide](docs/SELF-HOSTING.md#https-pick-one) |
| 2 | **Real-device checks** | Passkeys, authenticator-app codes and web push are covered by tests but still need a proper pass on real phones and browsers, and the phone and TV set-up guides need checking on real devices |
| 3 | **Scheduled automatic backups** | Backup and restore work and are [documented and tested](docs/INSTALL.md#backup-and-restore), but they are manual. Automatic backups into the data volume, with a restore tried regularly, would remove the "I forgot" failure |
| 4 | **Optional lock on first-run setup** | Today whoever opens the site first can finish setup, which is listed under [known limitations](SECURITY.md#known-limitations). An optional setup password (off by default, so the one-minute install stays one minute) would close it for people who need that |
| 5 | **Encrypt saved API keys at rest** | The Jellyfin, Seerr and Tracearr keys sit in `config.json`, protected only by file permissions (see [known limitations](SECURITY.md#known-limitations)). Encrypting them would make a stolen backup less harmful |

## 💡 Later

Good ideas that are not scheduled. If one matters to you, say so on an issue.

| Item | Notes |
| --- | --- |
| **Sign-in page posters from your own library** | The sign-in page's poster wall comes from Seerr's trending list today. The setup wizard already builds its wall from your Jellyfin library, so the sign-in page could do the same and no longer need Seerr |
| **Resolve addresses before connecting** | Obvious cloud-metadata addresses are refused by name, but names are not resolved first. Resolving them would be a stronger guard for the outbound connections |
| **HSTS switch in Server settings** | Jellypass sets no `Strict-Transport-Security` header; today you add it at your proxy |
| **Unraid, Synology and TrueNAS guides** | Install notes (and an Unraid template) for the common home-server platforms |
| **Light-theme screenshots** | The README screenshots are the dark theme only |
| **Move to a newer Node release** | The image runs on Node 24. A newer release needs testing first, because Jellypass relies on Node's built-in SQLite |

## 🚫 Not planned

Saying no keeps the project small and dependable:

- **Replacing Jellyfin accounts or sign-in.** People always sign in with their Jellyfin username and password; Jellypass never stores passwords.
- **Hosting or managing media.** Jellypass does not download, organise or serve media. That is Jellyfin, Seerr, Sonarr, Radarr and similar tools.
- **32-bit ARM images.** Images are published for 64-bit Intel/AMD and 64-bit ARM.

## Shaping it

- **Vote.** Add a 👍 to an existing issue so it is clear what matters to people.
- **Ask.** Open a [feature request](https://github.com/Ol775/Jellypass/issues/new?template=feature_request.yml) and describe the problem you are trying to solve.
- **Build.** Pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). For anything large, talk it through on an issue first.
- **Security.** Please report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

When something ships it moves up this page and into the [changelog](CHANGELOG.md).
