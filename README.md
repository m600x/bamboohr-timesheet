# BambooHR Time and Attendance Automation

Automates BambooHR login and timesheet clock-in/out via Puppeteer and Express.

The idea is to have an API that will allow you to clock-in or out without an API key.

You would deploy that container somewhere and then be able to issue a curl from anywhere, in any form or shape (cron? an ESP32 button? Whatever you can imagine?)

Start using `make run` (need docker). Then:
```
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"SECRET","action":"in"}'
```

Work if:
- You have a normal login (email/password)
- You have a TOTP on your account and you retrieved the secret (see below)

**No logs will record your TOTP secret, it only live in memory for the time of the request.**

## Quick Start

### Docker

```bash
docker-compose up -d
```

### NPM

```bash
npm install
node api-server.js
```

## API Server

### Endpoints

```bash
# Clock in
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"SECRET","action":"in"}'

# Clock out
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"SECRET","action":"out"}'

# Toggle state
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"SECRET","action":"toggle"}'

# Check current status (no action field)
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"SECRET"}'

# Health check
curl http://localhost:3000/health
```

### Request Body Schema

| Field | Required | Description |
|-------|----------|-------------|
| `instance` | Yes | BambooHR instance name (e.g., `umbrella` for `https://umbrella.bamboohr.com`) |
| `user` | Yes | BambooHR email address |
| `pass` | Yes | BambooHR password |
| `totp` | Yes | TOTP secret key (Base32 encoded) |
| `action` | No | Action to perform: `in`, `out`, or `toggle`. If omitted, returns current status. |

### Response Format

**Success (action performed):**
```json
{
  "requestId": "uuid",
  "action": "in",
  "state": "clocked-in"
}
```

**Validation Error:**
```json
{
  "requestId": "uuid",
  "errors": ["instance is required", "user is required", "pass is required", "totp is required"]
}
```

**Error:**
```json
{
  "requestId": "uuid",
  "error": "Login form submission failed"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid request body or missing fields |
| 500 | Automation error |
| 503 | Server busy (cooldown period) |

### Request Tracing

Include `X-Request-Id` header for request tracing:

```bash
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: my-trace-id" \
  -d '{"instance":"..."...}'
```

If not provided, a UUID is generated. All logs include the request ID for tracing.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

## Project Structure

```
bamboohr/
├── api-server.js      # Express API server
├── automation.js      # Puppeteer automation logic
├── utils.js           # Shared utilities
├── package.json       # Node.js dependencies
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose configuration
└── README.md          # This file
```

## Automation Workflow

The automation performs these steps:

1. **stepLoadBambooHR** - Navigate to BambooHR and wait for login form
2. **stepEnableNormalLogin** - Enable normal login form (hides SSO options)
3. **stepLogin** - Submit email and password
4. **stepTOTP** - Generate TOTP code using `oathtool` and submit
5. **stepTrustedBrowser** - Select "Trust this browser" option
6. **stepCurrentState** - Determine current clocked-in/clocked-out state
7. **stepTimesheet** - Click clock-in/out button based on action

## TOTP Secret Extraction

Extract TOTP secret from existing authenticator QR code:

```
otpauth://totp/BambooHR:email@example.com?secret=JBSWY3DPEHPK3PXP&issuer=BambooHR
```

Use the value after `secret=` in your request payload.