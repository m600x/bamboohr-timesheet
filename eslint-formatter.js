module.exports = function(results) {
    let output = '';
    let errorCount = 0;
    let warningCount = 0;

    results.forEach(result => {
        const relativePath = result.filePath.replace(process.cwd() + '/', '');
        const errors = result.errorCount;
        const warnings = result.warningCount;

        errorCount += errors;
        warningCount += warnings;

        if (errors > 0) {
            output += `✗ ${relativePath} (${errors} error${errors > 1 ? 's' : ''})\n`;
            result.messages.forEach(msg => {
                output += `    ${msg.line}:${msg.column}  ${msg.severity === 2 ? 'error' : 'warning'}  ${msg.message}  ${msg.ruleId || ''}\n`;
            });
        } else if (warnings > 0) {
            output += `⚠ ${relativePath} (${warnings} warning${warnings > 1 ? 's' : ''})\n`;
            result.messages.forEach(msg => {
                output += `    ${msg.line}:${msg.column}  warning  ${msg.message}  ${msg.ruleId || ''}\n`;
            });
        } else {
            output += `✓ ${relativePath}\n`;
        }
    });

    output += '\n';
    if (errorCount > 0 || warningCount > 0) {
        output += `Total: ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}\n`;
    } else {
        output += `All ${results.length} files passed\n`;
    }

    return output;
};
