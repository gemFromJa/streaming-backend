var ffmpeg = require("fluent-ffmpeg");
var fs = require("fs");
var path = require("path");

async function createHLSStream({
    filePath,
    outputTargetFile,
    segmentTargetFile,
    videoBitrate,
    audioBitrate,
    resolution,
}) {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .outputOptions([
                `-c:v h264`,
                `-b:v ${videoBitrate}`,
                `-c:a aac`,
                `-b:a ${audioBitrate}`,
                `-vf scale=${resolution}`,
                `-f hls`,
                `-sc_threshold 0`,
                `-hls_playlist_type vod`,
                `-hls_time 10`,
                `-hls_list_size 0`,
                `-hls_segment_filename ${path.join(
                    path.resolve(__dirname, "..", "public", "movies"),
                    segmentTargetFile
                )}`,
            ])
            .output(
                path.join(
                    path.resolve(__dirname, "..", "public", "movies"),
                    outputTargetFile
                )
            )
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
    });
}

const getVideoMetadata = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath).ffprobe((err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            if (
                !(
                    metadata &&
                    metadata.streams &&
                    metadata.format &&
                    metadata.format.duration
                )
            ) {
                reject(new Error(`Fail to parse metadata`));
                return;
            }
            const video = metadata.streams.find(
                (s) => s.codec_type === "video"
            );
            if (!video) {
                reject(new Error(`No video stream found`));
                return;
            }

            const duration = metadata.format.duration;
            resolve({ duration });
        });
    });
};

/**
 *
 * @returns {Object} schedule
 * @param {Object} schedule.channel
 */
function getSchedule() {
    const filePath = path.join(__dirname, "./schedule.json");
    const schedule = JSON.parse(fs.readFileSync(filePath));
    return schedule;
}

function saveShedule(data) {
    const filePath = path.join(__dirname, "./schedule.json");
    fs.writeFileSync(filePath, JSON.stringify(data));
}

/**
 *
 * @param {Object} param
 * @property {String} param.name
 * @property {String} param.url
 * @property {number} param.duration - film length in seconds
 */
function addMovieToDB({ name, duration, url }) {
    const schedule = getSchedule();

    schedule.movies.push({ name, duration, url });

    const newFilmIndex = schedule.movies.length;
    const entry = { index: newFilmIndex - 1, duration };

    schedule.channel[1].order.push(entry);
    schedule.channel[2].order.unshift(entry);

    saveShedule(schedule);
}

function getChannels() {
    const schedule = getSchedule();
    const channels = Object.keys(schedule.channel);

    return channels;
}

// get movie info
function getCurrentMovie(channel_id) {
    const schedule = getSchedule();
    const channel = schedule.channel[channel_id];

    if (!channel) {
        throw new Error("Unknown channel");
    }

    // calculate current movie
    const channel_start_date = new Date(channel.created);
    const elapsed_time_in_seconds =
        Math.abs(new Date() - channel_start_date) / 1000;
    const all_programs_length = channel.order?.reduce(
        (sum, programme) => sum + programme.duration,
        0
    );

    // find how much of the loop/program is done
    const remaining_time_in_schedule =
        elapsed_time_in_seconds % all_programs_length;

    // this `schedule_part_reached` will be a ratio to check what segment of the schedule we are currently in
    let schedule_part_reached = 0;
    // find the film that is currently playing in this version of the loop
    let currentProgram = channel.order.find((programme) => {
        schedule_part_reached += programme.duration;

        return schedule_part_reached > remaining_time_in_schedule;
    });

    if (!currentProgram) null;

    // calculate the difference between the time left in the loop and the previous film to see
    // time elapsed in current film
    const currentOffset =
        remaining_time_in_schedule -
        (schedule_part_reached - currentProgram.duration);
    return {
        currentOffset,
        ...schedule.movies[currentProgram.index],
    };
}

// get channel info

module.exports = {
    createHLSStream,
    getVideoMetadata,
    getCurrentMovie,
    addMovieToDB,
    getChannels,
};
