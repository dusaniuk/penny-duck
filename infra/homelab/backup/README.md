# Database backups (homelab)

Two layers:

| Layer    | Where                                    | Kept    | For                                     |
| -------- | ---------------------------------------- | ------- | --------------------------------------- |
| Coolify  | on the server (Coolify's backup tab)     | 7 days  | quick "I broke something" restores      |
| Off-site | Backblaze B2, age-encrypted, Object Lock | 90 days | losing the server, ransomware, mistakes |

The off-site job runs on the host as a systemd timer: `pg_dump` inside Coolify's Postgres container → `age` (public key only) → `rclone` to B2. The host can write backups but can't read them; the private key lives in 1Password.

## Coolify

Postgres resource → **Backups** → one schedule, `daily`, local retention 7 days, **S3 off**. Off-site copies come from the timer below, not from Coolify.

## One-off setup

### 1. age key (on your Mac)

```bash
age-keygen -o penny-duck-backup.key
```

It prints `Public key: age1...` — that goes in the env file. Save the key file in 1Password (as a document), then delete it locally. `age-keygen -y <key file>` re-derives the public key if you lose it.

### 2. Backblaze B2

The B2 region is picked when the account is created: choose **EU Central**.

1. Create a private bucket `penny-duck-backups` with **Object Lock** enabled, default retention **Governance, 30 days**. Locked file versions can't be deleted by anyone holding the server's key, even if the server is compromised.
2. Lifecycle settings → custom rule for all files: hide after **90** days, delete **1** day after hiding.
3. Application keys → two keys, both restricted to `penny-duck-backups`:
   - **Write Only** for the server: it can upload but can't read, list or delete. Its key ID and key go in the env file.
   - **Read Only** for restores: save it in 1Password next to the age key. It never goes on the server.

### 3. healthchecks.io (optional, recommended)

New check, period 1 day, grace 2 hours. The script pings `/start`, success and `/fail`, so a missed or failed backup sends an alert.

### 4. Install on the server

From your Mac:

```bash
scp -r infra/homelab/backup you@homelab:~/
```

On the server:

```bash
sudo apt install age rclone
sudo install -m 755 ~/backup/backup-db.sh /usr/local/bin/penny-duck-backup
sudo install -d -m 700 /etc/penny-duck
sudo install -m 600 ~/backup/penny-duck-backup.env.example /etc/penny-duck/backup.env
sudoedit /etc/penny-duck/backup.env
sudo cp ~/backup/penny-duck-backup.service ~/backup/penny-duck-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

`DB_CONTAINER` is the hostname in the database's internal URL in Coolify; `docker ps --filter name=<it>` confirms it. `DB_USER` and `DB_NAME` are on the same page.

Run it once by hand, then turn on the timer:

```bash
sudo systemctl start penny-duck-backup.service
journalctl -u penny-duck-backup -n 20
sudo systemctl enable --now penny-duck-backup.timer
systemctl list-timers penny-duck-backup.timer
```

The timer runs daily at about 03:30; `Persistent=true` runs a missed backup when the server comes back up.

## Restoring

Needs only your Mac, the read-only B2 key and the age key from 1Password — nothing from the homelab. Add the B2 key once with `rclone config` (new remote `b2`, type `b2`), then:

```bash
rclone lsf b2:penny-duck-backups
rclone copy b2:penny-duck-backups/<file> .
age -d -i penny-duck-backup.key <file> | pg_restore --no-owner --no-acl --exit-on-error -d "$TARGET_URL"
```

`TARGET_URL` must be an empty database. Pipe through `docker exec -i <postgres container> pg_restore -U <user> -d <db> ...` instead when the target runs in Docker.

A file hidden with `rclone delete` (or by an attacker) still has its locked version; list it with `rclone lsf --b2-versions`.

### Restore drill

Every few months: restore the latest backup into a scratch database, compare row counts with production (e.g. `select count(*) from app.transactions`), then drop it and delete the downloaded file. A backup that hasn't been restored isn't known to work.
