const puppeteer = require('puppeteer');
const { log, generateTOTP } = require('./utils');

const SELECTORS = {
    PRIMARY_BUTTON: '[class*="MuiButton-containedPrimary"]',
    TIMESHEET_CLOCK: '[data-bi-id*="my-info-timesheet-clock-"]',
    LOGIN_FORM: 'form[name="loginform"]',
    EMAIL_INPUT: '#lemail',
    PASSWORD_INPUT: '#password',
    TOTP_INPUT: 'input[name="oneTimeCode"]',
};

async function stepLoadBamboohr(page, instance) {
    const bambooHrUrl = `https://${instance}.bamboohr.com`;
    await page.goto(bambooHrUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
    });
    const landedUrl = page.url();
    if (landedUrl === 'https://bamboohr.com/' || landedUrl === 'https://www.bamboohr.com/') {
        log(`Instance ${instance} failed to load, redirected to BambooHR home page (${landedUrl})`);
        throw new Error(`Instance [${instance}] failed to load, check if the name is correct`);
    }
    log(`BambooHR loaded`);
    try {
        await page.waitForSelector('form', { timeout: 2000 });
        log(`Instance ${instance} loaded`);
    } catch {
        throw new Error(`Instance ${instance} failed to load, the form was not found`);
    }
}

async function stepEnableNormalLogin(page) {
    await page.evaluate((field) => {
        const loginForm = document.querySelector(field);
        if (loginForm && !loginForm.classList.contains('show-normal-login')) {
            loginForm.classList.add('show-normal-login');
        }
    }, SELECTORS.LOGIN_FORM);
    try {
        await page.waitForSelector(`${SELECTORS.LOGIN_FORM}.show-normal-login ${SELECTORS.EMAIL_INPUT}`, { timeout: 5000 });
        log('Normal login enabled');
    } catch {
        throw new Error('Failed to enable normal login option');
    }
}

async function stepLogin(page, user, pass) {
    await page.type(SELECTORS.EMAIL_INPUT, user);
    await page.type(SELECTORS.PASSWORD_INPUT, pass);
    await page.evaluate((field) => {
        const form = document.querySelector(field);
        if (form)
            form.submit();
    }, SELECTORS.LOGIN_FORM);
    try {
        await page.waitForSelector(SELECTORS.TOTP_INPUT, { timeout: 20000 });
        log('Login form submitted');
    } catch {
        throw new Error('Login invalid');
    }
}

async function stepTOTP(page, totpSecret) {
    const totpCode = await generateTOTP(totpSecret);
    await page.type(SELECTORS.TOTP_INPUT, totpCode);
    const currentUrl = page.url();
    await page.keyboard.press('Enter');
    try {
        await page.waitForFunction(url => window.location.href !== url, { timeout: 10000 }, currentUrl);
        log('TOTP submitted');
    } catch {
        throw new Error('TOTP submission failed or took too long');
    }
}

async function stepTrustedBrowser(page) {
    await page.evaluate((field) => {
        const buttons = Array.from(document.querySelectorAll(field));
        if (buttons.length > 0) buttons[0].click();
    }, SELECTORS.PRIMARY_BUTTON);
    log('Trusted browser selected');
    try {
        await page.waitForSelector(SELECTORS.TIMESHEET_CLOCK, { timeout: 150000 });
        log('Logged in');
    } catch {
        throw new Error('Login process failed or took too long');
    }
}

async function stepCurrentState(page) {
    await page.waitForSelector(SELECTORS.PRIMARY_BUTTON, { timeout: 10000 });
    const buttonId = await page.evaluate((field) => {
        const buttons = document.querySelectorAll(field);
        return buttons[0]?.getAttribute('data-bi-id') || '';
    }, SELECTORS.PRIMARY_BUTTON);
    const canClockIn = buttonId.includes('clock-in');
    return canClockIn ? 'clocked-out' : 'clocked-in';
}

async function stepTimesheet(page, currentState) {
    await page.evaluate((field) => {
        const buttons = document.querySelectorAll(field);
        if (buttons[0]) buttons[0].click();
    }, SELECTORS.PRIMARY_BUTTON);
    await page.waitForFunction(
        (expectedState, field) => {
            const buttons = document.querySelectorAll(field);
            if (buttons[0] && buttons[0].getAttribute('data-bi-id')) {
                return buttons[0].getAttribute('data-bi-id').includes(expectedState);
            }
            return false;
        },
        { timeout: 20000 },
        currentState === 'clocked-in' ? 'clock-in' : 'clock-out',
        SELECTORS.PRIMARY_BUTTON
    );
    log(`Clocked ${currentState === 'clocked-in' ? 'out' : 'in'}`);
}

async function runAutomation(payload) {
    let browser = null;

    log('Starting automation');

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        await stepLoadBamboohr(page, payload.instance);
        await stepEnableNormalLogin(page);
        await stepLogin(page, payload.user, payload.pass);
        await stepTOTP(page, payload.totp);
        await stepTrustedBrowser(page);

        const currentState = await stepCurrentState(page);
        log(`Current state: ${currentState}`);

        let newState = currentState;
        switch (payload.action) {
            case 'in':
                log('Processing clock-in action');
                if (currentState === 'clocked-out') {
                    await stepTimesheet(page, currentState);
                    newState = 'clocked-in';
                }
                else {
                    log('Already clocked in, no action taken');
                }
                break;
            case 'out':
                log('Processing clock-out action');
                if (currentState === 'clocked-in') {
                    await stepTimesheet(page, currentState);
                    newState = 'clocked-out';
                }
                else {
                    log('Already clocked out, no action taken');
                }
                break;
            case 'toggle':
                await stepTimesheet(page, currentState);
                newState = currentState === 'clocked-in' ? 'clocked-out' : 'clocked-in';
                break;
            default:
                log('No action taken, status check only, returning current state: ', currentState);
                return {
                    action: 'status',
                    state: currentState
                };
        }
        if (currentState != newState) {
            log(`State changed from ${currentState} to ${newState}`);
        }
        return {
            action: payload.action,
            state: newState
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = {
    runAutomation
};