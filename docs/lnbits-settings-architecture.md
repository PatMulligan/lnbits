# LNbits Settings Architecture

## Overview

LNbits implements a two-tier settings system that combines environment variables with database-stored configuration. This design allows for both static infrastructure configuration and dynamic runtime settings that can be modified through an admin UI.

---

## Table of Contents

1. [Settings Hierarchy](#settings-hierarchy)
2. [The LNBITS_ADMIN_UI Flag](#the-lnbits_admin_ui-flag)
3. [ReadOnlySettings (Always from .env)](#readonlysettings-always-from-env)
4. [EditableSettings (Database-Stored)](#editablesettings-database-stored)
5. [TransientSettings (Runtime Only)](#transientsettings-runtime-only)
6. [Application Startup Lifecycle](#application-startup-lifecycle)
7. [Database Schema](#database-schema)
8. [Runtime Settings Updates](#runtime-settings-updates)
9. [Edge Cases and Gotchas](#edge-cases-and-gotchas)
10. [Key Source Files](#key-source-files)

---

## Settings Hierarchy

LNbits settings are organized into a class hierarchy using Pydantic v1's `BaseSettings`:

```
Settings (main class)
├── EditableSettings      → Can be stored in database
├── ReadOnlySettings      → Always from environment variables
├── TransientSettings     → Runtime state, never persisted
└── BaseSettings          → Pydantic base (reads .env + env vars)
```

The `Settings` class in `lnbits/settings.py` inherits from all three, with Pydantic automatically loading values from:
1. The `.env` file in the project root
2. System environment variables
3. Default values defined in `Field(default=...)`

---

## The LNBITS_ADMIN_UI Flag

The `LNBITS_ADMIN_UI` environment variable (default: `True`) is the master switch that controls whether database-stored settings are used.

| `LNBITS_ADMIN_UI=True` (Default) | `LNBITS_ADMIN_UI=False` |
|----------------------------------|-------------------------|
| Admin UI endpoints enabled | Admin routes not registered |
| EditableSettings loaded from database | All settings from .env only |
| Settings modifiable via API at runtime | No runtime changes possible |
| Database seeded with .env values on first run | Database ignored entirely |
| Detailed env logging disabled | All env vars logged for debugging |

### When Admin UI is Enabled

On startup, the `check_admin_settings()` function in `lnbits/core/services/users.py`:

1. Checks if the `system_settings` database table has data
2. If empty (first run): seeds it with current environment variable values
3. Loads settings from database into memory, overriding .env values
4. Only `EditableSettings` fields are overwritten; `ReadOnlySettings` are preserved

### When Admin UI is Disabled

The database loading block is completely skipped. Settings remain exactly as loaded from `.env` and environment variables.

---

## ReadOnlySettings (Always from .env)

These settings **always** come from environment variables, regardless of the `LNBITS_ADMIN_UI` flag. They cannot be modified through the admin interface.

### EnvSettings

| Setting | Default | Description |
|---------|---------|-------------|
| `debug` | `False` | Enable debug mode |
| `debug_database` | `False` | Enable database query logging |
| `bundle_assets` | `True` | Use bundled frontend assets |
| `host` | `127.0.0.1` | Server bind address |
| `port` | `5000` | Server port |
| `forwarded_allow_ips` | `*` | Trusted proxy IPs |
| `lnbits_title` | `LNbits API` | API title |
| `lnbits_path` | `.` | LNbits installation path |
| `lnbits_extensions_path` | `lnbits` | Extensions directory |
| `super_user` | `""` | Super user ID (can override DB) |
| `auth_secret_key` | `""` | JWT signing key |
| `version` | `0.0.0` | LNbits version |
| `user_agent` | `""` | HTTP user agent |
| `enable_log_to_file` | `True` | Write logs to file |
| `log_rotation` | `100 MB` | Log rotation size |
| `log_retention` | `3 months` | Log retention period |
| `cleanup_wallets_days` | `90` | Days before wallet cleanup |
| `funding_source_max_retries` | `4` | Max funding source retries |

### PersistenceSettings

| Setting | Default | Description |
|---------|---------|-------------|
| `lnbits_data_folder` | `./data` | Data storage directory |
| `lnbits_database_url` | `None` | PostgreSQL/CockroachDB URL |

### ExtensionsInstallSettings

| Setting | Default | Description |
|---------|---------|-------------|
| `lnbits_extensions_default_install` | `[]` | Extensions to auto-install |
| `lnbits_ext_github_token` | `""` | GitHub token for rate limits |

### SuperUserSettings

| Setting | Default | Description |
|---------|---------|-------------|
| `lnbits_allowed_funding_sources` | `[list of wallets]` | Allowed funding source classes |

### The Admin UI Flag Itself

| Setting | Default | Description |
|---------|---------|-------------|
| `lnbits_admin_ui` | `True` | Enable admin UI and database settings |

---

## EditableSettings (Database-Stored)

When `LNBITS_ADMIN_UI=True`, these settings are stored in the database and can be modified through the admin API. On startup, database values override any `.env` values for these fields.

### Categories of Editable Settings

**User Management**
- `lnbits_admin_users` - List of admin user IDs
- `lnbits_allowed_users` - Allowlist of user IDs
- `lnbits_allow_new_accounts` - Allow new account registration

**Extension Configuration**
- `lnbits_admin_extensions` - Admin-only extensions
- `lnbits_user_default_extensions` - Default extensions for new users
- `lnbits_extensions_deactivate_all` - Disable all extensions
- `lnbits_extensions_manifests` - Extension manifest URLs

**Theme and Branding**
- `lnbits_site_title` - Site title
- `lnbits_site_tagline` - Site tagline
- `lnbits_site_description` - Site description
- `lnbits_default_wallet_name` - Default wallet name
- `lnbits_custom_logo` - Custom logo URL
- `lnbits_ad_space` - Advertisement configuration

**Operations**
- `lnbits_baseurl` - Base URL for callbacks
- `lnbits_hide_api` - Hide API documentation

**Fee Settings**
- `lnbits_reserve_fee_min` - Minimum reserve fee
- `lnbits_reserve_fee_percent` - Reserve fee percentage
- `lnbits_service_fee` - Service fee percentage
- `lnbits_service_fee_ignore_internal` - Ignore internal transactions
- `lnbits_service_fee_max` - Maximum service fee
- `lnbits_service_fee_wallet` - Wallet for fee collection

**Security Settings**
- `lnbits_rate_limit_no` - Rate limit count
- `lnbits_rate_limit_unit` - Rate limit time unit
- `lnbits_wallet_limit_*` - Wallet balance limits
- `lnbits_*_ips` - IP allowlists/blocklists
- `auth_*` - Authentication settings

**Funding Source Credentials**
- All wallet-specific settings (LND, CLN, Eclair, Phoenix, etc.)
- Connection URLs, macaroons, certificates, API keys

**Notifications**
- Nostr, Telegram, email notification settings
- Push notification (VAPID) keys

---

## TransientSettings (Runtime Only)

These settings exist only in memory during server runtime and are never persisted to database or read from environment variables.

| Setting | Description |
|---------|-------------|
| `first_install` | True if this is first server start |
| `lnbits_running` | Server is running |
| `server_startup_time` | Timestamp of server start |
| `lnbits_all_extensions_ids` | All available extension IDs |
| `latest_balance_delta_sats` | Recent balance change |
| `lnbits_deactivated_extensions` | Currently deactivated extensions |
| `lnbits_installed_extensions_ids` | Installed extension IDs |

---

## Application Startup Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. MODULE IMPORT (lnbits/settings.py)                           │
│    └─> settings = Settings()                                    │
│        └─> Pydantic reads .env file + environment variables     │
│            └─> All defaults applied                             │
│                └─> Global settings object now available         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FASTAPI APP CREATION (lnbits/app.py: create_app)             │
│    └─> Middlewares registered                                   │
│    └─> Static files mounted                                     │
│    └─> Routes NOT yet loaded                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. LIFESPAN STARTUP (lnbits/app.py: startup)                    │
│    └─> migrate_databases()                                      │
│        └─> Creates/updates system_settings table                │
│        └─> Runs all pending migrations                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SETTINGS TRANSITION (lnbits/core/services/users.py)          │
│    └─> check_admin_settings()                                   │
│        ┌─────────────────────────────────────────────────────┐  │
│        │ IF lnbits_admin_ui == True:                         │  │
│        │   └─> Load settings from database                   │  │
│        │       └─> If DB empty: seed with env var values     │  │
│        │   └─> update_cached_settings() - override memory    │  │
│        │   └─> Save superuser to .super_user file            │  │
│        │                                                     │  │
│        │ ELSE (lnbits_admin_ui == False):                    │  │
│        │   └─> Skip database entirely                        │  │
│        │   └─> Keep settings from .env only                  │  │
│        └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. EXTENSIONS AND FUNDING SOURCE                                │
│    └─> check_webpush_settings() - generate VAPID keys           │
│    └─> check_and_register_extensions(app)                       │
│    └─> set_funding_source() - initialize wallet backend         │
│    └─> init_core_routers(app) - register API routes             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. SERVER RUNNING                                               │
│    └─> Admin API available (if admin_ui enabled):               │
│        ├─> GET  /admin/api/v1/settings                          │
│        ├─> PUT  /admin/api/v1/settings                          │
│        ├─> PATCH /admin/api/v1/settings                         │
│        └─> DELETE /admin/api/v1/settings                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

Settings are stored in the `system_settings` table:

```sql
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,       -- Setting field name
    value TEXT,                -- JSON-encoded value
    tag TEXT NOT NULL DEFAULT 'core',
    UNIQUE (id, tag)
);
```

**Example rows:**
```
id                          | value                    | tag
----------------------------|--------------------------|------
lnbits_site_title           | "My LNbits Instance"     | core
lnbits_allow_new_accounts   | true                     | core
lnbits_rate_limit_no        | 200                      | core
super_user                  | "abc123def456..."        | core
```

---

## Runtime Settings Updates

When settings are modified via the admin API:

```
┌──────────────────┐
│  API Request     │  PUT /admin/api/v1/settings
│  (JSON payload)  │  { "lnbits_site_title": "New Title" }
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Validation      │  UpdateSettings model validates input
│                  │  (Extra.forbid prevents unknown fields)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Database Write  │  update_admin_settings()
│                  │  → set_settings_field() for each field
│                  │  → INSERT ... ON CONFLICT UPDATE
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Memory Update   │  update_cached_settings()
│                  │  → setattr(settings, key, value)
│                  │  → ReadOnlySettings are SKIPPED
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Side Effects    │  e.g., register_new_ratelimiter()
│                  │  to apply new rate limit values
└──────────────────┘
```

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `update_admin_settings()` | `core/crud/settings.py:43` | Write to database |
| `set_settings_field()` | `core/crud/settings.py:111` | Single field write |
| `get_settings_by_tag()` | `core/crud/settings.py:123` | Read all settings |
| `update_cached_settings()` | `core/services/settings.py:46` | Sync to memory |

---

## Behavior and Design Decisions

### Database Settings Persistence

**Important**: Once database settings exist, they are **always used** regardless of the `LNBITS_ADMIN_UI` flag. The `admin_ui` flag only controls:

1. Whether admin API endpoints (`/admin/api/v1/*`) are available
2. Whether admin UI pages (`/admin`, `/users`, `/audit`, `/node`) are accessible
3. Whether to seed the database on first run

This design ensures that:
- Disabling the admin UI doesn't cause silent data loss
- Configuration is predictable and consistent
- Operators can disable the admin UI for security without losing their settings

### What `LNBITS_ADMIN_UI` Controls

| Scenario | DB Has Settings | Behavior |
|----------|-----------------|----------|
| `admin_ui=True` | Yes | Load from DB, admin endpoints available |
| `admin_ui=True` | No | Seed DB from .env, admin endpoints available |
| `admin_ui=False` | Yes | Load from DB, admin endpoints **disabled** |
| `admin_ui=False` | No | Use .env only, admin endpoints disabled |

### Super User Override

The `super_user` setting in `.env` **always overrides** the database value:

```python
if settings.super_user and settings.super_user != settings_db.super_user:
    settings_db = await update_super_user(settings.super_user)
```

### First Install Detection

LNbits detects first install by checking if the superuser account has `provider="env"`:

```python
account = await get_account(settings.super_user)
if account and account.extra and account.extra.provider == "env":
    settings.first_install = True
```

---

## CLI Commands for Settings Management

LNbits provides CLI commands to manage settings:

### Show Settings Status

```bash
lnbits-cli settings show
```

Displays the current settings source (database or .env) and key configuration values.

### Reset Settings

```bash
# Reset and re-seed from current .env values (default)
lnbits-cli settings reset

# Reset without re-seeding (revert to .env-only mode)
lnbits-cli settings reset --no-reseed

# Skip confirmation prompt
lnbits-cli settings reset -y
```

Use this when you want to:
- Discard all changes made via the Admin UI
- Force a fresh start with current .env values
- Revert to environment-variable-only configuration

### Export Settings

```bash
# Export to stdout in .env format
lnbits-cli settings export

# Export to file
lnbits-cli settings export -o backup.env

# Export as JSON
lnbits-cli settings export --format json -o settings.json
```

This exports all editable settings from the database. ReadOnly settings are not included as they can only be set via environment variables.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `lnbits/settings.py` | Settings class definitions, validation, defaults |
| `lnbits/app.py` | Application factory, startup lifecycle |
| `lnbits/core/services/users.py` | `check_admin_settings()`, `init_admin_settings()` |
| `lnbits/core/services/settings.py` | `update_cached_settings()` |
| `lnbits/core/crud/settings.py` | Database CRUD operations |
| `lnbits/core/views/admin_api.py` | Admin API endpoints |
| `lnbits/core/migrations.py` | Database schema migrations |

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         LNbits Settings                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │   .env File     │         │    Database     │               │
│  │  + Env Vars     │         │ system_settings │               │
│  └────────┬────────┘         └────────┬────────┘               │
│           │                           │                         │
│           ▼                           ▼                         │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │ ReadOnlySettings│         │EditableSettings │               │
│  │                 │         │                 │               │
│  │ • host, port    │         │ • site_title    │               │
│  │ • database_url  │         │ • admin_users   │               │
│  │ • data_folder   │         │ • fee_settings  │               │
│  │ • debug         │         │ • rate_limits   │               │
│  │ • super_user    │         │ • wallet_creds  │               │
│  │ • admin_ui      │         │ • notifications │               │
│  └────────┬────────┘         └────────┬────────┘               │
│           │                           │                         │
│           │    ┌──────────────────────┘                        │
│           │    │  (only if LNBITS_ADMIN_UI=True)               │
│           │    │                                                │
│           ▼    ▼                                                │
│  ┌─────────────────────────────────────────┐                   │
│  │         In-Memory Settings Object       │                   │
│  │              (global `settings`)        │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document generated from LNbits source code analysis*
*LNbits version: 1.4.0*
