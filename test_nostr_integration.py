#!/usr/bin/env python3
"""
Test script to verify Nostr keypair integration with LNBits User model
"""

import sys
import os

# Add the lnbits directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lnbits'))

def test_nostr_keypair_generation():
    """Test that we can generate Nostr keypairs"""
    try:
        from lnbits.utils.nostr import generate_keypair
        private_key, public_key = generate_keypair()
        print(f"✓ Nostr keypair generation works")
        print(f"  Private key: {private_key[:16]}...")
        print(f"  Public key: {public_key}")
        return True
    except Exception as e:
        print(f"✗ Nostr keypair generation failed: {e}")
        return False

def test_account_model():
    """Test that the Account model includes nostr_private_key field"""
    try:
        from lnbits.core.models.users import Account
        account = Account(
            id="test123",
            username="testuser",
            nostr_private_key="test_private_key"
        )
        print(f"✓ Account model includes nostr_private_key field")
        print(f"  nostr_private_key: {account.nostr_private_key}")
        return True
    except Exception as e:
        print(f"✗ Account model test failed: {e}")
        return False

def test_user_model():
    """Test that the User model includes nostr_public_key field"""
    try:
        from lnbits.core.models.users import User
        user = User(
            id="test123",
            created_at=None,
            updated_at=None,
            nostr_public_key="test_public_key"
        )
        print(f"✓ User model includes nostr_public_key field")
        print(f"  nostr_public_key: {user.nostr_public_key}")
        return True
    except Exception as e:
        print(f"✗ User model test failed: {e}")
        return False

def test_migration():
    """Test that the migration function exists"""
    try:
        from lnbits.core.migrations import m034_add_nostr_private_key_to_accounts
        print(f"✓ Migration function exists")
        return True
    except Exception as e:
        print(f"✗ Migration test failed: {e}")
        return False

def main():
    print("Testing Nostr integration with LNBits...")
    print("=" * 50)
    
    tests = [
        test_nostr_keypair_generation,
        test_account_model,
        test_user_model,
        test_migration,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed! Nostr integration is ready.")
    else:
        print("✗ Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    main() 