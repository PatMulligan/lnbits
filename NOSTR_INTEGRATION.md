# Nostr Integration for LNBits Users

This document describes the changes made to integrate Nostr keypairs with LNBits user accounts.

## Overview

The integration adds Nostr keypair generation to user accounts, allowing each user to have a unique Nostr identity. The private key is stored securely in the database, while the public key is derived and made available through the API.

## Changes Made

### 1. Database Migration

**File**: `lnbits/core/migrations.py`
- Added `m034_add_nostr_private_key_to_accounts()` migration
- Adds `prvkey` column to the `accounts` table for Nostr private keys

### 2. Model Updates

**File**: `lnbits/core/models/users.py`
- Added `prvkey` field to `Account` model for Nostr private key
- The existing `pubkey` field is now used to store the Nostr public key

### 3. CRUD Operations

**File**: `lnbits/core/crud/users.py`
- Updated `get_user_from_account()` to use the existing pubkey field (now contains Nostr public key)
- Updated `get_accounts()` SQL query to include `prvkey` field

### 4. API Endpoints

**File**: `lnbits/core/views/user_api.py`
- Modified user creation to automatically generate Nostr keypair and set the pubkey field
- Added new endpoint `/users/api/v1/nostr/pubkeys` to get all user public keys
- Endpoint requires admin privileges and returns:
  ```json
  [
    {
      "user_id": "user_id",
      "username": "username", 
      "nostr_public_key": "public_key_hex"
    }
  ]
  ```

### 5. Command Line Interface

**File**: `lnbits/commands.py`
- Updated `create_user` command to generate Nostr keypair
- Displays the generated public key when creating users via CLI

## API Usage

### Creating a User (Automatically generates Nostr keypair)

```bash
POST /users/api/v1/user
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "password_repeat": "password123"
}
```

### Getting All User Public Keys

```bash
GET /users/api/v1/nostr/pubkeys
Authorization: Bearer <admin_token>

Response:
[
  {
    "user_id": "abc123",
    "username": "user1",
    "pubkey": "02a1b2c3d4e5f6..."
  },
  {
    "user_id": "def456", 
    "username": "user2",
    "pubkey": "03b2c3d4e5f6a1..."
  }
]
```

### Getting Individual User (includes Nostr public key)

```bash
GET /users/api/v1/user/{user_id}

Response:
{
  "id": "abc123",
  "username": "user1",
  "email": "user1@example.com",
  "pubkey": "02a1b2c3d4e5f6...",  # This is the Nostr public key
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  ...
}
```

## Security Considerations

1. **Private Key Storage**: Nostr private keys are stored in the `prvkey` field but are never exposed through the API
2. **Public Key Storage**: Nostr public keys are stored directly in the `pubkey` field for efficiency
3. **Admin Access**: The public key listing endpoint requires admin privileges
4. **Consistent Naming**: `pubkey` and `prvkey` provide clear, consistent field names

## Migration

To apply the database changes:

1. Run the migration: `python -m lnbits db migrate`
2. The migration will add the `prvkey` column to existing accounts for Nostr private keys
3. New users will automatically get Nostr keypairs generated

## Testing

Use the provided test script to verify the integration:

```bash
python test_nostr_integration.py
```

## Dependencies

The integration uses the existing `lnbits.utils.nostr` module which provides:
- `generate_keypair()`: Generates new Nostr keypairs
- `PrivateKey` class: For key manipulation and public key derivation

## Future Enhancements

Potential improvements could include:
1. NIP-19 encoding support (npub/nsec format)
2. Nostr event signing capabilities
3. Integration with Nostr relays for user discovery
4. User profile metadata storage 