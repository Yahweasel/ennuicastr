/*
 * Copyright (c) 2018-2020 Yahweasel
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

// Basic DOM stuff
var dce = document.createElement.bind(document);
var gebi = document.getElementById.bind(document);
var log = gebi("log");

// For feature selection in audio
var plzyes = {ideal: true};
var plzno = {ideal: false};

// Short name for our protocol
var prot = EnnuiCastrProtocol;

// Opus zero packet, will be replaced with FLAC's version if needed
var zeroPacket = new Uint8Array([0xF8, 0xFF, 0xFE]);

// Configuration, which will be filled in by loading code
var config;

// The name of this recording, which may never be set
var recName = null;

/* We have multiple connections to the server:
 * One for pings,
 * one to send data, and
 * if we're the master, one for master communication */
var pingSock = null;
var dataSock = null;
var masterSock = null;

// Our own ID
var selfId = 0;

// We connect assuming our mode is not-yet-recording
var mode = prot.mode.init;

// The audio device being read
var userMedia = null;

// The pseudodevice as processed to reduce noise, for RTC
var userMediaRTC = null;

// The video device being read
var userMediaVideo = null;

/* We need an event target we can use. "usermediaready" fires when userMedia is
 * ready. "usermediastopped" fires when it stops. "usermediavideoready" fires
 * when video is ready. "spmediaready" fires when the media device that's
 * processed through the ScriptProcessor is ready. */
var userMediaAvailableEvent;
try {
    userMediaAvailableEvent = new EventTarget();
} catch (ex) {
    // No EventTarget
    userMediaAvailableEvent = window;
}
var ac = null; // The audio context for our scripts
var fileReader = null; // Used to transfer Opus data from the built-in encoder
var mediaRecorder = null; // The built-in media recorder, on browsers which support encoding to Ogg Opus
var libav = null; // If using libav.js
var libavEncoder = null; // If using libav.js to encode
var mkvDemuxer = null; // If using mkvdemux.js to demux

// If we're flushing our buffers, this will be a timeout to re-check
var flushTimeout = null;

// Our input sample rate
var sampleRate = 48000;

// Our RTC peer connections
var rtcConnections = {
    outgoing: {},
    incoming: {},
    videoRecHost: -1
};

/* For RTC, we apply compression. Those properties are here, along with a
 * callback for when they change. */
var rtcCompression = {
    // Compressor stage (if used)
    compressor: {
        // Default settings suitable for most users

        // Anything below -40dB is almost certainly noise
        threshold: -40,

        // No need to knee in noise
        knee: 0,

        // Default to no compression
        ratio: 1,

        // Standard attack and release times
        attack: 0.1,
        release: 0.25
    },

    // General gain stage
    gain: {
        // Multiplier to the gain from below, our volume knob
        volume: 1,

        /* Direct gain to apply. Reset to null to force recalculation from
         * target. */
        gain: null,

        /* Target peak, based on compressor above. Reset gain to null to
         * recalculate. */
        target: -18
    },

    // Per-user gain stage
    perUserVol: {},

    // Our currently active compressors
    compressors: []
};

// Global connection state
var connected = false;
var transmitting = false;

// Our output device, if it's been explicitly chosen
var outputDeviceId = null;

// WebRTCVAD's raw output
var rawVadOn = false;

// Recording VAD after warmup and cooldown
var vadOn = false;

// RTC VAD after cooldown
var rtcVadOn = false;

// Number of milliseconds to run the VAD for before/after talking
var vadExtension = 2000;

// Similar, for RTC transmission
var rtcVadExtension = 250;

// When we're not sending real data, we have to send a few (arbitrarily, 3) empty frames
var sentZeroes = 999;

/* To help with editing by sending a clean silence sample, we send the
 * first few (arbitrarily, 8) seconds of VAD-off silence */
var sendSilence = 400;

// The data used by both the level-based VAD and display
var waveData = [];
var waveVADs = [];

var waveVADColorSets = {
    "sv": ["#000", "#753", "#730", "#a30"],
    "sc": ["#000", "#730", "#730", "#a30"],
    "rv": ["#000", "#aaa", "#073", "#0a3"],
    "rc": ["#000", "#073", "#073", "#0a3"]
};

var waveVADColors = waveVADColorSets.sv;

// The entire user interface
var ui = {
    // Has the user taken control of the window size?
    manualSize: false,

    // What is our desired automatic size?
    autoSize: 0,

    // Are we currently resizing?
    resizing: null,

    // The code for the entire UI
    code: null,

    // The outermost wrapper
    wrapper: null,

    // All of our panels
    panels: {},

    // The element to auto-focus when a panel is activated
    panelAutos: {},

    // The video canvas wrapper
    video: null,

    // The display canvas and data
    waveWrapper: null,
    waveCanvas: null,
    waveWatcher: null,
    waveRotate: false,

    // The menu
    menu: null,

    // The mute button
    muteB: null,

    /* If we're showing anything *other* than the wave display and menu, it
     * goes here (everything below this point) */
    postWrapper: null,

    // The user list and voice status
    userList: {
        left: null,
        right: null,
        els: []
    },

    // The wrapper for the device selector
    deviceList: null,

    // The wrapper for the output control panel
    outputControlPanel: null,

    // The wrapper for the video device selector, if applicable
    videoDeviceList: null,

    // If we've received chat, the box for that
    chatBox: null,

    // Push-to-talk settings
    ptt: {
        enabled: false,
        hotkey: null,
        muted: false
    },

    // If we're in master mode, master UI elements
    masterUI: {},

    // Sound elements
    sounds: {}
};

// Our start time is in local ticks, and our offset is updated every so often
var startTime = 0;
var timeOffset = null;

/* So that the time offset doesn't jump all over the place, we adjust it
 * *slowly*. This is the target time offset */
var targetTimeOffset = null;

// And this is the amount to adjust it per frame (1%)
var timeOffsetAdjPerFrame = 0.0002;

// The remote start time, i.e., when recording began
var remoteBeginTime = null;

/* We keep track of the last time we successfully encoded data for
 * transfer, to determine if anything's gone wrong */
var lastSentTime = 0;

// The delays on the pongs we've received back
var pongs = [];

// The current blobs waiting to be read
var blobs = [];

// The current ArrayBuffers of data to be handled
var data = [];

// The Opus or FLAC packets to be handled. Format: [granulePos, data]
var packets = [];

// ICE servers for RTC
var iceServers = [
    {
        urls: "stun:stun.l.google.com:19302"
    }
];
