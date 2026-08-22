# Deploying (testnet)

The app runs locally with nothing but the Pollar key. A deploy needs two more
things, and both exist for the same reason: **a serverless filesystem is
read-only and ephemeral**, so the local SQLite file that works on a laptop
cannot work on Vercel.

## 1. A database that isn't a file

[Turso](https://turso.tech) (libSQL) — the same engine, hosted.

**From the web, no CLI needed.** Sign in with GitHub, create a database named
`qr-menu-orders`, then copy two values from its connection panel: the URL
(`libsql://qr-menu-orders-<org>.<region>.turso.io`) and a generated
read-write token (a long string starting with `eyJ`).

If you prefer the CLI, note that the Homebrew formula depends on a tap it
doesn't declare, so `brew install tursodatabase/tap/turso` fails on a clean
machine with `No available formula with the name "libsql/sqld/sqld"`. Either
tap it first or use the official installer:

```bash
brew tap libsql/sqld && brew install tursodatabase/tap/turso
# or
curl -sSfL https://get.tur.so/install.sh | bash

turso auth login
turso db create qr-menu-orders
turso db show qr-menu-orders --url
turso db tokens create qr-menu-orders
```

## 2. Create the tables

Migrations run automatically **only** against a local file. Against a remote
database they don't: several serverless instances migrating at once is a race,
so it's a deliberate step you run once, from your machine:

```bash
cd apps/qr-menu-orders
DATABASE_URL=libsql://…  DATABASE_AUTH_TOKEN=…  pnpm db:migrate
```

Both variables go on one line, before the command: that sets them for this
command only, without touching the local `.env`. Quote the token — it contains
characters the shell would otherwise interpret.

Re-run this after any future `pnpm db:generate`. To check it worked without
the CLI:

```bash
DATABASE_URL='libsql://…' DATABASE_AUTH_TOKEN='…' node -e '
const {createClient}=require("@libsql/client");
createClient({url:process.env.DATABASE_URL,authToken:process.env.DATABASE_AUTH_TOKEN})
  .execute("select name from sqlite_master where type=\'table\' order by name")
  .then(r=>console.log(r.rows.map(x=>x.name).join(", ")));'
```

It should list all seven tables.

## 3. Environment variables

Three, all set in **Vercel → Settings → Environment Variables**:

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | `pub_testnet_…` | The SDK |
| `DATABASE_URL` | `libsql://…` from step 1 | Where the data lives |
| `DATABASE_AUTH_TOKEN` | the token from step 1 | Access to it |

**Set them before the first build, not after.** The build prerenders the
landing page, the Pollar provider throws when the key is missing, and the
build fails — not at runtime, at build time.

Nothing else belongs in the environment. The USDC issuer and the Horizon URL
are constants in `lib/stellar.ts`, and the QR's base URL is read from the
incoming request, so a QR printed from the deploy encodes the deploy.

## 4. Deploy

```bash
npm i -g vercel
cd apps/qr-menu-orders
vercel          # first run: creates the project, this folder is the root
vercel --prod
```

Running from inside `apps/qr-menu-orders` matters: this app has its own
`package.json` and lockfile and no workspace, so that folder is the project
root as far as Vercel is concerned.

## 5. Tell Pollar about the domain

**Dashboard → Build → Domains** → add `https://<your-app>.vercel.app`.

Without it the SDK is refused by CORS and nobody can log in. Vercel also
issues a URL per deployment; the stable production domain is the one to add.

## 6. Fill in the metadata

- `pollar.manifest.json` → `"url": "https://<your-app>.vercel.app"`
- root `apps.json` → the `qr-menu-orders` entry's `"deploy"`

## Checking it actually works

In order, because each one depends on the last:

1. The landing page loads → build and key are fine
2. `/admin` lets you log in → the domain is registered with Pollar
3. Creating a restaurant returns an admin key → the database is reachable and
   migrated
4. A table's QR scans on a real phone and opens the menu → the origin is right
5. A diner pays and the board shows the order → the whole loop

## When something breaks

| Symptom | Cause |
|---|---|
| Build fails on the landing page | `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` missing at build time |
| `DATABASE_URL is not set, so the app fell back to a local SQLite file…` | Exactly what it says: set the two Turso variables. This message exists because the driver's own error is an opaque code |
| Login does nothing, CORS errors in the console | The deploy's domain isn't in Build → Domains |
| Tables exist locally but the deploy 500s on any query | Step 2 was skipped — the remote database has no schema |
| A diner gets "not enough XLM to cover the network fee" | **Starting XLM balance** is 0 in Treasury → Account Funding. Set it to 1 or 2 |
| The QR opens `localhost` | It was printed from the local dev server. Print from the deploy |

## Local, for contrast

```bash
pnpm install
cp .env.example .env    # paste the Pollar key
pnpm dev
```

No database step: unset `DATABASE_URL` means a SQLite file under `./data/`,
created and migrated on the first request.
