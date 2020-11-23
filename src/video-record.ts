/*
 * Copyright (c) 2020 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

// extern
declare var MediaRecorder: any, streamSaver: any;

import * as audio from "./audio";
import * as config from "./config";
import * as log from "./log";
import * as net from "./net";
import { prot } from "./net";
import * as rtc from "./rtc";
import * as ui from "./ui";
import * as util from "./util";
import { gebi } from "./util";
import * as video from "./video";

// Do we support MediaRecorder with VP8 output?
const mediaRecorderVP8 = (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm; codecs=vp8"));

// Function to stop the current video recording, or null if there is none
export var recordVideoStop: any = null;

// Function to call to verify remote willingness to accept video data
export var recordVideoRemoteOK: any = null;
var recordVideoRemoteOKTimeout = null;

// Record video
function recordVideo(opts) {
    recordVideoButton(true);

    // Choose a name
    var filename = "";
    if (net.recName)
        filename = net.recName + "-";
    filename += config.username + "-video.webm";

    // Create a write stream early, so it's in response to the button click
    var localWriter = null, remoteWriter = null;
    if (opts.local) {
        if (opts.localWriter) {
            localWriter = opts.localWriter;
        } else {
            var fileStream = streamSaver.createWriteStream(filename);
            localWriter = fileStream.getWriter();
            window.addEventListener("unload", function() {
                localWriter.close();
            });
            opts.localWriter = localWriter;
        }
    }

    if (opts.remote) {
        if (!("remotePeer" in opts)) {
            // Verify first!
            rtc.rtcVideoRecSend(rtc.rtcConnections.videoRecHost, prot.videoRec.startVideoRecReq);

            recordVideoRemoteOK = function(peer) {
                opts.remotePeer = peer;
                recordVideo(opts);
            };

            recordVideoRemoteOKTimeout = setTimeout(function() {
                recordVideoRemoteOK = null;
                if (localWriter)
                    localWriter.close();
                recordVideoButton();
            }, 5000);
            return;

        } else {
            recordVideoRemoteOK = null;
            if (recordVideoRemoteOKTimeout) {
                clearTimeout(recordVideoRemoteOKTimeout);
                recordVideoRemoteOKTimeout = null;
            }

            remoteWriter = {
                write: function(chunk) { recordVideoRemoteWrite(opts.remotePeer, chunk); },
                close: function() {
                    this.write = function() {};
                    recordVideoRemoteClose(opts.remotePeer);
                }
            };

        }

    }

    if (recordVideoStop) {
        // Can't have two videos recording at once!
        recordVideoStop();
    }

    // Make sure they know what's what
    log.pushStatus("video-beta", "Video recording is an ALPHA feature in early testing.");
    setTimeout(function() { log.popStatus("video-beta"); }, 10000);

    // We decide the bitrate based on the height (FIXME: Configurability)
    var videoSettings = video.userMediaVideo.getVideoTracks()[0].getSettings();
    var bitrate = videoSettings.height * 5000;
    var globalFrameTime = 1/videoSettings.frameRate * 1000;
    var libav;

    return audio.loadLibAV().then(function() {
        // Set up our forwarder in LibAV
        libav = audio.libav;
        if (!libav.onwrite) {
            libav.onwriteto = {};
            libav.onwrite = function(name, pos, buf) {
                if (name in libav.onwriteto)
                    return libav.onwriteto[name](pos, buf);
                else
                    console.error(name);
            };
        }

    }).then(function() {
        // Create our LibAV input
        var transtate: any = {};
        transtate.inF = "in-" + Math.random() + ".webm";
        transtate.outF = "out-" + Math.random() + ".webm";
        recordVideoInput(transtate);

        // And output
        transtate.written = 0;
        libav.onwriteto[transtate.outF] = function(pos, buf) {
            if (pos !== transtate.written)
                return; // Ignore patches
            buf = new Uint8Array(buf.buffer);
            if (localWriter)
                localWriter.write(buf);
            if (remoteWriter)
                remoteWriter.write(buf);
            transtate.written += buf.length;
        };

        // Then the transit
        transtate.startPromise.then(function() {
            return libav.ff_init_demuxer_file(transtate.inF);

        }).then(function(ret) {
            transtate.in_fmt_ctx = ret[0];
            var streams = transtate.in_streams = ret[1];

            var si, stream;
            for (si = 0; si < streams.length; si++) {
                stream = streams[si];
                if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
                    break;
            }
            if (si >= streams.length)
                throw new Error("MediaRecorder didn't produce a valid video file!");

            transtate.in_stream_idx = si;
            transtate.in_stream = stream;
            return libav.ff_init_decoder(stream.codec_id);

        }).then(function(ret) {
            transtate.c = ret[1];
            transtate.pkt = ret[2];
            transtate.frame = ret[3];

            var sentFirst = false;
            var lastDTS = 0;

            // Now read it in
            return new Promise(function(res, rej) {
                function go() {
                    var readState, packets, endTimeReal;
                    return libav.ff_read_multi(transtate.in_fmt_ctx, transtate.pkt, transtate.inF).then(function(ret) {
                        readState = ret[0];
                        if (readState !== 0 && readState !== -libav.EAGAIN && readState !== libav.AVERROR_EOF) {
                            // Weird error!
                            throw new Error(ret[0]);
                        }
                        packets = ret[1][transtate.in_stream_idx] || [];

                        // Figure out the timing
                        if (packets.length)
                            endTimeReal = performance.now();

                        // Maybe prepare output
                        if (packets.length && !transtate.out_oc) {
                            // Decode at least some packets so the codec state is complete
                            return libav.ff_decode_multi(transtate.c, transtate.pkt, transtate.frame, packets, true).then(function() {
                                // Initialize the muxer and output device
                                return libav.ff_init_muxer({filename: transtate.outF, open: true, device: true},
                                    [[transtate.c, transtate.in_stream.time_base_num, transtate.in_stream.time_base_den]]);
                            }).then(function(ret) {
                                transtate.out_oc = ret[0];
                                transtate.out_fmt = ret[1];
                                transtate.out_pb = ret[2];
                                transtate.out_st = ret[3];

                                // Write out the header
                                return libav.avformat_write_header(transtate.out_oc, 0);

                            });
                        }

                    }).then(function() {
                        function timeFrom(fromhi, from) {
                            from += fromhi * 0x100000000;
                            return from * transtate.in_stream.time_base_num / transtate.in_stream.time_base_den * 1000;
                        }

                        function timeTo(from) {
                            var to = from * transtate.in_stream.time_base_den / transtate.in_stream.time_base_num / 1000;
                            return {
                                hi: ~~(to / 0x100000000),
                                lo: ~~(to % 0x100000000)
                            };
                        }

                        if (packets.length) {
                            // Update the timing
                            if (net.remoteBeginTime && audio.timeOffset) {
                                // The last packet tells us roughly when we are
                                var lastPacket = packets[packets.length-1];

                                // Get the framerate from the packets
                                var frameTime;
                                if (packets.length > 1) {
                                    var last = timeFrom(lastPacket.dtshi, lastPacket.dts);
                                    var first = timeFrom(packets[0].dtshi, packets[0].dts);
                                    frameTime = (last - first) / (packets.length - 1);
                                } else {
                                    frameTime = globalFrameTime;
                                }

                                // Figure out the ideal end time
                                var endTimeDTS = endTimeReal // The real time when we received this packet
                                    + audio.timeOffset // Convert to remote time
                                    - net.remoteBeginTime; // Base at recording start time

                                // Now figure out the practical range of times
                                var startTimeDTS;
                                if (lastDTS)
                                    startTimeDTS = lastDTS;
                                else
                                    startTimeDTS = endTimeDTS - frameTime * (packets.length-1);

                                // Figure out our ideal time step between these
                                var step = (endTimeDTS - startTimeDTS) / (packets.length-1);

                                // But don't let it get too far from the frame rate
                                var stepVRate = step/frameTime;
                                if (stepVRate < 0.99)
                                    step = frameTime * 0.99;
                                else if (stepVRate > 1.01)
                                    step = frameTime * 1.01;

                                // Now retime all the packets
                                var dts = startTimeDTS;
                                for (var pi = 0; pi < packets.length; pi++) {
                                    var packet = packets[pi];
                                    var pdts: any = timeFrom(packet.dtshi, packet.dts);
                                    var ppts: any = timeFrom(packet.ptshi, packet.pts);
                                    ppts -= pdts;
                                    pdts = (dts < lastDTS) ? lastDTS : dts;
                                    ppts += pdts;
                                    if (ppts < 0) ppts = 0;
                                    pdts = timeTo(pdts);
                                    ppts = timeTo(ppts);
                                    packet.dtshi = pdts.hi;
                                    packet.dts = pdts.lo;
                                    packet.ptshi = ppts.hi;
                                    packet.pts = ppts.lo;
                                    dts += step;
                                }

                                lastDTS = dts;

                            } else {
                                /* No starting time yet, so either send only
                                 * one packet (to get the timestamps right) or
                                 * nothing */
                                if (!sentFirst)
                                    packets = [packets[0]];
                                else
                                    packets = [];

                            }
                        }

                        if (packets.length) {
                            if (!sentFirst) {
                                // Make sure the first packet has timestamp 0 so that all the other timestamps are right
                                packets[0].dtshi = packets[0].dts = packets[0].ptshi = packets[0].pts = 0;
                                sentFirst = true;
                            }

                            // And write
                            return libav.ff_write_multi(transtate.out_oc, transtate.pkt, packets);

                        }

                    }).then(function() {
                        // Continue or end
                        if (readState === libav.AVERROR_EOF)
                            res(void 0);
                        else if (readState === -libav.EAGAIN && packets.length === 0)
                            new Promise(function(res) { transtate.read = res; }).then(go);
                        else
                            go();

                    }).catch(rej);
                }

                go();
            });

        }).then(function() {
            // When we're done reading, write the trailer
            if (transtate.out_oc)
                return libav.av_write_trailer(transtate.out_oc);

        }).then(function() {
            // Free everything
            return Promise.all([
                libav.ff_free_decoder(transtate.c, transtate.pkt, transtate.frame),
                libav.avformat_close_input_js(transtate.in_fmt_ctx),
                transtate.out_oc ? libav.ff_free_muxer(transtate.out_oc, transtate.out_pb) : Promise.all([])
            ]);

        }).then(function() {
            // And close writing
            if (localWriter)
                localWriter.close();
            if (remoteWriter)
                remoteWriter.close();

        }).catch(function(err) {
            console.error(err);

        });

        // MediaRecorder produces a WebM file, and we have to correct its timestamps
        var mediaRecorder = new MediaRecorder(video.userMediaVideo, {
            mimeType: "video/webm; codecs=vp8",
            videoBitsPerSecond: bitrate
        });
        mediaRecorder.addEventListener("dataavailable", function(chunk) {
            if (transtate.write) {
                transtate.write(chunk.data);
                if (transtate.read)
                    transtate.read();
            }
        });
        mediaRecorder.addEventListener("stop", function() {
            if (transtate.write) {
                transtate.write(null);
                transtate.write = null;

                if (transtate.read)
                    transtate.read();

                recordVideoStop = null;
                recordVideoButton();
            }
        });
        mediaRecorder.start(200);

        // Set up a way to stop it
        recordVideoStop = function() {
            // Stop writing the file immediately
            if (localWriter)
                localWriter.close();
            if (remoteWriter)
                remoteWriter.close();

            // And end the translation
            if (transtate.write) {
                transtate.write(null);
                transtate.write = null;

                if (transtate.read)
                    transtate.read();
            }
            recordVideoStop = null;
            recordVideoButton();
        };
        recordVideoButton();

    });
}

