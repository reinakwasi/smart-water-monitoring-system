"""
Script to resolve MongoDB Atlas SRV records to actual hostnames
This helps convert mongodb+srv:// to standard mongodb:// connection strings
"""
import dns.resolver
import sys

def resolve_mongodb_srv(srv_domain):
    """
    Resolve MongoDB SRV records to get actual cluster hostnames
    
    Args:
        srv_domain: The SRV domain (e.g., cluster.mongodb.net)
    
    Returns:
        List of (hostname, port) tuples
    """
    try:
        # Use Google's public DNS to avoid local DNS issues
        resolver = dns.resolver.Resolver()
        resolver.nameservers = ['8.8.8.8', '8.8.4.4']  # Google Public DNS
        
        # Query SRV records
        srv_records = resolver.resolve(f'_mongodb._tcp.{srv_domain}', 'SRV')
        
        hosts = []
        for srv in srv_records:
            hostname = str(srv.target).rstrip('.')
            port = srv.port
            hosts.append((hostname, port))
            print(f"Found host: {hostname}:{port}")
        
        return hosts
    
    except Exception as e:
        print(f"Error resolving SRV records: {e}")
        return None


def convert_to_standard_uri(srv_uri):
    """
    Convert mongodb+srv:// URI to standard mongodb:// URI
    
    Args:
        srv_uri: The SRV connection string
    
    Returns:
        Standard MongoDB connection string
    """
    # Extract the domain from SRV URI
    # Format: mongodb+srv://username:password@cluster-domain/database?options
    try:
        # Remove the protocol
        without_protocol = srv_uri.replace('mongodb+srv://', '')
        
        # Extract credentials if present
        if '@' in without_protocol:
            credentials, rest = without_protocol.split('@', 1)
            username, password = credentials.split(':', 1) if ':' in credentials else (credentials, '')
        else:
            username = password = ''
            rest = without_protocol
        
        # Extract domain and options
        if '/' in rest:
            domain, rest_after = rest.split('/', 1)
            if '?' in rest_after:
                database, options = rest_after.split('?', 1)
            else:
                database = rest_after
                options = ''
        else:
            if '?' in rest:
                domain, options = rest.split('?', 1)
            else:
                domain = rest
                options = ''
            database = ''
        
        print(f"\nResolving domain: {domain}")
        print(f"Using Google DNS servers: 8.8.8.8, 8.8.4.4\n")
        
        # Resolve the SRV records
        hosts = resolve_mongodb_srv(domain)
        
        if not hosts:
            print("\nFailed to resolve SRV records. This might be due to:")
            print("1. No internet connectivity")
            print("2. Firewall blocking DNS queries")
            print("3. Invalid MongoDB Atlas cluster domain")
            return None
        
        # Build the standard connection string
        host_strings = [f"{host}:{port}" for host, port in hosts]
        hosts_part = ','.join(host_strings)
        
        if username and password:
            credentials_part = f"{username}:{password}@"
        else:
            credentials_part = ""
        
        database_part = f"/{database}" if database else ""
        options_part = f"?{options}" if options else ""
        
        standard_uri = f"mongodb://{credentials_part}{hosts_part}{database_part}{options_part}"
        
        print("\n" + "="*80)
        print("STANDARD CONNECTION STRING:")
        print("="*80)
        print(standard_uri)
        print("="*80)
        
        return standard_uri
    
    except Exception as e:
        print(f"Error converting URI: {e}")
        return None


if __name__ == "__main__":
    # Get the SRV URI from environment or command line
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    srv_uri = os.getenv('MONGODB_URL')
    
    if not srv_uri:
        print("Error: MONGODB_URL not found in .env file")
        sys.exit(1)
    
    print("Original SRV URI:")
    print(srv_uri)
    print("\n")
    
    standard_uri = convert_to_standard_uri(srv_uri)
    
    if standard_uri:
        print("\n✓ Successfully converted to standard connection string!")
        print("\nUpdate your .env file with:")
        print(f'MONGODB_URL="{standard_uri}"')
    else:
        print("\n✗ Failed to convert connection string")
        sys.exit(1)
