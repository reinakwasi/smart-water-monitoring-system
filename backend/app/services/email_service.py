"""Email service for sending OTP and notifications"""

import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv

from app.utils.logger import get_logger

# Load environment variables explicitly
load_dotenv()

logger = get_logger(__name__)


class EmailService:
    def __init__(self):
        # In-memory OTP storage (use Redis in production)
        self.otp_store = {}
        
        # Load SMTP configuration at initialization
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", self.smtp_user)
        self.from_name = os.getenv("SMTP_FROM_NAME", "AquaGuard")
        self.otp_expiry_minutes = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))
        self.otp_length = int(os.getenv("OTP_LENGTH", "6"))
        
        # Log configuration (without password)
        logger.info(f"Email service initialized:")
        logger.info(f"  SMTP Host: {self.smtp_host}")
        logger.info(f"  SMTP Port: {self.smtp_port}")
        logger.info(f"  SMTP User: {self.smtp_user}")
        logger.info(f"  Password Set: {bool(self.smtp_password)}")
        logger.info(f"  Password Length: {len(self.smtp_password) if self.smtp_password else 0}")
    
    def generate_otp(self) -> str:
        """Generate a random OTP code"""
        return ''.join(random.choices(string.digits, k=self.otp_length))
    
    def store_otp(self, email: str, otp: str) -> None:
        """Store OTP with expiry time"""
        expiry_time = datetime.utcnow() + timedelta(minutes=self.otp_expiry_minutes)
        self.otp_store[email] = {
            'otp': otp,
            'expiry': expiry_time,
            'attempts': 0
        }
        logger.info(f"OTP stored for {email}, expires at {expiry_time}")
    
    def verify_otp(self, email: str, otp: str) -> bool:
        """Verify OTP code"""
        if email not in self.otp_store:
            logger.warning(f"No OTP found for {email}")
            return False
        
        stored_data = self.otp_store[email]
        
        # Check if OTP expired
        if datetime.utcnow() > stored_data['expiry']:
            logger.warning(f"OTP expired for {email}")
            del self.otp_store[email]
            return False
        
        # Check attempts (max 3)
        if stored_data['attempts'] >= 3:
            logger.warning(f"Too many OTP attempts for {email}")
            del self.otp_store[email]
            return False
        
        # Verify OTP
        if stored_data['otp'] == otp:
            logger.info(f"OTP verified successfully for {email}")
            del self.otp_store[email]
            return True
        else:
            stored_data['attempts'] += 1
            logger.warning(f"Invalid OTP attempt for {email} (attempt {stored_data['attempts']})")
            return False
    
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email via SMTP"""
        try:
            # Validate configuration
            if not self.smtp_user or not self.smtp_password:
                logger.error("SMTP credentials not configured")
                return False
            
            # Create message
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = f"{self.from_name} <{self.from_email}>"
            message['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            message.attach(html_part)
            
            # Try SMTP with TLS (port 587)
            try:
                logger.info(f"Attempting to send email to {to_email} via SMTP TLS (port {self.smtp_port})")
                logger.info(f"Using SMTP credentials: {self.smtp_user}")
                
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                    server.set_debuglevel(1)  # Enable debug output
                    logger.info("Connected to SMTP server")
                    
                    server.starttls()
                    logger.info("TLS started")
                    
                    server.login(self.smtp_user, self.smtp_password)
                    logger.info("Login successful")
                    
                    server.send_message(message)
                    logger.info(f"Email sent successfully to {to_email}")
                    
                return True
                
            except smtplib.SMTPAuthenticationError as auth_error:
                logger.error(f"SMTP Authentication failed: {str(auth_error)}")
                logger.error("Please check your Gmail App Password")
                
                # Try SSL as fallback
                logger.info("Trying SSL (port 465) as fallback...")
                with smtplib.SMTP_SSL(self.smtp_host, 465, timeout=15) as server:
                    server.set_debuglevel(1)
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(message)
                logger.info(f"Email sent successfully to {to_email} via SSL")
                return True
                
            except Exception as tls_error:
                logger.warning(f"TLS failed: {str(tls_error)}, trying SSL...")
                
                # Fallback to SMTP_SSL (port 465)
                with smtplib.SMTP_SSL(self.smtp_host, 465, timeout=15) as server:
                    server.set_debuglevel(1)
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(message)
                logger.info(f"Email sent successfully to {to_email} via SSL")
                return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def send_otp_email(self, to_email: str, otp: str) -> bool:
        """Send OTP verification email"""
        subject = "Verify Your Email - AquaGuard"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f8f9fa;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .otp-box {{
                    background: white;
                    border: 2px solid #0891B2;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .otp-code {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #0891B2;
                    letter-spacing: 8px;
                    margin: 10px 0;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    color: #666;
                    font-size: 12px;
                }}
                .warning {{
                    background: #FEF2F2;
                    border-left: 4px solid #EF4444;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌊 AquaGuard</h1>
                    <p>Water Quality Monitoring System</p>
                </div>
                <div class="content">
                    <h2>Verify Your Email Address</h2>
                    <p>Thank you for signing up! Please use the following OTP code to verify your email address:</p>
                    
                    <div class="otp-box">
                        <p style="margin: 0; color: #666;">Your OTP Code</p>
                        <div class="otp-code">{otp}</div>
                        <p style="margin: 0; color: #666; font-size: 14px;">Valid for {self.otp_expiry_minutes} minutes</p>
                    </div>
                    
                    <p>Enter this code in the app to complete your registration.</p>
                    
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong><br>
                        • Never share this code with anyone<br>
                        • AquaGuard will never ask for your OTP via phone or email<br>
                        • This code expires in {self.otp_expiry_minutes} minutes
                    </div>
                    
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2024 AquaGuard Water Quality Monitoring System</p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)
    
    def send_welcome_email(self, to_email: str, full_name: str) -> bool:
        """Send welcome email after successful verification"""
        subject = "Welcome to AquaGuard! 🎉"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f8f9fa;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .feature {{
                    background: white;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 8px;
                    border-left: 4px solid #0891B2;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌊 Welcome to AquaGuard!</h1>
                </div>
                <div class="content">
                    <h2>Hi {full_name}! 👋</h2>
                    <p>Your email has been verified successfully! You're all set to start monitoring your water quality.</p>
                    
                    <h3>What you can do with AquaGuard:</h3>
                    
                    <div class="feature">
                        <strong>📊 Real-time Monitoring</strong><br>
                        Track pH, Turbidity, TDS, and Temperature 24/7
                    </div>
                    
                    <div class="feature">
                        <strong>🤖 AI-Powered Predictions</strong><br>
                        Get instant water quality assessments
                    </div>
                    
                    <div class="feature">
                        <strong>🔔 Smart Alerts</strong><br>
                        Receive notifications for tank levels and water quality issues
                    </div>
                    
                    <div class="feature">
                        <strong>📈 Historical Data</strong><br>
                        View trends and analyze your water quality over time
                    </div>
                    
                    <p style="margin-top: 30px;">Ready to get started? Sign in to your account and explore!</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)
    
    def send_password_reset_email(self, email: str, full_name: str, reset_token: str) -> bool:
        """Send password reset email with token"""
        subject = "Password Reset - AquaGuard"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #0891B2 0%, #0B7FA5 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f8f9fa;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .otp-box {{
                    background: white;
                    border: 2px dashed #0891B2;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .otp-code {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #0891B2;
                    letter-spacing: 8px;
                }}
                .warning {{
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset Request</h1>
                </div>
                <div class="content">
                    <p>Hi {full_name},</p>
                    <p>We received a request to reset your password. Use the code below to reset your password:</p>
                    
                    <div class="otp-box">
                        <p style="margin: 0; color: #666; font-size: 14px;">Your Reset Code</p>
                        <div class="otp-code">{reset_token}</div>
                        <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for {self.otp_expiry_minutes} minutes</p>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong>
                        <p style="margin: 5px 0 0 0;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
                    </div>
                    
                    <p>Best regards,<br>The {self.from_name} Team</p>
                </div>
                <div class="footer">
                    <p>© 2025 {self.from_name}. All rights reserved.</p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(email, subject, html_content)


# Singleton instance
email_service = EmailService()
