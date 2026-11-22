# Install guide

Want to see it first? There's a [live demo](https://jellypass.peacock665.com) of the self-hosted version, with made-up data and a guided tour. It shows the same screens you'll get, including Settings, Server.

A complete walkthrough from nothing to a working Jellypass with your first member invited. If something goes wrong, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md). For reference material (HTTPS options, every environment variable, the update check) see [SELF-HOSTING.md](SELF-HOSTING.md).

**Contents:** [What you need](#what-you-need) · [Get a Jellyfin API key](#get-a-jellyfin-api-key) · [Install](#install) · [The setup wizard](#the-setup-wizard) · [After installing](#after-installing) · [Updating](#updating) · [Backup and restore](#backup-and-restore) · [Moving to a new server](#moving-to-a-new-server) · [Uninstalling](#uninstalling) · [What is stored where](#what-is-stored-where)

## What you need

| | |
| --- | --- |
| **A Jellyfin server** | Running and reachable from the machine that will run Jellypass. You need an administrator account on it. Developed against Jellyfin 12.x; older versions may work but are untested |
| **Docker** | Docker Engine with Compose v2 (`docker compose`), or Portainer. Any machine that runs Docker: a NAS, a mini PC, a Raspberry Pi 4 or newer |
| **CPU** | 64-bit Intel/AMD (`amd64`) or 64-bit ARM (`arm64`). 32-bit ARM is not published |
| **Resources** | About 40 MB of memory when idle, about 250 MB of disk for the image, plus a small database |
| **A free port** | 8787 by default (you can change it) |
| **Optional** | [Seerr](https://docs.seerr.dev) (or Jellyseerr) for requests, Tracearr for live streams, an SMTP account for email, a domain name for HTTPS and the sign-in challenge |

Jellypass does not replace Jellyfin. It sits beside it: Jellyfin keeps your media and accounts, Jellypass adds invites, requests, history and admin tools on top.

## Get a Jellyfin API key

Jellypass uses one Jellyfin API key to create accounts for invited members and to read watch history.

1. Sign in to Jellyfin as an administrator.
2. Open the **Dashboard**, then **API Keys** (under Advanced).
3. Press **+**, name it `Jellypass`, and confirm.
4. Copy the key that appears. You will paste it into the setup wizard.

If you use Seerr, its key is under **Settings, General, API Key**. Tracearr's is under its **Settings** page. Both are optional and can be added later.

## Install

Pick one. All of them end at the same place: a container serving the setup wizard on port 8787.

### Portainer (as a stack)

1. In Portainer choose **Stacks**, then **Add stack**, and name it `jellypass`.
2. Pick **Web editor** and paste the contents of [`docker-compose.yml`](../docker-compose.yml). (Or pick **Repository**, use `https://github.com/Ol775/Jellypass` as the repository URL and `docker-compose.yml` as the compose path, and Portainer fetches it for you.)
3. You do not need to set any environment variables. Press **Deploy the stack**.
4. Wait for the container to show as running (healthy). The first start pulls the image, so allow a minute.
5. Open `http://<your-server>:8787`.

### Docker Compose

1. Make a folder and save [`docker-compose.yml`](../docker-compose.yml) in it. For example:

   ```sh
   mkdir jellypass && cd jellypass
   curl -O https://raw.githubusercontent.com/Ol775/Jellypass/main/docker-compose.yml
   ```

2. Start it:

   ```sh
   docker compose up -d
   ```

3. Check it is healthy: `docker compose ps` should show `healthy` after about 30 seconds.
4. Open `http://<your-server>:8787`.

### Plain Docker

```sh
docker run -d --name jellypass --restart unless-stopped \
  -p 8787:8787 -v jellypass-data:/data \
  ghcr.io/ol775/jelly-pass:latest
```

### Build it yourself

Useful if you want to change the code or run an unreleased version.

```sh
git clone https://github.com/Ol775/Jellypass.git
cd Jellypass
docker build -t jellypass .
JELLYPASS_IMAGE=jellypass docker compose up -d
```

### Changing the port

Set `PORT` when you start it (for example `PORT=9000 docker compose up -d`, or add `PORT` to the stack's environment variables in Portainer). The container always listens on 8787 inside; `PORT` is the port on your server.

### Where to open it from

Use the address of the machine running Docker, not `localhost` (unless you are on that machine). If it is not reachable, check the firewall, and that `BIND_ADDR` has not been set to `127.0.0.1`.

## The setup wizard

The first time you open the site you get a six-step wizard. Each connection is tested before you can continue, so a typo stops you on that page. Nothing is saved until the last step.

**Whoever opens the site first can finish setup**, so complete it before you expose the port or a hostname to anyone else.

| Step | What to enter |
| --- | --- |
| **1. Welcome** | Nothing. Press Continue |
| **2. Jellyfin** (required) | The **address** of your Jellyfin server and the **API key** from above. The address has to work *from inside the container*: use the server's LAN address, such as `192.168.1.10:8096`, or the Jellyfin container's name if it shares a Docker network. **`localhost` does not work**, because inside the container that means Jellypass itself. If you leave off `http://`, it is added. When Jellyfin connects, the background fills with posters from your library. There is also an optional **Address members use**: fill it in only if members connect to Jellyfin by a different address than Jellypass does, for example `watch.example.com` from outside your home network (see below) |
| **3. Seerr** (optional) | Its address and API key, and optionally the address members use for it, or **Skip** |
| **4. Tracearr** (optional) | Its address and token, or **Skip** |
| **5. Your address** | The web address members will open, for example `https://jellypass.example.com`. It is used in emails and invite links. It is pre-filled from your browser; change it if you will put Jellypass behind a proxy or tunnel |
| **6. Review** | Check the summary and press **Finish setup**. Nothing is changed in Jellyfin |

A final page says "You're ready". Everything you entered can be changed later under **Settings**.

## After installing

### 1. Sign in as an administrator

Sign in with a **Jellyfin administrator** account (the username and password you use in Jellyfin). Admins go straight to Home and see the admin pages in the sidebar: Users, Invites, Live streams, Announcements, Audit log, Security and Settings. There are no separate Jellypass accounts; people always sign in with their Jellyfin username and password.

### 2. Look at the access levels

**Settings, Access levels** has three to start with:

| Level | Ends after | Streaming limit | Requests |
| --- | --- | --- | --- |
| **Standard** | 365 days | 20 Mbit/s | can request |
| **Family** | never | none | requests approved automatically |
| **Guest** | 30 days | 8 Mbit/s | none |

Edit them or add your own. Changing a level does not change existing members until you choose **Apply to members**.

### 3. Invite your first member

1. Open **Invites** and create one: choose an access level, how many people may use it (1 to 100) and when it expires (1 to 90 days). You can also enter email addresses to send invites directly (email is optional, see below). Without email, copy the link.
2. Send the link. The member opens it, chooses a username and password, and Jellypass creates their Jellyfin account with that access level. A short guide helps them set up their phone or TV app.

### 4. If members connect from outside your network

Jellypass reaches Jellyfin by the address you gave it, which often only works inside your home network (`192.168.1.10:8096`). Members' browsers also use a Jellyfin address: for poster images, the "Open in Jellyfin" links, the app set-up guide that tells them which server to type, and the links in "request ready" emails and notifications. If members connect from outside, or by a different name, set **Address members use** on the Jellyfin card in Settings, Connections (for example `watch.example.com`). The Seerr card has the same field for the "Open Seerr" buttons. Leave them blank to use the connection addresses, which is right when those are already public.

### 5. Make it reachable and safe

- **HTTPS.** Plain HTTP is fine for a trial on your home network, but the sign-in cookie is only marked secure over HTTPS, and passkeys need it. Settings, **Server**, has Address and HTTPS: use a Cloudflare Tunnel or reverse proxy, or turn on the built-in self-signed or custom certificate. See the HTTPS table in [SELF-HOSTING.md](SELF-HOSTING.md#https-pick-one).
- **Sign-in challenge.** Settings, Server, can add Cloudflare Turnstile to the sign-in page to stop bots guessing passwords. It needs a real domain name.
- **Email** is optional and off until you add SMTP details in Settings, Server. While it is off, nothing is sent and the email-only screens are hidden. See [SELF-HOSTING.md](SELF-HOSTING.md#email-is-optional).
- **Maps and locations** are optional extras, see [SELF-HOSTING.md](SELF-HOSTING.md#optional-maps-and-approximate-locations).

## Updating

Jellypass tells you when a newer version exists: a banner appears on the admin pages, and Settings, **Server**, has an "About and updates" card with what changed. (It checks GitHub once a day; you can turn that off there.)

- **Portainer:** open the stack. If it came from the Web editor, choose **Update the stack** and turn on **Re-pull image and redeploy**; if it came from a repository, choose **Pull and redeploy**.
- **Docker Compose:** `docker compose pull && docker compose up -d`
- **Plain Docker:** `docker pull ghcr.io/ol775/jelly-pass:latest`, then remove the container and run it again with the same `-v jellypass-data:/data`.

Your data is in the volume, so it is kept. Database changes apply automatically when the new version starts. To stay on a specific version, replace `latest` with a number such as `1.0.0` in the image name.

## Backup and restore

Everything lives in the `jellypass-data` volume. Back up two things: the database and `config.json` (your saved settings, including the API keys).

### Back up

```sh
# 1. A consistent copy of the database, made while Jellypass is running
docker exec jellypass node --disable-warning=ExperimentalWarning -e \
  "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('/data/jellypass.db').exec(\"VACUUM INTO '/data/backup.db'\")"

# 2. Copy it, and the settings file, out of the container
docker cp jellypass:/data/backup.db ./jellypass-backup.db
docker cp jellypass:/data/config.json ./jellypass-config.json

# 3. Remove the temporary copy inside the volume
docker exec jellypass rm /data/backup.db
```

Replace `jellypass` with your container name if it differs. `config.json` holds secrets (API keys), so keep the backup somewhere private.

### Restore

Stop Jellypass, put the files into the volume, and start it again. The folder and the files must belong to user 1000 (`node`), which is what the container runs as:

```sh
docker stop jellypass
docker run --rm -u 0 -v jellypass-data:/data -v "$PWD":/restore:ro alpine sh -c '
  rm -f /data/jellypass.db /data/jellypass.db-wal /data/jellypass.db-shm &&
  cp /restore/jellypass-backup.db /data/jellypass.db &&
  cp /restore/jellypass-config.json /data/config.json &&
  chown -R 1000:1000 /data'
docker start jellypass
```

If the volume has a different name (Compose prefixes it with the project name, for example `jellypass_jellypass-data`), check `docker volume ls`.

## Moving to a new server

Install Jellypass on the new machine as above, stop it before the wizard is completed, then restore your backup into its volume as shown above and start it. Set the new public address in Settings, Server if it changed.

## Uninstalling

- **Keep your data:** stop and remove the stack or container but leave the volume (`docker compose down`). Reinstalling later with the same volume picks up where you left off.
- **Delete everything:** `docker compose down -v` removes the volume too. This is permanent, so take a backup first.

Uninstalling does not touch Jellyfin. Accounts that Jellypass created for members stay in Jellyfin.

## What is stored where

| Location | Contents |
| --- | --- |
| Volume `jellypass-data`, `/data/jellypass.db` | The database: invites, access levels and end dates, member preferences, notices, the audit log |
| `/data/config.json` | Your saved settings, including the Jellyfin, Seerr and Tracearr keys and the sign-in challenge secret. Readable only by the container's user |
| `/data/tls/` | The HTTPS certificate and key, if you turned on built-in HTTPS |
| `/data/tiles/` | Optional map and location files you add yourself |

What people watch is read live from Jellyfin and Seerr and is not copied into Jellypass's database.
