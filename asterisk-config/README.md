# Asterisk Configuration Examples

Ready-to-use Asterisk config files for the NET2APP Hub Docker setup.
Mount these into your Asterisk container to skip the manual AMI setup.

## Quick start

```bash
# 1. Start Asterisk with configs mounted
docker compose up -d asterisk

# 2. Verify AMI is reachable
nc -zv localhost 5038

# 3. Register the server in the bridge
curl -X POST http://localhost:3000/api/asterisk/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Local Asterisk",
    "ami_host": "asterisk",
    "ami_port": 5038,
    "sip_host": "asterisk",
    "sip_port": 5060,
    "ami_username": "admin",
    "ami_secret": "net2app-ami-secret"
  }'
```

## Files

| File | Purpose | Mount path |
|---|---|---|
| `manager.conf` | AMI (Asterisk Manager Interface) | `/etc/asterisk/manager.conf` |
| `http.conf` | HTTP server (debugging) | `/etc/asterisk/http.conf` |

## AMI Users

| Username | Secret | Permissions |
|---|---|---|
| `admin` | `net2app-ami-secret` | Full read/write (bridge operations) |
| `monitor` | `monitor-readonly` | Read-only (dashboards, debugging) |

## Docker Compose mount

The `docker-compose.yml` already mounts `asterisk-config/` into the container.
If you're using a custom compose file, add:

```yaml
asterisk:
  volumes:
    - ./asterisk-config/manager.conf:/etc/asterisk/manager.conf:ro
    - ./asterisk-config/http.conf:/etc/asterisk/http.conf:ro
```

## Security

- **Change secrets in production.** The defaults here are for local development.
- Restrict `permit` to your actual IP ranges in `manager.conf`.
- Consider using a firewall to limit access to port 5038.
