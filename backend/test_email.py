import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
smtp_port = int(os.getenv("SMTP_PORT", "587"))
smtp_user = os.getenv("SMTP_USER")
smtp_password = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
from_name = os.getenv("SMTP_FROM_NAME", "AquaGuard")

print(f"📧 Testing SMTP Configuration:")
print(f"   Host: {smtp_host}")
print(f"   Port: {smtp_port}")
print(f"   User: {smtp_user}")
print(f"   Password Length: {len(smtp_password) if smtp_password else 0} characters")
print(f"   Password (first 4): {smtp_password[:4] if smtp_password else 'NOT SET'}...")
print(f"   From: {from_email}")
print(f"   Name: {from_name}")
print()

# Test 1: Try TLS (port 587)
print("=" * 60)
print("TEST 1: SMTP with TLS (Port 587)")
print("=" * 60)
try:
    message = MIMEMultipart('alternative')
    message['Subject'] = "Test Email from AquaGuard (TLS)"
    message['From'] = f"{from_name} <{from_email}>"
    message['To'] = smtp_user
    
    html_content = """
    <html>
        <body>
            <h1>🌊 Test Email (TLS)</h1>
            <p>If you're reading this, your SMTP TLS configuration is working!</p>
            <p><strong>AquaGuard Water Quality Monitoring System</strong></p>
        </body>
    </html>
    """
    
    html_part = MIMEText(html_content, 'html')
    message.attach(html_part)
    
    print("🔄 Connecting to SMTP server...")
    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        print("✅ Connected!")
        
        print("🔄 Starting TLS...")
        server.starttls()
        print("✅ TLS started!")
        
        print("🔄 Logging in...")
        server.login(smtp_user, smtp_password)
        print("✅ Logged in!")
        
        print("🔄 Sending email...")
        server.send_message(message)
        print("✅ Email sent successfully via TLS!")
        
    print()
    print(f"✅ SUCCESS! Check your inbox at {smtp_user}")
    
except Exception as e:
    print(f"❌ TLS FAILED: {str(e)}")
    print()
    
    # Test 2: Try SSL (port 465)
    print("=" * 60)
    print("TEST 2: SMTP with SSL (Port 465)")
    print("=" * 60)
    try:
        message = MIMEMultipart('alternative')
        message['Subject'] = "Test Email from AquaGuard (SSL)"
        message['From'] = f"{from_name} <{from_email}>"
        message['To'] = smtp_user
        
        html_content = """
        <html>
            <body>
                <h1>🌊 Test Email (SSL)</h1>
                <p>If you're reading this, your SMTP SSL configuration is working!</p>
                <p><strong>AquaGuard Water Quality Monitoring System</strong></p>
            </body>
        </html>
        """
        
        html_part = MIMEText(html_content, 'html')
        message.attach(html_part)
        
        print("🔄 Connecting to SMTP server with SSL...")
        with smtplib.SMTP_SSL(smtp_host, 465, timeout=10) as server:
            print("✅ Connected with SSL!")
            
            print("🔄 Logging in...")
            server.login(smtp_user, smtp_password)
            print("✅ Logged in!")
            
            print("🔄 Sending email...")
            server.send_message(message)
            print("✅ Email sent successfully via SSL!")
            
        print()
        print(f"✅ SUCCESS! Check your inbox at {smtp_user}")
        print()
        print("💡 NOTE: SSL (port 465) works! Update your .env file:")
        print("   SMTP_PORT=465")
        
    except Exception as ssl_error:
        print(f"❌ SSL ALSO FAILED: {str(ssl_error)}")
        print()
        print("=" * 60)
        print("TROUBLESHOOTING STEPS:")
        print("=" * 60)
        print("1. Go to https://myaccount.google.com/security")
        print("2. Make sure 2-Step Verification is ENABLED")
        print("3. Go to https://myaccount.google.com/apppasswords")
        print("4. Generate a NEW App Password for 'Mail'")
        print("5. Copy the 16-character password (e.g., 'abcd efgh ijkl mnop')")
        print("6. Update .env file with password WITHOUT SPACES:")
        print("   SMTP_PASSWORD=abcdefghijklmnop")
        print("7. Make sure you're using the App Password, NOT your Gmail password")
        print("8. Check if your antivirus/firewall is blocking ports 587 or 465")

