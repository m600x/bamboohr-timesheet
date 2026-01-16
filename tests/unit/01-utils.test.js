const { generateRequestId, runWithRequestId, log } = require('../../src/utils');

describe('utils', () => {
    describe('generateRequestId', () => {
        it('should generate a valid UUID v4 format', () => {
            const id = generateRequestId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
            expect(id).toMatch(uuidRegex);
        });

        it('should generate unique IDs on each call', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateRequestId());
            }
            expect(ids.size).toBe(100);
        });

        it('should always have version 4 indicator', () => {
            for (let i = 0; i < 10; i++) {
                const id = generateRequestId();
                expect(id.charAt(14)).toBe('4');
            }
        });

        it('should have valid variant bits (8, 9, a, or b)', () => {
            for (let i = 0; i < 10; i++) {
                const id = generateRequestId();
                expect(['8', '9', 'a', 'b']).toContain(id.charAt(19));
            }
        });
    });

    describe('runWithRequestId', () => {
        it('should execute the provided function', async () => {
            const mockFn = jest.fn().mockResolvedValue('result');
            const result = await runWithRequestId('test-id', mockFn);
            expect(mockFn).toHaveBeenCalled();
            expect(result).toBe('result');
        });

        it('should handle synchronous functions', async () => {
            const mockFn = jest.fn().mockReturnValue('sync-result');
            const result = await runWithRequestId('test-id', mockFn);
            expect(result).toBe('sync-result');
        });

        it('should propagate errors from the function', async () => {
            const error = new Error('Test error');
            const mockFn = jest.fn().mockRejectedValue(error);
            await expect(runWithRequestId('test-id', mockFn)).rejects.toThrow('Test error');
        });
    });

    describe('log', () => {
        beforeEach(() => {
            console.log.mockClear();
        });

        it('should log message with timestamp and default request ID', () => {
            log('Test message');
            expect(console.log).toHaveBeenCalled();
            const logOutput = console.log.mock.calls[0][0];
            expect(logOutput).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[-\] Test message$/);
        });

        it('should log with request ID when inside runWithRequestId context', async () => {
            await runWithRequestId('my-request-123', () => {
                log('Contextual message');
            });
            expect(console.log).toHaveBeenCalled();
            const logOutput = console.log.mock.calls[0][0];
            expect(logOutput).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[my-request-123\] Contextual message$/);
        });
    });
});
