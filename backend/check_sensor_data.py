"""
Script to check if there's sensor data in the MongoDB database
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def check_database():
    # Connect to MongoDB
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.water_quality_db
    
    print("=" * 60)
    print("CHECKING MONGODB DATABASE FOR SENSOR DATA")
    print("=" * 60)
    print()
    
    # Check sensor readings
    print("📊 SENSOR READINGS:")
    print("-" * 60)
    sensor_count = await db.sensor_readings.count_documents({})
    print(f"Total sensor readings: {sensor_count}")
    
    if sensor_count > 0:
        # Get latest sensor reading
        latest_sensor = await db.sensor_readings.find_one(
            {},
            sort=[("timestamp", -1)]
        )
        
        print(f"\n✅ Latest sensor reading found:")
        print(f"   Device ID: {latest_sensor.get('device_id')}")
        print(f"   Timestamp: {latest_sensor.get('timestamp')}")
        print(f"   Classification: {latest_sensor.get('classification')}")
        print(f"   Confidence: {latest_sensor.get('classification_confidence', 0) * 100:.1f}%")
        print(f"   pH: {latest_sensor.get('ph')}")
        print(f"   Turbidity: {latest_sensor.get('turbidity')}")
        print(f"   Temperature: {latest_sensor.get('temperature')}")
        print(f"   TDS: {latest_sensor.get('tds')}")
        print(f"   Dissolved Oxygen: {latest_sensor.get('dissolved_oxygen')}")
        print(f"   Risk Score: {latest_sensor.get('risk_score', 0):.2f}")
        print(f"   Risk Level: {latest_sensor.get('risk_level')}")
    else:
        print("\n❌ No sensor readings found in database!")
        print("   The ESP32 needs to send data to the backend first.")
        print("   Use the /api/v1/sensor/sensor-data endpoint to send data.")
    
    print()
    print("=" * 60)
    
    # Check tank readings
    print("🚰 TANK READINGS:")
    print("-" * 60)
    tank_count = await db.tank_readings.count_documents({})
    print(f"Total tank readings: {tank_count}")
    
    if tank_count > 0:
        # Get latest tank reading
        latest_tank = await db.tank_readings.find_one(
            {},
            sort=[("timestamp", -1)]
        )
        
        print(f"\n✅ Latest tank reading found:")
        print(f"   Device ID: {latest_tank.get('device_id')}")
        print(f"   Timestamp: {latest_tank.get('timestamp')}")
        print(f"   Tank Status: {latest_tank.get('tank_status')}")
        print(f"   Level: {latest_tank.get('level_percent'):.1f}%")
        print(f"   Volume: {latest_tank.get('volume_liters'):.1f}L")
        print(f"   Distance: {latest_tank.get('distance_cm')}cm")
        print(f"   Tank Height: {latest_tank.get('tank_height_cm')}cm")
    else:
        print("\n❌ No tank readings found in database!")
        print("   The ESP32 needs to send data to the backend first.")
        print("   Use the /api/v1/sensor/tank-level endpoint to send data.")
    
    print()
    print("=" * 60)
    print()
    
    # Check users
    print("👤 USERS:")
    print("-" * 60)
    user_count = await db.users.count_documents({})
    print(f"Total users: {user_count}")
    
    if user_count > 0:
        verified_count = await db.users.count_documents({"is_verified": True})
        print(f"Verified users: {verified_count}")
        
        # Show first user
        first_user = await db.users.find_one({})
        print(f"\nFirst user:")
        print(f"   Email: {first_user.get('email')}")
        print(f"   Full Name: {first_user.get('full_name')}")
        print(f"   Verified: {first_user.get('is_verified')}")
        print(f"   Active: {first_user.get('is_active')}")
    else:
        print("\n❌ No users found in database!")
    
    print()
    print("=" * 60)
    print()
    
    # Summary
    if sensor_count > 0 and tank_count > 0:
        print("✅ DATABASE STATUS: READY")
        print("   The frontend should be able to fetch and display data.")
    elif sensor_count == 0 and tank_count == 0:
        print("❌ DATABASE STATUS: NO DATA")
        print("   You need to send sensor data from ESP32 first.")
        print()
        print("   To test with sample data, you can use:")
        print("   POST http://localhost:8000/api/v1/sensor/sensor-data")
        print("   POST http://localhost:8000/api/v1/sensor/tank-level")
    else:
        print("⚠️  DATABASE STATUS: PARTIAL DATA")
        print(f"   Sensor readings: {sensor_count}")
        print(f"   Tank readings: {tank_count}")
    
    print()
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_database())
