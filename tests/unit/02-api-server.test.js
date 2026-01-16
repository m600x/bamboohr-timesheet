const request = require('supertest');

// Mock fs module before importing app
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue(JSON.stringify({
        version_timestamp: '2026-01-16 14:32:15.847',
        version_hash: 'abc123def456'
    }))
}));

// Mock the automation module before importing app
jest.mock('../../src/automation', () => ({
    runAutomation: jest.fn().mockResolvedValue({ action: 'in', state: 'clocked-in' })
}));

const { app, validateParameters } = require('../../src/api-server');
const { runAutomation } = require('../../src/automation');

describe('API Server', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateParameters', () => {
        it('should return empty array when all required fields are present', () => {
            const body = {
                instance: 'company',
                user: 'user@example.com',
                pass: 'password123',
                totp: 'SECRET'
            };
            const errors = validateParameters(body);
            expect(errors).toEqual([]);
        });

        it('should return error when instance is missing', () => {
            const body = {
                user: 'user@example.com',
                pass: 'password123',
                totp: 'SECRET'
            };
            const errors = validateParameters(body);
            expect(errors).toContain('instance is required');
        });

        it('should return error when user is missing', () => {
            const body = {
                instance: 'company',
                pass: 'password123',
                totp: 'SECRET'
            };
            const errors = validateParameters(body);
            expect(errors).toContain('user is required');
        });

        it('should return error when pass is missing', () => {
            const body = {
                instance: 'company',
                user: 'user@example.com',
                totp: 'SECRET'
            };
            const errors = validateParameters(body);
            expect(errors).toContain('pass is required');
        });

        it('should return error when totp is missing', () => {
            const body = {
                instance: 'company',
                user: 'user@example.com',
                pass: 'password123'
            };
            const errors = validateParameters(body);
            expect(errors).toContain('totp is required');
        });

        it('should return all errors when all fields are missing', () => {
            const errors = validateParameters({});
            expect(errors).toHaveLength(4);
            expect(errors).toContain('instance is required');
            expect(errors).toContain('user is required');
            expect(errors).toContain('pass is required');
            expect(errors).toContain('totp is required');
        });

        it('should return errors for empty string values', () => {
            const body = {
                instance: '',
                user: '',
                pass: '',
                totp: ''
            };
            const errors = validateParameters(body);
            expect(errors).toHaveLength(4);
        });
    });

    describe('GET /health', () => {
        it('should return health status with version info', async () => {
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'ok',
                version_timestamp: '2026-01-16 14:32:15.847',
                version_hash: 'abc123def456'
            });
        });
    });

    describe('POST /automation', () => {
        it('should return 400 when required fields are missing', async () => {
            const response = await request(app)
                .post('/automation')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.errors).toHaveLength(4);
            expect(response.body.requestId).toBeDefined();
        });

        it('should return 400 when some fields are missing', async () => {
            const response = await request(app)
                .post('/automation')
                .send({ instance: 'company' });

            expect(response.status).toBe(400);
            expect(response.body.errors).toHaveLength(3);
            expect(response.body.errors).not.toContain('instance is required');
        });

        it('should return 400 for invalid action', async () => {
            const response = await request(app)
                .post('/automation')
                .send({
                    instance: 'company',
                    user: 'user@example.com',
                    pass: 'password123',
                    totp: 'SECRET',
                    action: 'invalid'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/Invalid action/);
        });

        it('should accept valid actions and call automation', async () => {
            const response = await request(app)
                .post('/automation')
                .send({
                    instance: 'company',
                    user: 'user@example.com',
                    pass: 'password123',
                    totp: 'SECRET',
                    action: 'in'
                });

            expect(response.status).toBe(200);
            expect(response.body.action).toBe('in');
            expect(response.body.state).toBe('clocked-in');
            expect(runAutomation).toHaveBeenCalledWith(expect.objectContaining({
                instance: 'company',
                user: 'user@example.com',
                action: 'in'
            }));
        });

        it('should handle case-insensitive actions', async () => {
            // Wait for cooldown from previous test
            await new Promise(resolve => setTimeout(resolve, 600));
            
            const response = await request(app)
                .post('/automation')
                .send({
                    instance: 'company',
                    user: 'user@example.com',
                    pass: 'password123',
                    totp: 'SECRET',
                    action: 'OUT'
                });

            // Should pass validation (action is lowercased internally)
            expect(response.status).not.toBe(400);
        });

        it('should use provided X-Request-Id header', async () => {
            const customRequestId = 'my-custom-request-id';
            const response = await request(app)
                .post('/automation')
                .set('X-Request-Id', customRequestId)
                .send({});

            expect(response.body.requestId).toBe(customRequestId);
        });

        it('should generate requestId when not provided', async () => {
            const response = await request(app)
                .post('/automation')
                .send({});

            expect(response.body.requestId).toBeDefined();
            expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
        });
    });
});
