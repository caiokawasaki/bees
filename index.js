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
const FPS = 20
const SHUTTER = 80_000
const BITRATE = 6_000_000

let stopping = false

function spawnStreamer() {
    const camArgs = [
        "--width", String(WIDTH),
        "--height", String(HEIGHT),
        "--framerate", String(FPS),
        "--shutter", String(SHUTTER),
        "--rotation", "180",

        "--codec", "h264",
        "--profile", "high",
        "--bitrate", String(BITRATE),
        "--intra", String(FPS * 2),
        "--inline",

        "--denoise", "cdn_hq",
        "--contrast", "1.05",
        "--sharpness", "1.0",
        "--saturation", "0.9",

        "--awb", "auto",
        "--metering", "average",

        "--autofocus-mode", "continuous",
        "--autofocus-range", "normal",
        "--autofocus-speed", "normal",
        "--autofocus-window", "0.40,0.40,0.20,0.20",

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
        "-an",

        "-g", String(FPS * 2),

        "-f", "flv",
        RTMP_URL,
    ]

    const ff = spawn("ffmpeg", ffArgs, {stdio: ["pipe", "inherit", "inherit"]})

    cam.stdout.pipe(ff.stdin)

    cam.stderr.on("data", (d) => {
        const msg = d.toString()
        // rpicam outputs frame stats to stderr - only log actual errors, skip frame stats
        if (/error|fail|fatal|cannot/i.test(msg)) {
            process.stderr.write(`[rpicam] ${msg}`)
        }
        // Frame stats (fps, exposure, gain) are discarded - too verbose
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
