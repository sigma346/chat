(() => {
    if (
        window.playerCalls
        || !window.supabaseClient
    ) {
        return;
    }

    const RING_DURATION_MS = 45_000;
    const HEARTBEAT_INTERVAL_MS = 30_000;
    const ICE_BATCH_DELAY_MS = 140;
    const MICROPHONE_STORAGE_KEY =
        "preferred-player-call-microphone-v1";
    const fallbackIceServers = [
        {
            urls: ["stun:stun.cloudflare.com:3478"]
        }
    ];

    let currentUser = null;
    let accessToken = null;
    let currentCall = null;
    let localStream = null;
    let remoteStream = null;
    let peerConnection = null;
    let callsChannel = null;
    let signalsChannel = null;
    let heartbeatTimer = null;
    let durationTimer = null;
    let expiryTimer = null;
    let iceFlushTimer = null;
    let lastSignalId = 0;
    let startingCall = false;
    let settingUpPeer = null;
    let makingOffer = false;
    let pendingLocalCandidates = [];
    let pendingRemoteCandidates = [];
    let pendingSignals = [];
    const notifiedIncomingCallIds = new Set();
    let selectedMicrophoneId = loadSelectedMicrophone();
    let cameraWarning = "";
    let mediaState = {
        microphone: true,
        camera: true
    };

    const ui = {};

    function singleRpcRow(data) {
        return Array.isArray(data)
            ? data[0] ?? null
            : data ?? null;
    }

    function loadSelectedMicrophone() {
        try {
            return window.localStorage.getItem(
                MICROPHONE_STORAGE_KEY
            ) || "";
        } catch (error) {
            return "";
        }
    }

    function saveSelectedMicrophone(deviceId) {
        selectedMicrophoneId = String(deviceId ?? "");

        try {
            if (selectedMicrophoneId) {
                window.localStorage.setItem(
                    MICROPHONE_STORAGE_KEY,
                    selectedMicrophoneId
                );
            } else {
                window.localStorage.removeItem(
                    MICROPHONE_STORAGE_KEY
                );
            }
        } catch (error) {
            console.warn(
                "The microphone preference could not be saved:",
                error
            );
        }
    }

    function createCallUi() {
        if (document.querySelector("#player-call-root")) {
            return;
        }

        const root = document.createElement("section");
        root.id = "player-call-root";
        root.className = "player-call-root hidden";
        root.setAttribute("aria-live", "polite");

        root.innerHTML = `
            <div class="player-call-backdrop" data-call-action="minimise"></div>

            <aside class="player-call-card hidden" aria-label="Player call">
                <div class="player-call-card-icon" aria-hidden="true">☎</div>
                <div class="player-call-card-copy">
                    <span class="player-call-kicker"></span>
                    <strong class="player-call-peer"></strong>
                    <span class="player-call-card-status"></span>
                </div>
                <div class="player-call-card-actions">
                    <button
                        type="button"
                        class="player-call-button neutral"
                        data-call-action="devices"
                    >Devices</button>
                    <button
                        type="button"
                        class="player-call-button accept hidden"
                        data-call-action="accept"
                    >Accept</button>
                    <button
                        type="button"
                        class="player-call-button neutral hidden"
                        data-call-action="rejoin"
                    >Rejoin</button>
                    <button
                        type="button"
                        class="player-call-button danger"
                        data-call-action="decline"
                    >Decline</button>
                </div>
            </aside>

            <div class="player-call-stage hidden" role="dialog" aria-modal="true">
                <header class="player-call-stage-header">
                    <div>
                        <span class="player-call-kicker">PRIVATE CALL</span>
                        <strong class="player-call-stage-peer"></strong>
                    </div>
                    <div class="player-call-stage-meta">
                        <span class="player-call-duration">00:00</span>
                        <span class="player-call-connection">Connecting…</span>
                    </div>
                </header>

                <div class="player-call-media">
                    <video
                        class="player-call-remote-video"
                        autoplay
                        playsinline
                    ></video>
                    <div class="player-call-audio-avatar" aria-hidden="true">
                        <span>☎</span>
                    </div>
                    <div class="player-call-remote-muted hidden">Camera off</div>

                    <video
                        class="player-call-local-video"
                        autoplay
                        muted
                        playsinline
                    ></video>
                </div>

                <p class="player-call-error" role="alert"></p>

                <div class="player-call-controls">
                    <button
                        type="button"
                        class="player-call-control"
                        data-call-action="devices"
                    >Devices</button>
                    <button
                        type="button"
                        class="player-call-control"
                        data-call-action="microphone"
                        aria-pressed="false"
                    >Mute</button>
                    <button
                        type="button"
                        class="player-call-control"
                        data-call-action="camera"
                        aria-pressed="false"
                    >Camera off</button>
                    <button
                        type="button"
                        class="player-call-control hangup"
                        data-call-action="hangup"
                    >End call</button>
                </div>
            </div>

            <aside
                class="player-call-device-panel hidden"
                role="dialog"
                aria-modal="false"
                aria-labelledby="player-call-device-title"
            >
                <header class="player-call-device-header">
                    <div>
                        <span class="player-call-kicker">CALL SETTINGS</span>
                        <h2 id="player-call-device-title">Microphone</h2>
                    </div>
                    <button
                        type="button"
                        class="player-call-device-close"
                        data-call-action="close-devices"
                        aria-label="Close call settings"
                    >×</button>
                </header>

                <label class="player-call-device-field">
                    <span>Microphone input</span>
                    <select class="player-call-microphone-select">
                        <option value="">Default microphone</option>
                    </select>
                </label>

                <div class="player-call-device-actions">
                    <button
                        type="button"
                        class="player-call-button accept"
                        data-call-action="retry-microphone"
                    >Test microphone permission</button>
                </div>

                <p class="player-call-device-status" role="status"></p>

                <div class="player-call-permission-help hidden">
                    <strong>If the permission prompt will not return:</strong>
                    <ol>
                        <li>Select the lock or site-controls icon beside the address.</li>
                        <li>Set <b>Microphone</b> to <b>Allow</b>.</li>
                        <li>Check that Windows/macOS also allows microphone access for the browser.</li>
                        <li>Reload the website, then press the test button again.</li>
                    </ol>
                </div>
            </aside>

            <div class="player-call-toast hidden" role="status"></div>
        `;

        document.body.append(root);

        ui.root = root;
        ui.backdrop = root.querySelector(".player-call-backdrop");
        ui.card = root.querySelector(".player-call-card");
        ui.cardKicker = root.querySelector(
            ".player-call-card .player-call-kicker"
        );
        ui.cardPeer = root.querySelector(".player-call-peer");
        ui.cardStatus = root.querySelector(
            ".player-call-card-status"
        );
        ui.acceptButton = root.querySelector(
            '[data-call-action="accept"]'
        );
        ui.rejoinButton = root.querySelector(
            '[data-call-action="rejoin"]'
        );
        ui.declineButton = root.querySelector(
            '[data-call-action="decline"]'
        );
        ui.stage = root.querySelector(".player-call-stage");
        ui.stagePeer = root.querySelector(
            ".player-call-stage-peer"
        );
        ui.duration = root.querySelector(".player-call-duration");
        ui.connection = root.querySelector(
            ".player-call-connection"
        );
        ui.remoteVideo = root.querySelector(
            ".player-call-remote-video"
        );
        ui.localVideo = root.querySelector(
            ".player-call-local-video"
        );
        ui.audioAvatar = root.querySelector(
            ".player-call-audio-avatar"
        );
        ui.remoteMuted = root.querySelector(
            ".player-call-remote-muted"
        );
        ui.error = root.querySelector(".player-call-error");
        ui.microphoneButton = root.querySelector(
            '[data-call-action="microphone"]'
        );
        ui.cameraButton = root.querySelector(
            '[data-call-action="camera"]'
        );
        ui.devicePanel = root.querySelector(
            ".player-call-device-panel"
        );
        ui.microphoneSelect = root.querySelector(
            ".player-call-microphone-select"
        );
        ui.deviceStatus = root.querySelector(
            ".player-call-device-status"
        );
        ui.permissionHelp = root.querySelector(
            ".player-call-permission-help"
        );
        ui.retryMicrophoneButton = root.querySelector(
            '[data-call-action="retry-microphone"]'
        );
        ui.toast = root.querySelector(".player-call-toast");

        ui.microphoneSelect.addEventListener(
            "change",
            () => {
                chooseMicrophone(
                    ui.microphoneSelect.value
                ).catch((error) => {
                    setDeviceStatus(
                        error.message
                        || "The microphone could not be changed.",
                        true
                    );
                });
            }
        );
    }

    function installCallSettingsLaunch() {
        if (
            document.querySelector("[data-player-call-settings]")
            || !window.location.pathname.endsWith("friends.html")
        ) {
            return;
        }

        const introduction = document.querySelector(
            ".friends-hero > div:first-child"
        );

        if (!introduction) {
            return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "player-call-settings-launch";
        button.dataset.playerCallSettings = "true";
        button.textContent = "Call settings";
        introduction.append(button);
    }

    function peerId(call = currentCall) {
        if (!call || !currentUser) {
            return null;
        }

        return call.caller_id === currentUser.id
            ? call.callee_id
            : call.caller_id;
    }

    function peerName(call = currentCall) {
        if (!call || !currentUser) {
            return "Player";
        }

        return call.caller_id === currentUser.id
            ? call.callee_username
            : call.caller_username;
    }

    function isCaller(call = currentCall) {
        return Boolean(
            call
            && currentUser
            && call.caller_id === currentUser.id
        );
    }

    function notifyIncomingCall(call) {
        if (
            !call?.id
            || isCaller(call)
            || notifiedIncomingCallIds.has(call.id)
        ) {
            return;
        }

        notifiedIncomingCallIds.add(call.id);
        const mode = call.call_mode === "video" ? "video" : "audio";
        const detail = {
            title: `Incoming ${mode} call`,
            body: `${peerName(call)} is calling you.`,
            tag: `player-call-${call.id}`,
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

    function showToast(message, type = "") {
        if (!ui.toast) {
            return;
        }

        ui.root.classList.remove("hidden");
        ui.toast.textContent = message;
        ui.toast.className =
            `player-call-toast ${type}`.trim();

        window.setTimeout(() => {
            ui.toast.classList.add("hidden");

            if (
                !currentCall
                && ui.devicePanel?.classList.contains("hidden")
            ) {
                ui.root.classList.add("hidden");
            }
        }, 3200);
    }

    function setCallError(message = "") {
        if (ui.error) {
            ui.error.textContent = message;
        }
    }

    function showCameraFallbackNotice() {
        if (!cameraWarning) {
            return;
        }

        const message = cameraWarning;
        cameraWarning = "";
        showToast(message, "warning");
    }

    function showMediaFailure(error, fallbackMessage) {
        const message = error?.message || fallbackMessage;
        showToast(message, "error");

        if (String(error?.code ?? "").startsWith("microphone_")) {
            openDeviceSettings(message).catch(() => {});
        }
    }

    function setConnectionStatus(message) {
        if (ui.connection) {
            ui.connection.textContent = message;
        }
    }

    function setDeviceStatus(message = "", error = false) {
        if (!ui.deviceStatus) {
            return;
        }

        ui.deviceStatus.textContent = message;
        ui.deviceStatus.classList.toggle("error", error);
    }

    function microphonePermissionError(originalError) {
        const error = new Error(
            "Microphone access is blocked. Open Call settings for the browser and operating-system permission steps."
        );
        error.code = "microphone_permission";
        error.originalName = originalError?.name ?? "NotAllowedError";
        return error;
    }

    async function microphonePermissionState() {
        if (!navigator.permissions?.query) {
            return "unknown";
        }

        try {
            const result = await navigator.permissions.query({
                name: "microphone"
            });
            return result.state;
        } catch (error) {
            return "unknown";
        }
    }

    async function refreshMicrophoneDevices() {
        if (!ui.microphoneSelect) {
            return [];
        }

        if (!navigator.mediaDevices?.enumerateDevices) {
            setDeviceStatus(
                "This browser cannot list microphone devices.",
                true
            );
            return [];
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter(
            (device) => device.kind === "audioinput"
        );
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Default microphone";
        ui.microphoneSelect.replaceChildren(defaultOption);

        microphones.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.textContent = device.label
                || `Microphone ${index + 1}`;
            ui.microphoneSelect.append(option);
        });

        const selectedExists = microphones.some(
            (device) => device.deviceId === selectedMicrophoneId
        );

        if (selectedMicrophoneId && !selectedExists) {
            saveSelectedMicrophone("");
        }

        ui.microphoneSelect.value = selectedMicrophoneId;
        return microphones;
    }

    async function openDeviceSettings(message = "") {
        ui.root.classList.remove("hidden");
        ui.devicePanel.classList.remove("hidden");
        setDeviceStatus(message, Boolean(message));

        const permissionState = await microphonePermissionState();
        ui.permissionHelp.classList.toggle(
            "hidden",
            permissionState !== "denied"
            && !message.toLowerCase().includes("blocked")
            && !message.toLowerCase().includes("operating system")
        );

        try {
            const microphones = await refreshMicrophoneDevices();

            if (!message && microphones.length) {
                setDeviceStatus(
                    `${microphones.length} microphone${
                        microphones.length === 1 ? "" : "s"
                    } available.`
                );
            } else if (!message && permissionState === "denied") {
                setDeviceStatus(
                    "Microphone permission is currently blocked.",
                    true
                );
            }
        } catch (error) {
            setDeviceStatus(
                "Microphone devices could not be listed.",
                true
            );
        }
    }

    function closeDeviceSettings() {
        ui.devicePanel.classList.add("hidden");

        if (!currentCall && ui.toast.classList.contains("hidden")) {
            ui.root.classList.add("hidden");
        }
    }

    function microphoneConstraints(deviceId = selectedMicrophoneId) {
        return {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(deviceId
                ? { deviceId: { exact: deviceId } }
                : {})
        };
    }

    async function requestMicrophone(deviceId = selectedMicrophoneId) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: microphoneConstraints(deviceId),
                video: false
            });
        } catch (error) {
            if (
                deviceId
                && (
                    error?.name === "NotFoundError"
                    || error?.name === "OverconstrainedError"
                )
            ) {
                saveSelectedMicrophone("");
                return requestMicrophone("");
            }

            if (
                error?.name === "NotAllowedError"
                || error?.name === "PermissionDeniedError"
                || error?.name === "SecurityError"
            ) {
                throw microphonePermissionError(error);
            }

            const unavailableError = new Error(
                "The browser found the microphone but could not open it. Check Windows/macOS microphone privacy settings and close other apps using the device."
            );
            unavailableError.code = "microphone_unavailable";
            throw unavailableError;
        }
    }

    async function retryMicrophonePermission() {
        ui.retryMicrophoneButton.disabled = true;
        setDeviceStatus("Requesting microphone access…");

        try {
            const testStream = await requestMicrophone();
            testStream.getTracks().forEach((track) => track.stop());
            await refreshMicrophoneDevices();
            ui.permissionHelp.classList.add("hidden");
            setDeviceStatus(
                "Microphone access works. You can start or accept a call now."
            );
        } catch (error) {
            ui.permissionHelp.classList.remove("hidden");
            setDeviceStatus(
                error.message
                || "Microphone permission is still blocked.",
                true
            );
        } finally {
            ui.retryMicrophoneButton.disabled = false;
        }
    }

    async function chooseMicrophone(deviceId) {
        saveSelectedMicrophone(deviceId);

        if (!localStream) {
            setDeviceStatus(
                "This microphone will be used for the next call."
            );
            return;
        }

        setDeviceStatus("Switching microphone…");
        const replacementStream = await requestMicrophone(
            selectedMicrophoneId
        );
        const replacementTrack = replacementStream.getAudioTracks()[0];

        if (!replacementTrack) {
            throw new Error("The selected device has no audio track.");
        }

        replacementTrack.enabled = mediaState.microphone;
        const sender = (peerConnection?.getSenders() ?? [])
            .find((candidate) => candidate.track?.kind === "audio");

        if (sender) {
            await sender.replaceTrack(replacementTrack);
        }

        const previousTracks = localStream.getAudioTracks();
        previousTracks.forEach((track) => {
            localStream.removeTrack(track);
            track.stop();
        });
        localStream.addTrack(replacementTrack);
        await refreshMicrophoneDevices();
        setDeviceStatus("Microphone changed successfully.");
    }

    function resetCardButtons() {
        ui.acceptButton.classList.add("hidden");
        ui.rejoinButton.classList.add("hidden");
        ui.declineButton.textContent = "Decline";
    }

    function showCallCard(kind) {
        ui.root.classList.remove("hidden");
        ui.card.classList.remove("hidden");
        ui.stage.classList.add("hidden");
        ui.backdrop.classList.add("hidden");
        resetCardButtons();

        ui.cardPeer.textContent = peerName();

        if (kind === "incoming") {
            ui.cardKicker.textContent = "INCOMING CALL";
            ui.cardStatus.textContent = currentCall.call_mode === "video"
                ? "Video call"
                : "Audio call";
            ui.acceptButton.textContent = currentCall.call_mode === "video"
                ? "Accept video"
                : "Accept audio";
            ui.acceptButton.classList.remove("hidden");
            ui.declineButton.textContent = "Decline";
        } else if (kind === "outgoing") {
            ui.cardKicker.textContent = "CALLING";
            ui.cardStatus.textContent = currentCall.call_mode === "video"
                ? "Waiting for video call…"
                : "Waiting for audio call…";
            ui.declineButton.textContent = "Cancel";
        } else {
            ui.cardKicker.textContent = "CALL IN PROGRESS";
            ui.cardStatus.textContent =
                "This call was interrupted on this page.";
            ui.rejoinButton.classList.remove("hidden");
            ui.declineButton.textContent = "End call";
        }
    }

    function showActiveStage() {
        ui.root.classList.remove("hidden");
        ui.card.classList.add("hidden");
        ui.stage.classList.remove("hidden");
        ui.backdrop.classList.remove("hidden");
        ui.stagePeer.textContent = peerName();
        ui.stage.dataset.mode = currentCall.call_mode;

        const videoMode = currentCall.call_mode === "video";
        ui.localVideo.classList.toggle("hidden", !videoMode);
        ui.remoteVideo.classList.toggle("hidden", !videoMode);
        ui.audioAvatar.classList.toggle("hidden", videoMode);
        ui.cameraButton.classList.toggle("hidden", !videoMode);
        ui.remoteMuted.classList.add("hidden");
        setCallError();
        setConnectionStatus("Connecting…");
        startDurationClock();
    }

    function cameraConstraints() {
        return {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 }
        };
    }

    async function requestOptionalCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: cameraConstraints()
            });

            return {
                stream,
                warning: ""
            };
        } catch (error) {
            const permissionBlocked =
                error?.name === "NotAllowedError"
                || error?.name === "PermissionDeniedError"
                || error?.name === "SecurityError";

            return {
                stream: null,
                warning: permissionBlocked
                    ? "Camera access is unavailable, so you joined with audio only. You can still see the other player's video."
                    : "No camera is available, so you joined with audio only. You can still see the other player's video."
            };
        }
    }

    async function acquireLocalMedia(mode) {
        if (localStream) {
            return localStream;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Calls need an HTTPS page and a supported browser."
            );
        }

        const microphoneStream = await requestMicrophone();
        const cameraResult = mode === "video"
            ? await requestOptionalCamera()
            : { stream: null, warning: "" };

        localStream = new MediaStream();
        microphoneStream.getAudioTracks().forEach((track) => {
            localStream.addTrack(track);
        });
        cameraResult.stream?.getVideoTracks().forEach((track) => {
            localStream.addTrack(track);
        });
        cameraWarning = cameraResult.warning;

        mediaState = {
            microphone: localStream.getAudioTracks().some(
                (track) => track.enabled
            ),
            camera: localStream.getVideoTracks().some(
                (track) => track.enabled
            )
        };

        ui.localVideo.srcObject = localStream;
        ui.localVideo.play().catch(() => {});
        updateControlLabels();
        refreshMicrophoneDevices().catch(() => {});
        return localStream;
    }

    function stopMedia() {
        localStream?.getTracks().forEach((track) => track.stop());
        remoteStream?.getTracks().forEach((track) => track.stop());
        localStream = null;
        remoteStream = null;
        cameraWarning = "";

        if (ui.localVideo) {
            ui.localVideo.srcObject = null;
        }

        if (ui.remoteVideo) {
            ui.remoteVideo.srcObject = null;
        }
    }

    async function loadIceServers() {
        try {
            const { data, error } = await window.supabaseClient
                .functions
                .invoke("get-call-ice-servers", {
                    body: {}
                });

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
                "TURN configuration was unavailable; using STUN:",
                error
            );
            return fallbackIceServers;
        }
    }

    async function sendSignal(signalType, payload) {
        if (!currentCall?.id) {
            return;
        }

        const { error } = await window.supabaseClient.rpc(
            "send_player_call_signal",
            {
                p_call_id: currentCall.id,
                p_signal_type: signalType,
                p_payload: payload
            }
        );

        if (error) {
            throw error;
        }
    }

    async function flushLocalCandidates() {
        if (iceFlushTimer) {
            window.clearTimeout(iceFlushTimer);
            iceFlushTimer = null;
        }

        if (!pendingLocalCandidates.length || !currentCall) {
            return;
        }

        const candidates = pendingLocalCandidates.splice(0);
        await sendSignal("ice", { candidates });
    }

    function queueLocalCandidate(candidate) {
        pendingLocalCandidates.push(candidate.toJSON());

        if (iceFlushTimer) {
            return;
        }

        iceFlushTimer = window.setTimeout(() => {
            flushLocalCandidates().catch((error) => {
                console.warn("ICE candidates could not be sent:", error);
            });
        }, ICE_BATCH_DELAY_MS);
    }

    async function flushRemoteCandidates() {
        if (!peerConnection?.remoteDescription) {
            return;
        }

        const queued = pendingRemoteCandidates.splice(0);

        for (const candidate of queued) {
            try {
                await peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.warn("Remote ICE candidate was rejected:", error);
            }
        }
    }

    async function setupPeerConnection() {
        if (peerConnection) {
            return peerConnection;
        }

        if (settingUpPeer) {
            return settingUpPeer;
        }

        settingUpPeer = (async () => {
            const iceServers = await loadIceServers();
            const connection = new RTCPeerConnection({ iceServers });
            peerConnection = connection;
            remoteStream = new MediaStream();
            ui.remoteVideo.srcObject = remoteStream;

            for (const track of localStream.getTracks()) {
                connection.addTrack(track, localStream);
            }

            if (
                currentCall.call_mode === "video"
                && localStream.getVideoTracks().length === 0
            ) {
                connection.addTransceiver("video", {
                    direction: "recvonly"
                });
            }

            connection.addEventListener("track", (event) => {
                for (const track of event.streams[0]?.getTracks() ?? [
                    event.track
                ]) {
                    if (!remoteStream.getTrackById(track.id)) {
                        remoteStream.addTrack(track);
                    }
                }

                ui.remoteVideo.play().catch(() => {});
            });

            connection.addEventListener("icecandidate", (event) => {
                if (event.candidate) {
                    queueLocalCandidate(event.candidate);
                    return;
                }

                flushLocalCandidates().catch((error) => {
                    console.warn(
                        "Final ICE candidates could not be sent:",
                        error
                    );
                });
            });

            connection.addEventListener(
                "connectionstatechange",
                () => {
                    const labels = {
                        new: "Preparing…",
                        connecting: "Connecting…",
                        connected: "Connected",
                        disconnected: "Reconnecting…",
                        failed: "Connection failed",
                        closed: "Call ended"
                    };

                    setConnectionStatus(
                        labels[connection.connectionState]
                        ?? "Connecting…"
                    );

                    if (connection.connectionState === "connected") {
                        touchCall().catch(() => {});
                    }

                    if (connection.connectionState === "failed") {
                        setCallError(
                            "The connection failed. Ending the call."
                        );
                        window.setTimeout(() => {
                            endCurrentCall(true).catch(() => {});
                        }, 1200);
                    }
                }
            );

            return connection;
        })();

        try {
            return await settingUpPeer;
        } finally {
            settingUpPeer = null;
        }
    }

    async function createOffer() {
        if (makingOffer || !currentCall || !isCaller()) {
            return;
        }

        makingOffer = true;

        try {
            const connection = await setupPeerConnection();
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await sendSignal("offer", {
                description: connection.localDescription.toJSON()
            });
        } finally {
            makingOffer = false;
        }
    }

    async function processSignal(signal) {
        if (
            !currentCall
            || signal.call_id !== currentCall.id
            || signal.sender_id === currentUser.id
        ) {
            return;
        }

        lastSignalId = Math.max(
            lastSignalId,
            Number(signal.id ?? 0)
        );

        if (!localStream || !peerConnection) {
            pendingSignals.push(signal);
            return;
        }

        const connection = peerConnection;
        const payload = signal.payload ?? {};

        if (signal.signal_type === "offer") {
            if (!payload.description) {
                return;
            }

            await connection.setRemoteDescription(
                payload.description
            );
            await flushRemoteCandidates();

            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            await sendSignal("answer", {
                description: connection.localDescription.toJSON()
            });
        } else if (signal.signal_type === "answer") {
            if (
                payload.description
                && connection.signalingState === "have-local-offer"
            ) {
                await connection.setRemoteDescription(
                    payload.description
                );
                await flushRemoteCandidates();
            }
        } else if (signal.signal_type === "ice") {
            const candidates = Array.isArray(payload.candidates)
                ? payload.candidates
                : [];

            for (const candidate of candidates) {
                if (connection.remoteDescription) {
                    try {
                        await connection.addIceCandidate(candidate);
                    } catch (error) {
                        console.warn(
                            "Remote ICE candidate was rejected:",
                            error
                        );
                    }
                } else {
                    pendingRemoteCandidates.push(candidate);
                }
            }
        } else if (signal.signal_type === "media_state") {
            const cameraOn = payload.camera !== false;
            ui.remoteMuted.classList.toggle(
                "hidden",
                currentCall.call_mode !== "video" || cameraOn
            );
        }
    }

    async function processPendingSignals() {
        const queued = pendingSignals.splice(0);

        for (const signal of queued) {
            await processSignal(signal);
        }
    }

    async function loadMissedSignals() {
        if (!currentCall?.id) {
            return;
        }

        const { data, error } = await window.supabaseClient.rpc(
            "get_player_call_signals",
            {
                p_call_id: currentCall.id,
                p_after_id: lastSignalId
            }
        );

        if (error) {
            throw error;
        }

        for (const signal of data ?? []) {
            await processSignal(signal);
        }
    }

    function startDurationClock() {
        if (durationTimer) {
            window.clearInterval(durationTimer);
        }

        const startedAt = new Date(
            currentCall.responded_at ?? Date.now()
        ).getTime();

        const render = () => {
            const totalSeconds = Math.max(
                0,
                Math.floor((Date.now() - startedAt) / 1000)
            );
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const displayValue = hours > 0
                ? `${String(hours).padStart(2, "0")}:${String(
                    minutes
                ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
                : `${String(minutes).padStart(2, "0")}:${String(
                    seconds
                ).padStart(2, "0")}`;

            if (ui.duration.firstChild) {
                ui.duration.firstChild.nodeValue = displayValue;
            } else {
                ui.duration.textContent = displayValue;
            }
        };

        render();
        durationTimer = window.setInterval(render, 1000);
    }

    async function touchCall() {
        if (!currentCall?.id || currentCall.status !== "accepted") {
            return false;
        }

        const { data, error } = await window.supabaseClient.rpc(
            "touch_player_call",
            {
                p_call_id: currentCall.id
            }
        );

        if (error || data !== true) {
            return false;
        }

        return true;
    }

    function startHeartbeat() {
        if (heartbeatTimer) {
            window.clearInterval(heartbeatTimer);
        }

        touchCall().catch(() => {});

        heartbeatTimer = window.setInterval(async () => {
            const active = await touchCall().catch(() => false);

            if (!active && currentCall?.status === "accepted") {
                finishCallLocally("Call ended.");
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    async function enterAcceptedCall({ createCallerOffer = true } = {}) {
        if (!currentCall) {
            return;
        }

        showActiveStage();
        await acquireLocalMedia(currentCall.call_mode);
        showCameraFallbackNotice();
        await setupPeerConnection();
        startHeartbeat();

        await loadMissedSignals().catch((error) => {
            console.warn("Earlier call signals could not be loaded:", error);
        });
        await processPendingSignals();

        if (isCaller() && createCallerOffer) {
            await createOffer();
        }

        await sendMediaState().catch(() => {});
    }

    function scheduleRingExpiry() {
        if (expiryTimer) {
            window.clearTimeout(expiryTimer);
        }

        const expiresAt = new Date(
            currentCall?.expires_at
            ?? Date.now() + RING_DURATION_MS
        ).getTime();
        const delay = Math.max(0, expiresAt - Date.now() + 500);

        expiryTimer = window.setTimeout(async () => {
            const { data } = await window.supabaseClient.rpc(
                "get_my_active_player_call"
            );
            const active = data?.[0] ?? null;

            if (!active || active.id !== currentCall?.id) {
                finishCallLocally("Call unanswered.");
            }
        }, delay);
    }

    async function startCall(userId, username, mode = "audio") {
        const cleanMode = mode === "video" ? "video" : "audio";

        if (!currentUser) {
            showToast("Calls are still loading. Try again in a moment.", "error");
            return;
        }

        if (startingCall || currentCall) {
            showToast("You already have a call open.", "error");
            return;
        }

        if (!userId || userId === currentUser.id) {
            showToast("You cannot call yourself.", "error");
            return;
        }

        startingCall = true;

        try {
            await acquireLocalMedia(cleanMode);

            const { data, error } = await window.supabaseClient.rpc(
                "start_player_call",
                {
                    p_callee_id: userId,
                    p_call_mode: cleanMode
                }
            );

            if (error) {
                throw error;
            }

            currentCall = singleRpcRow(data);

            if (!currentCall) {
                throw new Error("The call session was not returned.");
            }

            currentCall.callee_username =
                currentCall.callee_username || username || "Player";
            showCallCard("outgoing");
            scheduleRingExpiry();
            showCameraFallbackNotice();
        } catch (error) {
            stopMedia();
            showMediaFailure(
                error,
                "The call could not be started."
            );
        } finally {
            startingCall = false;
        }
    }

    async function acceptIncomingCall() {
        if (
            !currentCall
            || currentCall.status !== "ringing"
            || isCaller()
        ) {
            return;
        }

        ui.acceptButton.disabled = true;
        ui.declineButton.disabled = true;

        try {
            await acquireLocalMedia(currentCall.call_mode);

            const { data, error } = await window.supabaseClient.rpc(
                "respond_to_player_call",
                {
                    p_call_id: currentCall.id,
                    p_accept: true
                }
            );

            if (error) {
                throw error;
            }

            currentCall = singleRpcRow(data);

            if (!currentCall) {
                throw new Error("The accepted call was not returned.");
            }

            await enterAcceptedCall({ createCallerOffer: false });
        } catch (error) {
            setCallError(
                error.message || "The call could not be accepted."
            );
            showMediaFailure(
                error,
                "The call could not be accepted."
            );
        } finally {
            ui.acceptButton.disabled = false;
            ui.declineButton.disabled = false;
        }
    }

    async function rejoinCall() {
        if (!currentCall || currentCall.status !== "accepted") {
            return;
        }

        ui.rejoinButton.disabled = true;

        try {
            await enterAcceptedCall({
                createCallerOffer: isCaller()
            });
        } catch (error) {
            showMediaFailure(
                error,
                "The call could not be rejoined."
            );
        } finally {
            ui.rejoinButton.disabled = false;
        }
    }

    async function declineOrCancelCall() {
        if (!currentCall) {
            return;
        }

        ui.declineButton.disabled = true;

        try {
            if (currentCall.status === "ringing" && !isCaller()) {
                await window.supabaseClient.rpc(
                    "respond_to_player_call",
                    {
                        p_call_id: currentCall.id,
                        p_accept: false
                    }
                );
            } else {
                await window.supabaseClient.rpc(
                    "end_player_call",
                    {
                        p_call_id: currentCall.id,
                        p_failed: false
                    }
                );
            }
        } finally {
            finishCallLocally(
                isCaller() ? "Call cancelled." : "Call declined."
            );
            ui.declineButton.disabled = false;
        }
    }

    async function endCurrentCall(failed = false) {
        if (!currentCall) {
            return;
        }

        const callId = currentCall.id;

        try {
            await window.supabaseClient.rpc(
                "end_player_call",
                {
                    p_call_id: callId,
                    p_failed: failed
                }
            );
        } catch (error) {
            console.warn("Call end status could not be saved:", error);
        }

        finishCallLocally(failed ? "Call failed." : "Call ended.");
    }

    function finishCallLocally(message = "") {
        if (heartbeatTimer) {
            window.clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }

        if (durationTimer) {
            window.clearInterval(durationTimer);
            durationTimer = null;
        }

        if (expiryTimer) {
            window.clearTimeout(expiryTimer);
            expiryTimer = null;
        }

        if (iceFlushTimer) {
            window.clearTimeout(iceFlushTimer);
            iceFlushTimer = null;
        }

        peerConnection?.close();
        peerConnection = null;
        settingUpPeer = null;
        stopMedia();
        currentCall = null;
        lastSignalId = 0;
        pendingSignals = [];
        pendingLocalCandidates = [];
        pendingRemoteCandidates = [];
        makingOffer = false;
        ui.card.classList.add("hidden");
        ui.stage.classList.add("hidden");
        ui.backdrop.classList.add("hidden");
        setCallError();

        if (message) {
            showToast(message);
        } else {
            ui.root.classList.add("hidden");
        }
    }

    function terminalMessage(status) {
        const messages = {
            declined: "Call declined.",
            cancelled: "Call cancelled.",
            ended: "Call ended.",
            missed: "Call unanswered.",
            failed: "Call connection failed."
        };

        return messages[status] ?? "Call ended.";
    }

    async function handleCallChange(call) {
        if (!call || !currentUser) {
            return;
        }

        const participant = [
            call.caller_id,
            call.callee_id
        ].includes(currentUser.id);

        if (!participant) {
            return;
        }

        if (
            !currentCall
            && !["ringing", "accepted"].includes(call.status)
        ) {
            return;
        }

        if (currentCall && currentCall.id !== call.id) {
            return;
        }

        const previousStatus = currentCall?.status;
        currentCall = call;

        if (call.status === "ringing") {
            notifyIncomingCall(call);
            showCallCard(isCaller(call) ? "outgoing" : "incoming");
            scheduleRingExpiry();
            return;
        }

        if (call.status === "accepted") {
            if (previousStatus === "ringing" && localStream) {
                try {
                    await enterAcceptedCall({
                        createCallerOffer: isCaller(call)
                    });
                } catch (error) {
                    setCallError(
                        error.message || "The call could not connect."
                    );
                }
            } else if (!peerConnection) {
                showCallCard("rejoin");
            }
            return;
        }

        finishCallLocally(terminalMessage(call.status));
    }

    function handleSignalInsert(signal) {
        processSignal(signal).catch((error) => {
            console.error("Call signal processing failed:", error);
            setCallError("The call connection could not be negotiated.");
        });
    }

    function subscribeToCalls() {
        callsChannel = window.supabaseClient
            .channel(`player-calls-${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "player_calls",
                    filter: `caller_id=eq.${currentUser.id}`
                },
                (payload) => handleCallChange(payload.new)
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "player_calls",
                    filter: `callee_id=eq.${currentUser.id}`
                },
                (payload) => handleCallChange(payload.new)
            )
            .subscribe();

        signalsChannel = window.supabaseClient
            .channel(`player-call-signals-${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "player_call_signals",
                    filter: `recipient_id=eq.${currentUser.id}`
                },
                (payload) => handleSignalInsert(payload.new)
            )
            .subscribe();
    }

    function updateControlLabels() {
        ui.microphoneButton.textContent = mediaState.microphone
            ? "Mute"
            : "Unmute";
        ui.microphoneButton.setAttribute(
            "aria-pressed",
            String(!mediaState.microphone)
        );

        const hasCamera = Boolean(
            localStream?.getVideoTracks().length
        );

        ui.cameraButton.textContent = !hasCamera
            ? "No camera"
            : mediaState.camera
                ? "Camera off"
                : "Camera on";
        ui.cameraButton.disabled = !hasCamera;
        ui.cameraButton.setAttribute(
            "aria-pressed",
            String(!mediaState.camera)
        );
    }

    async function sendMediaState() {
        if (currentCall?.status === "accepted") {
            await sendSignal("media_state", mediaState);
        }
    }

    function toggleMicrophone() {
        const tracks = localStream?.getAudioTracks() ?? [];

        if (!tracks.length) {
            return;
        }

        mediaState.microphone = !mediaState.microphone;
        tracks.forEach((track) => {
            track.enabled = mediaState.microphone;
        });
        updateControlLabels();
        sendMediaState().catch(() => {});
    }

    function toggleCamera() {
        const tracks = localStream?.getVideoTracks() ?? [];

        if (!tracks.length) {
            return;
        }

        mediaState.camera = !mediaState.camera;
        tracks.forEach((track) => {
            track.enabled = mediaState.camera;
        });
        ui.localVideo.classList.toggle(
            "camera-disabled",
            !mediaState.camera
        );
        updateControlLabels();
        sendMediaState().catch(() => {});
    }

    function sendUnloadEnd() {
        if (!currentCall?.id || !accessToken) {
            return;
        }

        const config = window.CHAT_CONFIG;

        if (!config?.supabaseUrl || !config?.supabaseKey) {
            return;
        }

        fetch(
            `${config.supabaseUrl}/rest/v1/rpc/end_player_call`,
            {
                method: "POST",
                keepalive: true,
                headers: {
                    apikey: config.supabaseKey,
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    p_call_id: currentCall.id,
                    p_failed: false
                })
            }
        ).catch(() => {});
    }

    document.addEventListener("click", (event) => {
        const settingsButton = event.target.closest(
            "[data-player-call-settings]"
        );

        if (settingsButton) {
            event.preventDefault();
            openDeviceSettings().catch(() => {});
            return;
        }

        const startButton = event.target.closest(
            "[data-player-call-user][data-player-call-mode]"
        );

        if (startButton) {
            event.preventDefault();
            startCall(
                startButton.dataset.playerCallUser,
                startButton.dataset.playerCallName,
                startButton.dataset.playerCallMode
            );
            return;
        }

        const actionButton = event.target.closest(
            "#player-call-root [data-call-action]"
        );

        if (!actionButton) {
            return;
        }

        const action = actionButton.dataset.callAction;

        if (action === "accept") {
            acceptIncomingCall();
        } else if (action === "rejoin") {
            rejoinCall();
        } else if (action === "decline") {
            declineOrCancelCall();
        } else if (action === "hangup") {
            endCurrentCall(false);
        } else if (action === "microphone") {
            toggleMicrophone();
        } else if (action === "camera") {
            toggleCamera();
        } else if (action === "devices") {
            openDeviceSettings().catch(() => {});
        } else if (action === "close-devices") {
            closeDeviceSettings();
        } else if (action === "retry-microphone") {
            retryMicrophonePermission();
        }
    });

    window.addEventListener("pagehide", sendUnloadEnd);

    async function initialisePlayerCalls() {
        createCallUi();
        installCallSettingsLaunch();

        navigator.mediaDevices?.addEventListener?.(
            "devicechange",
            () => {
                if (!ui.devicePanel.classList.contains("hidden")) {
                    refreshMicrophoneDevices().catch(() => {});
                }
            }
        );

        if (!window.RTCPeerConnection) {
            console.warn("This browser does not support WebRTC calls.");
            return;
        }

        try {
            const [userResult, sessionResult] = await Promise.all([
                window.supabaseClient.auth.getUser(),
                window.supabaseClient.auth.getSession()
            ]);

            if (userResult.error || !userResult.data.user) {
                return;
            }

            currentUser = userResult.data.user;
            accessToken =
                sessionResult.data.session?.access_token ?? null;
            subscribeToCalls();

            const { data, error } = await window.supabaseClient.rpc(
                "get_my_active_player_call"
            );

            if (error) {
                if (
                    !error.message?.includes(
                        "get_my_active_player_call"
                    )
                ) {
                    console.warn(
                        "Player calls could not be initialised:",
                        error
                    );
                }
                return;
            }

            const activeCall = data?.[0];

            if (activeCall) {
                await handleCallChange(activeCall);
            }
        } catch (error) {
            console.warn("Player calls could not be initialised:", error);
        }
    }

    window.playerCalls = {
        start: startCall,
        end: () => endCurrentCall(false),
        openSettings: () => openDeviceSettings(),
        get activeCall() {
            return currentCall;
        }
    };

    initialisePlayerCalls();
})();
