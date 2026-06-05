Web app for dockhost hosting — competitive Rubik's cube solving.

# Features

- JWT in cookies authentication middleware
- bcrypt password hashing
- 3D Rubik's cube (Three.js) with animated face turns
- Keyboard shortcuts for basic moves and algorithm macros
- YAML-defined scrambles and macro algorithms
- Server-side solved-state validation (54 facelets)

# Env vars

- JWT_SECRET — 32-character base64 key for HS256 JWT symmetric signing
- POSTGRES_DB — postgres database name
- POSTGRES_HOST — name of postgres container in the same Dockhost project

```
+====rubik-app====+  +====postgres=====+
|POSTGRES_USER    |<-|POSTGRES_USER    |
|POSTGRES_PASSWORD|<-|POSTGRES_PASSWORD|
|POSTGRES_DB      |<-|POSTGRES_DB      |
|POSTGRES_HOST    |  +=================+
|JWT_SECRET       |
+=================+
```

# Setup

## Postgres app setup

1. Enter `psql -U $POSTGRES_USER -d $POSTGRES_DB` in postgres terminal
2. Create the users table:
```sql
CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    username VARCHAR(15),
    password VARCHAR(60),
    solved INT DEFAULT 0,
    easy INT DEFAULT 0,
    medium INT DEFAULT 0,
    hard INT DEFAULT 0
);
```

## App setup

1. Set deploy from git repo with build context **`rubik-app/`** and Dockerfile path **`rubik-app/Dockerfile`**
2. Specify app container env vars (`JWT_SECRET`, `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) and port **8000**

## Domain setup

1. Create a domain object on external or dynamic dockhost-provided domain
2. Create route from domain to app container on it's port

# Rubik's cube

`rubik-app/rubik.yaml` has two sections:

- **macros** — algorithm shortcuts bound to number keys `1`–`6`
- **scrambles** — WCA-style notation strings with difficulty (`easy`, `medium`, `hard`)

## Controls (on /rubik)

| Input | Action |
|-------|--------|
| `R` `L` `U` `D` `F` `B` | clockwise face turn |
| Shift + face key | counter-clockwise (prime) |
| Ctrl + face key | half turn (180°) |
| `1`–`6` | run algorithm macro |
| drag canvas | orbit camera |