// Receive a remote video recording
export function recordVideoRemoteIncoming(peer) {
    // Choose a name
    var filename = "";
    if (net.recName)
        filename = net.recName + "-";
    var remoteName = ui.ui.userList.names[peer];
    if (remoteName)
        filename += remoteName + "-";
    filename += "video.webm";

    // Create a write stream
    return loadStreamSaver().then(function() {
        var fileStream = streamSaver.createWriteStream(filename);
        var fileWriter = fileStream.getWriter();
        window.addEventListener("unload", function() {
            fileWriter.close();
        });

        return fileWriter;
    });
}

// Show the video recording panel if we need to, or just start recording
function recordVideoPanel() {
    ui.togglePanel("video-record");
}

// Input handler for video recording
function recordVideoInput(transtate) {
    var buf;
    var libav = audio.libav;

    /* Create a promise for the start, because we have to buffer the header
     * before we can start real recording */
    var startPromiseRes, startPromiseDone = false;
    var startSz = 0;
    transtate.startPromise = new Promise(function(res) {
        startPromiseRes = res;
    });

    // Create a promise for creating the input device
    var devicePromise = libav.mkreaderdev(transtate.inF);

    // Create a promise so we can keep everything in order, starting with the device
    var inputPromise = devicePromise;

    // Now create our input handler
    transtate.write = function(blob) {
        inputPromise = inputPromise.then(function() {
            // Convert to an ArrayBuffer
            if (blob)
                return blob.arrayBuffer();
            else
                return null;

        }).then(function(sbuf) {
            // And then send it along
            if (sbuf)
                buf = new Uint8Array(sbuf);
            else
                buf = null;
            return libav.ff_reader_dev_send(transtate.inF, buf);

        }).then(function() {
            // Possibly wake up the transcoding
            if (!startPromiseDone || !buf) {
                if (buf)
                    startSz += buf.length;
                if (startSz >= 64 * 1024 || !buf) {
                    startPromiseRes();
                    startPromiseDone = true;
                }
            }

        });
    }
}

