const json = require("@rollup/plugin-json");

module.exports = args =>
  args.configDefaultConfig.map(config => {
    config.plugins.push(json());
    return config;
  });
