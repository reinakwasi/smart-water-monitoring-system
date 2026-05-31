import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def delete_unverified():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('MONGODB_DB_NAME')]
    
    # Delete all unverified accounts
    result = await db.users.delete_many({'is_verified': False})
    print(f'✅ Deleted {result.deleted_count} unverified accounts')
    
    # Also delete accounts without is_verified field (old accounts)
    result2 = await db.users.delete_many({'is_verified': {'$exists': False}})
    print(f'✅ Deleted {result2.deleted_count} old accounts without verification field')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(delete_unverified())
