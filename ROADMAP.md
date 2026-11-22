# Roadmap

<p align="center"><img src="docs/images/roadmap.png" alt="Jellypass roadmap in three columns. Shipped in 1.0: Docker image and Portainer stack, first-run setup wizard, editing connections in Settings, HTTPS with a self-signed or your own certificate, Cloudflare Tunnel and proxy support, optional email and sign-in challenge, version and changelog with an update notice, and the install, troubleshooting and security guides. Up next: detecting Jellyfin, Seerr and Tracearr on your network, scheduled automatic backups, backup to S3-compatible storage, an optional lock on first-run setup, and encrypting saved API keys. Later: sign-in page posters from your own library, resolving addresses before connecting, an HSTS switch, Unraid, Synology and TrueNAS guides, personalisation (your own name, logo and accent colour), and moving to a newer Node release." width="100%"></p>

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
| **1.0.2** | An optional **Address members use** for Jellyfin and Seerr, so posters, links, the app set-up guide and notification emails work for members outside your network |
| **1.0.1** | Install guide and troubleshooting guide, a security policy, contributing guide and issue templates, CI, and fixes for the Docker health check with HTTPS, the unwritable-data-folder error and the backup instructions. See the [changelog](CHANGELOG.md) |
| **1.0.0** | The first public self-hosted release: a Docker image and compose file that work as a Portainer stack, the first-run setup wizard, editing Jellyfin, Seerr and Tracearr connections in Settings, built-in HTTPS (self-signed or your own certificate), Cloudflare Tunnel and reverse-proxy support, optional email and Cloudflare Turnstile, and a version, changelog and update notice |

## 🗓️ Up next

In rough priority order. These make setup easier and close gaps that the docs already admit to.

| # | Item | Why |
| --- | --- | --- |
| 1 | **Detect Jellyfin, Seerr and Tracearr on your network** | Setup today means typing three addresses. The wizard could offer the servers it finds, so you pick one from a list and only paste the key. Jellyfin's own discovery broadcast does not cross Docker's network, so this would work by trying the usual container names and ports on your Docker network and home network, and recognising each service by how it answers |
| 2 | **Scheduled automatic backups** | Backup and restore work and are [documented and tested](docs/INSTALL.md#backup-and-restore), but they are manual. Automatic backups into the data volume, with a restore tried regularly, would remove the "I forgot" failure |
| 3 | **Backup to S3-compatible storage** | Upload each scheduled backup off the machine, to Amazon S3, Backblaze B2, Cloudflare R2, MinIO and anything else that speaks the S3 protocol. Backups hold your keys, so they would be encrypted before they leave your server, with a retention setting so old ones are cleared. A lost disk would no longer mean lost data |
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
| **Personalisation** | Make the portal yours: your own site name, logo and accent colour, and a default theme for new devices. Members can already choose Auto, Light, Dark or OLED themselves in their Settings (saved per device); this would let the admin brand the whole portal |
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
