"""
Fix user account verification status in MongoDB
This script will check and update the user account to be verified and active
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_user_account():
    # MongoDB connection string - load from environment variables
    mongo_uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DB_NAME", "water_quality_db")
    
    if not mongo_uri:
        print("❌ ERROR: MONGODB_URI environment variable not set")
        print("Please set MONGODB_URI in your .env file")
        return
    
    print(f"\n🔗 Connecting to MongoDB...")
    print(f"URI: {mongo_uri[:50]}...")
    print(f"Database: {database_name}\n")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_uri)
    db = client[database_name]
    
    # Email to fix
    email = "reinapp734@gmail.com"
    
    print(f"🔍 Checking account: {email}\n")
    
    # Find the user
    user = await db.users.find_one({"email": email})
    
    if not user:
        print(f"❌ ERROR: User not found with email {email}")
        print("📝 Available users in database:")
        async for u in db.users.find({}, {"email": 1, "full_name": 1}):
            print(f"   - {u['email']} ({u.get('full_name', 'No name')})")
        return
    
    print(f"✅ User found!")
    print(f"   Name: {user.get('full_name', 'N/A')}")
    print(f"   Email: {user['email']}")
    print(f"   Role: {user.get('role', 'N/A')}")
    print(f"   Created: {user.get('created_at', 'N/A')}")
    print(f"   Last login: {user.get('last_login', 'Never')}\n")
    
    print(f"📊 Current status:")
    print(f"   is_verified: {user.get('is_verified', False)}")
    print(f"   is_active: {user.get('is_active', False)}\n")
    
    # Check if already verified and active
    if user.get('is_verified', False) and user.get('is_active', False):
        print(f"✅ Account is already verified and active!")
        print(f"   No changes needed.\n")
        return
    
    # Update the user
    print(f"🔧 Updating account to be verified and active...")
    
    result = await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "is_verified": True,
                "is_active": True,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ SUCCESS! Account updated.\n")
        
        # Verify the update
        updated_user = await db.users.find_one({"email": email})
        print(f"📊 New status:")
        print(f"   is_verified: {updated_user.get('is_verified', False)}")
        print(f"   is_active: {updated_user.get('is_active', False)}")
        print(f"   updated_at: {updated_user.get('updated_at', 'N/A')}\n")
        
        print(f"🎉 You can now login with:")
        print(f"   Email: {email}")
        print(f"   Password: [your password]\n")
    else:
        print(f"⚠️  WARNING: No changes were made (account may already be updated)\n")
    
    # Close connection
    client.close()
    print(f"✅ Done!\n")

if __name__ == "__main__":
    asyncio.run(fix_user_account())
