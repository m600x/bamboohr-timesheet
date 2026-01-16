const puppeteer = require('puppeteer');
const { generateTOTP } = require('../../src/utils');
const { runAutomation } = require('../../src/automation');

// Mock puppeteer
jest.mock('puppeteer');

// Mock generateTOTP
jest.mock('../../src/utils', () => ({
    ...jest.requireActual('../../src/utils'),
    generateTOTP: jest.fn().mockResolvedValue('123456')
}));

describe('automation', () => {
    let mockPage;
    let mockBrowser;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock page with all required methods
        mockPage = {
            goto: jest.fn().mockResolvedValue(),
            url: jest.fn().mockReturnValue('https://testcompany.bamboohr.com/login'),
            waitForSelector: jest.fn().mockResolvedValue(),
            evaluate: jest.fn().mockResolvedValue(),
            type: jest.fn().mockResolvedValue(),
            setViewport: jest.fn().mockResolvedValue(),
            waitForFunction: jest.fn().mockResolvedValue(),
            keyboard: {
                press: jest.fn().mockResolvedValue()
            }
        };

        // Create mock browser
        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn().mockResolvedValue()
        };

        // Setup puppeteer.launch to return mock browser
        puppeteer.launch.mockResolvedValue(mockBrowser);
    });

    describe('runAutomation', () => {
        const validPayload = {
            instance: 'testcompany',
            user: 'user@example.com',
            pass: 'password123',
            totp: 'SECRETKEY',
            action: 'in'
        };

        it('should launch browser with correct options', async () => {
            // Mock clocked-out state (can clock in)
            mockPage.evaluate.mockResolvedValueOnce() // stepEnableNormalLogin
                .mockResolvedValueOnce() // stepLogin form submit
                .mockResolvedValueOnce() // stepTrustedBrowser click
                .mockResolvedValueOnce('my-info-timesheet-clock-in') // stepCurrentState - clocked out
                .mockResolvedValueOnce(); // stepTimesheet click

            await runAutomation(validPayload);

            expect(puppeteer.launch).toHaveBeenCalledWith({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        });

        it('should set viewport to 1280x800', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in')
                .mockResolvedValueOnce();

            await runAutomation(validPayload);

            expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1280, height: 800 });
        });

        it('should navigate to correct BambooHR URL', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in')
                .mockResolvedValueOnce();

            await runAutomation(validPayload);

            expect(mockPage.goto).toHaveBeenCalledWith(
                'https://testcompany.bamboohr.com',
                { waitUntil: 'domcontentloaded', timeout: 10000 }
            );
        });

        it('should throw error when redirected to BambooHR home page', async () => {
            mockPage.url.mockReturnValue('https://bamboohr.com/');

            await expect(runAutomation(validPayload)).rejects.toThrow(
                'Instance failed to load, check if the name is correct'
            );
        });

        it('should throw error when redirected to www.bamboohr.com', async () => {
            mockPage.url.mockReturnValue('https://www.bamboohr.com/');

            await expect(runAutomation(validPayload)).rejects.toThrow(
                'Instance failed to load, check if the name is correct'
            );
        });

        it('should throw error when login form is not found', async () => {
            mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));

            await expect(runAutomation(validPayload)).rejects.toThrow(
                'Instance failed to load, the form was not found'
            );
        });

        it('should type credentials into login form', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in')
                .mockResolvedValueOnce();

            await runAutomation(validPayload);

            expect(mockPage.type).toHaveBeenCalledWith('#lemail', 'user@example.com');
            expect(mockPage.type).toHaveBeenCalledWith('#password', 'password123');
        });

        it('should throw error on invalid login', async () => {
            mockPage.waitForSelector
                .mockResolvedValueOnce() // form wait
                .mockResolvedValueOnce() // normal login wait
                .mockRejectedValueOnce(new Error('Timeout')); // TOTP input wait fails

            await expect(runAutomation(validPayload)).rejects.toThrow('Login invalid');
        });

        it('should generate and submit TOTP code', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in')
                .mockResolvedValueOnce();

            await runAutomation(validPayload);

            expect(generateTOTP).toHaveBeenCalledWith('SECRETKEY');
            expect(mockPage.type).toHaveBeenCalledWith('input[name="oneTimeCode"]', '123456');
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
        });

        it('should clock in when currently clocked out', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in') // clocked out state
                .mockResolvedValueOnce(); // click to clock in

            const result = await runAutomation({ ...validPayload, action: 'in' });

            expect(result).toEqual({ action: 'in', state: 'clocked-in' });
        });

        it('should not clock in when already clocked in', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-out'); // already clocked in

            const result = await runAutomation({ ...validPayload, action: 'in' });

            expect(result).toEqual({ action: 'in', state: 'clocked-in' });
        });

        it('should clock out when currently clocked in', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-out') // clocked in state
                .mockResolvedValueOnce(); // click to clock out

            const result = await runAutomation({ ...validPayload, action: 'out' });

            expect(result).toEqual({ action: 'out', state: 'clocked-out' });
        });

        it('should not clock out when already clocked out', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in'); // already clocked out

            const result = await runAutomation({ ...validPayload, action: 'out' });

            expect(result).toEqual({ action: 'out', state: 'clocked-out' });
        });

        it('should toggle from clocked-out to clocked-in', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in') // clocked out
                .mockResolvedValueOnce(); // click to toggle

            const result = await runAutomation({ ...validPayload, action: 'toggle' });

            expect(result).toEqual({ action: 'toggle', state: 'clocked-in' });
        });

        it('should toggle from clocked-in to clocked-out', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-out') // clocked in
                .mockResolvedValueOnce(); // click to toggle

            const result = await runAutomation({ ...validPayload, action: 'toggle' });

            expect(result).toEqual({ action: 'toggle', state: 'clocked-out' });
        });

        it('should return status without action when no action specified', async () => {
            mockPage.evaluate.mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce('my-info-timesheet-clock-in'); // clocked out

            const result = await runAutomation({ ...validPayload, action: null });

            expect(result).toEqual({ action: 'status', state: 'clocked-out' });
        });

        it('should always close browser even on error', async () => {
            mockPage.url.mockReturnValue('https://bamboohr.com/');

            await expect(runAutomation(validPayload)).rejects.toThrow();
            expect(mockBrowser.close).toHaveBeenCalled();
        });

        it('should throw error when TOTP submission fails', async () => {
            mockPage.waitForSelector
                .mockResolvedValueOnce() // form wait
                .mockResolvedValueOnce() // normal login wait
                .mockResolvedValueOnce(); // TOTP input wait
            mockPage.waitForFunction.mockRejectedValueOnce(new Error('Timeout'));

            await expect(runAutomation(validPayload)).rejects.toThrow(
                'TOTP submission failed or took too long'
            );
        });
    });
});
