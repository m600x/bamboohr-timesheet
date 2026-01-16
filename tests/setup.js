// Silence console.log during tests - the app uses console.log for logging
// which is expected behavior, not actual errors
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    console.log.mockRestore();
});
