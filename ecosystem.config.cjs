require("dotenv").config()

const APP_DIR = process.env.APP_DIR || (() => {
    throw new Error("APP_DIR environment variable is required. Set it in your .env file or export it before running PM2.")
})()

module.exports = {
    apps: [
        {
            name: "camera-stream",
            script: "./index.js",
            cwd: APP_DIR,

            autorestart: true,
            restart_delay: 2000,
            max_restarts: 50,

            out_file: "./logs/camera-stream.out.log",
            error_file: "./logs/camera-stream.err.log",
            time: true,
        },
    ],
};