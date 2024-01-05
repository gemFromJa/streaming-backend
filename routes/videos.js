var express = require("express");
var fs = require("fs");
var path = require("path");
var multer = require("multer");
const { resolutions } = require("../utils/constants");
const {
    createHLSStream,
    getVideoMetadata,
    addMovieToDB,
    getCurrentMovie,
    getChannels,
} = require("../utils/movie");
// ffmpeg.setFfmpegPath("C:\\ProgramData\\chocolatey\\bin\\ffmpeg");
var upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, "./public/movies/");
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        },
    }),
});
var router = express.Router();

/* GET films listing. */
router.get("/channels", async function (req, res, next) {
    try {
        const channels = getChannels();
        return res.send({ success: true, data: { channels } });
    } catch (error) {
        return res.send({
            success: false,
            error: "Unexpected error occured",
        });
    }
});

/** UPLOAD movie - protect with an API key */
router.post(
    "/",
    (req, res, next) => {
        // not real security - but some jwt implementation would be good
        const key =
            process.env.NODE_ENV === "production"
                ? process.env.API_KEY
                : "password";
        if (req.headers.password !== key) {
            return res.sendStatus(403);
        }
        next();
    },
    upload.single("film"),
    async function (req, res) {
        if (req.file && req.body.name) {
            try {
                let variantPlaylists = [];
                const mp4FileName = req.file.originalname;
                const baseName = `${mp4FileName
                    .replace(".", "_")
                    .replace(/\s+/g, "_")}`;
                const { duration } = await getVideoMetadata(req.file.path);

                // create versions of video for adaptive bitrate
                for (const {
                    resolution,
                    videoBitrate,
                    audioBitrate,
                    bandwidth,
                } of resolutions) {
                    console.log(`HLS conversion starting for ${resolution}`);
                    const outputFileName = `${baseName}_${resolution}.m3u8`;
                    const segmentFileName = `${baseName}_${resolution}_%03d.ts`;

                    await createHLSStream({
                        filePath: req.file.path,
                        videoBitrate,
                        audioBitrate,
                        resolution,
                        segmentTargetFile: segmentFileName,
                        outputTargetFile: outputFileName,
                    });

                    const variantPlaylist = {
                        resolution,
                        outputFileName,
                        bandwidth,
                    };
                    variantPlaylists.push(variantPlaylist);
                    console.log(`HLS conversion done for ${resolution}`);
                }

                // generate masterplaylist that points to all other playlists
                let masterPlaylist = variantPlaylists
                    .map((variantPlaylist) => {
                        const { resolution, outputFileName, bandwidth } =
                            variantPlaylist;

                        return `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n${outputFileName}`;
                    })
                    .join("\n");
                masterPlaylist = `#EXTM3U\n` + masterPlaylist;

                const masterPlaylistFileName = `${baseName}_master.m3u8`;
                const masterPlaylistPath = path.join(
                    path.resolve(__dirname, `../public/movies/`),
                    masterPlaylistFileName
                );

                // could save these to S3 or something fancy like that

                // save masterplaylist to disc
                fs.writeFileSync(masterPlaylistPath, masterPlaylist);

                addMovieToDB({
                    name: req.body.name,
                    duration,
                    url: new URL(
                        `${req.protocol}://${req.get(
                            "host"
                        )}/movies/${masterPlaylistFileName}`
                    ),
                });

                // remove uploaded mp4 file
                fs.unlinkSync(req.file.path);
                console.log("Sent file removed");

                return res
                    .status(200)
                    .send({ success: true, data: "file uploaded" });
            } catch (error) {
                console.log("ERROR: ", error);
                return res.status(500).send({
                    success: false,
                    error: "catastrophic failure. everything is on fire",
                });
            }
        } else {
            return res.send({
                success: false,
                error: !req.body.name ? "Missing movie name" : "upload a file",
            });
        }
    }
);

/** GET current position of movie showing on channel */
router.get("/:channel_id/offset", function (req, res, next) {
    const { channel_id } = req.params;

    if (isNaN(Number(channel_id))) {
        return res.send({ error: "Not a valid channel id" });
    }

    try {
        const movie = getCurrentMovie(channel_id);

        return res.send({ data: { movie } });
    } catch (error) {
        return res.send({
            success: false,
            error: "Unexpected error occured",
        });
    }
});

module.exports = router;
