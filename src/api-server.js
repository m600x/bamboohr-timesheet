const express = require('express');
const fs = require('fs');
const path = require('path');
const { runAutomation } = require('./automation');
const { log, generateRequestId, runWithRequestId } = require('./utils');

const CONFIG = {
    PORT: process.env.PORT || 3000,
    REQUEST_COOLDOWN: 5000,
};

const ctx = {
    lastRequestTime: 0,
    isProcessing: false,
};

// Load version info at startup
let versionInfo = {
    version_timestamp: null,
    version_hash: null
};

try {
    const versionPath = path.join(__dirname, '..', 'version');
    const versionData = fs.readFileSync(versionPath, 'utf8');
    versionInfo = JSON.parse(versionData);
    log(`Version loaded: ${versionInfo.version_hash?.substring(0, 7)} (${versionInfo.version_timestamp})`);
} catch (err) {
    log(`Version file not found or invalid, using defaults: ${err.message}`);
}

const app = express();
app.use(express.json());

function validateParameters(body) {
    const errors = [];
    if (!body.instance)
        errors.push('instance is required');
    if (!body.user)
        errors.push('user is required');
    if (!body.pass)
        errors.push('pass is required');
    if (!body.totp)
        errors.push('totp is required');
    return errors;
}

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        version_timestamp: versionInfo.version_timestamp,
        version_hash: versionInfo.version_hash
    });
});

app.post('/automation', async (req, res) => {
    const now = Date.now();
    const requestId = req.headers['x-request-id'] || generateRequestId();

    await runWithRequestId(requestId, async () => {
        log(`Request received`);
        
        const errors = validateParameters(req.body);
        if (errors.length > 0) {
            log(`Validation failed: ${errors.join(', ')}`);
            return res.status(400).json({
                requestId: requestId,
                errors
            });
        }
        log(`Required parameters present`);
        
        const action = req.body.action?.toLowerCase() || null;
        const validActions = ['in', 'out', 'toggle'];
        if (action && !validActions.includes(action)) {
            log(`Invalid action: ${action}`);
            return res.status(400).json({
                requestId: requestId,
                error: `Invalid action. Valid actions: ${validActions.join(', ')}`
            });
        }
        log(`Action requested: `, action === null ? 'status check' : action);

        if (ctx.isProcessing || now - ctx.lastRequestTime < CONFIG.REQUEST_COOLDOWN) {
            log(`Server busy`);
            return res.status(503).json({
                requestId: requestId,
                error: 'Server busy, try again later'
            });
        }
        log(`Processing request`);

        ctx.isProcessing = true;
        ctx.lastRequestTime = Date.now();

        try {
            const result = await runAutomation(req.body);
            res.json({
                requestId: requestId,
                action: result.action,
                state: result.state
            });
        } catch (error) {
            log(`Error: ${error.message}`);
            res.status(500).json({
                requestId: requestId,
                error: error.message
            });
        } finally {
            log(`Request processing completed`);
            ctx.isProcessing = false;
        }
    });
});

/* istanbul ignore next */
if (require.main === module) {
    app.listen(CONFIG.PORT, () => {
        log(`BambooHR Timesheet API running on port ${CONFIG.PORT}`);
    });
}

module.exports = { app, validateParameters };