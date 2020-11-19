// This line was generated by mkui.js. Do not modify.
ui.code = "<div id=\"ecouter\" class=\"cflex\" style=\"min-height: 100%; overflow: hidden;\"><div id=\"ecvideo-wrapper\" class=\"cflex\" style=\"position: relative; flex: auto;\"><div id=\"ecvideo-main\" class=\"cflex\" style=\"position: relative; flex: auto; min-height: 160px; text-align: center;\"><button id=\"ecvideo-main-fs\" class=\"fsbutton\" title=\"Fullscreen (single video)\" aria-label=\"Fullscreen (single video)\"><i class=\"fas fa-expand\"></i></button></div><div id=\"ecvideo-side\" class=\"rflex\" style=\"height: 160px; width: 100%; overflow: auto hidden;\"></div><button id=\"ecvideo-wrapper-fs\" class=\"fsbutton\" title=\"Fullscreen (all video)\" aria-label=\"Fullscreen (all video)\"><i class=\"fas fa-expand\"></i></button></div><div id=\"ecwaveform-wrapper\" style=\"position: relative; flex: auto;\"><canvas id=\"ecwaveform\" style=\"position: absolute; left: 0px; top: 0px;\"></canvas><img id=\"ecwave-watcher\" style=\"position: absolute; left: 0px; top: 0px; height: 100%;\" /></div><div id=\"ecmenu\" class=\"rflex\"><span id=\"ecmenu-master-hider\" style=\"display: none\"><button id=\"ecmenu-master\" class=\"menubutton hotkey-hidden\" title=\"Master interface\" aria-label=\"Master interface\"><i class=\"fas fa-cog\"></i></button></span><button id=\"ecmenu-chat\" class=\"menubutton hotkey-hidden\" title=\"Chat\" aria-label=\"Chat\"><i class=\"fas fa-keyboard\"></i></button><span id=\"ecmenu-users-hider\" style=\"display: none\"><button id=\"ecmenu-users\" class=\"menubutton hotkey-hidden\" title=\"User list\" aria-label=\"User list\"><i class=\"fas fa-users\"></i></button></span><span id=\"ecmenu-sounds-hider\" style=\"display: none\"><button id=\"ecmenu-sounds\" class=\"menubutton hotkey-hidden\" title=\"Soundboard\" aria-label=\"Soundboard\"><i class=\"fas fa-music\"></i></button></span><button id=\"ecmenu-audio-devices\" class=\"menubutton hotkey-hidden\" title=\"Audio configuration\" aria-label=\"Audio configuration\"><i class=\"fas fa-microphone-alt\"></i></button><button id=\"ecmenu-camera-devices\" class=\"menubutton hotkey-hidden\" title=\"Camera selector\" aria-label=\"Camera selector\"><i class=\"fas fa-video\"></i></button><span style=\"flex: auto;\"></span><button id=\"ecmenu-record\" class=\"menubutton hotkey-hidden\" title=\"Record video\" aria-label=\"Record video\"><i class=\"fas fa-file-video\"></i> <i class=\"fas fa-circle\"></i></button><button id=\"ecmenu-mute\" class=\"menubutton hotkey-hidden\" style=\"margin-right: 0\" title=\"Mute\" aria-label=\"Mute\"><i class=\"fas fa-volume-up\"></i></button></div><div id=\"ecmaster-wrapper\" class=\"panel\"><span id=\"ecmaster-left\" class=\"halfspan halfspan-left\"><button id=\"ecmaster-pause-resume\" class=\"row\"><i class=\"fas fa-pause\"></i> Pause recording</button><button id=\"ecmaster-start-stop\" class=\"row\"><i class=\"fas fa-microphone-alt\"></i> Start recording</button><div class=\"row\" id=\"ecmaster-yes-no\"><span class=\"halfspan halfspan-left\"><button id=\"ecmaster-yes\" style=\"width: 100%;\">Yes</button></span><span class=\"halfspan halfspan-right\"><button id=\"ecmaster-no\" style=\"width: 100%;\">No</button></span></div><div class=\"invite row\"><div class=\"rflex\"><label for=\"ecmaster-invite-link\">&nbsp;Invite:&nbsp;</label><input id=\"ecmaster-invite-link\" type=\"text\" readonly style=\"flex: auto; min-width: 1em;\" /><button id=\"ecmaster-invite-link-copy\" class=\"hotkey-hidden\" title=\"Copy invite link\" aria-label=\"Copy invite link\"><i class=\"fas fa-clipboard\"></i></button></div><div style=\"text-align: right;\"><span id=\"ecmaster-invite-flac-wrapper\"><input id=\"ecmaster-invite-flac\" type=\"checkbox\" /><label for=\"ecmaster-invite-flac\">FLAC&nbsp;&nbsp;</label></span><span id=\"ecmaster-invite-continuous-wrapper\"><input id=\"ecmaster-invite-continuous\" type=\"checkbox\" /><label for=\"ecmaster-invite-continuous\">Continuous&nbsp;</label></span></div></div><div class=\"rflex row\"><span style=\"min-width: 10em; text-align: right;\">Recording cost:&nbsp;</span><input id=\"ecmaster-recording-cost\" type=\"text\" readonly style=\"flex: auto; min-width: 1em;\" /></div><div class=\"rflex row\"><span style=\"min-width: 10em; text-align: right;\">Current rate:&nbsp;</span><input id=\"ecmaster-recording-rate\" type=\"text\" readonly style=\"flex: auto; min-width: 1em;\" /></div></span><span id=\"ecmaster-right\" class=\"halfspan halfspan-right\"></span></div><div id=\"ecuser-list-wrapper\" class=\"panel\"></div><div id=\"ecsounds-wrapper\" class=\"panel\"></div><div id=\"ecaudio-device-wrapper\" class=\"panel\"><div class=\"row\"><label for=\"ecinput-device-list\">Input device:&nbsp;</label><select id=\"ecinput-device-list\"></select></div><span class=\"halfspan halfspan-left\"><button id=\"ecpttb\" style=\"\"><i class=\"fas fa-gamepad\"></i> Gamepad push-to-talk</button></span><span id=\"ecinput-options-wrapper\" class=\"halfspan halfspan-right\"><input id=\"ecnoise-reduction\" type=\"checkbox\" /><label for=\"ecnoise-reduction\">&nbsp;Apply noise reduction</label><br/><input id=\"ececho-cancellation\" type=\"checkbox\" /><label for=\"ececho-cancellation\">&nbsp;Apply echo cancellation</label></span><hr/><div id=\"ecoutput-device-list-wrapper\" class=\"row\"><label for=\"ecoutput-device-list\">Output:&nbsp;</label><select id=\"ecoutput-device-list\"></select></div><div class=\"rflex row\"><label for=\"ecoutput-volume\">Volume:&nbsp;</label><input id=\"ecoutput-volume\" type=\"range\" min=0 max=400 value=200 style=\"flex: auto; min-width: 5em;\" /><span id=\"ecoutput-volume-status\">&nbsp;100%</span></div><div><input id=\"ecdynamic-range-compression\" type=\"checkbox\" /><label for=\"ecdynamic-range-compression\">&nbsp;Auto-level everyone's volume</label></div></div><div id=\"ecvideo-device-wrapper\" class=\"panel\"><label for=\"ecvideo-device-list\">Camera:&nbsp;</label><select id=\"ecvideo-device-list\"></select></div><div id=\"ecchat-wrapper\" class=\"cflex panel noborder\" style=\"flex: auto;\"><div id=\"ecchat-incoming\" class=\"chat\" style=\"flex: auto; padding: 0.5em; min-height: 2em; overflow: auto;\" role=\"log\" aria-live=\"polite\"></div><input id=\"ecchat-outgoing\" type=\"text\" style=\"box-sizing: border-box; width: 100%;\" data-hotkey-enter=\"ecchat-outgoing-b\" /><input id=\"ecchat-outgoing-b\" type=\"hidden\" /></div><div id=\"eclog\" class=\"status\">&nbsp;</div></div>";
