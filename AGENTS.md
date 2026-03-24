# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

BambooHR Time and Attendance Automation — a Node.js Express API that uses Puppeteer (headless Chrome) to automate BambooHR clock-in/clock-out. See `README.md` for full API docs.

### Development commands

Standard commands are in `package.json` scripts and `Makefile`:

- **Install deps:** `npm install`
- **Lint:** `npm run lint`
- **Unit tests:** `npm test` (Jest; all browser/TOTP interactions are mocked — no Chromium or network needed)
- **Run server:** `PUPPETEER_EXECUTABLE_PATH=$(which google-chrome) node src/api-server.js` (port 3000)

### Non-obvious caveats

- **Puppeteer executable path:** The VM has Google Chrome at `/usr/local/bin/google-chrome`, not Chromium. Set `PUPPETEER_EXECUTABLE_PATH=$(which google-chrome)` when starting the server. Without this, Puppeteer will try its bundled Chromium (downloaded into `node_modules`) which may or may not work depending on the install.
- **oathtool:** Required at runtime only when a request includes `totp_secret` (to generate TOTP codes). Already installed at `/usr/bin/oathtool`. Unit tests mock this dependency.
- **Version file:** The app reads a `version` file at startup for build metadata. It gracefully handles a missing file — no action needed.
- **Node.js version:** The project targets Node.js 20 (per CI and Dockerfile). Use `nvm use 20` if the default version differs.
- **End-to-end testing limitation:** Real automation requires valid BambooHR credentials (`instance`, `user`, `pass`, `totp`/`totp_secret`). Without credentials, you can verify the full pipeline up to the login step (Puppeteer launches Chrome, navigates to BambooHR, and reports "Login invalid").
- **Cooldown:** The server enforces a 5-second cooldown between `/automation` requests (returns 503). Keep this in mind when testing multiple requests in sequence.
