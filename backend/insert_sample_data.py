"""
Script to insert sample sensor and tank data into MongoDB for testing
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def insert_sample_data():
    # Connect to MongoDB
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.water_quality_db
    
    print("=" * 60)
    print("INSERTING SAMPLE DATA INTO MONGODB")
    print("=" * 60)
    print()
    
    # Sample sensor reading
    sensor_data = {
        "device_id": "ESP32_001",
        "timestamp": datetime.utcnow(),
        "ph": 7.2,
        "turbidity": 3.1,
        "temperature": 24.0,
        "tds": 312.0,
        "dissolved_oxygen": 8.5,
        "classification": "Safe",
        "classification_confidence": 0.94,
        "risk_score": 0.15,
        "risk_level": "Low",
        "classification_shap_values": {
            "ph": 0.05,
            "turbidity": -0.02,
            "temperature": 0.01,
            "tds": -0.03,
            "dissolved_oxygen": 0.04
        },
        "risk_shap_values": {
            "ph": -0.01,
            "turbidity": 0.02,
            "temperature": 0.01,
            "tds": 0.01,
            "dissolved_oxygen": -0.02
        },
        "created_at": datetime.utcnow()
    }
    
    print("📊 Inserting sensor reading...")
    result = await db.sensor_readings.insert_one(sensor_data)
    print(f"✅ Sensor reading inserted with ID: {result.inserted_id}")
    print(f"   Device: {sensor_data['device_id']}")
    print(f"   Classification: {sensor_data['classification']}")
    print(f"   Confidence: {sensor_data['classification_confidence'] * 100}%")
    print(f"   pH: {sensor_data['ph']}")
    print(f"   Turbidity: {sensor_data['turbidity']}")
    print(f"   Temperature: {sensor_data['temperature']}")
    print(f"   TDS: {sensor_data['tds']}")
    print()
    
    # Sample tank reading
    tank_data = {
        "device_id": "ESP32_001",
        "timestamp": datetime.utcnow(),
        "distance_cm": 32.0,
        "tank_height_cm": 100.0,
        "level_percent": 68.0,
        "volume_liters": 340.0,
        "tank_status": "Half_Full",
        "created_at": datetime.utcnow()
    }
    
    print("🚰 Inserting tank reading...")
    result = await db.tank_readings.insert_one(tank_data)
    print(f"✅ Tank reading inserted with ID: {result.inserted_id}")
    print(f"   Device: {tank_data['device_id']}")
    print(f"   Tank Status: {tank_data['tank_status']}")
    print(f"   Level: {tank_data['level_percent']}%")
    print(f"   Volume: {tank_data['volume_liters']}L")
    print()
    
    print("=" * 60)
    print("✅ SAMPLE DATA INSERTED SUCCESSFULLY!")
    print()
    print("You can now:")
    print("1. Start the backend: start_backend.bat")
    print("2. Start the frontend: npx react-native run-android")
    print("3. Login and view the Home screen")
    print("4. The Home screen should display the sample data")
    print()
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(insert_sample_data())
