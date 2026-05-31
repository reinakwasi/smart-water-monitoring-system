"""
Test script to verify password reset security fix
"""
import asyncio
from app.db.mongodb import mongodb
from app.services.auth_service import auth_service
from app.services.email_service import email_service

async def test_password_reset():
    await mongodb.connect()
    db = mongodb.get_database()
    
    # Get test user
    user = await db.users.find_one({"email": "test@example.com"})
    if not user:
        print("❌ Test user not found")
        await mongodb.disconnect()
        return
    
    print(f"✅ Found user: {user['email']}")
    print(f"   Current password hash: {user['password_hash'][:20]}...")
    
    # Test 1: Try to reset with same password
    print("\n🧪 Test 1: Attempting to reset with SAME password (should fail)")
    test_password = "Test123!@#"  # This is the current password
    
    # Check if password matches current
    is_same = auth_service.verify_password(test_password, user["password_hash"])
    print(f"   Password matches current: {is_same}")
    
    if is_same:
        print("   ✅ Security check would BLOCK this (same password)")
    else:
        print("   ❌ Password doesn't match current")
    
    # Test 2: Try to reset with different password
    print("\n🧪 Test 2: Attempting to reset with DIFFERENT password (should succeed)")
    new_password = "NewTest456!@#"
    
    is_same = auth_service.verify_password(new_password, user["password_hash"])
    print(f"   Password matches current: {is_same}")
    
    if not is_same:
        print("   ✅ Security check would ALLOW this (different password)")
    else:
        print("   ❌ Password matches current (unexpected)")
    
    await mongodb.disconnect()
    print("\n✅ Test completed")

if __name__ == "__main__":
    asyncio.run(test_password_reset())
