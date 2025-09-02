# LNBits Auto-Credit Changes

## Overview
Modified LNBits server to automatically credit new accounts with 1 million satoshis (1,000,000 sats) when they are created.

## Changes Made

### 1. Modified `lnbits/core/services/users.py`

**Added imports:**
- `get_wallet` from `..crud`
- `update_wallet_balance` from `.payments`

**Modified `create_user_account_no_ckeck` function:**
- Changed `create_wallet` call to capture the returned wallet object
- Added automatic credit of 1,000,000 sats after wallet creation
- Added error handling and logging for the credit operation

**Code changes:**
```python
# Before:
await create_wallet(
    user_id=account.id,
    wallet_name=wallet_name or settings.lnbits_default_wallet_name,
)

# After:
wallet = await create_wallet(
    user_id=account.id,
    wallet_name=wallet_name or settings.lnbits_default_wallet_name,
)

# Credit new account with 1 million satoshis
try:
    await update_wallet_balance(wallet, 1_000_000)
    logger.info(f"Credited new account {account.id} with 1,000,000 sats")
except Exception as e:
    logger.error(f"Failed to credit new account {account.id} with 1,000,000 sats: {e}")
```

### 2. Updated Tests in `tests/api/test_auth.py`

**Modified test functions:**
- `test_register_ok`: Added balance verification for regular user registration
- `test_register_nostr_ok`: Added balance verification for Nostr authentication

**Added assertions:**
```python
# Check that the wallet has 1 million satoshis
wallet = user.wallets[0]
assert wallet.balance == 1_000_000, f"Expected 1,000,000 sats balance, got {wallet.balance} sats"
```

## Affected Account Creation Paths

The automatic credit will be applied to all new accounts created through:

1. **Regular user registration** (`/api/v1/auth/register`)
2. **Nostr authentication** (`/api/v1/auth/nostr`)
3. **SSO login** (when new account is created)
4. **API account creation** (`/api/v1/account`)
5. **Admin user creation** (via admin interface)

## Excluded Paths

- **Superuser/Admin account creation** (`init_admin_settings`): This function creates the admin account directly and bypasses the user creation flow, so it won't receive the automatic credit.

## Testing

To test the changes:

1. Install dependencies: `poetry install`
2. Run the modified tests: `poetry run pytest tests/api/test_auth.py::test_register_ok -v`
3. Run Nostr test: `poetry run pytest tests/api/test_auth.py::test_register_nostr_ok -v`

## Logging

The system will log:
- Success: `"Credited new account {account.id} with 1,000,000 sats"`
- Failure: `"Failed to credit new account {account.id} with 1,000,000 sats: {error}"`

## Notes

- The credit uses the existing `update_wallet_balance` function which creates an internal payment record
- The credit is applied after wallet creation but before user extensions are set up
- Error handling ensures that account creation continues even if the credit fails
- The credit amount is hardcoded to 1,000,000 sats (1MM sats)

