# Troubleshooting

Find your symptom, read what it means, apply the fix. The exact wording of messages is quoted so you can search this page. For installing from scratch see [INSTALL.md](INSTALL.md).

**Contents:** [First, get some information](#first-get-some-information) · [Starting the container](#starting-the-container) · [The setup wizard](#the-setup-wizard) · [Signing in](#signing-in) · [HTTPS, proxies and tunnels](#https-proxies-and-tunnels) · [Email](#email) · [Updates](#updates) · [Data, backups and resetting](#data-backups-and-resetting) · [Maps and locations](#maps-and-locations) · [Still stuck?](#still-stuck)

## First, get some information

Most problems show up in the logs.

```sh
docker logs --tail 100 jellypass          # the last 100 lines (use your container name)
docker logs -f jellypass                  # follow live
docker ps -a --filter name=jellypass      # is it running, and healthy?
```

In Portainer, open the container and choose **Logs**. A healthy start prints the version and where it listens:

```
Jellypass 1.0.0
Jellypass listening on :8787 over HTTP (data in /data)
```

The version is also shown in Settings, **Server**, under "About and updates".

## Starting the container

### `Bind for 0.0.0.0:8787 failed: port is already allocated`

Something else on the machine already uses that port. Pick another: `PORT=8788 docker compose up -d` (or set `PORT` in the Portainer stack's environment variables). The container still listens on 8787 inside; `PORT` is the port on your server.

### `The container name "/jellypass" is already in use`

A container with that name exists, often from an earlier attempt. Remove it (`docker rm -f jellypass`, only if you do not need it) or choose another name. If you want to keep the old one running, edit `container_name:` in the compose file.

### `unauthorized` or `pull access denied` when pulling the image

Check the image name. It is `ghcr.io/ol775/jelly-pass` (with a hyphen), not `jellypass`. An old name like `ghcr.io/ol775/jellypass` returns `unauthorized`.

### `no matching manifest for linux/arm/v7` (or similar)

Images are published for 64-bit Intel/AMD (`amd64`) and 64-bit ARM (`arm64`) only. A 32-bit ARM system, including a Raspberry Pi running 32-bit Raspberry Pi OS, cannot run it. Use a 64-bit operating system.

### The container starts, then exits straight away with `Cannot open the database in /data`

```
Cannot open the database in /data: unable to open database file
The container runs as user 1000 (node). If /data is a folder from your server, make it writable with: chown -R 1000:1000 <that folder>.
```

The data folder is not writable by the container's user (user 1000, `node`). This happens when you mount a folder from your server (a bind mount such as `-v /srv/jellypass:/data`) that is owned by root. Fix it:

```sh
sudo chown -R 1000:1000 /srv/jellypass     # use your own folder
```

A Docker **named volume**, as in the supplied compose file, needs nothing. (Older versions printed only `Error: unable to open database file`.)

### The container shows `unhealthy`

First check the logs. If you turned on built-in HTTPS from the settings page and are on version 1.0.0, the health check only tried plain HTTP and reported unhealthy even though the site was fine; update to 1.0.1 or later. Otherwise `docker inspect jellypass --format '{{json .State.Health}}'` shows the last check's output.

### It is running but `http://<server>:8787` does not open

- You must use the address of the machine running Docker, not `localhost` from another computer.
- Check the firewall allows the port.
- Check `docker ps` shows `0.0.0.0:8787->8787/tcp`. If it shows `127.0.0.1:8787`, `BIND_ADDR=127.0.0.1` is set and only that machine can connect; unset it, or put a proxy in front.
- If you turned on HTTPS, the address now starts with `https://`. Plain `http://` to the same port no longer answers.

## The setup wizard

### `Could not reach it. The address must be reachable from inside the container (not localhost).`

Jellypass could not connect to the address you gave. Remember it connects *from inside the container*:

- **`localhost` and `127.0.0.1` never work**, because they mean the Jellypass container itself. Use the other machine's LAN address (`192.168.1.10:8096`) or, if both run on the same Docker network, the container's name (`http://jellyfin:8096`).
- Check the port (Jellyfin is usually 8096; Seerr 5055).
- Check the address in a browser from another computer. If Jellyfin has a firewall or only listens on certain addresses, allow the Docker host.
- An `https://` address to a server with a self-signed certificate fails, because Jellypass checks certificates. Use the plain `http://` LAN address instead.

### `That key was refused. Check it and try again.`

The service answered but rejected the key. Copy it again without spaces. For Jellyfin it must be an **API key** (Dashboard, API Keys), not a password. The user behind it does not matter, but keys can be revoked, so confirm it is still listed in Jellyfin.

### `Enter the address (starting http:// or https://) and the key.`

One of the two boxes is empty or the address is malformed. A link-local address such as `169.254.…` is deliberately refused.

### The posters behind the wizard are plain placeholders

The wizard shows placeholder tiles until Jellyfin connects, then fills with posters from your library. If it stays plain after Jellyfin connects, the logs will say why, for example `Poster wall unavailable: Jellyfin answered 401`. It is only decoration: setup still works. A library with no items that have posters also shows placeholders.

### The setup wizard appears again after I finished it

Your saved settings were lost, which means the data is not persisting. Check the container was started with a volume (`-v jellypass-data:/data`, or the supplied compose file), and that you did not recreate it with a different or no volume. `docker volume ls` should list `jellypass-data` (Compose prefixes it, for example `jellypass_jellypass-data`).

### I want to run setup again

Delete the saved settings. The data (invites, members' preferences, audit log) is kept:

```sh
docker exec jellypass rm /data/config.json
docker restart jellypass
```

## Signing in

### I sign in, it looks like it worked, but I end up back on the sign-in page

This is almost always the address. The sign-in cookie is marked secure when the **Public address** starts with `https://`. If the public address says `https://…` but you are browsing over plain `http://`, the browser throws the cookie away and the next page sees you as signed out.

**Fix:** make the Public address match how you open the site. If you browse `http://192.168.1.10:8787`, set the Public address to exactly that, or set up HTTPS and always use the `https://` address. Change it in Settings, **Server**, Address and HTTPS (or if you cannot sign in at all, start once with `NETWORK_RESET=true`, see below). The same happens if a proxy terminates HTTPS but Jellypass is told the public address is `http://`: use the `https://` address.

### `jellyfin unavailable`

Jellypass cannot reach Jellyfin right now. Check Jellyfin is running, and open Settings, **Connections** (or ask someone with access) to see whether it shows Working. If the address changed, update it there.

### `wrong username or password`

Use the **Jellyfin** username and password (not an email address). If Jellyfin itself rejects the password, reset it in Jellyfin: Dashboard, Users.

### `challenge failed`

The sign-in challenge (Cloudflare Turnstile) is on but did not pass. Common causes: the Turnstile widget's hostname does not match the address you are using (it needs a real domain name, not an IP), the site key and secret are from different widgets, or a browser extension blocked the script from `challenges.cloudflare.com`. You can turn the challenge off in Settings, Server, Sign-in challenge, or fix the widget's hostname in Cloudflare.

### `too many attempts, try again later`

Five failed attempts within 15 minutes lock that **address** and that **username** for the rest of the 15 minutes. Wait it out, or clear the counters yourself (a restart does not clear them, they are kept in the database):

```sh
docker exec jellypass node --disable-warning=ExperimentalWarning -e \
  "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('/data/jellypass.db').exec('DELETE FROM rate_limits')"
```

 Behind a proxy or tunnel, Jellypass sees every member as the proxy's address unless **Trust the proxy** is on (Settings, Server), so one person's mistakes can lock everyone out. Turn it on only if the proxy is the only way in.

### I signed in but there are no admin pages

Admin access comes from Jellyfin: the account must be a Jellyfin **administrator** (Dashboard, Users, the user, Profile, "Allow this user to manage the server").

### I forgot my password / "Forgot password?" is missing

Passwords live in Jellyfin. With email off, the sign-in page says to ask whoever runs the server, who can reset it in Jellyfin (Dashboard, Users). With email on, the Forgot password link sends a code.

## HTTPS, proxies and tunnels

### The browser warns about the certificate (`NET::ERR_CERT_AUTHORITY_INVALID`)

Expected with the built-in **self-signed** certificate: nothing trusted vouches for it. Accept the warning once, or download the certificate in Settings, Server, and add it to your device's trust store. Some phones and TVs refuse self-signed certificates; use a Cloudflare Tunnel, a proxy with a real certificate, or your own certificate instead.

### I turned on HTTPS and now I cannot open the site

The address now starts with `https://` and plain `http://` stops answering on that port. Open `https://<server>:8787`. If it still will not load, start the container once with `NETWORK_RESET=true`: it ignores the saved address, HTTPS and proxy settings so you can open the page and fix them. Remove the variable afterwards.

### Certificate messages in Settings, Server

| Message | Meaning and fix |
| --- | --- |
| `That does not look like a certificate (PEM text starting with BEGIN CERTIFICATE).` | Paste the certificate as text, including the `-----BEGIN CERTIFICATE-----` lines. Not a `.pfx` or `.der` file |
| `That does not look like an unencrypted private key (PEM text starting with BEGIN PRIVATE KEY).` | The key must be PEM and **not password protected**. Remove the passphrase first (`openssl pkey -in key.pem -out key-open.pem`) |
| `The private key does not belong to that certificate.` | You pasted a key from a different certificate. Nothing was changed |
| `That certificate expired on …` | Renew it, then paste the new one |
| `Could not make a certificate: openssl is not available in this container.` | Only happens with a custom-built image. The published image includes openssl |

A rejected certificate changes nothing, so the site keeps working while you fix it.

### Cloudflare Tunnel: error 502 or 1033, or the `cloudflared` container exits

- The tunnel's public hostname must point at `http://jellypass:8787` (the service name and port), and `cloudflared` must be on the same Docker network as Jellypass. The supplied compose file does both.
- Start it with `COMPOSE_PROFILES=tunnel` and a `TUNNEL_TOKEN`; without the token `cloudflared` exits. `docker logs` on the `cloudflared` container says which.
- Set the Public address to the https hostname and turn on **Trust the proxy**.
- If you changed the tunnel to talk to Jellypass over `https://`, it must skip certificate checks (`noTLSVerify`) because the certificate is self-signed.

### Invite links or emails contain the wrong address

They are built from the **Public address**. Set it to the address members actually use (Settings, Server).

### Every member appears to come from the same IP

You are behind a proxy and **Trust the proxy** is off. Turn it on in Settings, Server, Address and HTTPS, but only if the proxy is the only way to reach Jellypass (bind with `BIND_ADDR=127.0.0.1` or use a private Docker network). Otherwise anyone could fake their address.

## Email

Email is optional. If a screen you expect is missing (Forgot password, the email options on the Account page, the emailed sign-in link), email is **off**: it is off until SMTP is set up, and Settings, Server, Email (SMTP) has a switch to turn it off again.

### `Email is turned off on this server.`

Email is off, see above. Add SMTP details and tick **Send email from this server**.

### The test email fails

Settings, Server, **Send test email** shows the mail server's own reply:

| Reply | Fix |
| --- | --- |
| `Invalid login: 534-5.7.9 Please log in with your web browser…` (Gmail) | Use an **app password**, not your normal password. Turn on 2-step verification first, then create one in your Google account |
| `Invalid login` / `535` | Wrong username or password. Many providers use the full email address as the username |
| `Connection timeout` / `ECONNREFUSED` | Wrong server name or port, or the port is blocked. Port 587 with SSL **off** (STARTTLS), or port 465 with SSL **on** |
| `self-signed certificate` | The mail server's certificate is not trusted. Use a provider with a normal certificate |
| Sender not allowed / `550` | The **From address** must be one your provider lets you send as |

### The test email says it was sent but nothing arrives

Check the spam folder, and that the From address and your domain pass the provider's checks (SPF/DKIM). Free providers often reject mail from unverified senders.

## Updates

### No update banner appears

The check runs once a day, so give it time, or press **Check now** in Settings, Server, About and updates. Check it has not been switched off there. The banner can be dismissed per version.

### `Could not reach GitHub.`

The container cannot reach `api.github.com`. Check DNS and any firewall or proxy on the server. It does not affect anything else.

### I redeployed but the version did not change

Docker reused the cached image. In Portainer turn on **Re-pull image and redeploy**; with Compose run `docker compose pull` first. If you pinned a version in the image name (for example `:1.0.0`) change it.

## Data, backups and resetting

Backup and restore steps (verified) are in [INSTALL.md](INSTALL.md#backup-and-restore). Quick answers:

- **Where is my data?** In the `jellypass-data` volume, see [What is stored where](INSTALL.md#what-is-stored-where).
- **Restored a backup and the container exits.** The data folder and files must belong to user 1000: `chown -R 1000:1000` on the folder and the files, see the restore steps. Restoring only the database file's owner is not enough; the folder needs it too, because SQLite creates its journal files there.
- **Locked out by a bad network setting.** Start once with `NETWORK_RESET=true`.
- **Re-run the setup wizard.** Delete `config.json` as shown above.
- **Start completely fresh.** Remove the stack and its volume (`docker compose down -v`). This deletes everything.

## Maps and locations

The Live streams map and city names for sign-ins are blank unless you add the optional files (they cannot be bundled for licence reasons). See [Optional: maps and approximate locations](SELF-HOSTING.md#optional-maps-and-approximate-locations). Everything else works without them.

## Still stuck?

Open an issue at [github.com/Ol775/Jellypass/issues](https://github.com/Ol775/Jellypass/issues). Please include:

- The Jellypass **version** (Settings, Server, or the first line of the logs) and how you installed it (Portainer, Compose, plain Docker).
- The relevant **log lines** (`docker logs --tail 100 jellypass`). Remove anything secret first: API keys, tokens and passwords should never appear in the logs, but check.
- What you did, what you expected, and what happened, including any exact error text.
- Your Jellyfin version, and whether Jellypass runs behind a proxy or tunnel.

Never post your `config.json`; it contains your API keys.
