# Homelab (Coolify + Twingate)

Penny Duck runs on a Coolify server that's reachable only through Twingate. Nothing on it is exposed to the internet, and nothing outside reaches in: CI publishes images to GHCR, and a timer on the server pulls them.

```
push to main/v* → images.yml → ghcr.io/dusaniuk/penny-duck-{api,web}:<branch> + :<sha>
                                        ↑ polled every 2 min
server: penny-duck-deploy.timer → docker pull → Coolify API (localhost) → docker-compose.yml
Twingate client → app.penny-duck.com → Traefik (wildcard cert, DNS-01) → web → api → Postgres
```

| Folder               | What                                                     |
| -------------------- | -------------------------------------------------------- |
| `docker-compose.yml` | the `api` + `web` stack Coolify runs                     |
| `deploy/`            | the watcher that redeploys when new images are published |
| `backup/`            | encrypted off-site database backups (see its README)     |

Host files follow one layout: scripts in `/usr/local/bin/penny-duck-*`, config in `/etc/penny-duck/`, units in `/etc/systemd/system/penny-duck-*`.

## 1. Images

`.github/workflows/images.yml` runs on every push to `main` and to version branches. After its first run, make both packages public: GitHub → your profile → Packages → `penny-duck-api` / `penny-duck-web` → Package settings → Change visibility → Public. The images hold only what's in this public repo; secrets are set at runtime.

## 2. TLS: wildcard certificate via Cloudflare DNS-01

The app has no public DNS record, so Let's Encrypt can't reach it over HTTP; DNS-01 proves ownership with a TXT record instead. A wildcard keeps hostnames out of the public Certificate Transparency logs.

1. Cloudflare → My Profile → API Tokens → Create token → **Edit zone DNS**, limited to the `penny-duck.com` zone.
2. Coolify → Servers → your server → Proxy → Configuration. Under the `traefik` service, add `CF_DNS_API_TOKEN=<token>` to `environment`. In `command`, remove the two `httpchallenge` lines and add:

   ```yaml
   - "--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=cloudflare"
   - "--certificatesresolvers.letsencrypt.acme.dnschallenge.delaybeforecheck=0"
   ```

   Save, then **Restart Proxy**.

3. Proxy → Dynamic Configurations → new file `wildcard-penny-duck-com.yaml`. Traefik only requests certificates for routers, so this placeholder router (unused host, no-op service) exists to request the wildcard; app routers then reuse it instead of getting their own:

   ```yaml
   http:
     routers:
       wildcard-penny-duck-com:
         rule: Host(`wildcard.penny-duck.com`)
         entryPoints:
           - https
         service: noop@internal
         tls:
           certResolver: letsencrypt
           domains:
             - main: penny-duck.com
               sans:
                 - "*.penny-duck.com"
   ```

4. Watch Proxy → Logs for the ACME request to succeed. Once the app is deployed, [crt.sh](https://crt.sh/?q=penny-duck.com) should list only the wildcard, not `app.penny-duck.com`.

## 3. Twingate

- **Resource** `app.penny-duck.com`: address `192.168.100.29`, alias `app.penny-duck.com`, port 443 only, for the group that uses the app.
- **Resource** for the Coolify dashboard and SSH: admin group only.
- Postgres is never a resource.

## 4. Coolify application

New Resource → **Public Repository** → `https://github.com/dusaniuk/penny-duck`:

- Branch: `main` (a version branch for a rehearsal)
- Build pack: **Docker Compose**, compose file `/infra/homelab/docker-compose.yml`

Environment variables:

| Variable                                    | Value                                            |
| ------------------------------------------- | ------------------------------------------------ |
| `IMAGE_TAG`                                 | `main`, or the version branch during a rehearsal |
| `DATABASE_URL`                              | the Postgres resource's internal URL             |
| `BETTER_AUTH_SECRET`                        | `openssl rand -base64 32`                        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from the Google OAuth client                     |
| `WEB_URL`                                   | `https://app.penny-duck.com`                     |

Domains: on the `web` service, `https://app.penny-duck.com:3000`. `api` gets no domain; only `web` reaches it.

In Google Cloud → APIs & Services → Credentials → the OAuth client, add the redirect URI `https://app.penny-duck.com/api/auth/callback/google`.

Deploy once by hand and check that the `api` logs show migrations applied and `api listening`, and that both containers turn healthy.

## 5. Deploy watcher

1. Coolify → Settings → enable **API access**. Keys & Tokens → API tokens → new token with **deploy** permission.
2. The application's UUID is in its URL in the Coolify dashboard.
3. Install, from your Mac:

   ```bash
   scp -r infra/homelab/deploy yaro@192.168.100.29:~/
   ```

   On the server:

   ```bash
   sudo install -m 755 ~/deploy/deploy-watch.sh /usr/local/bin/penny-duck-deploy
   sudo install -m 600 ~/deploy/penny-duck-deploy.env.example /etc/penny-duck/deploy.env
   sudoedit /etc/penny-duck/deploy.env
   sudo cp ~/deploy/penny-duck-deploy.service ~/deploy/penny-duck-deploy.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl start penny-duck-deploy.service
   sudo journalctl -u penny-duck-deploy -n 20
   sudo systemctl enable --now penny-duck-deploy.timer
   rm -r ~/deploy
   ```

`IMAGE_TAG` in `deploy.env` must match the one in Coolify. The first run always deploys, since it has no record of what's running.

## Rolling back

Set `IMAGE_TAG` in Coolify to an earlier commit SHA (every build is also tagged with it) and redeploy. The watcher keeps redeploying when `main` moves, but Coolify stays on the pinned SHA until you set it back to `main`.

Migrations only move forward. Rolling back past a migration leaves the newer schema in place, which the older code has to tolerate, or the database has to be restored from a backup.
