import {spawn} from "node:child_process"
import "dotenv/config"

const RTMP_URL = process.env.RTMP_URL

if (!RTMP_URL) {
    console.error("ERROR: RTMP_URL environment variable is required")
    process.exit(1)
}

// Video settings
const WIDTH = 1920
const HEIGHT = 1080
const FPS = 30
const BITRATE = 12_000_000

let stopping = false

function spawnStreamer() {
    const camArgs = [
        "--width", String(WIDTH),
        "--height", String(HEIGHT),
        "--framerate", String(FPS),
        "--shutter", "20000",
        "--rotation", "180",

        "--codec", "h264",
        "--bitrate", String(BITRATE),
        "--intra", "60",
        "--inline",

        "--denoise", "cdn_fast",
        "--sharpness", "1.2",
        "--contrast", "1.1",
        "--saturation", "1.05",

        "-t", "0",
        "-o", "-",
    ]

    const cam = spawn("rpicam-vid", camArgs, {stdio: ["ignore", "pipe", "pipe"]})

    const ffArgs = [
        "-hide_banner",
        "-loglevel", "warning",
        "-fflags", "+genpts",
        "-use_wallclock_as_timestamps", "1",
        "-thread_queue_size", "1024",
        "-f", "h264",
        "-i", "pipe:0",

        "-c:v", "copy",
        "-b:v", "12000k",
        "-maxrate", "14000k",
        "-bufsize", "28000k",
        "-g", "60",

        "-pix_fmt", "yuv420p",
        "-an",
        "-f", "flv",
        RTMP_URL,
    ]

    const ff = spawn("ffmpeg", ffArgs, {stdio: ["pipe", "inherit", "inherit"]})

    cam.stdout.pipe(ff.stdin)

    cam.stderr.on("data", (d) => {
        const msg = d.toString()
        // rpicam outputs frame stats to stderr - only treat actual errors as errors
        if (/error|fail|fatal|cannot/i.test(msg)) {
            process.stderr.write(`[rpicam] ${msg}`)
        } else {
            process.stdout.write(`[rpicam] ${msg}`)
        }
    })

    const restart = (why, code) => {
        if (stopping) return
        console.error(`\n[stream] ${why} (code=${code ?? "?"}) — reiniciando em 2s...\n`)
        try {
            cam.kill("SIGTERM")
        } catch {
        }
        try {
            ff.kill("SIGTERM")
        } catch {
        }
        setTimeout(spawnStreamer, 2000)
    }

    cam.on("close", (code) => restart("rpicam-vid encerrou", code))
    ff.on("close", (code) => restart("ffmpeg encerrou", code))

    return {cam, ff}
}

const procs = spawnStreamer()

function gracefulShutdown() {
    stopping = true
    try {
        procs.cam.kill("SIGTERM")
    } catch {
    }
    try {
        procs.ff.kill("SIGTERM")
    } catch {
    }
    process.exit(0)
}

process.on("SIGINT", gracefulShutdown)
process.on("SIGTERM", gracefulShutdown)
