const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
    sort(tests) {
        // Sort alphabetically by test path to ensure consistent order
        return [...tests].sort((a, b) => a.path.localeCompare(b.path));
    }
}

module.exports = CustomSequencer;