// Write data to an RTC peer
function recordVideoRemoteWrite(peer, buf) {
    console.log("Sending " + buf.length);
    rtc.rtcDataSend(peer, buf);
}

// Stop sending video data to a peer
function recordVideoRemoteClose(peer) {
    rtc.rtcVideoRecSend(peer, prot.videoRec.endVideoRec);
}

// Configure the video recording button based on the current state
export function recordVideoButton(loading?: boolean) {
    var btn = ui.ui.recordVideoButton;
    if (!btn) return;

    function disabled(to) {
        btn.disabled = to;
        if (to)
            btn.classList.add("off");
        else
            btn.classList.remove("off");
    }

    var start = '<i class="fas fa-file-video"></i> ';
    if (loading) {
        // Currently loading, don't mess with it
        btn.innerHTML = start + '<i class="fas fa-ellipsis-h"></i>';
        disabled(true);

    } else if (recordVideoStop) {
        // Current recording is stoppable
        btn.innerHTML = start + '<i class="fas fa-stop"></i>';
        btn.disabled = false;
        disabled(false);
        btn.onclick = function() {
            disabled(true);
            recordVideoStop();
        };

    } else {
        // Not currently recording
        btn.innerHTML = start + '<i class="fas fa-circle"></i>';
        if (mediaRecorderVP8 && video.userMediaVideo) {
            // But we could be!

            // Make sure we've loaded StreamSaver
            if (typeof streamSaver === "undefined") {
                disabled(true);
                loadStreamSaver().then(function() {
                    disabled(false);
                });
            } else {
                disabled(false);
            }

            btn.onclick = function() {
                if (rtc.rtcConnections.videoRecHost >= 0) {
                    disabled(false);
                    recordVideoPanel();
                } else {
                    disabled(true);
                    recordVideo({local: true});
                }
            };

            gebi("ecvideo-record-local").onclick = function() {
                ui.togglePanel("video-record", false);
                recordVideo({local: true});
            };

            gebi("ecvideo-record-remote").onclick = function() {
                ui.togglePanel("video-record", false);
                recordVideo({remote: true});
            };

            gebi("ecvideo-record-local-remote").onclick = function() {
                ui.togglePanel("video-record", false);
                recordVideo({local: true, remote: true});
            };

        } else {
            // And we can't
            disabled(true);

        }

    }
}

// Load the StreamSaver library, needed only for video recording
function loadStreamSaver(): Promise<unknown> {
    if (typeof streamSaver === "undefined") {
        return util.loadLibrary("web-streams-ponyfill.js").then(function() {
            return util.loadLibrary("StreamSaver.js?v=5");
        }).then(function() {
            streamSaver.mitm = "StreamSaver/mitm.html";
        });
    }
    return Promise.all([]);
}

// Make sure the record button updates when the video state updates
audio.userMediaAvailableEvent.addEventListener("usermediavideoready", function() { recordVideoButton(); });
audio.userMediaAvailableEvent.addEventListener("usermediavideostopped", function() { recordVideoButton(); });
