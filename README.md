# BambooHR Time and Attendance automation (Docker X Puppeteer)

Automates BambooHR login and timesheet clock-in/out via Puppeteer.

Useful when the [API](https://documentation.bamboohr.com/reference/add-timesheet-clock-in-entry) is not working even in basic auth and you don't have an API key either.

## Usage

### With Docker


```bash
cp .env.example .env
# Edit the .env with your infos

docker-compose up
```

### Native npm

#### Run with environment variables
```bash
export LOGIN_USER=email@example.com
export LOGIN_PASS=password
export LOGIN_INSTANCE=your-company
export TOTP_SECRET=JBSWY3DPEHPK3PXP
npm install
npm test
```

## Project Structure

```
bamboohr/
├── index.js           # Main Puppeteer automation script
├── package.json       # Node.js dependencies and scripts
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose configuration
└── README.md          # This file
```

## Requirements

- Node.js 18+ (if launching natively)
- Docker & Docker Compose (if using the docker container)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LOGIN_USER` | Yes | BambooHR email address |
| `LOGIN_PASS` | Yes | BambooHR password |
| `LOGIN_INSTANCE` | Yes | BambooHR instance name (e.g., `umbrella` for `https://umbrella.bamboohr.com`) |
| `TOTP_SECRET` | Yes | TOTP secret key |
| `SCREENSHOT` | No | `0` to disable screenshots, `1` to enable (default: `0`) |

## Workflow

The automation performs these steps in order:

1. **stepLoadBambooHR** - Navigate to the BambooHR instance URL
2. **stepEnableNormalLogin** - Enable normal login form (add `show-normal-login` class)
3. **stepLogin** - Fill email and password, submit form
4. **stepTOTP** - Generate TOTP code locally and submit
5. **stepTrustedBrowser** - Select "Trust this browser" option
6. **stepTimesheet** - Click timesheet clock-in/out button



## TOTP Generation

The `TOTP_SECRET` environment variable contains the Base32-encoded TOTP secret key.

### Getting a TOTP Secret from Existing Authenticator

If you already use an authenticator app, you can extract the secret from the QR code URL:
```
otpauth://totp/BambooHR:email@example.com?secret=JBSWY3DPEHPK3PXP&issuer=BambooHR
```
Extract the value after `secret=`.
