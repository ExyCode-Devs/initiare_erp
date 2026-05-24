module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "axiom-prime",
      script: "node",
      args: ".output/server/index.mjs",
      cwd: process.env.APP_DIR || process.cwd(),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: process.env.HOST || "0.0.0.0",
        PORT: process.env.PORT || "3000",
      },
    },
  ],
};
