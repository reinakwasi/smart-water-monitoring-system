"""Firebase Cloud Messaging notification service with throttling and retry logic"""

import httpx
import asyncio
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.utils.logger import get_logger

logger = get_logger(__name__)


class NotificationService:
    """
    Firebase Cloud Messaging notification service
    
    Provides methods to send notifications for water quality changes, contamination risk alerts,
    and tank status updates with built-in throttling and retry logic.    """
    
    def __init__(self, fcm_server_key: str):
        """
        Initialize notification service
        
        Args:
            fcm_server_key: Firebase Cloud Messaging server key
        """
        self.fcm_server_key = fcm_server_key
        self.fcm_url = "https://fcm.googleapis.com/fcm/send"
        self.notification_cache: Dict[str, datetime] = {}  # Track last notification time per type
        self.throttle_duration = timedelta(hours=1)  # 1 hour cooldown per notification type
        self.max_retries = 3
        self.retry_delays = [1, 2, 4]  # Exponential backoff delays in seconds
    
    async def send_quality_change_notification(
        self,
        user_tokens: List[str],
        old_quality: str,
        new_quality: str,
        top_factor: str
    ) -> bool:
        """
        Send notification when water quality classification changes        Args:
            user_tokens: List of FCM device tokens
            old_quality: Previous water quality classification
            new_quality: New water quality classification
            top_factor: Top contributing factor from SHAP analysis
            
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        notification_key = f"quality_{new_quality}"
        
        # Check throttling (Requirement 8.7)
        if self._should_throttle(notification_key):
            logger.info(
                f"Quality change notification throttled for {new_quality}",
                extra={
                    "extra_fields": {
                        "notification_type": "quality_change",
                        "new_quality": new_quality,
                        "throttled": True
                    }
                }
            )
            return False
        
        # Determine priority based on quality level (Requirement 8.2)
        priority = "high" if new_quality == "Unsafe" else "normal"
        
        # Format notification message (Requirement 8.5, 8.6)
        title, body = self._format_quality_message(old_quality, new_quality, top_factor)
        
        # Send notification with retry logic
        success = await self._send_fcm_notification_with_retry(
            user_tokens, title, body, priority, notification_type="quality_change"
        )
        
        if success:
            # Update throttle cache (Requirement 8.7)
            self._update_throttle_cache(notification_key)
            logger.info(
                f"Quality change notification sent successfully: {old_quality} -> {new_quality}",
                extra={
                    "extra_fields": {
                        "notification_type": "quality_change",
                        "old_quality": old_quality,
                        "new_quality": new_quality,
                        "top_factor": top_factor,
                        "priority": priority
                    }
                }
            )
        
        return success
    
    async def send_risk_change_notification(
        self,
        user_tokens: List[str],
        risk_level: str,
        risk_score: float
    ) -> bool:
        """
        Send notification when contamination risk level increases        Args:
            user_tokens: List of FCM device tokens
            risk_level: Risk level (Low, Medium, High)
            risk_score: Risk score (0.0 - 1.0)
            
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        notification_key = f"risk_{risk_level}"
        
        # Check throttling (Requirement 8.7)
        if self._should_throttle(notification_key):
            logger.info(
                f"Risk change notification throttled for {risk_level}",
                extra={
                    "extra_fields": {
                        "notification_type": "risk_change",
                        "risk_level": risk_level,
                        "throttled": True
                    }
                }
            )
            return False
        
        # Format notification message
        title = f"Contamination Risk: {risk_level}"
        body = f"Risk score: {risk_score:.2f}. Monitor water quality closely."
        
        # Send notification with retry logic
        success = await self._send_fcm_notification_with_retry(
            user_tokens, title, body, "normal", notification_type="risk_change"
        )
        
        if success:
            # Update throttle cache (Requirement 8.7)
            self._update_throttle_cache(notification_key)
            logger.info(
                f"Risk change notification sent successfully: {risk_level} ({risk_score:.2f})",
                extra={
                    "extra_fields": {
                        "notification_type": "risk_change",
                        "risk_level": risk_level,
                        "risk_score": risk_score
                    }
                }
            )
        
        return success
    
    async def send_tank_notification(
        self,
        user_tokens: List[str],
        tank_status: str,
        level_percent: float
    ) -> bool:
        """
        Send notification for tank level changes        Args:
            user_tokens: List of FCM device tokens
            tank_status: Tank status (Empty, Half_Full, Full, Overflow)
            level_percent: Tank level percentage
            
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        notification_key = f"tank_{tank_status}"
        
        # Check throttling (Requirement 9.6)
        if self._should_throttle(notification_key):
            logger.info(
                f"Tank notification throttled for {tank_status}",
                extra={
                    "extra_fields": {
                        "notification_type": "tank_status",
                        "tank_status": tank_status,
                        "throttled": True
                    }
                }
            )
            return False
        
        # Determine priority based on tank status (Requirement 9.1)
        priority = "high" if tank_status == "Overflow" else "normal"
        
        # Format notification message (Requirement 9.4, 9.5)
        title, body = self._format_tank_message(tank_status, level_percent)
        
        # Send notification with retry logic
        success = await self._send_fcm_notification_with_retry(
            user_tokens, title, body, priority, notification_type="tank_status"
        )
        
        if success:
            # Update throttle cache (Requirement 9.6)
            self._update_throttle_cache(notification_key)
            logger.info(
                f"Tank notification sent successfully: {tank_status} ({level_percent:.1f}%)",
                extra={
                    "extra_fields": {
                        "notification_type": "tank_status",
                        "tank_status": tank_status,
                        "level_percent": level_percent,
                        "priority": priority
                    }
                }
            )
        
        return success
    
    async def _send_fcm_notification_with_retry(
        self,
        tokens: List[str],
        title: str,
        body: str,
        priority: str,
        notification_type: str
    ) -> bool:
        """
        Send FCM notification with retry logic
        
        Args:
            tokens: List of FCM device tokens
            title: Notification title
            body: Notification body
            priority: Notification priority (normal, high)
            notification_type: Type of notification for logging
            
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        if not tokens:
            logger.warning(f"No FCM tokens provided for {notification_type} notification")
            return False
        
        if not self.fcm_server_key:
            logger.error(f"FCM server key not configured for {notification_type} notification")
            return False
        
        for attempt in range(self.max_retries):
            try:
                success = await self._send_fcm_notification(tokens, title, body, priority)
                if success:
                    return True
                
                # If not the last attempt, wait before retrying
                if attempt < self.max_retries - 1:
                    delay = self.retry_delays[attempt]
                    logger.warning(
                        f"FCM notification attempt {attempt + 1} failed, retrying in {delay}s",
                        extra={
                            "extra_fields": {
                                "notification_type": notification_type,
                                "attempt": attempt + 1,
                                "retry_delay": delay
                            }
                        }
                    )
                    await asyncio.sleep(delay)
                
            except Exception as e:
                logger.error(
                    f"FCM notification attempt {attempt + 1} failed with exception: {str(e)}",
                    extra={
                        "extra_fields": {
                            "notification_type": notification_type,
                            "attempt": attempt + 1,
                            "error": str(e)
                        }
                    },
                    exc_info=True
                )
                
                # If not the last attempt, wait before retrying
                if attempt < self.max_retries - 1:
                    delay = self.retry_delays[attempt]
                    await asyncio.sleep(delay)
        
        logger.error(
            f"FCM notification failed after {self.max_retries} attempts",
            extra={
                "extra_fields": {
                    "notification_type": notification_type,
                    "max_retries": self.max_retries
                }
            }
        )
        return False
    
    async def _send_fcm_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        priority: str
    ) -> bool:
        """
        Send notification via Firebase Cloud Messaging
        
        Args:
            tokens: List of FCM device tokens
            title: Notification title
            body: Notification body
            priority: Notification priority (normal, high)
            
        Returns:
            bool: True if notification sent successfully, False otherwise
            
        Raises:
            httpx.HTTPError: If HTTP request fails
        """
        headers = {
            "Authorization": f"key={self.fcm_server_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "registration_ids": tokens,
            "priority": priority,
            "notification": {
                "title": title,
                "body": body,
                "sound": "default"
            },
            "data": {
                "timestamp": datetime.utcnow().isoformat(),
                "priority": priority
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.fcm_url,
                json=payload,
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code == 200:
                # Parse FCM response to check for errors
                fcm_response = response.json()
                success_count = fcm_response.get("success", 0)
                failure_count = fcm_response.get("failure", 0)
                
                if success_count > 0:
                    logger.debug(
                        f"FCM notification sent successfully to {success_count} devices",
                        extra={
                            "extra_fields": {
                                "success_count": success_count,
                                "failure_count": failure_count
                            }
                        }
                    )
                    return True
                else:
                    logger.warning(
                        f"FCM notification failed for all {failure_count} devices",
                        extra={
                            "extra_fields": {
                                "success_count": success_count,
                                "failure_count": failure_count,
                                "fcm_response": fcm_response
                            }
                        }
                    )
                    return False
            else:
                logger.error(
                    f"FCM API returned error status: {response.status_code}",
                    extra={
                        "extra_fields": {
                            "status_code": response.status_code,
                            "response_text": response.text
                        }
                    }
                )
                response.raise_for_status()
                return False
    
    def _should_throttle(self, notification_key: str) -> bool:
        """
        Check if notification should be throttled
        
        Args:
            notification_key: Unique key for notification type
            
        Returns:
            bool: True if notification should be throttled, False otherwise
        """
        if notification_key not in self.notification_cache:
            return False
        
        last_sent = self.notification_cache[notification_key]
        return datetime.utcnow() - last_sent < self.throttle_duration
    
    def _update_throttle_cache(self, notification_key: str):
        """
        Update last notification timestamp for throttling
        
        Args:
            notification_key: Unique key for notification type
        """
        self.notification_cache[notification_key] = datetime.utcnow()
    
    def _format_quality_message(self, old: str, new: str, factor: str) -> Tuple[str, str]:
        """
        Format water quality change message        Args:
            old: Previous water quality classification
            new: New water quality classification
            factor: Top contributing factor from SHAP analysis
            
        Returns:
            Tuple[str, str]: (title, body) for notification
        """
        messages = {
            "Unsafe": (
                "⚠️ Water Quality: Unsafe",
                f"Water quality changed from {old} to {new}. Main factor: {factor}. Do not use water."
            ),
            "Warning": (
                "⚡ Water Quality: Warning",
                f"Water quality changed from {old} to {new}. Main factor: {factor}. Use caution."
            ),
            "Safe": (
                "✅ Water Quality: Safe",
                f"Water quality improved from {old} to {new}. Water is safe to use."
            )
        }
        return messages.get(new, ("Water Quality Update", f"Status changed to {new}"))
    
    async def get_active_user_tokens(self, db: AsyncIOMotorDatabase) -> List[str]:
        """
        Get FCM tokens for all active users
        
        Args:
            db: MongoDB database instance
            
        Returns:
            List of FCM tokens for active users
        """
        try:
            cursor = db.users.find(
                {
                    "is_active": True,
                    "fcm_token": {"$ne": None, "$exists": True}
                },
                {"fcm_token": 1}
            )
            
            tokens = []
            async for user in cursor:
                if user.get("fcm_token"):
                    tokens.append(user["fcm_token"])
            
            logger.debug(f"Found {len(tokens)} active user FCM tokens")
            return tokens
            
        except Exception as e:
            logger.error(f"Error retrieving user FCM tokens: {str(e)}", exc_info=True)
            return []
    
    def _format_tank_message(self, status: str, level: float) -> Tuple[str, str]:
        """
        Format tank level message        Args:
            status: Tank status (Empty, Half_Full, Full, Overflow)
            level: Tank level percentage
            
        Returns:
            Tuple[str, str]: (title, body) for notification
        """
        messages = {
            "Overflow": (
                "🚨 Tank Overflow Alert",
                f"Tank level at {level:.1f}%. Immediate action required!"
            ),
            "Full": (
                "💧 Tank Full",
                f"Tank level at {level:.1f}%. Consider stopping water supply."
            ),
            "Empty": (
                "⚠️ Tank Empty",
                f"Tank level at {level:.1f}%. Refill needed."
            ),
            "Half_Full": (
                "📊 Tank Status Update",
                f"Tank level at {level:.1f}%."
            )
        }
        return messages.get(status, ("Tank Status", f"Level: {level:.1f}%"))


# Global notification service instance (will be initialized in main.py)
notification_service: Optional[NotificationService] = None


def get_notification_service() -> Optional[NotificationService]:
    """
    Get the global notification service instance
    
    Returns:
        NotificationService instance or None if not initialized
    """
    return notification_service


def initialize_notification_service(fcm_server_key: Optional[str]) -> Optional[NotificationService]:
    """
    Initialize the global notification service instance
    
    Args:
        fcm_server_key: Firebase Cloud Messaging server key
        
    Returns:
        NotificationService instance or None if FCM key not provided
    """
    global notification_service
    
    if fcm_server_key:
        notification_service = NotificationService(fcm_server_key)
        logger.info("Notification service initialized successfully")
        return notification_service
    else:
        logger.warning("FCM server key not provided, notification service disabled")
        return None