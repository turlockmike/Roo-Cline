function fastGlob(patterns, options) {
    return Promise.resolve([]);
}

fastGlob.sync = function(patterns, options) {
    return [];
}

module.exports = fastGlob;
module.exports.default = fastGlob; 