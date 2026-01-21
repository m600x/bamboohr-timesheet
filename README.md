# BambooHR Time and Attendance Automation

![Lint](https://github.com/m600x/bamboohr-timesheet/actions/workflows/lint.yml/badge.svg)
![Tests](https://github.com/m600x/bamboohr-timesheet/actions/workflows/tests.yml/badge.svg)
![Build](https://github.com/m600x/bamboohr-timesheet/actions/workflows/build.yml/badge.svg)
![Deploy](https://github.com/m600x/bamboohr-timesheet/actions/workflows/deploy.yml/badge.svg)

Automates BambooHR login and timesheet clock-in/out via Puppeteer and Express.

The idea is to have an API that will allow you to clock-in or out without an API key.

You would deploy that container somewhere and then be able to issue a curl from anywhere, in any form or shape (cron? an ESP32 button? Whatever you can imagine?)

---
Deployed in an OCI VM by Github Actions, check the code, there's not a single log that keep your data anywhere.

I've deployed it for my own use but feel free: https://hr.m600.fr

Note:
- 1 request every 5sec max.
- Error 503 if the service is already doing a request.
- Set your timeout fairly high (> 30s), don't forget that it's spawning a Chrome browser in the background.

---

Start using `make run` (need docker). Then:
```
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"123456","action":"in"}'
```

Work if:
- You have a normal login (email/password)
- You have a TOTP on your account and you retrieved the secret (see below)
- Provide either `totp` (pre-generated TOTP code) or `totp_secret` (Base32 secret to generate TOTP)

**No logs will record your TOTP secret, it only live in memory for the time of the request.**

## Quick Start

### Docker (from GitHub Container Registry)

Run directly without cloning the repository:

```bash
docker run -d \
  --name bamboohr-timesheet \
  -p 3000:3000 \
  -e TZ=Europe/Paris \
  ghcr.io/m600x/bamboohr-timesheet:latest
```

Then use the API:

```bash
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"123456","action":"in"}'
```

To stop and remove:

```bash
docker stop bamboohr-timesheet && docker rm bamboohr-timesheet
```

### Docker Compose (local development)

```bash
git clone https://github.com/m600x/bamboohr-timesheet.git
cd bamboohr-timesheet
docker-compose up -d
```

### NPM (local development)

```bash
npm install
node src/api-server.js
```

## API Server

### Endpoints

```bash
# Health check
curl http://localhost:3000/

# Clock in
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"123456","action":"in"}'

# Clock out
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"123456","action":"out"}'

# Toggle state
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"123456","action":"toggle"}'

# Check current status (no action field)
curl -X POST http://localhost:3000/automation \
  -H "Content-Type: application/json" \
  -d '{"instance":"your_company","user":"email@example.com","pass":"password","totp":"123456"}'
```

### Request Body Schema

| Field | Required | Description |
|-------|----------|-------------|
| `instance` | Yes | BambooHR instance name (e.g., `umbrella` for `https://umbrella.bamboohr.com`) |
| `user` | Yes | BambooHR email address |
| `pass` | Yes | BambooHR password |
| `totp` or `totp_secret` | Yes* | TOTP secret key (Base32 encoded). Provide at least one. `totp_secret` will be used to generate TOTP code. `totp` is used directly if provided. |
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
  "errors": ["instance is required", "user is required", "pass is required", "totp or totp_secret is required"]
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
bamboohr-timesheet/
├── src/
│   ├── api-server.js      # Express API server
│   ├── automation.js      # Puppeteer automation logic
│   └── utils.js           # Shared utilities
├── tests/
│   └── unit/              # Unit tests
├── .github/workflows/     # CI/CD pipelines
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Node.js dependencies
└── README.md              # This file
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