const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function log(message) {
    const store = asyncLocalStorage.getStore();
    const requestId = store ? store.requestId : '-';
    const now = new Date();
    const time = now.toISOString().slice(11, 23);
    console.error(`[${time}] [${requestId}] ${message}`);
}

function generateTOTP(totpSecret) {
    return new Promise((resolve, reject) => {
        const { execFile } = require('child_process');
        execFile('oathtool', ['--totp', '-b', totpSecret], (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

function generateRequestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function runWithRequestId(requestId, fn) {
    return asyncLocalStorage.run({ requestId }, fn);
}

module.exports = {
    log,
    generateTOTP,
    generateRequestId,
    runWithRequestId
};