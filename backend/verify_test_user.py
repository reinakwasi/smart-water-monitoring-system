import asyncio
from app.db.mongodb import mongodb
from datetime import datetime

async def verify_user():
    await mongodb.connect()
    db = mongodb.get_database()
    result = await db.users.update_one(
        {'email': 'test@example.com'},
        {'$set': {
            'is_verified': True,
            'is_active': True,
            'updated_at': datetime.utcnow()
        }}
    )
    print(f"User verified: {result.modified_count} document(s) updated")
    await mongodb.disconnect()

if __name__ == "__main__":
    asyncio.run(verify_user())
