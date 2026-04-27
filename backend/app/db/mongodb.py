"""MongoDB connection management with Motor (async driver)"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    """MongoDB connection manager with lifecycle management"""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
    
    async def connect(self):
        """
        Establish MongoDB connection with connection pooling
        
        Connection pooling configuration:
        - maxPoolSize: Maximum number of connections in the pool
        - minPoolSize: Minimum number of connections to maintain
        - serverSelectionTimeoutMS: Timeout for server selection
        - connectTimeoutMS: Timeout for initial connection
        """
        try:
            logger.info(f"Connecting to MongoDB at {settings.mongodb_url}")
            
            self.client = AsyncIOMotorClient(
                settings.mongodb_url,
                maxPoolSize=settings.mongodb_max_pool_size,
                minPoolSize=settings.mongodb_min_pool_size,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
            )
            
            # Verify connection by pinging the server
            await self.client.admin.command('ping')
            
            self.db = self.client[settings.mongodb_db_name]
            
            logger.info(
                f"Successfully connected to MongoDB database: {settings.mongodb_db_name} "
                f"(pool size: {settings.mongodb_min_pool_size}-{settings.mongodb_max_pool_size})"
            )
            
            # Create indexes for performance optimization
            await self._create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    async def disconnect(self):
        """Close MongoDB connection and cleanup resources"""
        if self.client:
            try:
                logger.info("Closing MongoDB connection")
                self.client.close()
                self.client = None
                self.db = None
                logger.info("MongoDB connection closed successfully")
            except Exception as e:
                logger.error(f"Error closing MongoDB connection: {e}")
                raise
    
    async def _create_indexes(self):
        """Create database indexes for query optimization"""
        try:
            # Sensor readings collection indexes
            await self.db.sensor_readings.create_index("device_id")
            await self.db.sensor_readings.create_index("timestamp")
            await self.db.sensor_readings.create_index([("device_id", 1), ("timestamp", -1)])
            
            # Tank level readings collection indexes
            await self.db.tank_readings.create_index("device_id")
            await self.db.tank_readings.create_index("timestamp")
            await self.db.tank_readings.create_index([("device_id", 1), ("timestamp", -1)])
            
            # Users collection indexes
            await self.db.users.create_index("email", unique=True)
            
            # Sensor devices collection indexes
            await self.db.sensor_devices.create_index("device_id", unique=True)
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.warning(f"Error creating indexes (may already exist): {e}")
    
    def get_database(self) -> AsyncIOMotorDatabase:
        """Get the database instance"""
        if self.db is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self.db
    
    async def health_check(self) -> dict:
        """
        Check MongoDB connection health and return status
        
        Returns:
            dict: Health status with connection state and latency
        """
        if self.client is None or self.db is None:
            return {
                "status": "disconnected",
                "latency_ms": None
            }
        
        try:
            import time
            start_time = time.time()
            
            # Ping the database to check connection
            await self.client.admin.command('ping')
            
            latency_ms = (time.time() - start_time) * 1000
            
            return {
                "status": "connected",
                "latency_ms": round(latency_ms, 2)
            }
        except Exception as e:
            logger.error(f"MongoDB health check failed: {e}")
            return {
                "status": "disconnected",
                "latency_ms": None,
                "error": str(e)
            }


# Global MongoDB instance
mongodb = MongoDB()


async def get_database() -> AsyncIOMotorDatabase:
    """
    Dependency function to get database instance
    
    Usage in FastAPI endpoints:
        @app.get("/endpoint")
        async def endpoint(db: AsyncIOMotorDatabase = Depends(get_database)):
            ...
    """
    return mongodb.get_database()
