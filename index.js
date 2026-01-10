const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let browser;
let stepCounter = 0;
let resultsDir = '';

const shouldScreenshot = process.env.SCREENSHOT === '1';
const loginInstance = process.env.LOGIN_INSTANCE;
const bambooHrUrl = loginInstance ? `https://${loginInstance}.bamboohr.com` : null;

function log(message) {
  const now = new Date();
  const time = now.toISOString().slice(11, 23);
  console.log(`[${time}] ${message}`);
}

async function takeScreenshot(page, testName) {
  if (!shouldScreenshot) {
    return;
  }

  stepCounter++;
  const filepath = path.join(resultsDir, `${stepCounter}-${testName}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function stepLoadBambooHR(page) {
  await page.goto(bambooHrUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 10000
  });
  await page.waitForSelector('form', { timeout: 10000 });
  await takeScreenshot(page, 'stepLoadBambooHR');

  log('BambooHR loaded.');
}

async function stepEnableNormalLogin(page) {
  await takeScreenshot(page, 'stepEnableNormalLogin-before');
  await page.evaluate(() => {
    const loginForm = document.querySelector('form[name="loginform"]');
    if (loginForm && !loginForm.classList.contains('show-normal-login')) {
      loginForm.classList.add('show-normal-login');
    }
  });
  await page.waitForSelector('form[name="loginform"].show-normal-login #lemail', { timeout: 5000 });
  await takeScreenshot(page, 'stepEnableNormalLogin-after');

  log('Normal login option enabled');
}

async function stepLogin(page) {
  await takeScreenshot(page, 'stepLogin-before');
  await page.type('#lemail', process.env.LOGIN_USER);
  await page.type('#password', process.env.LOGIN_PASS);
  await takeScreenshot(page, 'stepLogin-filled');

  await page.evaluate(() => {
    const form = document.querySelector('form[name="loginform"]');
    if (form)
      form.submit();
  });
  await page.waitForSelector('input[name="oneTimeCode"]', { timeout: 10000 });
  await takeScreenshot(page, 'stepLogin-after');

  log('Login form submitted.');
}

async function fetchTotp() {
  return new Promise((resolve, reject) => {
    const { execFile } = require('child_process');
    execFile('oathtool', ['--totp', '-b', process.env.TOTP_SECRET], (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function stepTOTP(page) {
  const totpCode = await fetchTotp();

  await page.type('input[name="oneTimeCode"]', totpCode);
  await takeScreenshot(page, 'stepTOTP-filled');

  const currentUrl = page.url();

  await page.keyboard.press('Enter');

  try {
    await page.waitForFunction(url => window.location.href !== url, { timeout: 10000 }, currentUrl);
  } catch {
    throw new Error('TOTP submission failed or took too long');
  }
  await takeScreenshot(page, 'stepTOTP-submitted');
  log('TOTP submitted.');
}

async function stepTrustedBrowser(page) {
  await takeScreenshot(page, 'stepTrustedBrowser-before-submit');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[class*="MuiButton-containedPrimary"]'));
    if (buttons.length > 0) {
      buttons[0].click();
    }
  });
  await page.waitForSelector('[data-bi-id*="my-info-timesheet-clock-"]', { timeout: 15000 });
  await takeScreenshot(page, 'stepTrustedBrowser-after-submitted');
  log('Trusted browser selected.');
}

async function stepTimesheet(page) {
  await page.waitForSelector('[class*="MuiButton-containedPrimary"]', { timeout: 30000 });

  const currentButton = await page.evaluate(() => {
    const buttons = document.querySelectorAll('[class*="MuiButton-containedPrimary"]');
    return buttons[0]?.getAttribute('data-bi-id') || '';
  });

  const canClockIn = currentButton.includes('clock-in');
  const currentState = canClockIn ? 'clock-in' : 'clock-out';

  const targetStateId = canClockIn ? 'clock-out' : 'clock-in';
  
  await takeScreenshot(page, `stepTimesheet-before-${currentState}`);

  await page.evaluate(() => {
    const buttons = document.querySelectorAll('[class*="MuiButton-containedPrimary"]');
    if (buttons[0]) buttons[0].click();
  });
  await page.waitForFunction(
    (expectedState) => {
      const buttons = document.querySelectorAll('[class*="MuiButton-containedPrimary"]');
      if (buttons[0] && buttons[0].getAttribute('data-bi-id')) {
        return buttons[0].getAttribute('data-bi-id').includes(expectedState);
      }
      return false;
    },
    { timeout: 10000 },
    targetStateId
  );
  await takeScreenshot(page, 'stepTimesheet-after');
  log('Clocked ' + (canClockIn ? 'in' : 'out') + '.');
}

async function main() {
  const startTime = Date.now();

  if (!process.env.LOGIN_USER || !process.env.LOGIN_PASS) {
    log('LOGIN_USER and LOGIN_PASS environment variables must be set');
    process.exit(1);
  }

  if (!process.env.TOTP_SECRET) {
    log('TOTP_SECRET environment variable must be set');
    process.exit(1);
  }

  if (!bambooHrUrl) {
    log('LOGIN_INSTANCE environment variable must be set');
    process.exit(1);
  }

  log('Starting BambooHR timesheet (screenshot: ' + (shouldScreenshot ? 'enabled' : 'disabled') + ')');

  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  if (shouldScreenshot) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    resultsDir = path.join(__dirname, `results_${timestamp}`);
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  try {
    const page = await browser.newPage();
    await stepLoadBambooHR(page);
    await stepEnableNormalLogin(page);
    await stepLogin(page);
    await stepTOTP(page);
    await stepTrustedBrowser(page);
    await stepTimesheet(page);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log('All steps completed successfully in: ' + totalTime + 's');
  } catch (error) {
    log('Step FAILED: ' + error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();