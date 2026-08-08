(() => {
    if (window.groupCalls || !window.supabaseClient) {
        return;
    }

    const HEARTBEAT_INTERVAL_MS = 30_000;
    const REFRESH_DELAY_MS = 120;
    const ICE_BATCH_DELAY_MS = 120;
    const MICROPHONE_STORAGE_KEY =
        "preferred-player-call-microphone-v1";
    const fallbackIceServers = [
        { urls: ["stun:stun.cloudflare.com:3478"] }
    ];

    let currentUser = null;
    let activeState = null;
    let localStream = null;
    let cameraTrack = null;
    let screenTrack = null;
    let placeholderVideoTrack = null;
    let peerRecords = new Map();
    let globalChannel = null;
    let roomChannel = null;
    let heartbeatTimer = null;
    let durationTimer = null;
    let refreshTimer = null;
    let signalCursor = 0;
    let pendingSignals = [];
    let iceServersPromise = null;
    let actionBusy = false;
    let composerPurpose = "create";
    let composerMode = "video";
    let composerFriends = [];
    let composerSelected = new Set();
    let audioContext = null;
    const speakingDetectors = new Map();
    const notifiedInviteIds = new Set();
    const ui = {};

    function callId() {
        return activeState?.call?.id ?? null;
    }

    function membershipStatus() {
        return activeState?.membership?.status ?? null;
    }

    function joinedParticipants() {
        return (activeState?.participants ?? [])
            .filter((participant) => participant.status === "joined");
    }

    function activeParticipants() {
        return (activeState?.participants ?? [])
            .filter((participant) =>
                participant.status === "joined"
                || participant.status === "invited"
            );
    }

    function participantById(userId) {
        return (activeState?.participants ?? [])
            .find((participant) => participant.user_id === userId)
            ?? null;
    }

    function isHost() {
        return Boolean(
            currentUser
            && activeState?.call?.host_id === currentUser.id
        );
    }

    function modeLimit(mode = composerMode) {
        return mode === "video" ? 4 : 6;
    }

    function initials(username) {
        const clean = String(username ?? "?")
            .replaceAll("_", " ")
            .trim();

        if (!clean) {
            return "?";
        }

        const parts = clean.split(/\s+/).filter(Boolean);

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
    }

    function createUi() {
        if (document.querySelector("#group-call-root")) {
            return;
        }

        const root = document.createElement("section");
        root.id = "group-call-root";
        root.className = "group-call-root hidden";
        root.setAttribute("aria-live", "polite");

        root.innerHTML = `
            <div class="group-call-backdrop hidden" data-group-action="mini"></div>

            <aside class="group-call-incoming hidden" aria-label="Incoming group call">
                <div class="group-call-incoming-icon" aria-hidden="true">◉</div>
                <div class="group-call-incoming-copy">
                    <span class="group-call-kicker">GROUP CALL</span>
                    <strong class="group-call-incoming-title"></strong>
                    <span class="group-call-incoming-detail"></span>
                </div>
                <div class="group-call-incoming-actions">
                    <button type="button" class="group-call-button accept" data-group-action="accept">Join</button>
                    <button type="button" class="group-call-button danger" data-group-action="decline">Decline</button>
                </div>
            </aside>

            <section class="group-call-stage hidden" aria-label="Group call">
                <header class="group-call-header">
                    <div class="group-call-heading-copy">
                        <span class="group-call-kicker group-call-mode-label">GROUP VIDEO CALL</span>
                        <strong class="group-call-heading">Group call</strong>
                    </div>

                    <div class="group-call-header-meta">
                        <span class="group-call-count">0/0</span>
                        <span class="group-call-duration">00:00</span>
                        <button type="button" class="group-call-size-button" data-group-action="expand">Expand</button>
                    </div>
                </header>

                <div class="group-call-grid"></div>

                <p class="group-call-error" role="alert"></p>

                <div class="group-call-controls">
                    <button type="button" class="group-call-control" data-group-action="invite">Invite</button>
                    <button type="button" class="group-call-control" data-group-action="devices">Devices</button>
                    <button type="button" class="group-call-control" data-group-action="microphone">Mute</button>
                    <button type="button" class="group-call-control" data-group-action="camera">Camera off</button>
                    <button type="button" class="group-call-control hidden" data-group-action="screen">Share screen</button>
                    <button type="button" class="group-call-control danger" data-group-action="leave">Leave</button>
                    <button type="button" class="group-call-control danger hidden" data-group-action="end">End for all</button>
                </div>
            </section>

            <section class="group-call-composer hidden" role="dialog" aria-modal="true" aria-labelledby="group-call-composer-title">
                <header class="group-call-composer-header">
                    <div>
                        <span class="group-call-kicker">GROUP CALL</span>
                        <h2 id="group-call-composer-title">Start a group call</h2>
                    </div>
                    <button type="button" class="group-call-close" data-group-action="close-composer" aria-label="Close">×</button>
                </header>

                <div class="group-call-mode-picker">
                    <button type="button" data-group-mode="audio">Audio</button>
                    <button type="button" data-group-mode="video" class="active">Video</button>
                </div>

                <div class="group-call-composer-summary">
                    <span class="group-call-selection-count">0 selected</span>
                    <span class="group-call-selection-limit">Up to 3 friends</span>
                </div>

                <div class="group-call-friend-list"></div>

                <p class="group-call-composer-message" role="alert"></p>

                <div class="group-call-composer-actions">
                    <button type="button" class="group-call-button neutral" data-group-action="close-composer">Cancel</button>
                    <button type="button" class="group-call-button accept group-call-submit" data-group-action="submit-composer">Start video call</button>
                </div>
            </section>

            <section class="group-call-device-panel hidden" role="dialog" aria-modal="false" aria-labelledby="group-call-device-title">
                <header class="group-call-composer-header">
                    <div>
                        <span class="group-call-kicker">CALL SETTINGS</span>
                        <h2 id="group-call-device-title">Microphone</h2>
                    </div>
                    <button type="button" class="group-call-close" data-group-action="close-devices" aria-label="Close">×</button>
                </header>

                <label class="group-call-device-field">
                    <span>Microphone input</span>
                    <select class="group-call-microphone-select">
                        <option value="">Default microphone</option>
                    </select>
                </label>

                <p class="group-call-device-message" role="status"></p>
            </section>

            <div class="group-call-toast hidden" role="status"></div>
        `;

        document.body.append(root);

        ui.root = root;
        ui.backdrop = root.querySelector(".group-call-backdrop");
        ui.incoming = root.querySelector(".group-call-incoming");
        ui.incomingTitle = root.querySelector(".group-call-incoming-title");
        ui.incomingDetail = root.querySelector(".group-call-incoming-detail");
        ui.stage = root.querySelector(".group-call-stage");
        ui.modeLabel = root.querySelector(".group-call-mode-label");
        ui.heading = root.querySelector(".group-call-heading");
        ui.count = root.querySelector(".group-call-count");
        ui.duration = root.querySelector(".group-call-duration");
        ui.sizeButton = root.querySelector(".group-call-size-button");
        ui.grid = root.querySelector(".group-call-grid");
        ui.error = root.querySelector(".group-call-error");
        ui.microphoneButton = root.querySelector('[data-group-action="microphone"]');
        ui.cameraButton = root.querySelector('[data-group-action="camera"]');
        ui.screenButton = root.querySelector('[data-group-action="screen"]');
        ui.endButton = root.querySelector('[data-group-action="end"]');
        ui.composer = root.querySelector(".group-call-composer");
        ui.composerTitle = root.querySelector("#group-call-composer-title");
        ui.modePicker = root.querySelector(".group-call-mode-picker");
        ui.selectionCount = root.querySelector(".group-call-selection-count");
        ui.selectionLimit = root.querySelector(".group-call-selection-limit");
        ui.friendList = root.querySelector(".group-call-friend-list");
        ui.composerMessage = root.querySelector(".group-call-composer-message");
        ui.submitButton = root.querySelector(".group-call-submit");
        ui.devicePanel = root.querySelector(".group-call-device-panel");
        ui.microphoneSelect = root.querySelector(".group-call-microphone-select");
        ui.deviceMessage = root.querySelector(".group-call-device-message");
        ui.toast = root.querySelector(".group-call-toast");

        ui.microphoneSelect.addEventListener("change", () => {
            changeMicrophone(ui.microphoneSelect.value).catch((error) => {
                ui.deviceMessage.textContent =
                    error.message || "The microphone could not be changed.";
            });
        });
    }

    function installLaunchButton() {
        if (
            !window.location.pathname.endsWith("friends.html")
            || document.querySelector("[data-group-call-launch]")
        ) {
            return;
        }

        const target = document.querySelector(
            ".friends-hero > div:first-child"
        );

        if (!target) {
            return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "group-call-launch";
        button.dataset.groupCallLaunch = "true";
        button.textContent = "Start group call";
        target.append(button);
    }

    function showToast(message, type = "") {
        if (!ui.toast) {
            return;
        }

        ui.root.classList.remove("hidden");
        ui.toast.textContent = message;
        ui.toast.className = `group-call-toast ${type}`.trim();

        window.setTimeout(() => {
            ui.toast.classList.add("hidden");
            updateRootVisibility();
        }, 3200);
    }

    function setError(message = "") {
        ui.error.textContent = message;
    }

    function setComposerMessage(message = "") {
        ui.composerMessage.textContent = message;
    }

    function updateRootVisibility() {
        const visible = [
            ui.incoming,
            ui.stage,
            ui.composer,
            ui.devicePanel,
            ui.toast
        ].some((element) => element && !element.classList.contains("hidden"));

        ui.root.classList.toggle("hidden", !visible);
    }

    function directCallActive() {
        return Boolean(window.playerCalls?.activeCall);
    }

    function notifyInvite() {
        const call = activeState?.call;

        if (!call?.id || notifiedInviteIds.has(call.id)) {
            return;
        }

        notifiedInviteIds.add(call.id);

        const host = (activeState.participants ?? [])
            .find((participant) => participant.is_host);

        const mode = call.call_mode === "video" ? "video" : "audio";
        const detail = {
            title: `Group ${mode} call`,
            body: `${host?.username ?? "A friend"} invited you to a group call.`,
            tag: `group-call-${call.id}`,
            url: window.location.href,
            requireInteraction: true
        };

        if (window.siteDesktopNotifications) {
            window.siteDesktopNotifications.show(detail);
        } else {
            window.dispatchEvent(new CustomEvent(
                "site-desktop-notification",
                { detail }
            ));
        }
    }

    function showIncomingInvite() {
        const call = activeState?.call;

        if (!call || membershipStatus() !== "invited") {
            ui.incoming.classList.add("hidden");
            updateRootVisibility();
            return;
        }

        const host = (activeState.participants ?? [])
            .find((participant) => participant.is_host);

        const joined = joinedParticipants().length;
        const invited = activeParticipants().length;

        ui.incomingTitle.textContent =
            `${host?.username ?? "A friend"} started a group ${call.call_mode} call`;

        ui.incomingDetail.textContent = directCallActive()
            ? "Finish your current one-to-one call before joining."
            : `${joined} joined · ${invited} invited · ${call.max_participants} max`;

        ui.incoming.classList.remove("hidden");
        ui.root.classList.remove("hidden");
        notifyInvite();
    }

    function setExpanded(expanded) {
        if (!ui.stage || ui.stage.classList.contains("hidden")) {
            return;
        }

        ui.root.classList.toggle("group-call-expanded", expanded);
        ui.backdrop.classList.toggle("hidden", !expanded);
        ui.sizeButton.textContent = expanded ? "Mini" : "Expand";
        ui.sizeButton.dataset.groupAction = expanded ? "mini" : "expand";
    }

    async function loadIceServers() {
        if (iceServersPromise) {
            return iceServersPromise;
        }

        iceServersPromise = (async () => {
            try {
                const { data, error } = await window.supabaseClient
                    .functions
                    .invoke("get-call-ice-servers", { body: {} });

                if (
                    error
                    || !Array.isArray(data?.iceServers)
                    || !data.iceServers.length
                ) {
                    return fallbackIceServers;
                }

                return data.iceServers;
            } catch (error) {
                console.warn(
                    "Group-call TURN configuration was unavailable:",
                    error
                );
                return fallbackIceServers;
            }
        })();

        return iceServersPromise;
    }

    function preferredMicrophoneId() {
        try {
            return window.localStorage.getItem(MICROPHONE_STORAGE_KEY) || "";
        } catch (error) {
            return "";
        }
    }

    function savePreferredMicrophoneId(deviceId) {
        try {
            if (deviceId) {
                window.localStorage.setItem(MICROPHONE_STORAGE_KEY, deviceId);
            } else {
                window.localStorage.removeItem(MICROPHONE_STORAGE_KEY);
            }
        } catch (error) {
            // Calls can continue even if storage is blocked.
        }
    }

    function microphoneConstraints(deviceId = preferredMicrophoneId()) {
        return {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(deviceId ? { deviceId: { exact: deviceId } } : {})
        };
    }

    async function requestMicrophone(deviceId = preferredMicrophoneId()) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: microphoneConstraints(deviceId),
                video: false
            });
        } catch (error) {
            if (
                deviceId
                && (error?.name === "NotFoundError"
                    || error?.name === "OverconstrainedError")
            ) {
                savePreferredMicrophoneId("");
                return requestMicrophone("");
            }

            throw error;
        }
    }

    async function requestCamera() {
        return navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: "user" },
                resizeMode: { ideal: "none" },
                frameRate: { ideal: 20, max: 24 }
            }
        });
    }

    function ensurePlaceholderVideoTrack() {
        if (placeholderVideoTrack?.readyState === "live") {
            return placeholderVideoTrack;
        }

        try {
            const canvas = document.createElement("canvas");
            canvas.width = 4;
            canvas.height = 4;
            const context = canvas.getContext("2d");
            context.fillStyle = "#070b10";
            context.fillRect(0, 0, canvas.width, canvas.height);
            const stream = canvas.captureStream?.(1);
            placeholderVideoTrack = stream?.getVideoTracks?.()[0] ?? null;
            return placeholderVideoTrack;
        } catch (error) {
            placeholderVideoTrack = null;
            return null;
        }
    }

    async function acquireLocalMedia(mode) {
        if (localStream) {
            return localStream;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Group calls need HTTPS and a WebRTC-capable browser.");
        }

        localStream = new MediaStream();
        const warnings = [];

        try {
            const microphone = await requestMicrophone();
            const track = microphone.getAudioTracks()[0];

            if (track) {
                localStream.addTrack(track);
            }
        } catch (error) {
            warnings.push("Microphone unavailable. You can still listen to the call.");
        }

        if (mode === "video") {
            try {
                const camera = await requestCamera();
                cameraTrack = camera.getVideoTracks()[0] ?? null;

                if (cameraTrack) {
                    localStream.addTrack(cameraTrack);
                }
            } catch (error) {
                warnings.push("Camera unavailable. You joined with audio only.");
            }
        }

        if (warnings.length) {
            showToast(warnings.join(" "), "warning");
        }

        await refreshMicrophoneDevices().catch(() => {});
        return localStream;
    }

    function stopLocalMedia() {
        screenTrack?.stop();
        screenTrack = null;
        cameraTrack = null;
        placeholderVideoTrack?.stop();
        placeholderVideoTrack = null;
        localStream?.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    async function refreshMicrophoneDevices() {
        if (!ui.microphoneSelect || !navigator.mediaDevices?.enumerateDevices) {
            return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter((device) => device.kind === "audioinput");
        const current = preferredMicrophoneId();
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Default microphone";
        ui.microphoneSelect.replaceChildren(defaultOption);

        microphones.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${index + 1}`;
            ui.microphoneSelect.append(option);
        });

        ui.microphoneSelect.value = microphones.some(
            (device) => device.deviceId === current
        ) ? current : "";
    }

    async function changeMicrophone(deviceId) {
        savePreferredMicrophoneId(deviceId);

        if (!localStream) {
            ui.deviceMessage.textContent = "This microphone will be used when you join a call.";
            return;
        }

        ui.deviceMessage.textContent = "Switching microphone…";
        const replacement = await requestMicrophone(deviceId);
        const track = replacement.getAudioTracks()[0];

        if (!track) {
            throw new Error("The selected device has no audio track.");
        }

        const oldTrack = localStream.getAudioTracks()[0] ?? null;
        track.enabled = oldTrack?.enabled ?? true;

        for (const record of peerRecords.values()) {
            const sender = record.pc.getSenders()
                .find((candidate) => candidate.track?.kind === "audio");

            if (sender) {
                await sender.replaceTrack(track);
            }
        }

        if (oldTrack) {
            localStream.removeTrack(oldTrack);
            oldTrack.stop();
        }

        localStream.addTrack(track);
        attachSpeakingDetector(currentUser.id, localStream);
        await refreshMicrophoneDevices();
        ui.deviceMessage.textContent = "Microphone changed.";
    }

    function ensureAudioContext() {
        if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
            const AudioContextType = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextType();
        }

        if (audioContext?.state === "suspended") {
            audioContext.resume().catch(() => {});
        }

        return audioContext;
    }

    function clearSpeakingDetector(userId) {
        const cleanup = speakingDetectors.get(userId);

        if (cleanup) {
            cleanup();
            speakingDetectors.delete(userId);
        }
    }

    function attachSpeakingDetector(userId, stream) {
        clearSpeakingDetector(userId);

        const context = ensureAudioContext();
        const audioTracks = stream?.getAudioTracks?.() ?? [];

        if (!context || !audioTracks.length) {
            return;
        }

        try {
            const source = context.createMediaStreamSource(
                new MediaStream(audioTracks)
            );
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);

            const timer = window.setInterval(() => {
                analyser.getByteTimeDomainData(data);
                let total = 0;

                for (const value of data) {
                    const centred = (value - 128) / 128;
                    total += centred * centred;
                }

                const rms = Math.sqrt(total / data.length);
                const tile = ui.grid?.querySelector(
                    `[data-group-user="${CSS.escape(userId)}"]`
                );
                const participant = participantById(userId);
                const speaking =
                    rms > 0.045
                    && participant?.microphone_enabled !== false;

                tile?.classList.toggle("speaking", speaking);
            }, 120);

            speakingDetectors.set(userId, () => {
                window.clearInterval(timer);
                try {
                    source.disconnect();
                    analyser.disconnect();
                } catch (error) {
                    // Node may already be disconnected.
                }
            });
        } catch (error) {
            console.warn("Speaking indicator could not start:", error);
        }
    }

    function stopAllSpeakingDetectors() {
        for (const userId of Array.from(speakingDetectors.keys())) {
            clearSpeakingDetector(userId);
        }
    }

    function createTile(participant) {
        const tile = document.createElement("article");
        tile.className = "group-call-tile";
        tile.dataset.groupUser = participant.user_id;

        tile.innerHTML = `
            <video class="group-call-video" autoplay playsinline></video>
            <div class="group-call-avatar"></div>
            <div class="group-call-tile-footer">
                <strong class="group-call-tile-name"></strong>
                <div class="group-call-tile-badges">
                    <span class="group-call-host-badge hidden">Host</span>
                    <span class="group-call-mic-badge">Mic</span>
                    <span class="group-call-camera-badge hidden">Cam</span>
                </div>
            </div>
        `;

        ui.grid.append(tile);
        return tile;
    }

    function localPreviewStream() {
        if (screenTrack) {
            return new MediaStream([screenTrack]);
        }

        if (cameraTrack) {
            return new MediaStream([cameraTrack]);
        }

        return new MediaStream();
    }

    function updateTile(participant) {
        let tile = ui.grid.querySelector(
            `[data-group-user="${CSS.escape(participant.user_id)}"]`
        );

        if (!tile) {
            tile = createTile(participant);
        }

        const isMe = participant.user_id === currentUser.id;
        tile.classList.toggle("own", isMe);
        tile.classList.toggle("host", participant.is_host === true);
        tile.classList.toggle("muted", participant.microphone_enabled === false);
        tile.classList.toggle("screen-sharing", isMe && Boolean(screenTrack));

        const video = tile.querySelector(".group-call-video");
        const avatar = tile.querySelector(".group-call-avatar");
        const name = tile.querySelector(".group-call-tile-name");
        const hostBadge = tile.querySelector(".group-call-host-badge");
        const micBadge = tile.querySelector(".group-call-mic-badge");
        const cameraBadge = tile.querySelector(".group-call-camera-badge");

        name.textContent = isMe ? `${participant.username} (you)` : participant.username;
        avatar.textContent = initials(participant.username);
        hostBadge.classList.toggle("hidden", participant.is_host !== true);
        micBadge.textContent = participant.microphone_enabled === false ? "Muted" : "Mic";
        cameraBadge.classList.toggle(
            "hidden",
            activeState.call.call_mode !== "video"
        );
        cameraBadge.textContent = participant.camera_enabled === false
            ? "Camera off"
            : "Video";

        if (isMe) {
            const preview = localPreviewStream();
            video.srcObject = preview;
            video.muted = true;
            video.classList.toggle("mirrored", !screenTrack);
            video.play().catch(() => {});
        }

        const showVideo =
            activeState.call.call_mode === "video"
            && participant.camera_enabled !== false;

        tile.classList.toggle("camera-on", showVideo);
        return tile;
    }

    function renderTiles() {
        if (!activeState || membershipStatus() !== "joined") {
            return;
        }

        const joined = joinedParticipants();
        const joinedIds = new Set(joined.map((participant) => participant.user_id));

        ui.grid.querySelectorAll("[data-group-user]").forEach((tile) => {
            if (!joinedIds.has(tile.dataset.groupUser)) {
                clearSpeakingDetector(tile.dataset.groupUser);
                tile.remove();
            }
        });

        joined.forEach(updateTile);

        if (localStream) {
            attachSpeakingDetector(currentUser.id, localStream);
        }
    }

    function attachRemoteStream(userId, stream) {
        const participant = participantById(userId);

        if (!participant) {
            return;
        }

        const tile = updateTile(participant);
        const video = tile.querySelector(".group-call-video");
        video.srcObject = stream;
        video.muted = false;
        video.classList.remove("mirrored");
        video.play().catch(() => {});
        attachSpeakingDetector(userId, stream);
    }

    function amInitiator(remoteUserId) {
        return String(currentUser.id).localeCompare(String(remoteUserId)) < 0;
    }

    async function sendSignal(remoteUserId, signalType, payload) {
        if (!callId()) {
            return;
        }

        const { error } = await window.supabaseClient.rpc(
            "send_group_call_signal",
            {
                p_call_id: callId(),
                p_recipient_id: remoteUserId,
                p_signal_type: signalType,
                p_payload: payload
            }
        );

        if (error) {
            throw error;
        }
    }

    function applySenderBitrates(record) {
        const participantCount = joinedParticipants().length;
        const videoBitrate = participantCount >= 4 ? 550_000 : 800_000;

        for (const sender of record.pc.getSenders()) {
            if (sender.track?.kind !== "video") {
                continue;
            }

            const parameters = sender.getParameters();
            parameters.encodings = parameters.encodings?.length
                ? parameters.encodings
                : [{}];
            parameters.encodings[0].maxBitrate = videoBitrate;
            parameters.degradationPreference = "maintain-framerate";
            sender.setParameters(parameters).catch(() => {});
        }
    }

    function closePeer(remoteUserId) {
        const record = peerRecords.get(remoteUserId);

        if (!record) {
            return;
        }

        if (record.iceTimer) {
            window.clearTimeout(record.iceTimer);
        }

        record.pc.close();
        record.remoteStream?.getTracks().forEach((track) => track.stop());
        peerRecords.delete(remoteUserId);
        clearSpeakingDetector(remoteUserId);
    }

    async function flushIce(remoteUserId) {
        const record = peerRecords.get(remoteUserId);

        if (!record || !record.localIce.length) {
            return;
        }

        const candidates = record.localIce.splice(0);
        record.iceTimer = null;

        await sendSignal(remoteUserId, "ice", { candidates });
    }

    function queueIce(remoteUserId, candidate) {
        const record = peerRecords.get(remoteUserId);

        if (!record) {
            return;
        }

        record.localIce.push(candidate.toJSON());

        if (record.iceTimer) {
            return;
        }

        record.iceTimer = window.setTimeout(() => {
            flushIce(remoteUserId).catch((error) => {
                console.warn("Group-call ICE candidates could not be sent:", error);
            });
        }, ICE_BATCH_DELAY_MS);
    }

    async function ensurePeer(remoteUserId, { forceNew = false } = {}) {
        if (forceNew) {
            closePeer(remoteUserId);
        }

        if (peerRecords.has(remoteUserId)) {
            return peerRecords.get(remoteUserId);
        }

        const iceServers = await loadIceServers();
        const pc = new RTCPeerConnection({ iceServers });
        const remoteStream = new MediaStream();
        const record = {
            pc,
            remoteStream,
            pendingIce: [],
            localIce: [],
            iceTimer: null,
            makingOffer: false
        };

        peerRecords.set(remoteUserId, record);

        const audioTracks = localStream?.getAudioTracks() ?? [];
        const currentVideoTrack = screenTrack || cameraTrack;

        audioTracks.forEach((track) => pc.addTrack(track, localStream));

        if (!audioTracks.length) {
            pc.addTransceiver("audio", { direction: "recvonly" });
        }

        if (activeState.call.call_mode === "video") {
            const outgoingVideoTrack =
                currentVideoTrack || ensurePlaceholderVideoTrack();

            if (outgoingVideoTrack) {
                pc.addTrack(
                    outgoingVideoTrack,
                    currentVideoTrack && localStream
                        ? localStream
                        : new MediaStream([outgoingVideoTrack])
                );
            } else {
                pc.addTransceiver("video", { direction: "recvonly" });
            }
        }

        pc.addEventListener("track", (event) => {
            const tracks = event.streams[0]?.getTracks() ?? [event.track];

            for (const track of tracks) {
                if (!remoteStream.getTrackById(track.id)) {
                    remoteStream.addTrack(track);
                }
            }

            attachRemoteStream(remoteUserId, remoteStream);
        });

        pc.addEventListener("icecandidate", (event) => {
            if (event.candidate) {
                queueIce(remoteUserId, event.candidate);
            } else {
                flushIce(remoteUserId).catch(() => {});
            }
        });

        pc.addEventListener("connectionstatechange", () => {
            const tile = ui.grid.querySelector(
                `[data-group-user="${CSS.escape(remoteUserId)}"]`
            );

            tile?.classList.toggle(
                "reconnecting",
                pc.connectionState === "disconnected"
                || pc.connectionState === "connecting"
            );

            if (pc.connectionState === "connected") {
                applySenderBitrates(record);
            }

            if (
                pc.connectionState === "failed"
                && amInitiator(remoteUserId)
                && membershipStatus() === "joined"
            ) {
                restartPeerAndOffer(remoteUserId).catch(() => {});
            }
        });

        return record;
    }

    async function flushPendingRemoteIce(record) {
        if (!record.pc.remoteDescription) {
            return;
        }

        const candidates = record.pendingIce.splice(0);

        for (const candidate of candidates) {
            try {
                await record.pc.addIceCandidate(candidate);
            } catch (error) {
                console.warn("A group-call ICE candidate was rejected:", error);
            }
        }
    }

    async function createOffer(remoteUserId, { iceRestart = false } = {}) {
        const record = await ensurePeer(remoteUserId);

        if (record.makingOffer || record.pc.signalingState !== "stable") {
            return;
        }

        record.makingOffer = true;

        try {
            const offer = await record.pc.createOffer({ iceRestart });
            await record.pc.setLocalDescription(offer);
            await sendSignal(remoteUserId, "offer", {
                description: record.pc.localDescription.toJSON()
            });
        } finally {
            record.makingOffer = false;
        }
    }

    async function restartPeerAndOffer(remoteUserId) {
        await ensurePeer(remoteUserId, { forceNew: true });
        await createOffer(remoteUserId, { iceRestart: true });
    }

    async function processSignal(signal) {
        if (
            !signal
            || !activeState
            || signal.call_id !== callId()
            || signal.recipient_id !== currentUser.id
            || signal.sender_id === currentUser.id
        ) {
            return;
        }

        signalCursor = Math.max(signalCursor, Number(signal.id ?? 0));
        const senderId = signal.sender_id;

        if (!participantById(senderId)) {
            return;
        }

        if (signal.signal_type === "rejoin_request") {
            if (amInitiator(senderId)) {
                await restartPeerAndOffer(senderId);
            }
            return;
        }

        const record = await ensurePeer(senderId);
        const payload = signal.payload ?? {};

        if (signal.signal_type === "offer") {
            if (!payload.description) {
                return;
            }

            if (record.pc.signalingState === "have-local-offer") {
                await record.pc.setLocalDescription({ type: "rollback" });
            }

            await record.pc.setRemoteDescription(payload.description);
            await flushPendingRemoteIce(record);
            const answer = await record.pc.createAnswer();
            await record.pc.setLocalDescription(answer);
            await sendSignal(senderId, "answer", {
                description: record.pc.localDescription.toJSON()
            });
        } else if (signal.signal_type === "answer") {
            if (
                payload.description
                && record.pc.signalingState === "have-local-offer"
            ) {
                await record.pc.setRemoteDescription(payload.description);
                await flushPendingRemoteIce(record);
            }
        } else if (signal.signal_type === "ice") {
            const candidates = Array.isArray(payload.candidates)
                ? payload.candidates
                : [];

            for (const candidate of candidates) {
                if (record.pc.remoteDescription) {
                    try {
                        await record.pc.addIceCandidate(candidate);
                    } catch (error) {
                        console.warn("A group-call ICE candidate was rejected:", error);
                    }
                } else {
                    record.pendingIce.push(candidate);
                }
            }
        } else if (signal.signal_type === "media_state") {
            const participant = participantById(senderId);

            if (participant) {
                participant.microphone_enabled = payload.microphone !== false;
                participant.camera_enabled = payload.camera !== false;
                updateTile(participant);
            }
        }
    }

    async function loadNewSignals() {
        if (!callId() || membershipStatus() !== "joined") {
            return;
        }

        const { data, error } = await window.supabaseClient.rpc(
            "get_group_call_signals",
            {
                p_call_id: callId(),
                p_after_id: signalCursor
            }
        );

        if (error) {
            throw error;
        }

        for (const signal of data ?? []) {
            await processSignal(signal);
        }
    }

    async function syncPeers({ restored = false } = {}) {
        if (membershipStatus() !== "joined") {
            return;
        }

        const remotes = joinedParticipants()
            .filter((participant) => participant.user_id !== currentUser.id);
        const remoteIds = new Set(remotes.map((participant) => participant.user_id));

        for (const remoteUserId of Array.from(peerRecords.keys())) {
            if (!remoteIds.has(remoteUserId)) {
                closePeer(remoteUserId);
            }
        }

        for (const participant of remotes) {
            const existed = peerRecords.has(participant.user_id);
            await ensurePeer(participant.user_id);

            if (!existed && amInitiator(participant.user_id)) {
                await createOffer(participant.user_id).catch((error) => {
                    console.warn("Group-call offer could not be created:", error);
                });
            } else if (!existed && restored && !amInitiator(participant.user_id)) {
                await sendSignal(
                    participant.user_id,
                    "rejoin_request",
                    { page: window.location.pathname, at: new Date().toISOString() }
                ).catch(() => {});
            }
        }

        for (const record of peerRecords.values()) {
            applySenderBitrates(record);
        }
    }

    function updateControlLabels() {
        const microphoneTrack = localStream?.getAudioTracks()[0] ?? null;
        const activeVideoTrack = screenTrack || cameraTrack;
        const microphoneOn = Boolean(microphoneTrack?.enabled);
        const cameraOn = Boolean(activeVideoTrack?.enabled);

        ui.microphoneButton.textContent = !microphoneTrack
            ? "No mic"
            : microphoneOn ? "Mute" : "Unmute";
        ui.microphoneButton.disabled = !microphoneTrack;

        const videoMode = activeState?.call?.call_mode === "video";
        ui.cameraButton.classList.toggle("hidden", !videoMode);
        ui.screenButton.classList.toggle("hidden", !videoMode);
        ui.cameraButton.textContent = !cameraTrack
            ? "No camera"
            : cameraTrack.enabled ? "Camera off" : "Camera on";
        ui.cameraButton.disabled = !cameraTrack || Boolean(screenTrack);

        ui.screenButton.disabled =
            !videoMode
            || !navigator.mediaDevices?.getDisplayMedia
            || (!cameraTrack && !ensurePlaceholderVideoTrack());
        ui.screenButton.textContent = screenTrack ? "Stop sharing" : "Share screen";

        ui.endButton.classList.toggle("hidden", !isHost());
    }

    async function broadcastMediaState() {
        if (membershipStatus() !== "joined") {
            return;
        }

        const microphone = Boolean(localStream?.getAudioTracks()[0]?.enabled);
        const camera = activeState.call.call_mode === "video"
            && Boolean((screenTrack || cameraTrack)?.enabled);

        await window.supabaseClient.rpc(
            "update_group_call_media",
            {
                p_call_id: callId(),
                p_microphone_enabled: microphone,
                p_camera_enabled: camera
            }
        ).catch(() => {});

        for (const participant of joinedParticipants()) {
            if (participant.user_id === currentUser.id) {
                participant.microphone_enabled = microphone;
                participant.camera_enabled = camera;
                continue;
            }

            sendSignal(participant.user_id, "media_state", {
                microphone,
                camera
            }).catch(() => {});
        }

        renderTiles();
        updateControlLabels();
    }

    function renderStage() {
        if (membershipStatus() !== "joined") {
            return;
        }

        const joined = joinedParticipants();
        const mode = activeState.call.call_mode;

        ui.modeLabel.textContent = `GROUP ${mode.toUpperCase()} CALL`;
        ui.heading.textContent = mode === "video" ? "Group video call" : "Group audio call";
        ui.count.textContent = `${joined.length}/${activeState.call.max_participants}`;
        ui.grid.dataset.mode = mode;
        renderTiles();
        updateControlLabels();
    }

    function startDurationClock() {
        window.clearInterval(durationTimer);
        const startedAt = new Date(activeState.call.created_at).getTime();

        const render = () => {
            const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            ui.duration.textContent = hours > 0
                ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
                : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        };

        render();
        durationTimer = window.setInterval(render, 1000);
    }

    function startHeartbeat() {
        window.clearInterval(heartbeatTimer);

        const touch = async () => {
            if (!callId() || membershipStatus() !== "joined") {
                return;
            }

            const { data } = await window.supabaseClient.rpc(
                "touch_group_call",
                { p_call_id: callId() }
            );

            if (data !== true) {
                scheduleRefresh();
            }
        };

        touch().catch(() => {});
        heartbeatTimer = window.setInterval(() => touch().catch(() => {}), HEARTBEAT_INTERVAL_MS);
    }

    async function subscribeRoom(roomId) {
        if (roomChannel) {
            await window.supabaseClient.removeChannel(roomChannel);
            roomChannel = null;
        }

        roomChannel = window.supabaseClient
            .channel(`group-call-room-${roomId}-${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "group_call_participants",
                    filter: `call_id=eq.${roomId}`
                },
                scheduleRefresh
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "group_calls",
                    filter: `id=eq.${roomId}`
                },
                scheduleRefresh
            )
            .subscribe();
    }

    async function enterJoinedCall(state, { newlyJoined = false } = {}) {
        activeState = state;
        ui.incoming.classList.add("hidden");
        ui.stage.classList.remove("hidden");
        ui.root.classList.remove("hidden");
        setExpanded(false);
        setError();

        await acquireLocalMedia(state.call.call_mode);
        await subscribeRoom(state.call.id);

        if (newlyJoined) {
            /*
             * Existing participants can begin signalling immediately after
             * our database status flips to joined. Start from zero so an
             * offer that arrived during this page's join transition is not
             * accidentally treated as old history.
             */
            signalCursor = 0;
        } else {
            const cursorResult = await window.supabaseClient.rpc(
                "get_group_call_signal_cursor",
                { p_call_id: state.call.id }
            );

            if (!cursorResult.error) {
                signalCursor = Number(cursorResult.data ?? 0);
            }
        }

        renderStage();
        startDurationClock();
        startHeartbeat();
        await broadcastMediaState();

        if (newlyJoined) {
            await loadNewSignals().catch(() => {});
        }

        const joinedAt = new Date(state.membership.joined_at ?? Date.now()).getTime();
        const restored = !newlyJoined && Date.now() - joinedAt > 5000;
        await syncPeers({ restored });

        if (pendingSignals.length) {
            const queued = pendingSignals.splice(0);
            for (const signal of queued) {
                await processSignal(signal);
            }
        }
    }

    async function refreshState({ newlyJoined = false } = {}) {
        if (!currentUser) {
            return;
        }

        const previousCallId = callId();
        const previousStatus = membershipStatus();

        const { data, error } = await window.supabaseClient.rpc(
            "get_my_active_group_call"
        );

        if (error) {
            console.warn("Group-call state could not be loaded:", error);
            return;
        }

        if (!data) {
            if (previousStatus === "joined") {
                finishLocalCall();
                showToast("Group call ended.");
            } else {
                activeState = null;
                ui.incoming.classList.add("hidden");
                updateRootVisibility();
            }
            return;
        }

        activeState = data;

        if (membershipStatus() === "invited") {
            if (previousStatus === "joined" && previousCallId !== callId()) {
                finishLocalCall({ keepState: true });
                activeState = data;
            }
            showIncomingInvite();
            return;
        }

        if (membershipStatus() !== "joined") {
            return;
        }

        if (
            previousStatus !== "joined"
            || previousCallId !== callId()
            || ui.stage.classList.contains("hidden")
        ) {
            await enterJoinedCall(data, { newlyJoined });
            return;
        }

        renderStage();
        await syncPeers({ restored: false });
    }

    function scheduleRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
            refreshState().catch((error) => {
                console.warn("Group-call refresh failed:", error);
            });
        }, REFRESH_DELAY_MS);
    }

    async function respondToInvite(accept) {
        if (actionBusy || membershipStatus() !== "invited") {
            return;
        }

        if (accept && directCallActive()) {
            showToast("Finish your current one-to-one call before joining.", "error");
            return;
        }

        actionBusy = true;

        try {
            if (accept) {
                await acquireLocalMedia(activeState.call.call_mode);
            }

            const { error } = await window.supabaseClient.rpc(
                "respond_to_group_call",
                {
                    p_call_id: callId(),
                    p_accept: accept
                }
            );

            if (error) {
                throw error;
            }

            if (!accept) {
                activeState = null;
                ui.incoming.classList.add("hidden");
                updateRootVisibility();
                return;
            }

            await refreshState({ newlyJoined: true });
        } catch (error) {
            if (accept && membershipStatus() === "invited") {
                stopLocalMedia();
            }
            showToast(error.message || "The group call could not be joined.", "error");
        } finally {
            actionBusy = false;
        }
    }

    function composerCapacity() {
        if (composerPurpose === "invite" && activeState?.call) {
            return Math.max(
                0,
                Number(activeState.call.max_participants)
                - activeParticipants().length
            );
        }

        return modeLimit(composerMode) - 1;
    }

    function updateComposerSummary() {
        const capacity = composerCapacity();
        ui.selectionCount.textContent =
            `${composerSelected.size} selected`;
        ui.selectionLimit.textContent =
            `Up to ${capacity} friend${capacity === 1 ? "" : "s"}`;

        ui.submitButton.disabled =
            composerSelected.size < 1
            || composerSelected.size > capacity
            || actionBusy;

        if (composerPurpose === "invite") {
            ui.submitButton.textContent = "Send invitations";
        } else {
            ui.submitButton.textContent = composerMode === "video"
                ? "Start video call"
                : "Start audio call";
        }

        ui.friendList.querySelectorAll("input[type=checkbox]")
            .forEach((input) => {
                input.checked = composerSelected.has(input.value);
                input.disabled =
                    !input.checked
                    && composerSelected.size >= capacity;
            });
    }

    function renderComposerFriends() {
        ui.friendList.replaceChildren();
        const excluded = new Set(
            composerPurpose === "invite"
                ? activeParticipants().map((participant) => participant.user_id)
                : []
        );

        const available = composerFriends.filter(
            (friend) => !excluded.has(friend.user_id)
        );

        if (!available.length) {
            const empty = document.createElement("p");
            empty.className = "group-call-empty";
            empty.textContent = composerPurpose === "invite"
                ? "No other friends can be invited to this call."
                : "You need at least one friend before starting a group call.";
            ui.friendList.append(empty);
            updateComposerSummary();
            return;
        }

        for (const friend of available) {
            const label = document.createElement("label");
            label.className = "group-call-friend-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = friend.user_id;
            checkbox.checked = composerSelected.has(friend.user_id);

            const avatar = document.createElement("span");
            avatar.className = "group-call-friend-avatar";
            avatar.textContent = initials(friend.username);

            const copy = document.createElement("span");
            copy.className = "group-call-friend-copy";
            copy.innerHTML = `<strong></strong><small>Lv. ${Number(friend.level ?? 1)}</small>`;
            copy.querySelector("strong").textContent = friend.username;

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    if (composerSelected.size >= composerCapacity()) {
                        checkbox.checked = false;
                        return;
                    }
                    composerSelected.add(friend.user_id);
                } else {
                    composerSelected.delete(friend.user_id);
                }
                updateComposerSummary();
            });

            label.append(checkbox, avatar, copy);
            ui.friendList.append(label);
        }

        updateComposerSummary();
    }

    async function openComposer(purpose = null) {
        if (!currentUser) {
            return;
        }

        if (purpose === "create" && directCallActive()) {
            showToast("Finish your current one-to-one call first.", "error");
            return;
        }

        if (!purpose) {
            purpose = membershipStatus() === "joined" ? "invite" : "create";
        }

        if (purpose === "create" && membershipStatus() === "joined") {
            purpose = "invite";
        }

        if (purpose === "create" && membershipStatus() === "invited") {
            showToast("Respond to your pending group-call invitation first.", "error");
            return;
        }

        composerPurpose = purpose;
        composerMode = activeState?.call?.call_mode ?? "video";
        composerSelected.clear();
        setComposerMessage();

        ui.composerTitle.textContent = purpose === "invite"
            ? "Invite friends"
            : "Start a group call";
        ui.modePicker.classList.toggle("hidden", purpose === "invite");

        ui.root.classList.remove("hidden");
        ui.composer.classList.remove("hidden");
        ui.backdrop.classList.remove("hidden");

        const { data, error } = await window.supabaseClient.rpc(
            "get_my_friends",
            { p_search: null }
        );

        if (error) {
            setComposerMessage(error.message || "Friends could not be loaded.");
            return;
        }

        composerFriends = data ?? [];
        renderComposerFriends();
        updateModeButtons();
    }

    function closeComposer() {
        ui.composer.classList.add("hidden");
        ui.backdrop.classList.toggle(
            "hidden",
            !ui.root.classList.contains("group-call-expanded")
        );
        updateRootVisibility();
    }

    function updateModeButtons() {
        ui.modePicker.querySelectorAll("[data-group-mode]")
            .forEach((button) => {
                button.classList.toggle(
                    "active",
                    button.dataset.groupMode === composerMode
                );
            });
        updateComposerSummary();
    }

    async function submitComposer() {
        if (actionBusy || !composerSelected.size) {
            return;
        }

        actionBusy = true;
        setComposerMessage();
        updateComposerSummary();
        const inviteeIds = Array.from(composerSelected);

        try {
            if (composerPurpose === "invite") {
                const { data, error } = await window.supabaseClient.rpc(
                    "invite_to_group_call",
                    {
                        p_call_id: callId(),
                        p_invitee_ids: inviteeIds
                    }
                );

                if (error) {
                    throw error;
                }

                closeComposer();
                showToast(
                    `${Number(data ?? 0)} invitation${Number(data ?? 0) === 1 ? "" : "s"} sent.`
                );
                await refreshState();
                return;
            }

            if (directCallActive()) {
                throw new Error("Finish your current one-to-one call first.");
            }

            await acquireLocalMedia(composerMode);

            const { error } = await window.supabaseClient.rpc(
                "create_group_call",
                {
                    p_call_mode: composerMode,
                    p_invitee_ids: inviteeIds
                }
            );

            if (error) {
                throw error;
            }

            closeComposer();
            await refreshState({ newlyJoined: true });
        } catch (error) {
            setComposerMessage(error.message || "The group call could not be started.");
        } finally {
            actionBusy = false;
            updateComposerSummary();
        }
    }

    function toggleMicrophone() {
        const track = localStream?.getAudioTracks()[0];

        if (!track) {
            return;
        }

        track.enabled = !track.enabled;
        broadcastMediaState().catch(() => {});
    }

    function toggleCamera() {
        if (!cameraTrack || screenTrack) {
            return;
        }

        cameraTrack.enabled = !cameraTrack.enabled;
        broadcastMediaState().catch(() => {});
    }

    async function replaceOutgoingVideo(track) {
        for (const record of peerRecords.values()) {
            const sender = record.pc.getSenders()
                .find((candidate) => candidate.track?.kind === "video");

            if (sender) {
                await sender.replaceTrack(track);
            }
        }
    }

    async function stopScreenShare() {
        if (!screenTrack) {
            return;
        }

        const oldScreen = screenTrack;
        screenTrack = null;
        await replaceOutgoingVideo(
            cameraTrack ?? ensurePlaceholderVideoTrack() ?? null
        );
        oldScreen.stop();
        renderTiles();
        await broadcastMediaState();
    }

    async function toggleScreenShare() {
        if (screenTrack) {
            await stopScreenShare();
            return;
        }

        if (!navigator.mediaDevices?.getDisplayMedia) {
            showToast("Screen sharing is not supported in this browser.", "error");
            return;
        }

        try {
            const display = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 15, max: 20 } },
                audio: false
            });
            screenTrack = display.getVideoTracks()[0] ?? null;

            if (!screenTrack) {
                return;
            }

            screenTrack.addEventListener("ended", () => {
                if (screenTrack) {
                    stopScreenShare().catch(() => {});
                }
            }, { once: true });

            await replaceOutgoingVideo(screenTrack);
            renderTiles();
            await broadcastMediaState();
        } catch (error) {
            if (error?.name !== "NotAllowedError") {
                showToast(error.message || "Screen sharing could not start.", "error");
            }
        }
    }

    async function leaveCall() {
        if (actionBusy || membershipStatus() !== "joined") {
            return;
        }

        actionBusy = true;
        const roomId = callId();

        try {
            await window.supabaseClient.rpc(
                "leave_group_call",
                { p_call_id: roomId }
            );
        } finally {
            finishLocalCall();
            showToast("You left the group call.");
            actionBusy = false;
        }
    }

    async function endCallForEveryone() {
        if (!isHost() || actionBusy) {
            return;
        }

        const confirmed = window.confirm(
            "End this group call for everyone?"
        );

        if (!confirmed) {
            return;
        }

        actionBusy = true;
        const roomId = callId();

        try {
            const { error } = await window.supabaseClient.rpc(
                "end_group_call",
                { p_call_id: roomId }
            );

            if (error) {
                throw error;
            }

            finishLocalCall();
            showToast("Group call ended.");
        } catch (error) {
            showToast(error.message || "The group call could not be ended.", "error");
        } finally {
            actionBusy = false;
        }
    }

    function finishLocalCall({ keepState = false } = {}) {
        window.clearInterval(heartbeatTimer);
        window.clearInterval(durationTimer);
        heartbeatTimer = null;
        durationTimer = null;

        for (const remoteUserId of Array.from(peerRecords.keys())) {
            closePeer(remoteUserId);
        }

        stopAllSpeakingDetectors();
        stopLocalMedia();
        signalCursor = 0;
        pendingSignals = [];
        setExpanded(false);
        ui.stage.classList.add("hidden");
        ui.devicePanel.classList.add("hidden");
        ui.backdrop.classList.add("hidden");
        setError();

        if (roomChannel) {
            window.supabaseClient.removeChannel(roomChannel).catch(() => {});
            roomChannel = null;
        }

        if (!keepState) {
            activeState = null;
        }

        updateRootVisibility();
    }

    async function subscribeGlobal() {
        if (globalChannel) {
            return;
        }

        globalChannel = window.supabaseClient
            .channel(`group-call-global-${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "group_call_participants",
                    filter: `user_id=eq.${currentUser.id}`
                },
                scheduleRefresh
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "group_call_signals",
                    filter: `recipient_id=eq.${currentUser.id}`
                },
                (payload) => {
                    if (!activeState || membershipStatus() !== "joined") {
                        pendingSignals.push(payload.new);
                        return;
                    }
                    processSignal(payload.new).catch((error) => {
                        console.warn("Group-call signal processing failed:", error);
                    });
                }
            )
            .subscribe();
    }

    document.addEventListener("click", (event) => {
        ensureAudioContext();

        const directCallButton = event.target.closest(
            "[data-player-call-user][data-player-call-mode]"
        );

        if (directCallButton && membershipStatus() === "joined") {
            event.preventDefault();
            event.stopImmediatePropagation();
            showToast("Leave the group call before starting a one-to-one call.", "error");
            return;
        }

        if (event.target.closest("[data-group-call-launch]")) {
            event.preventDefault();
            openComposer("create").catch(() => {});
            return;
        }

        const modeButton = event.target.closest("[data-group-mode]");

        if (modeButton && composerPurpose === "create") {
            composerMode = modeButton.dataset.groupMode === "audio" ? "audio" : "video";
            const capacity = composerCapacity();

            while (composerSelected.size > capacity) {
                const last = Array.from(composerSelected).at(-1);
                composerSelected.delete(last);
            }

            updateModeButtons();
            renderComposerFriends();
            return;
        }

        const actionButton = event.target.closest(
            "#group-call-root [data-group-action]"
        );

        if (!actionButton) {
            return;
        }

        const action = actionButton.dataset.groupAction;

        if (action === "accept") {
            respondToInvite(true);
        } else if (action === "decline") {
            respondToInvite(false);
        } else if (action === "expand") {
            setExpanded(true);
        } else if (action === "mini") {
            setExpanded(false);
        } else if (action === "invite") {
            openComposer("invite").catch(() => {});
        } else if (action === "devices") {
            ui.root.classList.remove("hidden");
            ui.devicePanel.classList.remove("hidden");
            refreshMicrophoneDevices().catch(() => {});
        } else if (action === "close-devices") {
            ui.devicePanel.classList.add("hidden");
            updateRootVisibility();
        } else if (action === "microphone") {
            toggleMicrophone();
        } else if (action === "camera") {
            toggleCamera();
        } else if (action === "screen") {
            toggleScreenShare().catch(() => {});
        } else if (action === "leave") {
            leaveCall();
        } else if (action === "end") {
            endCallForEveryone();
        } else if (action === "close-composer") {
            closeComposer();
        } else if (action === "submit-composer") {
            submitComposer();
        }
    }, true);

    async function initialise() {
        createUi();
        installLaunchButton();

        if (!window.RTCPeerConnection) {
            console.warn("This browser does not support group WebRTC calls.");
            return;
        }

        try {
            const { data: { user }, error } =
                await window.supabaseClient.auth.getUser();

            if (error || !user) {
                return;
            }

            currentUser = user;
            await subscribeGlobal();
            await refreshState();

            navigator.mediaDevices?.addEventListener?.(
                "devicechange",
                () => {
                    if (!ui.devicePanel.classList.contains("hidden")) {
                        refreshMicrophoneDevices().catch(() => {});
                    }
                }
            );

            window.setInterval(() => {
                if (membershipStatus() === "joined") {
                    loadNewSignals().catch(() => {});
                }
            }, 2500);
        } catch (error) {
            console.warn("Group calls could not be initialised:", error);
        }
    }

    window.groupCalls = {
        open: () => openComposer(),
        leave: () => leaveCall(),
        end: () => endCallForEveryone(),
        get activeCall() {
            return membershipStatus() === "joined"
                ? activeState?.call ?? null
                : null;
        },
        get invitation() {
            return membershipStatus() === "invited"
                ? activeState?.call ?? null
                : null;
        }
    };

    initialise();
})();
