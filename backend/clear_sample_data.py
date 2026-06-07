"""
Script to clear sample sensor and tank data from MongoDB
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def clear_sample_data():
    # Connect to MongoDB
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.water_quality_db
    
    print("=" * 60)
    print("CLEARING SAMPLE DATA FROM MONGODB")
    print("=" * 60)
    print()
    
    # Check current counts
    sensor_count = await db.sensor_readings.count_documents({})
    tank_count = await db.tank_readings.count_documents({})
    
    print(f"📊 Current data:")
    print(f"   Sensor readings: {sensor_count}")
    print(f"   Tank readings: {tank_count}")
    print()
    
    if sensor_count == 0 and tank_count == 0:
        print("✅ Database is already empty!")
        client.close()
        return
    
    # Ask for confirmation
    response = input("⚠️  Do you want to DELETE ALL sensor and tank data? (yes/no): ")
    
    if response.lower() != 'yes':
        print("❌ Cancelled. No data was deleted.")
        client.close()
        return
    
    # Delete all sensor readings
    print()
    print("🗑️  Deleting sensor readings...")
    result = await db.sensor_readings.delete_many({})
    print(f"✅ Deleted {result.deleted_count} sensor readings")
    
    # Delete all tank readings
    print("🗑️  Deleting tank readings...")
    result = await db.tank_readings.delete_many({})
    print(f"✅ Deleted {result.deleted_count} tank readings")
    
    print()
    print("=" * 60)
    print("✅ ALL SAMPLE DATA CLEARED!")
    print()
    print("The app will now show:")
    print("- 'No sensor data available' error")
    print("- Or 404 errors when fetching current status")
    print()
    print("To add sample data back, run: python insert_sample_data.py")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_sample_data())
