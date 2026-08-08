(() => {
    if (window.groupCallEngineV7 || !window.supabaseClient) return;

    const BUILD = "PUSH V7.1";
    const HEARTBEAT_MS = 45000;
    const STATE_POLL_MS = 2500;
    const SIGNAL_POLL_MS = 1800;
    const OFFER_TIMEOUT_MS = 6000;
    const MICROPHONE_STORAGE_KEY = "preferred-player-call-microphone-v1";
    const VIEW_STORAGE_KEY = "group-call-view-v7";

    let currentUser = null;
    let activeState = null;
    let currentCallId = null;

    let localStream = null;
    let localAudioTrack = null;
    let cameraTrack = null;
    let screenTrack = null;
    let microphoneEnabled = true;
    let cameraEnabled = true;
    let screenSharing = false;

    const peers = new Map();
    const tiles = new Map();

    let signalChannel = null;
    let signalCursor = 0;
    let signalChain = Promise.resolve();

    let stateTimer = null;
    let signalTimer = null;
    let heartbeatTimer = null;
    let durationTimer = null;

    let connecting = false;
    let stateRefreshing = false;
    let signalPolling = false;
    let actionBusy = false;
    let disposed = false;

    let iceServersPromise = null;

    let composerPurpose = "create";
    let composerMode = "video";
    let composerFriends = [];
    let composerSelected = new Set();

    const pageSessionId =
        crypto.randomUUID?.()
        ?? `${Date.now()}-${Math.random()}`;

    const ui = {};

    window.__GROUP_CALL_PUSH__ = BUILD;
    console.info(`[GroupCall] ${BUILD} loaded`, {
        pageSessionId
    });

    function callMode() {
        return activeState?.call?.call_mode ?? composerMode ?? "video";
    }

    function membershipStatus() {
        return activeState?.membership?.status ?? null;
    }

    function joinedParticipants() {
        return (activeState?.participants ?? []).filter(
            (participant) => participant.status === "joined"
        );
    }

    function activeParticipants() {
        return (activeState?.participants ?? []).filter(
            (participant) =>
                participant.status === "joined"
                || participant.status === "invited"
        );
    }

    function participantById(userId) {
        return (activeState?.participants ?? []).find(
            (participant) => participant.user_id === userId
        ) ?? null;
    }

    function currentHost() {
        return (activeState?.participants ?? []).find(
            (participant) => participant.is_host
        ) ?? null;
    }

    function isHost() {
        return Boolean(
            currentUser
            && activeState?.call?.host_id === currentUser.id
        );
    }

    function directCallActive() {
        return Boolean(window.playerCalls?.activeCall);
    }

    function modeLimit(mode) {
        return mode === "video" ? 4 : 6;
    }

    function initials(username) {
        const value = String(username ?? "?")
            .replaceAll("_", " ")
            .trim();

        if (!value) return "?";

        const parts = value.split(/\s+/).filter(Boolean);

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
    }

    function formatDuration(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(total / 60);
        const remainder = total % 60;

        return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }

    function createUi() {
        if (document.querySelector("#group-call-v7-root")) return;

        const root = document.createElement("section");
        root.id = "group-call-v7-root";
        root.className = "group-call-v4-root hidden";
        root.setAttribute("aria-live", "polite");

        root.innerHTML = `
            <style>
                .gcv7-push {
                    display: inline-flex;
                    align-items: center;
                    min-height: 20px;
                    padding: 2px 6px;
                    border: 1px solid rgba(98,230,189,.42);
                    border-radius: 999px;
                    background: rgba(98,230,189,.11);
                    color: #9bf0d5;
                    font: 900 .58rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
                    letter-spacing: .04em;
                    white-space: nowrap;
                }
                .gcv7-peer-status {
                    color: #9fb0c7 !important;
                }
                .gcv7-peer-status.turn {
                    color: #ffe09b !important;
                }
                .gcv7-peer-status.connected {
                    color: #9bf0d5 !important;
                }
            </style>

            <div class="gcv4-backdrop hidden" data-gcv7-action="mini"></div>

            <aside class="gcv4-incoming hidden">
                <div class="gcv4-incoming-icon">◉</div>
                <div class="gcv4-incoming-copy">
                    <span class="gcv4-kicker">GROUP CALL · ${BUILD}</span>
                    <strong class="gcv4-incoming-title"></strong>
                    <span class="gcv4-incoming-detail"></span>
                </div>
                <div class="gcv4-incoming-actions">
                    <button type="button" class="gcv4-button accept" data-gcv7-action="accept">Join</button>
                    <button type="button" class="gcv4-button danger" data-gcv7-action="decline">Decline</button>
                </div>
            </aside>

            <section class="gcv4-stage hidden">
                <header class="gcv4-header">
                    <div class="gcv4-heading-copy">
                        <span class="gcv4-kicker gcv4-mode-label">GROUP VIDEO CALL</span>
                        <strong class="gcv4-heading">Group call</strong>
                    </div>

                    <div class="gcv4-header-meta">
                        <span class="gcv7-push">${BUILD}</span>
                        <span class="gcv4-count">0/0</span>
                        <span class="gcv4-duration">00:00</span>
                        <button type="button" class="gcv4-size-button" data-gcv7-action="expand">Expand</button>
                    </div>
                </header>

                <div class="gcv4-grid"></div>
                <p class="gcv4-error" role="alert"></p>

                <div class="gcv4-controls">
                    <button type="button" class="gcv4-control" data-gcv7-action="invite">Invite</button>
                    <button type="button" class="gcv4-control" data-gcv7-action="devices">Devices</button>
                    <button type="button" class="gcv4-control" data-gcv7-action="microphone">Mute</button>
                    <button type="button" class="gcv4-control" data-gcv7-action="camera">Camera off</button>
                    <button type="button" class="gcv4-control" data-gcv7-action="screen">Share screen</button>
                    <button type="button" class="gcv4-control danger" data-gcv7-action="leave">Leave</button>
                    <button type="button" class="gcv4-control danger hidden" data-gcv7-action="end">End for all</button>
                </div>
            </section>

            <section class="gcv4-composer hidden" role="dialog" aria-modal="true">
                <header class="gcv4-dialog-header">
                    <div>
                        <span class="gcv4-kicker">GROUP CALL · ${BUILD}</span>
                        <h2 class="gcv7-composer-title">Start a group call</h2>
                    </div>
                    <button type="button" class="gcv4-close" data-gcv7-action="close-composer">×</button>
                </header>

                <div class="gcv4-mode-picker">
                    <button type="button" data-gcv7-mode="audio">Audio</button>
                    <button type="button" data-gcv7-mode="video" class="active">Video</button>
                </div>

                <div class="gcv4-composer-summary">
                    <span class="gcv7-selection-count">0 selected</span>
                    <span class="gcv7-selection-limit">Up to 3 friends</span>
                </div>

                <div class="gcv4-friend-list"></div>
                <p class="gcv4-composer-message" role="alert"></p>

                <div class="gcv4-dialog-actions">
                    <button type="button" class="gcv4-button neutral" data-gcv7-action="close-composer">Cancel</button>
                    <button type="button" class="gcv4-button accept gcv7-submit" data-gcv7-action="submit-composer">Start video call</button>
                </div>
            </section>

            <section class="gcv4-device-panel hidden" role="dialog">
                <header class="gcv4-dialog-header">
                    <div>
                        <span class="gcv4-kicker">CALL SETTINGS · ${BUILD}</span>
                        <h2>Microphone</h2>
                    </div>
                    <button type="button" class="gcv4-close" data-gcv7-action="close-devices">×</button>
                </header>

                <label class="gcv4-device-field">
                    <span>Microphone input</span>
                    <select class="gcv7-microphone-select">
                        <option value="">Default microphone</option>
                    </select>
                </label>

                <p class="gcv4-device-message"></p>
            </section>

            <div class="gcv4-toast hidden"></div>
        `;

        document.body.append(root);

        ui.root = root;
        ui.backdrop = root.querySelector(".gcv4-backdrop");
        ui.incoming = root.querySelector(".gcv4-incoming");
        ui.incomingTitle = root.querySelector(".gcv4-incoming-title");
        ui.incomingDetail = root.querySelector(".gcv4-incoming-detail");
        ui.stage = root.querySelector(".gcv4-stage");
        ui.modeLabel = root.querySelector(".gcv4-mode-label");
        ui.heading = root.querySelector(".gcv4-heading");
        ui.count = root.querySelector(".gcv4-count");
        ui.duration = root.querySelector(".gcv4-duration");
        ui.sizeButton = root.querySelector(".gcv4-size-button");
        ui.grid = root.querySelector(".gcv4-grid");
        ui.error = root.querySelector(".gcv4-error");
        ui.inviteButton = root.querySelector('[data-gcv7-action="invite"]');
        ui.microphoneButton = root.querySelector('[data-gcv7-action="microphone"]');
        ui.cameraButton = root.querySelector('[data-gcv7-action="camera"]');
        ui.screenButton = root.querySelector('[data-gcv7-action="screen"]');
        ui.endButton = root.querySelector('[data-gcv7-action="end"]');

        ui.composer = root.querySelector(".gcv4-composer");
        ui.composerTitle = root.querySelector(".gcv7-composer-title");
        ui.modePicker = root.querySelector(".gcv4-mode-picker");
        ui.selectionCount = root.querySelector(".gcv7-selection-count");
        ui.selectionLimit = root.querySelector(".gcv7-selection-limit");
        ui.friendList = root.querySelector(".gcv4-friend-list");
        ui.composerMessage = root.querySelector(".gcv4-composer-message");
        ui.submitButton = root.querySelector(".gcv7-submit");

        ui.devicePanel = root.querySelector(".gcv4-device-panel");
        ui.microphoneSelect = root.querySelector(".gcv7-microphone-select");
        ui.deviceMessage = root.querySelector(".gcv4-device-message");
        ui.toast = root.querySelector(".gcv4-toast");

        root.addEventListener("click", handleRootClick);

        ui.microphoneSelect.addEventListener("change", () => {
            changeMicrophone(ui.microphoneSelect.value).catch((error) => {
                ui.deviceMessage.textContent =
                    error.message || "The microphone could not be changed.";
            });
        });

        document.addEventListener(
            "pointerdown",
            retryPlayback,
            { passive: true }
        );
    }

    function updateRootVisibility() {
        const visible = [
            ui.incoming,
            ui.stage,
            ui.composer,
            ui.devicePanel,
            ui.toast
        ].some((element) =>
            element && !element.classList.contains("hidden")
        );

        ui.root?.classList.toggle("hidden", !visible);
    }

    function setError(message = "") {
        if (ui.error) ui.error.textContent = String(message ?? "");
    }

    function setComposerMessage(message = "") {
        if (ui.composerMessage) {
            ui.composerMessage.textContent = String(message ?? "");
        }
    }

    function showToast(message, kind = "") {
        createUi();
        ui.root.classList.remove("hidden");
        ui.toast.textContent = String(message ?? "");
        ui.toast.className = `gcv4-toast ${kind}`.trim();

        window.setTimeout(() => {
            ui.toast.classList.add("hidden");
            updateRootVisibility();
        }, 3000);
    }

    async function ensureUser() {
        if (currentUser) return currentUser;

        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            throw new Error("You must be signed in to use group calls.");
        }

        currentUser = user;
        return user;
    }

    function preferredMicrophoneId() {
        try {
            return localStorage.getItem(MICROPHONE_STORAGE_KEY) || "";
        } catch {
            return "";
        }
    }

    function savePreferredMicrophoneId(deviceId) {
        try {
            if (deviceId) {
                localStorage.setItem(MICROPHONE_STORAGE_KEY, deviceId);
            } else {
                localStorage.removeItem(MICROPHONE_STORAGE_KEY);
            }
        } catch {
            // Preference storage is optional.
        }
    }

    async function requestMicrophone(deviceId = preferredMicrophoneId()) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    ...(deviceId
                        ? { deviceId: { exact: deviceId } }
                        : {})
                },
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
                frameRate: { ideal: 24, max: 30 },
                resizeMode: { ideal: "none" }
            }
        });
    }

    async function ensureLocalMedia() {
        if (!localStream) localStream = new MediaStream();

        const warnings = [];

        if (!localAudioTrack || localAudioTrack.readyState === "ended") {
            try {
                const stream = await requestMicrophone();
                localAudioTrack = stream.getAudioTracks()[0] ?? null;

                if (localAudioTrack) {
                    localStream.addTrack(localAudioTrack);
                    microphoneEnabled = true;
                }
            } catch {
                microphoneEnabled = false;
                warnings.push(
                    "Microphone access is unavailable. You can still listen."
                );
            }
        }

        if (
            callMode() === "video"
            && (!cameraTrack || cameraTrack.readyState === "ended")
        ) {
            try {
                const stream = await requestCamera();
                cameraTrack = stream.getVideoTracks()[0] ?? null;

                if (cameraTrack) {
                    localStream.addTrack(cameraTrack);
                    cameraEnabled = true;
                }
            } catch {
                cameraEnabled = false;
                warnings.push(
                    "Camera access is unavailable. The call will continue with audio."
                );
            }
        } else if (callMode() !== "video") {
            cameraEnabled = false;
        }

        if (localAudioTrack) {
            localAudioTrack.enabled = microphoneEnabled;
        }

        if (cameraTrack) {
            cameraTrack.enabled = cameraEnabled;
        }

        await updateServerMedia();

        if (warnings.length) {
            setError(warnings.join(" "));
        }

        const me = participantById(currentUser.id);
        if (me) updateTile(me);
    }

    function outgoingVideoTrack() {
        return screenTrack ?? cameraTrack ?? null;
    }

    async function updateServerMedia() {
        if (!currentCallId || membershipStatus() !== "joined") return;

        const { error } = await window.supabaseClient.rpc(
            "update_group_call_media",
            {
                p_call_id: currentCallId,
                p_microphone_enabled: microphoneEnabled,
                p_camera_enabled:
                    callMode() === "video"
                    && (cameraEnabled || screenSharing)
            }
        );

        if (error) {
            console.warn("Group-call media state update failed:", error);
        }
    }

    async function loadIceServers() {
        if (iceServersPromise) return iceServersPromise;

        iceServersPromise = (async () => {
            try {
                const { data, error } =
                    await window.supabaseClient.functions.invoke(
                        "get-call-ice-servers",
                        { body: {} }
                    );

                if (
                    !error
                    && Array.isArray(data?.iceServers)
                    && data.iceServers.length
                ) {
                    return data.iceServers;
                }
            } catch (error) {
                console.warn("ICE server endpoint failed:", error);
            }

            return [
                {
                    urls: [
                        "stun:stun.cloudflare.com:3478",
                        "stun:stun.l.google.com:19302",
                        "stun:stun1.l.google.com:19302"
                    ]
                }
            ];
        })();

        return iceServersPromise;
    }

    async function loadFullState(callId) {
        const { data, error } =
            await window.supabaseClient.rpc(
                "get_group_call_state",
                { p_call_id: callId }
            );

        if (error) throw error;
        return data ?? null;
    }

    function isOfferer(remoteUserId) {
        return currentUser.id.localeCompare(remoteUserId) < 0;
    }

    function createTile(participant) {
        const tile = document.createElement("article");
        tile.className = "gcv4-tile";
        tile.dataset.userId = participant.user_id;

        const video = document.createElement("video");
        video.className = "gcv4-video";
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;

        if (participant.user_id === currentUser.id) {
            video.classList.add("mirrored");
        }

        const avatar = document.createElement("div");
        avatar.className = "gcv4-avatar";
        avatar.textContent = initials(participant.username);

        const footer = document.createElement("footer");
        footer.className = "gcv4-tile-footer";

        const name = document.createElement("strong");
        name.className = "gcv4-tile-name";

        const badges = document.createElement("div");
        badges.className = "gcv4-tile-badges";

        footer.append(name, badges);
        tile.append(video, avatar, footer);
        ui.grid.append(tile);

        const record = {
            tile,
            video,
            avatar,
            name,
            badges
        };

        tiles.set(participant.user_id, record);
        return record;
    }

    function participantStream(participant) {
        if (participant.user_id === currentUser.id) {
            return localStream;
        }

        return peers.get(participant.user_id)?.remoteStream ?? null;
    }

    function hasLiveVideo(stream) {
        return Boolean(
            stream?.getVideoTracks().some(
                (track) => track.readyState === "live"
            )
        );
    }

    function updateTile(participant) {
        let tile = tiles.get(participant.user_id);

        if (!tile) {
            tile = createTile(participant);
        }

        const isLocal = participant.user_id === currentUser.id;
        const stream = participantStream(participant);
        const peer = isLocal ? null : peers.get(participant.user_id);

        const localVideoOn =
            isLocal
            && callMode() === "video"
            && Boolean(outgoingVideoTrack())
            && (screenSharing || cameraEnabled);

        const remoteVideoExpected =
            !isLocal
            && callMode() === "video"
            && Boolean(participant.camera_enabled);

        const remoteVideoActuallyPresent =
            remoteVideoExpected
            && hasLiveVideo(stream);

        const visibleVideo =
            isLocal
                ? localVideoOn
                : remoteVideoActuallyPresent;

        tile.tile.classList.toggle("local", isLocal);
        tile.tile.classList.toggle("camera-on", visibleVideo);
        tile.tile.classList.toggle(
            "muted",
            isLocal
                ? !microphoneEnabled
                : !participant.microphone_enabled
        );

        tile.name.textContent =
            isLocal
                ? `${participant.username} (you)`
                : participant.username;

        tile.avatar.textContent = initials(participant.username);
        tile.badges.replaceChildren();

        const addBadge = (text, className = "") => {
            const badge = document.createElement("span");
            badge.textContent = text;
            if (className) badge.className = className;
            tile.badges.append(badge);
        };

        if (participant.is_host) addBadge("HOST", "gcv4-host-badge");

        addBadge(
            isLocal
                ? (microphoneEnabled ? "MIC" : "MUTED")
                : (participant.microphone_enabled ? "MIC" : "MUTED"),
            "gcv4-mic-badge"
        );

        if (callMode() === "video") {
            if (isLocal) {
                addBadge(
                    screenSharing
                        ? "SCREEN"
                        : localVideoOn
                            ? "VIDEO"
                            : "CAM OFF"
                );
            } else if (remoteVideoExpected && !remoteVideoActuallyPresent) {
                addBadge("VIDEO WAIT");
            } else {
                addBadge(remoteVideoActuallyPresent ? "VIDEO" : "CAM OFF");
            }
        }

        if (peer?.transport) {
            addBadge(
                peer.transport,
                `gcv7-peer-status ${
                    peer.transport === "TURN"
                        ? "turn"
                        : peer.transport === "P2P"
                            ? "connected"
                            : ""
                }`
            );
        } else if (peer) {
            addBadge(
                String(peer.pc.connectionState || "new").toUpperCase(),
                "gcv7-peer-status"
            );
        }

        if (stream && tile.video.srcObject !== stream) {
            tile.video.srcObject = stream;
            tile.video.play().catch(() => {});
        }
    }

    function removeUnusedTiles() {
        const allowed = new Set(
            joinedParticipants().map((participant) => participant.user_id)
        );

        for (const [userId, record] of tiles) {
            if (allowed.has(userId)) continue;
            record.tile.remove();
            tiles.delete(userId);
        }
    }

    function renderStage() {
        if (!activeState?.call || membershipStatus() !== "joined") return;

        const participants = joinedParticipants();

        ui.modeLabel.textContent =
            callMode() === "video"
                ? "GROUP VIDEO CALL"
                : "GROUP AUDIO CALL";

        ui.heading.textContent =
            `${participants.length} participant${participants.length === 1 ? "" : "s"}`;

        ui.count.textContent =
            `${participants.length}/${activeState.call.max_participants}`;

        ui.grid.dataset.mode = callMode();

        ui.inviteButton.disabled =
            activeParticipants().length
            >= Number(activeState.call.max_participants);

        ui.cameraButton.classList.toggle(
            "hidden",
            callMode() !== "video"
        );

        ui.screenButton.classList.toggle(
            "hidden",
            callMode() !== "video"
            || !navigator.mediaDevices?.getDisplayMedia
        );

        ui.endButton.classList.toggle("hidden", !isHost());

        ui.microphoneButton.textContent =
            microphoneEnabled ? "Mute" : "Unmute";

        ui.cameraButton.textContent =
            screenSharing
                ? "Camera"
                : cameraEnabled
                    ? "Camera off"
                    : "Camera on";

        ui.screenButton.textContent =
            screenSharing ? "Stop sharing" : "Share screen";

        for (const participant of participants) {
            updateTile(participant);
        }

        removeUnusedTiles();

        ui.incoming.classList.add("hidden");
        ui.stage.classList.remove("hidden");
        ui.root.classList.remove("hidden");

        if (!ui.root.dataset.initialViewApplied) {
            ui.root.dataset.initialViewApplied = "true";

            let expanded = false;

            try {
                const stored = JSON.parse(
                    sessionStorage.getItem(VIEW_STORAGE_KEY) || "null"
                );

                expanded =
                    stored?.callId === currentCallId
                    && stored?.expanded === true;
            } catch {
                // Session storage is optional.
            }

            setExpanded(expanded);
        }

        updateRootVisibility();
    }

    function renderIncoming() {
        if (!activeState?.call || membershipStatus() !== "invited") {
            ui.incoming.classList.add("hidden");
            updateRootVisibility();
            return;
        }

        const host = currentHost();

        ui.incomingTitle.textContent =
            `${host?.username ?? "A friend"} started a group ${callMode()} call`;

        ui.incomingDetail.textContent =
            directCallActive()
                ? "Finish your private call before joining."
                : `${joinedParticipants().length} already joined · ${activeState.call.max_participants} max`;

        ui.incoming
            .querySelector('[data-gcv7-action="accept"]')
            .disabled = directCallActive();

        ui.incoming.classList.remove("hidden");
        ui.stage.classList.add("hidden");
        ui.root.classList.remove("hidden");
        updateRootVisibility();
    }

    function setExpanded(expanded) {
        if (!ui.stage || ui.stage.classList.contains("hidden")) return;

        ui.root.classList.toggle("gcv4-expanded", expanded);
        ui.backdrop.classList.toggle("hidden", !expanded);

        ui.sizeButton.textContent = expanded ? "Mini" : "Expand";
        ui.sizeButton.dataset.gcv7Action =
            expanded ? "mini" : "expand";

        try {
            sessionStorage.setItem(
                VIEW_STORAGE_KEY,
                JSON.stringify({
                    callId: currentCallId,
                    expanded
                })
            );
        } catch {
            // Session storage is optional.
        }
    }

    async function updateTransport(record) {
        try {
            const stats = await record.pc.getStats();
            let selectedPair = null;

            stats.forEach((report) => {
                if (
                    report.type === "transport"
                    && report.selectedCandidatePairId
                ) {
                    selectedPair = stats.get(report.selectedCandidatePairId);
                }
            });

            if (!selectedPair) {
                stats.forEach((report) => {
                    if (
                        report.type === "candidate-pair"
                        && report.state === "succeeded"
                        && report.nominated
                    ) {
                        selectedPair = report;
                    }
                });
            }

            if (!selectedPair) return;

            const local = stats.get(selectedPair.localCandidateId);
            const remote = stats.get(selectedPair.remoteCandidateId);

            record.transport =
                local?.candidateType === "relay"
                || remote?.candidateType === "relay"
                    ? "TURN"
                    : "P2P";

            const participant = participantById(record.remoteUserId);
            if (participant) updateTile(participant);
        } catch {
            // Transport diagnostics are optional.
        }
    }

    async function syncPeerTracks(record) {
        let directionChanged = false;

        const desiredAudioDirection =
            localAudioTrack ? "sendrecv" : "recvonly";

        if (record.audioTx.direction !== desiredAudioDirection) {
            record.audioTx.direction = desiredAudioDirection;
            directionChanged = true;
        }

        await record.audioTx.sender.replaceTrack(localAudioTrack ?? null);

        if (record.videoTx) {
            const videoTrack = outgoingVideoTrack();
            const desiredVideoDirection =
                videoTrack ? "sendrecv" : "recvonly";

            if (record.videoTx.direction !== desiredVideoDirection) {
                record.videoTx.direction = desiredVideoDirection;
                directionChanged = true;
            }

            await record.videoTx.sender.replaceTrack(videoTrack ?? null);
        }

        return directionChanged;
    }

    async function createPeer(remoteUserId) {
        const existing = peers.get(remoteUserId);
        if (existing) return existing;

        const pc = new RTCPeerConnection({
            iceServers: await loadIceServers()
        });

        const audioTx = pc.addTransceiver("audio", {
            direction: localAudioTrack ? "sendrecv" : "recvonly"
        });

        const videoTx =
            callMode() === "video"
                ? pc.addTransceiver("video", {
                    direction: outgoingVideoTrack()
                        ? "sendrecv"
                        : "recvonly"
                })
                : null;

        const remoteStream = new MediaStream();
        const remoteAudio = document.createElement("audio");

        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
        remoteAudio.hidden = true;
        remoteAudio.srcObject = remoteStream;
        ui.root.append(remoteAudio);

        const record = {
            remoteUserId,
            pc,
            audioTx,
            videoTx,
            remoteStream,
            remoteAudio,
            remoteSessionId: "",
            pendingCandidates: [],
            localIce: [],
            iceTimer: null,
            offerTimer: null,
            offerTimeout: null,
            pendingOfferId: "",
            remoteNegotiationId: "",
            localNegotiationId: "",
            requestedIceRestart: false,
            transport: "",
            reconnectTimer: null
        };

        peers.set(remoteUserId, record);

        pc.addEventListener("icecandidate", (event) => {
            if (!event.candidate) return;

            record.localIce.push(event.candidate.toJSON());
            scheduleIceFlush(record);
        });

        pc.addEventListener("track", (event) => {
            const track = event.track;

            if (
                !remoteStream
                    .getTracks()
                    .some((existingTrack) => existingTrack.id === track.id)
            ) {
                remoteStream.addTrack(track);
            }

            const participant = participantById(remoteUserId);
            if (participant) updateTile(participant);

            remoteAudio.play().catch(() => {});
            tiles.get(remoteUserId)?.video.play().catch(() => {});
        });

        pc.addEventListener("connectionstatechange", () => {
            const participant = participantById(remoteUserId);

            if (participant) updateTile(participant);

            if (pc.connectionState === "connected") {
                updateTransport(record);
            }

            if (
                pc.connectionState === "failed"
                || pc.connectionState === "disconnected"
            ) {
                scheduleReconnect(record);
            }
        });

        await syncPeerTracks(record);
        return record;
    }

    function closePeer(remoteUserId) {
        const record = peers.get(remoteUserId);
        if (!record) return;

        clearTimeout(record.iceTimer);
        clearTimeout(record.offerTimer);
        clearTimeout(record.offerTimeout);
        clearTimeout(record.reconnectTimer);

        try {
            record.pc.close();
        } catch {
            // Already closed.
        }

        try {
            record.remoteAudio.pause();
            record.remoteAudio.remove();
        } catch {
            // Already removed.
        }

        peers.delete(remoteUserId);
    }

    async function resetPeer(remoteUserId, remoteSessionId = "") {
        closePeer(remoteUserId);

        const record = await createPeer(remoteUserId);
        record.remoteSessionId = remoteSessionId;

        return record;
    }

    async function sendSignal(recipientId, signalType, payload = {}) {
        if (!currentCallId || !recipientId) return;

        const { error } = await window.supabaseClient.rpc(
            "send_group_call_signal",
            {
                p_call_id: currentCallId,
                p_recipient_id: recipientId,
                p_signal_type: signalType,
                p_payload: {
                    ...payload,
                    session_id: pageSessionId,
                    build: BUILD
                }
            }
        );

        if (error) throw error;
    }

    function scheduleIceFlush(record) {
        if (record.iceTimer) return;

        record.iceTimer = window.setTimeout(async () => {
            record.iceTimer = null;
            const candidates = record.localIce.splice(0);

            if (!candidates.length) return;

            try {
                await sendSignal(
                    record.remoteUserId,
                    "ice",
                    {
                        candidates,
                        negotiation_id:
                            record.localNegotiationId || ""
                    }
                );
            } catch (error) {
                console.warn("Group-call ICE send failed:", error);
            }
        }, 100);
    }

    async function flushCandidates(record) {
        if (!record.pc.remoteDescription) return;

        const pending = record.pendingCandidates.splice(0);

        for (const entry of pending) {
            if (
                entry.negotiationId
                && record.remoteNegotiationId
                && entry.negotiationId !== record.remoteNegotiationId
            ) {
                continue;
            }

            try {
                await record.pc.addIceCandidate(entry.candidate);
            } catch (error) {
                console.warn("Group-call ICE candidate rejected:", error);
            }
        }
    }

    function scheduleOffer(
        record,
        {
            iceRestart = false,
            delay = 120
        } = {}
    ) {
        if (!isOfferer(record.remoteUserId)) return;

        record.requestedIceRestart ||= iceRestart;

        if (record.offerTimer) return;

        record.offerTimer = window.setTimeout(async () => {
            record.offerTimer = null;

            if (
                record.pc.signalingState !== "stable"
                || record.pendingOfferId
            ) {
                scheduleOffer(record, {
                    iceRestart: record.requestedIceRestart,
                    delay: 250
                });
                return;
            }

            try {
                await makeOffer(
                    record,
                    record.requestedIceRestart
                );

                record.requestedIceRestart = false;
            } catch (error) {
                console.warn("Group-call offer failed:", error);
                scheduleReconnect(record);
            }
        }, delay);
    }

    async function makeOffer(record, iceRestart = false) {
        if (!isOfferer(record.remoteUserId)) return;
        if (record.pc.signalingState !== "stable") return;

        await syncPeerTracks(record);

        const negotiationId =
            crypto.randomUUID?.()
            ?? `${Date.now()}-${Math.random()}`;

        record.pendingOfferId = negotiationId;
        record.localNegotiationId = negotiationId;

        const offer = await record.pc.createOffer({ iceRestart });
        await record.pc.setLocalDescription(offer);

        await sendSignal(
            record.remoteUserId,
            "offer",
            {
                negotiation_id: negotiationId,
                description: record.pc.localDescription.toJSON()
            }
        );

        clearTimeout(record.offerTimeout);

        record.offerTimeout = window.setTimeout(async () => {
            if (record.pendingOfferId !== negotiationId) return;

            console.warn(
                `[GroupCall] ${BUILD} offer timed out`,
                record.remoteUserId
            );

            const session = record.remoteSessionId;
            const rebuilt =
                await resetPeer(record.remoteUserId, session);

            scheduleOffer(rebuilt, {
                iceRestart: true,
                delay: 120
            });
        }, OFFER_TIMEOUT_MS);
    }

    async function requestNegotiation(
        record,
        {
            iceRestart = false
        } = {}
    ) {
        if (isOfferer(record.remoteUserId)) {
            scheduleOffer(record, { iceRestart });
            return;
        }

        await sendSignal(
            record.remoteUserId,
            "rejoin_request",
            {
                reason: iceRestart
                    ? "connection_restart"
                    : "renegotiate"
            }
        );
    }

    async function announcePeer(remoteUserId) {
        const record = await createPeer(remoteUserId);

        await sendSignal(
            remoteUserId,
            "rejoin_request",
            { reason: "peer_ready" }
        );

        if (isOfferer(remoteUserId)) {
            scheduleOffer(record);
        }
    }

    function scheduleReconnect(record) {
        if (record.reconnectTimer) return;

        record.reconnectTimer = window.setTimeout(async () => {
            record.reconnectTimer = null;

            if (!participantById(record.remoteUserId)) return;

            const session = record.remoteSessionId;
            const rebuilt =
                await resetPeer(record.remoteUserId, session);

            try {
                await sendSignal(
                    rebuilt.remoteUserId,
                    "rejoin_request",
                    { reason: "connection_restart" }
                );

                if (isOfferer(rebuilt.remoteUserId)) {
                    scheduleOffer(rebuilt, {
                        iceRestart: true
                    });
                }
            } catch (error) {
                console.warn("Group-call reconnect failed:", error);
            }
        }, 1800);
    }

    async function handleOffer(record, payload) {
        if (isOfferer(record.remoteUserId)) {
            console.warn(
                `[GroupCall] ${BUILD} ignored unexpected offer from deterministic answerer`
            );
            return;
        }

        const negotiationId =
            String(payload.negotiation_id ?? "");

        const description = payload.description;

        if (!negotiationId || description?.type !== "offer") return;

        if (
            record.remoteNegotiationId === negotiationId
            && record.pc.signalingState === "stable"
        ) {
            return;
        }

        if (record.pc.signalingState !== "stable") {
            record = await resetPeer(
                record.remoteUserId,
                record.remoteSessionId
            );
        }

        await syncPeerTracks(record);

        record.remoteNegotiationId = negotiationId;

        await record.pc.setRemoteDescription(description);
        await flushCandidates(record);

        const answer = await record.pc.createAnswer();

        record.localNegotiationId = negotiationId;

        await record.pc.setLocalDescription(answer);

        await sendSignal(
            record.remoteUserId,
            "answer",
            {
                negotiation_id: negotiationId,
                description: record.pc.localDescription.toJSON()
            }
        );
    }

    async function handleAnswer(record, payload) {
        if (!isOfferer(record.remoteUserId)) return;

        const negotiationId =
            String(payload.negotiation_id ?? "");

        const description = payload.description;

        if (
            !negotiationId
            || description?.type !== "answer"
        ) {
            return;
        }

        /*
         * This is the exact V6 console error guard:
         * a stale/duplicate answer is not valid once the peer has already
         * returned to stable, and it must never be applied to a newer offer.
         */
        if (
            negotiationId !== record.pendingOfferId
            || record.pc.signalingState !== "have-local-offer"
        ) {
            console.info(
                `[GroupCall] ${BUILD} ignored stale answer`,
                {
                    remoteUserId: record.remoteUserId,
                    negotiationId,
                    expected: record.pendingOfferId,
                    signalingState:
                        record.pc.signalingState
                }
            );
            return;
        }

        record.remoteNegotiationId = negotiationId;

        await record.pc.setRemoteDescription(description);

        record.pendingOfferId = "";
        clearTimeout(record.offerTimeout);
        record.offerTimeout = null;

        await flushCandidates(record);
    }

    async function handleIce(record, payload) {
        const negotiationId =
            String(payload.negotiation_id ?? "");

        const candidates =
            Array.isArray(payload.candidates)
                ? payload.candidates
                : payload.candidate
                    ? [payload.candidate]
                    : [];

        for (const candidate of candidates) {
            if (
                negotiationId
                && record.remoteNegotiationId
                && negotiationId !== record.remoteNegotiationId
            ) {
                continue;
            }

            if (record.pc.remoteDescription) {
                try {
                    await record.pc.addIceCandidate(candidate);
                } catch (error) {
                    console.warn(
                        "Group-call ICE candidate failed:",
                        error
                    );
                }
            } else {
                record.pendingCandidates.push({
                    negotiationId,
                    candidate
                });
            }
        }
    }

    async function handleSignal(signal) {
        if (
            !signal
            || signal.call_id !== currentCallId
            || signal.recipient_id !== currentUser.id
        ) {
            return;
        }

        const remoteUserId = signal.sender_id;
        const payload = signal.payload ?? {};
        const remoteSessionId =
            String(payload.session_id ?? "");

        let record = await createPeer(remoteUserId);

        if (
            remoteSessionId
            && record.remoteSessionId
            && remoteSessionId !== record.remoteSessionId
        ) {
            record = await resetPeer(
                remoteUserId,
                remoteSessionId
            );
        } else if (remoteSessionId) {
            record.remoteSessionId = remoteSessionId;
        }

        if (signal.signal_type === "rejoin_request") {
            if (isOfferer(remoteUserId)) {
                scheduleOffer(record, {
                    iceRestart:
                        payload.reason === "connection_restart"
                });
            }

            return;
        }

        if (signal.signal_type === "offer") {
            await handleOffer(record, payload);
            return;
        }

        if (signal.signal_type === "answer") {
            await handleAnswer(record, payload);
            return;
        }

        if (signal.signal_type === "ice") {
            await handleIce(record, payload);
        }
    }

    function queueSignal(signal) {
        signalChain = signalChain
            .then(() => handleSignal(signal))
            .catch((error) => {
                console.warn(
                    `[GroupCall] ${BUILD} signalling failed:`,
                    error
                );
            });

        return signalChain;
    }

    async function pollSignals() {
        if (
            signalPolling
            || !currentCallId
            || membershipStatus() !== "joined"
        ) {
            return;
        }

        signalPolling = true;

        try {
            const { data, error } =
                await window.supabaseClient.rpc(
                    "get_group_call_signals",
                    {
                        p_call_id: currentCallId,
                        p_after_id: signalCursor
                    }
                );

            if (error) return;

            for (const signal of Array.isArray(data) ? data : []) {
                signalCursor = Math.max(
                    signalCursor,
                    Number(signal.id)
                );

                queueSignal(signal);
            }
        } finally {
            signalPolling = false;
        }
    }

    async function startSignalSystem() {
        const { data: cursor, error } =
            await window.supabaseClient.rpc(
                "get_group_call_signal_cursor",
                { p_call_id: currentCallId }
            );

        if (!error) {
            signalCursor = Number(cursor ?? 0);
        }

        if (signalChannel) {
            window.supabaseClient.removeChannel(signalChannel);
        }

        signalChannel = window.supabaseClient
            .channel(
                `group-call-v7-${currentCallId}-${pageSessionId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "group_call_signals",
                    filter:
                        `recipient_id=eq.${currentUser.id}`
                },
                (payload) => {
                    const signal = payload.new;

                    if (
                        !signal
                        || signal.call_id !== currentCallId
                    ) {
                        return;
                    }

                    signalCursor = Math.max(
                        signalCursor,
                        Number(signal.id)
                    );

                    queueSignal(signal);
                }
            )
            .subscribe();

        clearInterval(signalTimer);

        signalTimer = window.setInterval(
            () => pollSignals().catch(() => {}),
            SIGNAL_POLL_MS
        );

        /*
         * Catch signals inserted in the small gap between reading the cursor
         * and the realtime subscription becoming active.
         */
        window.setTimeout(
            () => pollSignals().catch(() => {}),
            250
        );
    }

    async function reconcilePeers({ announceNew = false } = {}) {
        if (!currentUser || membershipStatus() !== "joined") return;

        const remoteParticipants =
            joinedParticipants().filter(
                (participant) =>
                    participant.user_id !== currentUser.id
            );

        const remoteIds =
            new Set(
                remoteParticipants.map(
                    (participant) => participant.user_id
                )
            );

        for (const remoteUserId of Array.from(peers.keys())) {
            if (!remoteIds.has(remoteUserId)) {
                closePeer(remoteUserId);
            }
        }

        for (const participant of remoteParticipants) {
            const existed = peers.has(participant.user_id);

            await createPeer(participant.user_id);
            updateTile(participant);

            if (announceNew && !existed) {
                await announcePeer(participant.user_id);
            }
        }

        removeUnusedTiles();
    }

    async function refreshState() {
        if (stateRefreshing || !currentCallId) return;

        stateRefreshing = true;

        try {
            const state = await loadFullState(currentCallId);

            if (!state?.call) {
                const hadCall = Boolean(activeState?.call);

                await cleanupCallLocal();
                activeState = null;
                currentCallId = null;

                if (hadCall) {
                    showToast("The group call ended.");
                }

                return;
            }

            activeState = state;

            if (membershipStatus() === "invited") {
                renderIncoming();
                startStatePolling();
                return;
            }

            if (membershipStatus() === "joined") {
                renderStage();

                if (!connecting) {
                    await reconcilePeers({
                        announceNew: true
                    });
                }
            }
        } catch (error) {
            console.warn("Group-call state refresh failed:", error);
        } finally {
            stateRefreshing = false;
        }
    }

    function startStatePolling() {
        clearInterval(stateTimer);

        stateTimer = window.setInterval(
            () => refreshState().catch(() => {}),
            STATE_POLL_MS
        );
    }

    function startHeartbeat() {
        clearInterval(heartbeatTimer);

        const touch = async () => {
            if (!currentCallId || membershipStatus() !== "joined") return;

            try {
                const { data, error } =
                    await window.supabaseClient.rpc(
                        "touch_group_call",
                        { p_call_id: currentCallId }
                    );

                if (error || data === false) {
                    await refreshState();
                }
            } catch {
                // The next heartbeat/state poll can recover.
            }
        };

        touch();

        heartbeatTimer = window.setInterval(
            touch,
            HEARTBEAT_MS
        );
    }

    function startDurationTimer() {
        clearInterval(durationTimer);

        const update = () => {
            if (!activeState?.call) return;

            const start =
                new Date(activeState.call.created_at).getTime();

            ui.duration.textContent =
                formatDuration(
                    Number.isFinite(start)
                        ? (Date.now() - start) / 1000
                        : 0
                );
        };

        update();
        durationTimer = window.setInterval(update, 1000);
    }

    async function connectJoinedCall() {
        if (
            connecting
            || membershipStatus() !== "joined"
            || !currentCallId
        ) {
            return;
        }

        connecting = true;

        try {
            setError("");
            renderStage();

            /*
             * Media first, signalling second.
             * No participant can generate a recvonly answer merely because
             * its permission dialog was still open.
             */
            await ensureLocalMedia();
            await startSignalSystem();

            await reconcilePeers({
                announceNew: true
            });

            startStatePolling();
            startHeartbeat();
            startDurationTimer();

            if (
                !ui.root.classList.contains(
                    "gcv4-expanded"
                )
            ) {
                setExpanded(false);
            }
        } catch (error) {
            console.warn(
                `[GroupCall] ${BUILD} could not fully connect:`,
                error
            );

            setError(
                error.message
                || "The group call could not connect."
            );

            startStatePolling();
        } finally {
            connecting = false;
        }
    }

    async function resumeFromBootstrap(bootstrapState) {
        if (disposed || !bootstrapState?.call_id) return;

        await ensureUser();
        createUi();

        if (
            currentCallId
            && currentCallId !== bootstrapState.call_id
        ) {
            await cleanupCallLocal();
        }

        currentCallId = bootstrapState.call_id;
        activeState = await loadFullState(currentCallId);

        if (!activeState?.call) {
            currentCallId = null;
            return;
        }

        if (membershipStatus() === "invited") {
            renderIncoming();
            startStatePolling();
            return;
        }

        if (membershipStatus() === "joined") {
            await connectJoinedCall();
        }
    }

    async function respondToInvite(accept) {
        if (actionBusy || !currentCallId) return;

        if (accept && directCallActive()) {
            setError(
                "End your private call before joining this group call."
            );
            return;
        }

        actionBusy = true;

        try {
            const { error } =
                await window.supabaseClient.rpc(
                    "respond_to_group_call",
                    {
                        p_call_id: currentCallId,
                        p_accept: Boolean(accept)
                    }
                );

            if (error) throw error;

            if (!accept) {
                await cleanupCallLocal();
                activeState = null;
                currentCallId = null;
                showToast("Group call declined.");
                return;
            }

            activeState = await loadFullState(currentCallId);

            if (!activeState?.call) {
                throw new Error(
                    "The group call is no longer active."
                );
            }

            await connectJoinedCall();
        } catch (error) {
            setError(
                error.message
                || "The group-call invitation could not be answered."
            );
        } finally {
            actionBusy = false;
        }
    }

    async function leaveCall() {
        if (actionBusy || !currentCallId) return;

        actionBusy = true;

        try {
            const { error } =
                await window.supabaseClient.rpc(
                    "leave_group_call",
                    { p_call_id: currentCallId }
                );

            if (error) throw error;

            await cleanupCallLocal();
            activeState = null;
            currentCallId = null;

            showToast("You left the group call.");
        } catch (error) {
            setError(
                error.message
                || "The group call could not be left."
            );
        } finally {
            actionBusy = false;
        }
    }

    async function endCallForAll() {
        if (actionBusy || !currentCallId || !isHost()) return;

        actionBusy = true;

        try {
            const { error } =
                await window.supabaseClient.rpc(
                    "end_group_call",
                    { p_call_id: currentCallId }
                );

            if (error) throw error;

            await cleanupCallLocal();
            activeState = null;
            currentCallId = null;

            showToast("Group call ended.");
        } catch (error) {
            setError(
                error.message
                || "The group call could not be ended."
            );
        } finally {
            actionBusy = false;
        }
    }

    async function renegotiateAll() {
        for (const record of peers.values()) {
            const changed = await syncPeerTracks(record);

            if (changed) {
                await requestNegotiation(record);
            }
        }
    }

    async function toggleMicrophone() {
        if (!currentCallId || membershipStatus() !== "joined") return;

        if (!localAudioTrack || localAudioTrack.readyState === "ended") {
            try {
                const stream = await requestMicrophone();

                localAudioTrack =
                    stream.getAudioTracks()[0] ?? null;

                if (localAudioTrack) {
                    if (!localStream) localStream = new MediaStream();
                    localStream.addTrack(localAudioTrack);
                    microphoneEnabled = true;
                    await renegotiateAll();
                }
            } catch {
                setError(
                    "Microphone permission is unavailable. Check browser site permissions."
                );
                return;
            }
        } else {
            microphoneEnabled = !microphoneEnabled;
            localAudioTrack.enabled = microphoneEnabled;
        }

        await updateServerMedia();
        renderStage();
    }

    async function toggleCamera() {
        if (callMode() !== "video" || !currentCallId) return;

        if (screenSharing) {
            await stopScreenShare();
        }

        if (!cameraTrack || cameraTrack.readyState === "ended") {
            try {
                const stream = await requestCamera();

                cameraTrack =
                    stream.getVideoTracks()[0] ?? null;

                if (cameraTrack) {
                    if (!localStream) localStream = new MediaStream();
                    localStream.addTrack(cameraTrack);
                    cameraEnabled = true;
                    await renegotiateAll();
                }
            } catch {
                setError(
                    "Camera permission is unavailable. Check browser site permissions."
                );
                return;
            }
        } else {
            cameraEnabled = !cameraEnabled;
            cameraTrack.enabled = cameraEnabled;
        }

        await updateServerMedia();
        renderStage();
    }

    async function stopScreenShare() {
        if (!screenTrack) return;

        const oldTrack = screenTrack;
        screenTrack = null;
        screenSharing = false;

        try {
            oldTrack.stop();
        } catch {
            // Already stopped.
        }

        for (const record of peers.values()) {
            await syncPeerTracks(record);
        }

        await updateServerMedia();
        renderStage();
    }

    async function toggleScreenShare() {
        if (
            callMode() !== "video"
            || !navigator.mediaDevices?.getDisplayMedia
        ) {
            return;
        }

        if (screenSharing) {
            await stopScreenShare();
            return;
        }

        try {
            const stream =
                await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });

            screenTrack =
                stream.getVideoTracks()[0] ?? null;

            if (!screenTrack) return;

            screenSharing = true;

            screenTrack.addEventListener(
                "ended",
                () => {
                    if (screenSharing) {
                        stopScreenShare().catch(() => {});
                    }
                },
                { once: true }
            );

            for (const record of peers.values()) {
                await syncPeerTracks(record);
            }

            await updateServerMedia();
            renderStage();
        } catch (error) {
            if (error?.name !== "NotAllowedError") {
                setError(
                    error.message
                    || "Screen sharing could not start."
                );
            }
        }
    }

    async function refreshMicrophoneDevices() {
        const devices =
            await navigator.mediaDevices.enumerateDevices();

        const microphones = devices.filter(
            (device) => device.kind === "audioinput"
        );

        const selected = preferredMicrophoneId();

        ui.microphoneSelect.replaceChildren();

        const defaultOption =
            document.createElement("option");

        defaultOption.value = "";
        defaultOption.textContent = "Default microphone";

        ui.microphoneSelect.append(defaultOption);

        microphones.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.textContent =
                device.label || `Microphone ${index + 1}`;
            ui.microphoneSelect.append(option);
        });

        ui.microphoneSelect.value =
            Array.from(ui.microphoneSelect.options)
                .some((option) => option.value === selected)
                ? selected
                : "";
    }

    async function openDevices() {
        ui.devicePanel.classList.remove("hidden");
        ui.root.classList.remove("hidden");
        updateRootVisibility();

        try {
            await refreshMicrophoneDevices();
        } catch (error) {
            ui.deviceMessage.textContent =
                error.message
                || "Microphone devices could not be listed.";
        }
    }

    function closeDevices() {
        ui.devicePanel.classList.add("hidden");
        updateRootVisibility();
    }

    async function changeMicrophone(deviceId) {
        const stream = await requestMicrophone(deviceId);
        const newTrack = stream.getAudioTracks()[0] ?? null;

        if (!newTrack) {
            throw new Error(
                "That microphone did not provide an audio track."
            );
        }

        const oldTrack = localAudioTrack;

        localAudioTrack = newTrack;
        localAudioTrack.enabled = true;
        microphoneEnabled = true;

        if (!localStream) localStream = new MediaStream();

        if (oldTrack) {
            localStream.removeTrack(oldTrack);
        }

        localStream.addTrack(newTrack);

        for (const record of peers.values()) {
            await syncPeerTracks(record);
        }

        try {
            oldTrack?.stop();
        } catch {
            // Already stopped.
        }

        savePreferredMicrophoneId(deviceId);

        await updateServerMedia();
        renderStage();

        ui.deviceMessage.textContent =
            "Microphone changed.";
    }

    async function loadFriends() {
        const { data, error } =
            await window.supabaseClient.rpc(
                "get_my_friends",
                { p_search: null }
            );

        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    function selectionLimit() {
        if (composerPurpose === "invite") {
            return Math.max(
                0,
                Number(
                    activeState?.call?.max_participants ?? 0
                ) - activeParticipants().length
            );
        }

        return modeLimit(composerMode) - 1;
    }

    function updateComposerSummary() {
        const limit = selectionLimit();

        ui.selectionCount.textContent =
            `${composerSelected.size} selected`;

        ui.selectionLimit.textContent =
            limit === 1
                ? "1 spot available"
                : `${limit} spots available`;

        ui.submitButton.disabled =
            composerSelected.size < 1
            || composerSelected.size > limit;

        ui.submitButton.textContent =
            composerPurpose === "invite"
                ? "Send invites"
                : `Start ${composerMode} call`;

        ui.modePicker
            .querySelectorAll("[data-gcv7-mode]")
            .forEach((button) => {
                button.classList.toggle(
                    "active",
                    button.dataset.gcv7Mode === composerMode
                );

                button.disabled =
                    composerPurpose === "invite";
            });
    }

    function renderComposerFriends() {
        ui.friendList.replaceChildren();

        const excluded =
            new Set(
                composerPurpose === "invite"
                    ? activeParticipants().map(
                        (participant) =>
                            participant.user_id
                    )
                    : []
            );

        const available =
            composerFriends.filter(
                (friend) => !excluded.has(friend.user_id)
            );

        if (!available.length) {
            const empty = document.createElement("p");
            empty.className = "gcv4-empty";
            empty.textContent =
                composerPurpose === "invite"
                    ? "No additional friends are available to invite."
                    : "Add some friends before starting a group call.";

            ui.friendList.append(empty);
            updateComposerSummary();
            return;
        }

        const limit = selectionLimit();

        for (const friend of available) {
            const label = document.createElement("label");
            label.className = "gcv4-friend-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = friend.user_id;
            checkbox.checked =
                composerSelected.has(friend.user_id);

            const avatar = document.createElement("span");
            avatar.className = "gcv4-friend-avatar";
            avatar.textContent = initials(friend.username);

            const copy = document.createElement("span");
            copy.className = "gcv4-friend-copy";

            const name = document.createElement("strong");
            name.textContent = friend.username;

            const level = document.createElement("small");
            level.textContent =
                `Level ${Number(friend.level ?? 1)}`;

            copy.append(name, level);

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    if (composerSelected.size >= limit) {
                        checkbox.checked = false;
                        setComposerMessage(
                            `Only ${limit} more friend${limit === 1 ? "" : "s"} can be selected.`
                        );
                        return;
                    }

                    composerSelected.add(friend.user_id);
                } else {
                    composerSelected.delete(friend.user_id);
                }

                setComposerMessage("");
                updateComposerSummary();
            });

            label.append(checkbox, avatar, copy);
            ui.friendList.append(label);
        }

        updateComposerSummary();
    }

    async function openComposer({ purpose = "create" } = {}) {
        await ensureUser();
        createUi();

        if (purpose === "create" && activeState?.call) {
            purpose = "invite";
        }

        if (purpose === "create" && directCallActive()) {
            showToast(
                "End your private call before starting a group call.",
                "error"
            );
            return;
        }

        composerPurpose = purpose;
        composerMode =
            purpose === "invite"
                ? callMode()
                : "video";

        composerSelected = new Set();
        setComposerMessage("");

        ui.composerTitle.textContent =
            purpose === "invite"
                ? "Invite to group call"
                : "Start a group call";

        ui.composer.classList.remove("hidden");
        ui.backdrop.classList.remove("hidden");
        ui.root.classList.remove("hidden");

        try {
            composerFriends = await loadFriends();
            renderComposerFriends();
        } catch (error) {
            setComposerMessage(
                error.message
                || "Friends could not be loaded."
            );
        }

        updateRootVisibility();
    }

    function closeComposer() {
        ui.composer.classList.add("hidden");

        if (!ui.root.classList.contains("gcv4-expanded")) {
            ui.backdrop.classList.add("hidden");
        }

        updateRootVisibility();
    }

    async function submitComposer() {
        if (actionBusy || composerSelected.size < 1) return;

        const selected = Array.from(composerSelected);

        if (selected.length > selectionLimit()) {
            setComposerMessage(
                "Too many players are selected."
            );
            return;
        }

        actionBusy = true;
        ui.submitButton.disabled = true;

        try {
            if (composerPurpose === "invite") {
                const { data, error } =
                    await window.supabaseClient.rpc(
                        "invite_to_group_call",
                        {
                            p_call_id: currentCallId,
                            p_invitee_ids: selected
                        }
                    );

                if (error) throw error;

                closeComposer();

                showToast(
                    `${Number(data ?? 0)} invitation${Number(data ?? 0) === 1 ? "" : "s"} sent.`
                );

                await refreshState();
                return;
            }

            if (directCallActive()) {
                throw new Error(
                    "End your private call before starting a group call."
                );
            }

            const { data: callId, error } =
                await window.supabaseClient.rpc(
                    "create_group_call",
                    {
                        p_call_mode: composerMode,
                        p_invitee_ids: selected
                    }
                );

            if (error) throw error;

            currentCallId = callId;
            activeState =
                await loadFullState(currentCallId);

            closeComposer();

            if (!activeState?.call) {
                throw new Error(
                    "The new group call could not be loaded."
                );
            }

            await connectJoinedCall();
        } catch (error) {
            setComposerMessage(
                error.message
                || "The group call could not be created."
            );
        } finally {
            actionBusy = false;
            updateComposerSummary();
        }
    }

    function retryPlayback() {
        for (const record of peers.values()) {
            record.remoteAudio.play().catch(() => {});
            tiles
                .get(record.remoteUserId)
                ?.video
                ?.play()
                .catch(() => {});
        }
    }

    async function cleanupCallLocal() {
        clearInterval(stateTimer);
        clearInterval(signalTimer);
        clearInterval(heartbeatTimer);
        clearInterval(durationTimer);

        stateTimer = null;
        signalTimer = null;
        heartbeatTimer = null;
        durationTimer = null;

        if (signalChannel) {
            window.supabaseClient.removeChannel(signalChannel);
            signalChannel = null;
        }

        for (const remoteUserId of Array.from(peers.keys())) {
            closePeer(remoteUserId);
        }

        for (const track of localStream?.getTracks() ?? []) {
            try {
                track.stop();
            } catch {
                // Already stopped.
            }
        }

        localStream = null;
        localAudioTrack = null;
        cameraTrack = null;
        screenTrack = null;

        microphoneEnabled = true;
        cameraEnabled = true;
        screenSharing = false;

        for (const record of tiles.values()) {
            record.tile.remove();
        }

        tiles.clear();

        ui.stage?.classList.add("hidden");
        ui.incoming?.classList.add("hidden");
        ui.devicePanel?.classList.add("hidden");
        ui.backdrop?.classList.add("hidden");

        if (ui.root) {
            ui.root.classList.remove("gcv4-expanded");
            delete ui.root.dataset.initialViewApplied;
        }

        updateRootVisibility();

        signalCursor = 0;
        signalChain = Promise.resolve();
        connecting = false;
    }

    async function handleRootClick(event) {
        const modeButton =
            event.target.closest("[data-gcv7-mode]");

        if (modeButton) {
            if (composerPurpose !== "create") return;

            composerMode =
                modeButton.dataset.gcv7Mode;

            const limit = selectionLimit();

            while (composerSelected.size > limit) {
                composerSelected.delete(
                    Array.from(composerSelected).at(-1)
                );
            }

            renderComposerFriends();
            return;
        }

        const button =
            event.target.closest("[data-gcv7-action]");

        if (!button) {
            retryPlayback();
            return;
        }

        const action = button.dataset.gcv7Action;

        if (action === "accept") {
            await respondToInvite(true);
        } else if (action === "decline") {
            await respondToInvite(false);
        } else if (action === "expand") {
            setExpanded(true);
        } else if (action === "mini") {
            if (
                button === ui.backdrop
                && !ui.composer.classList.contains("hidden")
            ) {
                return;
            }

            setExpanded(false);
        } else if (action === "invite") {
            await openComposer({ purpose: "invite" });
        } else if (action === "close-composer") {
            closeComposer();
        } else if (action === "submit-composer") {
            await submitComposer();
        } else if (action === "devices") {
            await openDevices();
        } else if (action === "close-devices") {
            closeDevices();
        } else if (action === "microphone") {
            await toggleMicrophone();
        } else if (action === "camera") {
            await toggleCamera();
        } else if (action === "screen") {
            await toggleScreenShare();
        } else if (action === "leave") {
            await leaveCall();
        } else if (
            action === "end"
            && confirm("End this group call for everyone?")
        ) {
            await endCallForAll();
        }
    }

    navigator.mediaDevices
        ?.addEventListener?.(
            "devicechange",
            () => {
                if (
                    ui.devicePanel
                    && !ui.devicePanel.classList.contains("hidden")
                ) {
                    refreshMicrophoneDevices().catch(() => {});
                }
            }
        );

    window.addEventListener("pagehide", () => {
        disposed = true;
        cleanupCallLocal().catch(() => {});
    });

    createUi();

    const api = {
        BUILD,
        resumeFromBootstrap,
        openComposer,
        isHandlingCall() {
            return Boolean(
                currentCallId
                || activeState?.call
                || (
                    ui.composer
                    && !ui.composer.classList.contains("hidden")
                )
            );
        },
        get activeCall() {
            return activeState?.call ?? null;
        }
    };

    window.groupCallEngineV7 = api;

    /*
     * Keep the old global alias too so any already-deployed helper that only
     * checks the V4 name still recognises the active engine.
     */
    window.groupCallEngineV4 = api;
})();