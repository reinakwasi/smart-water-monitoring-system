import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_users():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('MONGODB_DB_NAME')]
    
    # Get all users
    users = await db.users.find().to_list(length=100)
    
    print(f"\n📊 Total users in database: {len(users)}\n")
    
    for user in users:
        print(f"Email: {user.get('email')}")
        print(f"  Full Name: {user.get('full_name')}")
        print(f"  Is Verified: {user.get('is_verified', 'N/A')}")
        print(f"  Is Active: {user.get('is_active', 'N/A')}")
        print(f"  Created: {user.get('created_at')}")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())
