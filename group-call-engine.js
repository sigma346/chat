(() => {
    if (
        window.groupCallEngineV4
        || !window.supabaseClient
    ) {
        return;
    }

    const VERSION = "6";
    const HEARTBEAT_MS = 45_000;
    const STATE_POLL_MS = 2_500;
    const SIGNAL_POLL_MS = 2_000;
    const ICE_BATCH_MS = 120;
    const MICROPHONE_STORAGE_KEY =
        "preferred-player-call-microphone-v1";
    const VIEW_STORAGE_KEY =
        "group-call-view-v4";

    const fallbackIceServers = [
        {
            urls: [
                "stun:stun.cloudflare.com:3478"
            ]
        }
    ];

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

    let peers = new Map();
    let tileRecords = new Map();
    let detectors = new Map();

    let signalChannel = null;
    let signalCursor = 0;
    let signalChain = Promise.resolve();

    let statePollTimer = null;
    let signalPollTimer = null;
    let heartbeatTimer = null;
    let durationTimer = null;
    let speakingTimer = null;

    let stateRefreshing = false;
    let signalPolling = false;
    let connecting = false;
    let actionBusy = false;
    let disposed = false;

    let iceServersPromise = null;
    let audioContext = null;

    let composerPurpose = "create";
    let composerMode = "video";
    let composerFriends = [];
    let composerSelected = new Set();

    const pageSessionId =
        crypto.randomUUID?.()
        ?? `${Date.now()}-${Math.random()}`;

    const notifiedInviteIds = new Set();

    const ui = {};

    function directCallActive() {
        return Boolean(
            window.playerCalls?.activeCall
        );
    }

    function callMode() {
        return (
            activeState?.call?.call_mode
            ?? composerMode
            ?? "video"
        );
    }

    function joinedParticipants() {
        return (
            activeState?.participants
            ?? []
        ).filter(
            (participant) =>
                participant.status === "joined"
        );
    }

    function activeParticipants() {
        return (
            activeState?.participants
            ?? []
        ).filter(
            (participant) =>
                participant.status === "joined"
                || participant.status === "invited"
        );
    }

    function membershipStatus() {
        return (
            activeState?.membership?.status
            ?? null
        );
    }

    function isHost() {
        return Boolean(
            currentUser
            && activeState?.call?.host_id
                === currentUser.id
        );
    }

    function modeLimit(mode) {
        return mode === "video"
            ? 4
            : 6;
    }

    function initials(username) {
        const clean =
            String(username ?? "?")
                .replaceAll("_", " ")
                .trim();

        if (!clean) {
            return "?";
        }

        const parts =
            clean.split(/\s+/).filter(Boolean);

        if (parts.length === 1) {
            return parts[0]
                .slice(0, 2)
                .toUpperCase();
        }

        return (
            `${parts[0][0]}${parts.at(-1)[0]}`
        ).toUpperCase();
    }

    function formatDuration(seconds) {
        const safe =
            Math.max(
                0,
                Math.floor(seconds)
            );

        const minutes =
            Math.floor(safe / 60);

        const remaining =
            safe % 60;

        return (
            `${String(minutes).padStart(2, "0")}:`
            + `${String(remaining).padStart(2, "0")}`
        );
    }

    function createUi() {
        if (
            document.querySelector(
                "#group-call-v4-root"
            )
        ) {
            return;
        }

        const root =
            document.createElement("section");

        root.id = "group-call-v4-root";
        root.className =
            "group-call-v4-root hidden";

        root.setAttribute(
            "aria-live",
            "polite"
        );

        root.innerHTML = `
            <div
                class="gcv4-backdrop hidden"
                data-gcv4-action="mini"
            ></div>

            <aside
                class="gcv4-incoming hidden"
                aria-label="Incoming group call"
            >
                <div
                    class="gcv4-incoming-icon"
                    aria-hidden="true"
                >◉</div>

                <div class="gcv4-incoming-copy">
                    <span class="gcv4-kicker">
                        GROUP CALL
                    </span>

                    <strong
                        class="gcv4-incoming-title"
                    ></strong>

                    <span
                        class="gcv4-incoming-detail"
                    ></span>
                </div>

                <div
                    class="gcv4-incoming-actions"
                >
                    <button
                        type="button"
                        class="gcv4-button accept"
                        data-gcv4-action="accept"
                    >
                        Join
                    </button>

                    <button
                        type="button"
                        class="gcv4-button danger"
                        data-gcv4-action="decline"
                    >
                        Decline
                    </button>
                </div>
            </aside>

            <section
                class="gcv4-stage hidden"
                aria-label="Group call"
            >
                <header class="gcv4-header">
                    <div class="gcv4-heading-copy">
                        <span
                            class="gcv4-kicker gcv4-mode-label"
                        >
                            GROUP VIDEO CALL
                        </span>

                        <strong
                            class="gcv4-heading"
                        >
                            Group call
                        </strong>
                    </div>

                    <div
                        class="gcv4-header-meta"
                    >
                        <span
                            class="gcv4-count"
                        >
                            0/0
                        </span>

                        <span
                            class="gcv4-duration"
                        >
                            00:00
                        </span>

                        <button
                            type="button"
                            class="gcv4-size-button"
                            data-gcv4-action="expand"
                        >
                            Expand
                        </button>
                    </div>
                </header>

                <div
                    class="gcv4-grid"
                ></div>

                <p
                    class="gcv4-error"
                    role="alert"
                ></p>

                <div
                    class="gcv4-controls"
                >
                    <button
                        type="button"
                        class="gcv4-control"
                        data-gcv4-action="invite"
                    >
                        Invite
                    </button>

                    <button
                        type="button"
                        class="gcv4-control"
                        data-gcv4-action="devices"
                    >
                        Devices
                    </button>

                    <button
                        type="button"
                        class="gcv4-control"
                        data-gcv4-action="microphone"
                    >
                        Mute
                    </button>

                    <button
                        type="button"
                        class="gcv4-control"
                        data-gcv4-action="camera"
                    >
                        Camera off
                    </button>

                    <button
                        type="button"
                        class="gcv4-control"
                        data-gcv4-action="screen"
                    >
                        Share screen
                    </button>

                    <button
                        type="button"
                        class="gcv4-control danger"
                        data-gcv4-action="leave"
                    >
                        Leave
                    </button>

                    <button
                        type="button"
                        class="gcv4-control danger hidden"
                        data-gcv4-action="end"
                    >
                        End for all
                    </button>
                </div>
            </section>

            <section
                class="gcv4-composer hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gcv4-composer-title"
            >
                <header
                    class="gcv4-dialog-header"
                >
                    <div>
                        <span
                            class="gcv4-kicker"
                        >
                            GROUP CALL
                        </span>

                        <h2
                            id="gcv4-composer-title"
                        >
                            Start a group call
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="gcv4-close"
                        data-gcv4-action="close-composer"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </header>

                <div
                    class="gcv4-mode-picker"
                >
                    <button
                        type="button"
                        data-gcv4-mode="audio"
                    >
                        Audio
                    </button>

                    <button
                        type="button"
                        data-gcv4-mode="video"
                        class="active"
                    >
                        Video
                    </button>
                </div>

                <div
                    class="gcv4-composer-summary"
                >
                    <span
                        class="gcv4-selection-count"
                    >
                        0 selected
                    </span>

                    <span
                        class="gcv4-selection-limit"
                    >
                        Up to 3 friends
                    </span>
                </div>

                <div
                    class="gcv4-friend-list"
                ></div>

                <p
                    class="gcv4-composer-message"
                    role="alert"
                ></p>

                <div
                    class="gcv4-dialog-actions"
                >
                    <button
                        type="button"
                        class="gcv4-button neutral"
                        data-gcv4-action="close-composer"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        class="gcv4-button accept gcv4-submit"
                        data-gcv4-action="submit-composer"
                    >
                        Start video call
                    </button>
                </div>
            </section>

            <section
                class="gcv4-device-panel hidden"
                role="dialog"
                aria-modal="false"
                aria-labelledby="gcv4-device-title"
            >
                <header
                    class="gcv4-dialog-header"
                >
                    <div>
                        <span
                            class="gcv4-kicker"
                        >
                            CALL SETTINGS
                        </span>

                        <h2
                            id="gcv4-device-title"
                        >
                            Microphone
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="gcv4-close"
                        data-gcv4-action="close-devices"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </header>

                <label
                    class="gcv4-device-field"
                >
                    <span>
                        Microphone input
                    </span>

                    <select
                        class="gcv4-microphone-select"
                    >
                        <option value="">
                            Default microphone
                        </option>
                    </select>
                </label>

                <p
                    class="gcv4-device-message"
                    role="status"
                ></p>
            </section>

            <div
                class="gcv4-toast hidden"
                role="status"
            ></div>
        `;

        document.body.append(root);

        ui.root = root;
        ui.backdrop =
            root.querySelector(
                ".gcv4-backdrop"
            );

        ui.incoming =
            root.querySelector(
                ".gcv4-incoming"
            );

        ui.incomingTitle =
            root.querySelector(
                ".gcv4-incoming-title"
            );

        ui.incomingDetail =
            root.querySelector(
                ".gcv4-incoming-detail"
            );

        ui.stage =
            root.querySelector(
                ".gcv4-stage"
            );

        ui.modeLabel =
            root.querySelector(
                ".gcv4-mode-label"
            );

        ui.heading =
            root.querySelector(
                ".gcv4-heading"
            );

        ui.count =
            root.querySelector(
                ".gcv4-count"
            );

        ui.duration =
            root.querySelector(
                ".gcv4-duration"
            );

        ui.sizeButton =
            root.querySelector(
                ".gcv4-size-button"
            );

        ui.grid =
            root.querySelector(
                ".gcv4-grid"
            );

        ui.error =
            root.querySelector(
                ".gcv4-error"
            );

        ui.inviteButton =
            root.querySelector(
                '[data-gcv4-action="invite"]'
            );

        ui.microphoneButton =
            root.querySelector(
                '[data-gcv4-action="microphone"]'
            );

        ui.cameraButton =
            root.querySelector(
                '[data-gcv4-action="camera"]'
            );

        ui.screenButton =
            root.querySelector(
                '[data-gcv4-action="screen"]'
            );

        ui.endButton =
            root.querySelector(
                '[data-gcv4-action="end"]'
            );

        ui.composer =
            root.querySelector(
                ".gcv4-composer"
            );

        ui.composerTitle =
            root.querySelector(
                "#gcv4-composer-title"
            );

        ui.modePicker =
            root.querySelector(
                ".gcv4-mode-picker"
            );

        ui.selectionCount =
            root.querySelector(
                ".gcv4-selection-count"
            );

        ui.selectionLimit =
            root.querySelector(
                ".gcv4-selection-limit"
            );

        ui.friendList =
            root.querySelector(
                ".gcv4-friend-list"
            );

        ui.composerMessage =
            root.querySelector(
                ".gcv4-composer-message"
            );

        ui.submitButton =
            root.querySelector(
                ".gcv4-submit"
            );

        ui.devicePanel =
            root.querySelector(
                ".gcv4-device-panel"
            );

        ui.microphoneSelect =
            root.querySelector(
                ".gcv4-microphone-select"
            );

        ui.deviceMessage =
            root.querySelector(
                ".gcv4-device-message"
            );

        ui.toast =
            root.querySelector(
                ".gcv4-toast"
            );

        root.addEventListener(
            "click",
            handleRootClick
        );

        /*
         * Some mobile browsers initially block remote audio autoplay.
         * Any later tap/click is enough to unlock it, so retry playback on
         * user interaction without interrupting the call.
         */
        document.addEventListener(
            "pointerdown",
            retryRemotePlayback,
            {
                passive: true
            }
        );

        ui.microphoneSelect
            .addEventListener(
                "change",
                () => {
                    changeMicrophone(
                        ui.microphoneSelect
                            .value
                    ).catch((error) => {
                        ui.deviceMessage
                            .textContent =
                            error.message
                            || "The microphone could not be changed.";
                    });
                }
            );
    }

    function updateRootVisibility() {
        const visible = [
            ui.incoming,
            ui.stage,
            ui.composer,
            ui.devicePanel,
            ui.toast
        ].some(
            (element) =>
                element
                && !element.classList
                    .contains("hidden")
        );

        ui.root.classList.toggle(
            "hidden",
            !visible
        );
    }

    function setError(message = "") {
        ui.error.textContent =
            String(message ?? "");
    }

    function setComposerMessage(
        message = ""
    ) {
        ui.composerMessage.textContent =
            String(message ?? "");
    }

    function showToast(
        message,
        kind = ""
    ) {
        ui.root.classList.remove(
            "hidden"
        );

        ui.toast.textContent =
            String(message ?? "");

        ui.toast.className =
            `gcv4-toast ${kind}`
                .trim();

        window.setTimeout(
            () => {
                ui.toast.classList
                    .add("hidden");

                updateRootVisibility();
            },
            3200
        );
    }

    async function ensureUser() {
        if (currentUser) {
            return currentUser;
        }

        const {
            data: { user },
            error
        } =
            await window.supabaseClient
                .auth
                .getUser();

        if (error || !user) {
            throw new Error(
                "You must be signed in to use group calls."
            );
        }

        currentUser = user;
        return user;
    }

    function preferredMicrophoneId() {
        try {
            return (
                window.localStorage
                    .getItem(
                        MICROPHONE_STORAGE_KEY
                    )
                || ""
            );
        } catch (error) {
            return "";
        }
    }

    function savePreferredMicrophoneId(
        deviceId
    ) {
        try {
            if (deviceId) {
                window.localStorage
                    .setItem(
                        MICROPHONE_STORAGE_KEY,
                        deviceId
                    );
            } else {
                window.localStorage
                    .removeItem(
                        MICROPHONE_STORAGE_KEY
                    );
            }
        } catch (error) {
            console.warn(
                "Microphone preference could not be saved:",
                error
            );
        }
    }

    function microphoneConstraints(
        deviceId =
            preferredMicrophoneId()
    ) {
        return {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(deviceId
                ? {
                    deviceId: {
                        exact: deviceId
                    }
                }
                : {})
        };
    }

    async function requestMicrophone(
        deviceId =
            preferredMicrophoneId()
    ) {
        try {
            return (
                await navigator.mediaDevices
                    .getUserMedia({
                        audio:
                            microphoneConstraints(
                                deviceId
                            ),
                        video: false
                    })
            );
        } catch (error) {
            if (
                deviceId
                && (
                    error?.name
                        === "NotFoundError"
                    || error?.name
                        === "OverconstrainedError"
                )
            ) {
                savePreferredMicrophoneId(
                    ""
                );

                return requestMicrophone(
                    ""
                );
            }

            throw error;
        }
    }

    async function requestCamera() {
        return (
            await navigator.mediaDevices
                .getUserMedia({
                    audio: false,
                    video: {
                        facingMode: {
                            ideal: "user"
                        },
                        frameRate: {
                            ideal: 24,
                            max: 30
                        },
                        resizeMode: {
                            ideal: "none"
                        }
                    }
                })
        );
    }

    async function loadIceServers() {
        if (iceServersPromise) {
            return iceServersPromise;
        }

        iceServersPromise = (
            async () => {
                try {
                    const {
                        data,
                        error
                    } =
                        await window
                            .supabaseClient
                            .functions
                            .invoke(
                                "get-call-ice-servers",
                                {
                                    body: {}
                                }
                            );

                    if (
                        error
                        || !Array.isArray(
                            data?.iceServers
                        )
                        || !data
                            .iceServers
                            .length
                    ) {
                        return (
                            fallbackIceServers
                        );
                    }

                    return data.iceServers;
                } catch (error) {
                    console.warn(
                        "TURN configuration was unavailable for the group call:",
                        error
                    );

                    return (
                        fallbackIceServers
                    );
                }
            }
        )();

        return iceServersPromise;
    }

    async function loadFullState(
        callId
    ) {
        const {
            data,
            error
        } = await window.supabaseClient
            .rpc(
                "get_group_call_state",
                {
                    p_call_id: callId
                }
            );

        if (error) {
            throw error;
        }

        return data ?? null;
    }

    function participantById(userId) {
        return (
            activeState?.participants
            ?? []
        ).find(
            (participant) =>
                participant.user_id
                    === userId
        ) ?? null;
    }

    function me() {
        if (!currentUser) {
            return null;
        }

        return participantById(
            currentUser.id
        );
    }

    function currentHost() {
        return (
            activeState?.participants
            ?? []
        ).find(
            (participant) =>
                participant.is_host
        ) ?? null;
    }

    function loadViewMode() {
        try {
            const stored =
                JSON.parse(
                    window.sessionStorage
                        .getItem(
                            VIEW_STORAGE_KEY
                        )
                    || "null"
                );

            if (
                stored?.callId
                    === currentCallId
                && stored?.expanded
                    === true
            ) {
                return "expanded";
            }
        } catch (error) {
            // Session storage is optional.
        }

        return "mini";
    }

    function saveViewMode(expanded) {
        if (!currentCallId) {
            return;
        }

        try {
            window.sessionStorage
                .setItem(
                    VIEW_STORAGE_KEY,
                    JSON.stringify({
                        callId:
                            currentCallId,
                        expanded:
                            Boolean(
                                expanded
                            )
                    })
                );
        } catch (error) {
            // Session storage is optional.
        }
    }

    function setExpanded(expanded) {
        if (
            !ui.stage
            || ui.stage.classList
                .contains("hidden")
        ) {
            return;
        }

        ui.root.classList.toggle(
            "gcv4-expanded",
            expanded
        );

        ui.backdrop.classList.toggle(
            "hidden",
            !expanded
        );

        ui.sizeButton.textContent =
            expanded
                ? "Mini"
                : "Expand";

        ui.sizeButton.dataset.gcv4Action =
            expanded
                ? "mini"
                : "expand";

        saveViewMode(expanded);
    }

    function createTile(
        participant
    ) {
        const tile =
            document.createElement(
                "article"
            );

        tile.className =
            "gcv4-tile";

        tile.dataset.userId =
            participant.user_id;

        const video =
            document.createElement(
                "video"
            );

        video.className =
            "gcv4-video";

        video.autoplay = true;
        video.playsInline = true;

        /*
         * Video tiles are always muted. Remote audio is played through a
         * dedicated <audio> element owned by that peer connection. Muted
         * video can autoplay reliably on desktop and mobile browsers, so a
         * browser autoplay decision cannot make a valid remote camera look
         * missing.
         */
        video.muted = true;

        if (
            participant.user_id
                === currentUser.id
        ) {
            video.classList
                .add("mirrored");
        }

        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            "gcv4-avatar";

        avatar.textContent =
            initials(
                participant.username
            );

        const footer =
            document.createElement(
                "footer"
            );

        footer.className =
            "gcv4-tile-footer";

        const name =
            document.createElement(
                "strong"
            );

        name.className =
            "gcv4-tile-name";

        const badges =
            document.createElement(
                "div"
            );

        badges.className =
            "gcv4-tile-badges";

        footer.append(
            name,
            badges
        );

        tile.append(
            video,
            avatar,
            footer
        );

        ui.grid.append(tile);

        const record = {
            tile,
            video,
            avatar,
            name,
            badges
        };

        tileRecords.set(
            participant.user_id,
            record
        );

        return record;
    }

    function streamForParticipant(
        participant
    ) {
        if (
            participant.user_id
                === currentUser.id
        ) {
            if (screenSharing && screenTrack) {
                return new MediaStream([
                    screenTrack
                ]);
            }

            return localStream;
        }

        return (
            peers.get(
                participant.user_id
            )?.remoteStream
            ?? null
        );
    }

    function updateTile(
        participant
    ) {
        let record =
            tileRecords.get(
                participant.user_id
            );

        if (!record) {
            record =
                createTile(
                    participant
                );
        }

        const isLocal =
            participant.user_id
                === currentUser.id;

        record.tile.classList.toggle(
            "local",
            isLocal
        );

        const effectiveCamera =
            callMode() === "video"
            && (
                isLocal
                    ? (
                        screenSharing
                        || cameraEnabled
                    )
                    : Boolean(
                        participant
                            .camera_enabled
                    )
            );

        const effectiveMic =
            isLocal
                ? microphoneEnabled
                : Boolean(
                    participant
                        .microphone_enabled
                );

        record.tile.classList.toggle(
            "camera-on",
            effectiveCamera
        );

        record.tile.classList.toggle(
            "muted",
            !effectiveMic
        );

        record.tile.classList.toggle(
            "screen-sharing",
            isLocal
                && screenSharing
        );

        record.name.textContent =
            isLocal
                ? `${participant.username} (you)`
                : participant.username;

        record.avatar.textContent =
            initials(
                participant.username
            );

        record.badges.replaceChildren();

        if (participant.is_host) {
            const host =
                document.createElement(
                    "span"
                );

            host.className =
                "gcv4-host-badge";

            host.textContent = "HOST";

            record.badges.append(
                host
            );
        }

        const mic =
            document.createElement(
                "span"
            );

        mic.className =
            "gcv4-mic-badge";

        mic.textContent =
            effectiveMic
                ? "MIC"
                : "MUTED";

        record.badges.append(mic);

        if (
            callMode() === "video"
        ) {
            const camera =
                document.createElement(
                    "span"
                );

            camera.textContent =
                effectiveCamera
                    ? (
                        isLocal
                        && screenSharing
                            ? "SCREEN"
                            : "VIDEO"
                    )
                    : "CAM OFF";

            record.badges.append(
                camera
            );
        }

        const stream =
            streamForParticipant(
                participant
            );

        if (
            stream
            && record.video.srcObject
                !== stream
        ) {
            record.video.srcObject =
                stream;

            record.video
                .play()
                .catch(() => {});
        }
    }

    function removeUnusedTiles() {
        const allowed =
            new Set(
                joinedParticipants()
                    .map(
                        (participant) =>
                            participant.user_id
                    )
            );

        for (
            const [
                userId,
                record
            ]
            of tileRecords
        ) {
            if (
                allowed.has(
                    userId
                )
            ) {
                continue;
            }

            record.tile.remove();
            tileRecords.delete(
                userId
            );
            removeSpeakingDetector(
                userId
            );
        }
    }

    function renderStage() {
        if (
            !activeState?.call
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        const mode =
            callMode();

        const joined =
            joinedParticipants();

        ui.modeLabel.textContent =
            mode === "video"
                ? "GROUP VIDEO CALL"
                : "GROUP AUDIO CALL";

        ui.heading.textContent =
            `${
                joined.length
            } participant${
                joined.length === 1
                    ? ""
                    : "s"
            }`;

        ui.count.textContent =
            `${joined.length}/${
                activeState.call
                    .max_participants
            }`;

        ui.grid.dataset.mode =
            mode;

        const activeCount =
            activeParticipants().length;

        ui.inviteButton.disabled =
            activeCount
                >= Number(
                    activeState.call
                        .max_participants
                );

        ui.cameraButton.classList.toggle(
            "hidden",
            mode !== "video"
        );

        ui.screenButton.classList.toggle(
            "hidden",
            mode !== "video"
            || !navigator.mediaDevices
                ?.getDisplayMedia
        );

        ui.endButton.classList.toggle(
            "hidden",
            !isHost()
        );

        ui.microphoneButton.textContent =
            microphoneEnabled
                ? "Mute"
                : "Unmute";

        ui.cameraButton.textContent =
            screenSharing
                ? "Camera"
                : cameraEnabled
                    ? "Camera off"
                    : "Camera on";

        ui.screenButton.textContent =
            screenSharing
                ? "Stop sharing"
                : "Share screen";

        for (
            const participant
            of joined
        ) {
            updateTile(
                participant
            );
        }

        removeUnusedTiles();

        ui.incoming.classList
            .add("hidden");

        ui.stage.classList
            .remove("hidden");

        ui.root.classList
            .remove("hidden");

        if (
            !ui.root.dataset
                .initialViewApplied
        ) {
            ui.root.dataset
                .initialViewApplied =
                "true";

            setExpanded(
                loadViewMode()
                    === "expanded"
            );
        }

        updateRootVisibility();
    }

    function renderIncoming() {
        if (
            !activeState?.call
            || membershipStatus()
                !== "invited"
        ) {
            ui.incoming.classList
                .add("hidden");

            updateRootVisibility();
            return;
        }

        const host =
            currentHost();

        const joined =
            joinedParticipants().length;

        ui.incomingTitle.textContent =
            `${
                host?.username
                ?? "A friend"
            } started a group ${
                callMode()
            } call`;

        ui.incomingDetail.textContent =
            directCallActive()
                ? "Finish your private call before joining."
                : `${
                    joined
                } already joined · ${
                    activeState.call
                        .max_participants
                } max`;

        const acceptButton =
            ui.incoming.querySelector(
                '[data-gcv4-action="accept"]'
            );

        acceptButton.disabled =
            directCallActive();

        ui.incoming.classList
            .remove("hidden");

        ui.stage.classList
            .add("hidden");

        ui.root.classList
            .remove("hidden");

        updateRootVisibility();

        if (
            !notifiedInviteIds.has(
                currentCallId
            )
        ) {
            notifiedInviteIds.add(
                currentCallId
            );

            window.siteDesktopNotifications
                ?.show?.({
                    title:
                        `Group ${callMode()} call`,
                    body:
                        `${
                            host?.username
                            ?? "A friend"
                        } invited you to join.`,
                    tag:
                        `group-call-v4-${currentCallId}`,
                    requireInteraction: true,
                    url:
                        window.location.href
                });
        }
    }

    function updateDuration() {
        if (
            !activeState?.call
            || !ui.duration
        ) {
            return;
        }

        const started =
            new Date(
                activeState.call
                    .created_at
            ).getTime();

        const elapsed =
            Number.isFinite(started)
                ? (
                    Date.now()
                    - started
                ) / 1000
                : 0;

        ui.duration.textContent =
            formatDuration(
                elapsed
            );
    }

    async function updateServerMedia() {
        if (
            !currentCallId
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        const {
            error
        } =
            await window.supabaseClient
                .rpc(
                    "update_group_call_media",
                    {
                        p_call_id:
                            currentCallId,
                        p_microphone_enabled:
                            microphoneEnabled,
                        p_camera_enabled:
                            callMode()
                                === "video"
                                && (
                                    cameraEnabled
                                    || screenSharing
                                )
                    }
                );

        if (error) {
            console.warn(
                "Group-call media state could not be updated:",
                error
            );
        }
    }

    async function ensureLocalMedia() {
        if (!localStream) {
            localStream =
                new MediaStream();
        }

        const warnings = [];

        if (
            !localAudioTrack
            || localAudioTrack
                .readyState
                === "ended"
        ) {
            try {
                const stream =
                    await requestMicrophone();

                const track =
                    stream.getAudioTracks()[0]
                    ?? null;

                if (track) {
                    localAudioTrack =
                        track;

                    localStream.addTrack(
                        track
                    );

                    microphoneEnabled =
                        true;
                }
            } catch (error) {
                microphoneEnabled =
                    false;

                warnings.push(
                    "Microphone access is unavailable. You can still listen to the call."
                );
            }
        }

        if (
            callMode() === "video"
            && (
                !cameraTrack
                || cameraTrack
                    .readyState
                    === "ended"
            )
        ) {
            try {
                const stream =
                    await requestCamera();

                const track =
                    stream.getVideoTracks()[0]
                    ?? null;

                if (track) {
                    cameraTrack =
                        track;

                    localStream.addTrack(
                        track
                    );

                    cameraEnabled =
                        true;
                }
            } catch (error) {
                cameraEnabled =
                    false;

                warnings.push(
                    "Camera access is unavailable. The call will continue with audio."
                );
            }
        } else if (
            callMode() !== "video"
        ) {
            cameraEnabled = false;
        }

        if (localAudioTrack) {
            localAudioTrack.enabled =
                microphoneEnabled;
        }

        if (cameraTrack) {
            cameraTrack.enabled =
                cameraEnabled;
        }

        /*
         * Signals can arrive while getUserMedia is still waiting on a
         * permission prompt. In that case createPeer() has already created
         * senders with null tracks. Push the newly-acquired microphone and
         * camera into every peer before continuing.
         *
         * Without this, a later-joining participant can receive everyone
         * else while nobody receives that participant.
         */
        const mediaDirectionChanged =
            await syncAllSenders();

        if (
            peers.size
            && mediaDirectionChanged
        ) {
            await renegotiateAllPeers({
                force: true
            });
        }

        await updateServerMedia();

        if (warnings.length) {
            setError(
                warnings.join(" ")
            );
        }

        const participant =
            me();

        if (participant) {
            updateTile(
                participant
            );
        }

        installSpeakingDetector(
            currentUser.id,
            localStream
        );
    }

    function outgoingVideoTrack() {
        return (
            screenTrack
            ?? cameraTrack
            ?? null
        );
    }

    function directionCanSend(direction) {
        return (
            direction === "sendrecv"
            || direction === "sendonly"
        );
    }

    async function syncPeerSenders(
        record
    ) {
        if (!record) {
            return false;
        }

        let negotiationNeeded = false;

        const desiredAudioTrack =
            localAudioTrack
            ?? null;

        const desiredAudioDirection =
            desiredAudioTrack
                ? "sendrecv"
                : "recvonly";

        if (
            record.audioTransceiver
            && record.audioTransceiver.direction
                !== desiredAudioDirection
        ) {
            record.audioTransceiver.direction =
                desiredAudioDirection;

            negotiationNeeded = true;
        }

        /*
         * currentDirection describes what the last completed SDP exchange
         * actually negotiated. If it is recvonly and a microphone now exists,
         * replaceTrack() by itself is not enough. A new offer/answer is needed.
         */
        if (
            desiredAudioTrack
            && record.audioTransceiver
                ?.currentDirection
            && !directionCanSend(
                record.audioTransceiver
                    .currentDirection
            )
        ) {
            negotiationNeeded = true;
        }

        await record.audioSender
            ?.replaceTrack(
                desiredAudioTrack
            );

        if (
            record.videoSender
            && record.videoTransceiver
        ) {
            const desiredVideoTrack =
                outgoingVideoTrack();

            const desiredVideoDirection =
                desiredVideoTrack
                    ? "sendrecv"
                    : "recvonly";

            if (
                record.videoTransceiver
                    .direction
                    !== desiredVideoDirection
            ) {
                record.videoTransceiver
                    .direction =
                    desiredVideoDirection;

                negotiationNeeded = true;
            }

            if (
                desiredVideoTrack
                && record.videoTransceiver
                    .currentDirection
                && !directionCanSend(
                    record.videoTransceiver
                        .currentDirection
                )
            ) {
                negotiationNeeded = true;
            }

            await record.videoSender
                .replaceTrack(
                    desiredVideoTrack
                    ?? null
                );
        }

        return negotiationNeeded;
    }

    async function syncAllSenders() {
        const results =
            await Promise.all(
                Array.from(
                    peers.values()
                ).map(
                    (record) =>
                        syncPeerSenders(
                            record
                        ).catch(
                            () => false
                        )
                )
            );

        return results.some(Boolean);
    }

    async function renegotiatePeer(
        remoteUserId,
        {
            iceRestart = false,
            delay = 0
        } = {}
    ) {
        if (delay > 0) {
            await new Promise(
                (resolve) =>
                    window.setTimeout(
                        resolve,
                        delay
                    )
            );
        }

        const record =
            peers.get(
                remoteUserId
            );

        if (
            !record
            || record.pc.signalingState
                === "closed"
        ) {
            return;
        }

        const needsDirectionUpdate =
            await syncPeerSenders(
                record
            );

        /*
         * We deliberately allow either side to offer here. The engine already
         * uses the perfect-negotiation polite/impolite collision handling.
         * This matters when the participant who gained a late camera is not
         * the deterministic offerer for that pair.
         */
        if (
            needsDirectionUpdate
            || iceRestart
        ) {
            await makeOffer(
                remoteUserId,
                {
                    iceRestart
                }
            );
        }
    }

    async function renegotiateAllPeers(
        {
            force = false,
            staggerMs = 80
        } = {}
    ) {
        let index = 0;

        for (
            const remoteUserId
            of peers.keys()
        ) {
            const record =
                peers.get(
                    remoteUserId
                );

            if (!record) {
                continue;
            }

            const needsDirectionUpdate =
                await syncPeerSenders(
                    record
                );

            if (
                force
                || needsDirectionUpdate
            ) {
                const delay =
                    index * staggerMs;

                index += 1;

                window.setTimeout(
                    () => {
                        makeOffer(
                            remoteUserId
                        ).catch(
                            (error) => {
                                console.warn(
                                    "Group-call media renegotiation failed:",
                                    error
                                );
                            }
                        );
                    },
                    delay
                );
            }
        }
    }

    function retryRemotePlayback() {
        for (
            const record
            of peers.values()
        ) {
            record.remoteAudio
                ?.play()
                .catch(
                    () => {}
                );

            tileRecords
                .get(
                    record.remoteUserId
                )?.video
                ?.play()
                .catch(
                    () => {}
                );
        }
    }

    async function createPeer(
        remoteUserId
    ) {
        const existing =
            peers.get(
                remoteUserId
            );

        if (existing) {
            return existing;
        }

        const iceServers =
            await loadIceServers();

        const pc =
            new RTCPeerConnection({
                iceServers
            });

        const audioTransceiver =
            pc.addTransceiver(
                "audio",
                {
                    direction:
                        localAudioTrack
                            ? "sendrecv"
                            : "recvonly"
                }
            );

        const videoTransceiver =
            callMode()
                === "video"
                ? pc.addTransceiver(
                    "video",
                    {
                        direction:
                            outgoingVideoTrack()
                                ? "sendrecv"
                                : "recvonly"
                    }
                )
                : null;

        const remoteStream =
            new MediaStream();

        const remoteAudio =
            document.createElement(
                "audio"
            );

        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
        remoteAudio.hidden = true;
        remoteAudio.dataset.groupCallPeer =
            remoteUserId;
        remoteAudio.srcObject =
            remoteStream;

        ui.root.append(
            remoteAudio
        );

        const record = {
            remoteUserId,
            pc,
            remoteStream,
            remoteAudio,
            audioTransceiver,
            videoTransceiver,
            audioSender:
                audioTransceiver.sender,
            videoSender:
                videoTransceiver
                    ?.sender
                ?? null,
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending:
                false,
            polite:
                currentUser.id
                    .localeCompare(
                        remoteUserId
                    ) > 0,
            remoteSessionId: "",
            pendingCandidates: [],
            pendingLocalCandidates: [],
            iceFlushTimer: null,
            reconnectTimer: null
        };

        peers.set(
            remoteUserId,
            record
        );

        await syncPeerSenders(
            record
        );

        pc.addEventListener(
            "icecandidate",
            (event) => {
                if (!event.candidate) {
                    return;
                }

                record
                    .pendingLocalCandidates
                    .push(
                        event.candidate
                            .toJSON()
                    );

                scheduleIceFlush(
                    record
                );
            }
        );

        pc.addEventListener(
            "track",
            (event) => {
                const track =
                    event.track;

                if (
                    !remoteStream
                        .getTracks()
                        .some(
                            (existingTrack) =>
                                existingTrack.id
                                    === track.id
                        )
                ) {
                    remoteStream
                        .addTrack(
                            track
                        );
                }

                const participant =
                    participantById(
                        remoteUserId
                    );

                if (participant) {
                    updateTile(
                        participant
                    );
                }

                if (
                    track.kind
                        === "audio"
                ) {
                    installSpeakingDetector(
                        remoteUserId,
                        remoteStream
                    );

                    record.remoteAudio
                        ?.play()
                        .catch(
                            () => {}
                        );
                }

                tileRecords
                    .get(
                        remoteUserId
                    )?.video
                    ?.play()
                    .catch(
                        () => {}
                    );
            }
        );

        pc.addEventListener(
            "connectionstatechange",
            () => {
                const tile =
                    tileRecords.get(
                        remoteUserId
                    )?.tile;

                const state =
                    pc.connectionState;

                tile?.classList.toggle(
                    "reconnecting",
                    state === "connecting"
                    || state
                        === "disconnected"
                    || state === "failed"
                );

                if (
                    state === "failed"
                    || state
                        === "disconnected"
                ) {
                    schedulePeerReconnect(
                        remoteUserId
                    );
                }
            }
        );

        return record;
    }

    function closePeer(
        remoteUserId
    ) {
        const record =
            peers.get(
                remoteUserId
            );

        if (!record) {
            return;
        }

        window.clearTimeout(
            record.iceFlushTimer
        );

        window.clearTimeout(
            record.reconnectTimer
        );

        try {
            record.pc.close();
        } catch (error) {
            // Closing an already-closed peer is harmless.
        }

        try {
            record.remoteAudio
                ?.pause();
            record.remoteAudio
                ?.remove();
        } catch (error) {
            // The audio element may already be gone during page teardown.
        }

        peers.delete(
            remoteUserId
        );

        removeSpeakingDetector(
            remoteUserId
        );
    }

    async function resetPeer(
        remoteUserId,
        remoteSessionId = ""
    ) {
        closePeer(
            remoteUserId
        );

        const record =
            await createPeer(
                remoteUserId
            );

        record.remoteSessionId =
            remoteSessionId;

        return record;
    }

    function shouldOffer(
        remoteUserId
    ) {
        return (
            currentUser.id
                .localeCompare(
                    remoteUserId
                ) < 0
        );
    }

    async function sendSignal(
        recipientId,
        signalType,
        payload = {}
    ) {
        if (
            !currentCallId
            || !recipientId
        ) {
            return;
        }

        const {
            error
        } =
            await window.supabaseClient
                .rpc(
                    "send_group_call_signal",
                    {
                        p_call_id:
                            currentCallId,
                        p_recipient_id:
                            recipientId,
                        p_signal_type:
                            signalType,
                        p_payload: {
                            ...payload,
                            session_id:
                                pageSessionId
                        }
                    }
                );

        if (error) {
            throw error;
        }
    }

    function scheduleIceFlush(
        record
    ) {
        if (record.iceFlushTimer) {
            return;
        }

        record.iceFlushTimer =
            window.setTimeout(
                async () => {
                    record.iceFlushTimer =
                        null;

                    const candidates =
                        record
                            .pendingLocalCandidates
                            .splice(0);

                    if (!candidates.length) {
                        return;
                    }

                    try {
                        await sendSignal(
                            record.remoteUserId,
                            "ice",
                            {
                                candidates
                            }
                        );
                    } catch (error) {
                        console.warn(
                            "Group-call ICE candidates could not be sent:",
                            error
                        );
                    }
                },
                ICE_BATCH_MS
            );
    }

    async function flushRemoteCandidates(
        record
    ) {
        if (
            !record.pc
                .remoteDescription
            || !record
                .pendingCandidates
                .length
        ) {
            return;
        }

        const pending =
            record
                .pendingCandidates
                .splice(0);

        for (
            const candidate
            of pending
        ) {
            try {
                await record.pc
                    .addIceCandidate(
                        candidate
                    );
            } catch (error) {
                if (
                    !record.ignoreOffer
                ) {
                    console.warn(
                        "Remote ICE candidate could not be applied:",
                        error
                    );
                }
            }
        }
    }

    async function makeOffer(
        remoteUserId,
        {
            iceRestart = false
        } = {}
    ) {
        const record =
            await createPeer(
                remoteUserId
            );

        if (
            record.makingOffer
            || record.pc
                .signalingState
                !== "stable"
        ) {
            return;
        }

        try {
            record.makingOffer =
                true;

            await syncPeerSenders(
                record
            );

            const offer =
                await record.pc
                    .createOffer({
                        iceRestart
                    });

            await record.pc
                .setLocalDescription(
                    offer
                );

            await sendSignal(
                remoteUserId,
                "offer",
                {
                    description:
                        record.pc
                            .localDescription
                            .toJSON()
                }
            );
        } finally {
            record.makingOffer =
                false;
        }
    }

    async function announcePeer(
        remoteUserId
    ) {
        await createPeer(
            remoteUserId
        );

        try {
            await sendSignal(
                remoteUserId,
                "rejoin_request",
                {
                    reason:
                        "peer_ready"
                }
            );
        } catch (error) {
            console.warn(
                "Group-call peer announcement failed:",
                error
            );
        }

        if (
            shouldOffer(
                remoteUserId
            )
        ) {
            window.setTimeout(
                () => {
                    makeOffer(
                        remoteUserId
                    ).catch(
                        (error) => {
                            console.warn(
                                "Initial group-call offer failed:",
                                error
                            );
                        }
                    );
                },
                220
            );
        }
    }

    function schedulePeerReconnect(
        remoteUserId
    ) {
        const record =
            peers.get(
                remoteUserId
            );

        if (
            !record
            || record.reconnectTimer
        ) {
            return;
        }

        record.reconnectTimer =
            window.setTimeout(
                async () => {
                    record.reconnectTimer =
                        null;

                    if (
                        !participantById(
                            remoteUserId
                        )
                    ) {
                        return;
                    }

                    try {
                        const rebuilt =
                            await resetPeer(
                                remoteUserId
                            );

                        await sendSignal(
                            remoteUserId,
                            "rejoin_request",
                            {
                                reason:
                                    "connection_restart"
                            }
                        );

                        if (
                            shouldOffer(
                                remoteUserId
                            )
                        ) {
                            await makeOffer(
                                remoteUserId,
                                {
                                    iceRestart:
                                        true
                                }
                            );
                        }

                        const tile =
                            tileRecords
                                .get(
                                    remoteUserId
                                )?.tile;

                        tile?.classList
                            .add(
                                "reconnecting"
                            );

                        rebuilt.pc
                            .addEventListener(
                                "connectionstatechange",
                                () => {}
                            );
                    } catch (error) {
                        console.warn(
                            "Group-call peer reconnect failed:",
                            error
                        );
                    }
                },
                1800
            );
    }

    async function handleSignal(
        signal
    ) {
        if (
            !signal
            || signal.call_id
                !== currentCallId
            || signal.recipient_id
                !== currentUser.id
        ) {
            return;
        }

        const remoteUserId =
            signal.sender_id;

        const payload =
            signal.payload
            ?? {};

        const remoteSessionId =
            String(
                payload.session_id
                ?? ""
            );

        if (
            signal.signal_type
                === "rejoin_request"
        ) {
            /*
             * A peer-ready announcement is not proof that the browser page
             * changed. V4 reset the RTCPeerConnection for every announcement,
             * so three participants joining close together could repeatedly
             * destroy one another's offers and ICE candidates.
             *
             * Only rebuild when the sender's page-session ID actually
             * changed. Normal peer-ready / connection-restart requests keep
             * the current connection and trigger deterministic renegotiation.
             */
            let record =
                await createPeer(
                    remoteUserId
                );

            const sessionChanged =
                Boolean(
                    remoteSessionId
                    && record.remoteSessionId
                    && record.remoteSessionId
                        !== remoteSessionId
                );

            if (sessionChanged) {
                record =
                    await resetPeer(
                        remoteUserId,
                        remoteSessionId
                    );
            } else if (
                remoteSessionId
            ) {
                record.remoteSessionId =
                    remoteSessionId;
            }

            if (
                shouldOffer(
                    remoteUserId
                )
            ) {
                const shouldRestartIce =
                    sessionChanged
                    || payload.reason
                        === "connection_restart";

                window.setTimeout(
                    () => {
                        makeOffer(
                            remoteUserId,
                            {
                                iceRestart:
                                    shouldRestartIce
                            }
                        ).catch(
                            (error) => {
                                console.warn(
                                    "Rejoin offer failed:",
                                    error
                                );
                            }
                        );
                    },
                    180
                );
            }

            const participant =
                participantById(
                    remoteUserId
                );

            if (participant) {
                updateTile(
                    participant
                );
            }

            return;
        }

        let record =
            await createPeer(
                remoteUserId
            );

        if (
            remoteSessionId
            && record.remoteSessionId
            && record.remoteSessionId
                !== remoteSessionId
        ) {
            record =
                await resetPeer(
                    remoteUserId,
                    remoteSessionId
                );
        } else if (
            remoteSessionId
        ) {
            record.remoteSessionId =
                remoteSessionId;
        }

        if (
            signal.signal_type
                === "offer"
            || signal.signal_type
                === "answer"
        ) {
            const description =
                payload.description;

            if (!description?.type) {
                return;
            }

            const readyForOffer =
                !record.makingOffer
                && (
                    record.pc
                        .signalingState
                        === "stable"
                    || record
                        .isSettingRemoteAnswerPending
                );

            const offerCollision =
                description.type
                    === "offer"
                && !readyForOffer;

            record.ignoreOffer =
                !record.polite
                && offerCollision;

            if (record.ignoreOffer) {
                return;
            }

            try {
                record
                    .isSettingRemoteAnswerPending =
                    description.type
                        === "answer";

                if (
                    offerCollision
                    && record.polite
                    && record.pc
                        .signalingState
                        !== "stable"
                ) {
                    await record.pc
                        .setLocalDescription({
                            type:
                                "rollback"
                        });
                }

                await record.pc
                    .setRemoteDescription(
                        description
                    );

                record
                    .isSettingRemoteAnswerPending =
                    false;

                await flushRemoteCandidates(
                    record
                );

                if (
                    description.type
                        === "offer"
                ) {
                    await syncPeerSenders(
                        record
                    );

                    const answer =
                        await record.pc
                            .createAnswer();

                    await record.pc
                        .setLocalDescription(
                            answer
                        );

                    await sendSignal(
                        remoteUserId,
                        "answer",
                        {
                            description:
                                record.pc
                                    .localDescription
                                    .toJSON()
                        }
                    );
                }
            } catch (error) {
                record
                    .isSettingRemoteAnswerPending =
                    false;

                console.warn(
                    "Group-call SDP could not be processed:",
                    error
                );
            }

            return;
        }

        if (
            signal.signal_type
                === "ice"
        ) {
            const candidates =
                Array.isArray(
                    payload.candidates
                )
                    ? payload.candidates
                    : payload.candidate
                        ? [
                            payload.candidate
                        ]
                        : [];

            for (
                const candidate
                of candidates
            ) {
                if (
                    record.pc
                        .remoteDescription
                ) {
                    try {
                        await record.pc
                            .addIceCandidate(
                                candidate
                            );
                    } catch (error) {
                        if (
                            !record.ignoreOffer
                        ) {
                            console.warn(
                                "Group-call ICE candidate failed:",
                                error
                            );
                        }
                    }
                } else {
                    record
                        .pendingCandidates
                        .push(
                            candidate
                        );
                }
            }
        }
    }

    function queueSignal(
        signal
    ) {
        signalChain =
            signalChain
                .then(
                    () =>
                        handleSignal(
                            signal
                        )
                )
                .catch(
                    (error) => {
                        console.warn(
                            "Group-call signalling failed:",
                            error
                        );
                    }
                );

        return signalChain;
    }

    async function pollSignals() {
        if (
            signalPolling
            || !currentCallId
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        signalPolling = true;

        try {
            const {
                data,
                error
            } =
                await window
                    .supabaseClient
                    .rpc(
                        "get_group_call_signals",
                        {
                            p_call_id:
                                currentCallId,
                            p_after_id:
                                signalCursor
                        }
                    );

            if (error) {
                return;
            }

            const signals =
                Array.isArray(data)
                    ? data
                    : [];

            for (
                const signal
                of signals
            ) {
                signalCursor =
                    Math.max(
                        signalCursor,
                        Number(
                            signal.id
                        )
                    );

                queueSignal(
                    signal
                );
            }
        } finally {
            signalPolling = false;
        }
    }

    async function startSignalSystem() {
        if (
            !currentCallId
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        if (signalChannel) {
            window.supabaseClient
                .removeChannel(
                    signalChannel
                );

            signalChannel = null;
        }

        const {
            data: cursor,
            error
        } =
            await window.supabaseClient
                .rpc(
                    "get_group_call_signal_cursor",
                    {
                        p_call_id:
                            currentCallId
                    }
                );

        if (!error) {
            signalCursor =
                Number(cursor ?? 0);
        }

        signalChannel =
            window.supabaseClient
                .channel(
                    `group-call-v4-signals-${currentCallId}-${pageSessionId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "group_call_signals",
                        filter:
                            `recipient_id=eq.${currentUser.id}`
                    },
                    (payload) => {
                        const signal =
                            payload.new;

                        if (
                            !signal
                            || signal.call_id
                                !== currentCallId
                        ) {
                            return;
                        }

                        signalCursor =
                            Math.max(
                                signalCursor,
                                Number(
                                    signal.id
                                )
                            );

                        queueSignal(
                            signal
                        );
                    }
                )
                .subscribe();

        window.clearInterval(
            signalPollTimer
        );

        signalPollTimer =
            window.setInterval(
                () => {
                    pollSignals()
                        .catch(
                            () => {}
                        );
                },
                SIGNAL_POLL_MS
            );
    }

    async function reconcilePeers(
        {
            announceNew = false
        } = {}
    ) {
        if (
            !currentUser
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        const remoteParticipants =
            joinedParticipants()
                .filter(
                    (participant) =>
                        participant.user_id
                            !== currentUser.id
                );

        const remoteIds =
            new Set(
                remoteParticipants
                    .map(
                        (participant) =>
                            participant.user_id
                    )
            );

        for (
            const remoteUserId
            of Array.from(
                peers.keys()
            )
        ) {
            if (
                !remoteIds.has(
                    remoteUserId
                )
            ) {
                closePeer(
                    remoteUserId
                );
            }
        }

        for (
            const participant
            of remoteParticipants
        ) {
            const existed =
                peers.has(
                    participant.user_id
                );

            await createPeer(
                participant.user_id
            );

            updateTile(
                participant
            );

            if (
                announceNew
                && !existed
            ) {
                await announcePeer(
                    participant.user_id
                );
            }
        }

        removeUnusedTiles();
    }

    async function refreshState() {
        if (
            stateRefreshing
            || !currentCallId
        ) {
            return;
        }

        stateRefreshing = true;

        try {
            const state =
                await loadFullState(
                    currentCallId
                );

            if (!state?.call) {
                const hadCall =
                    Boolean(
                        activeState?.call
                    );

                await cleanupCallLocal();

                activeState = null;
                currentCallId = null;

                if (hadCall) {
                    showToast(
                        "The group call ended."
                    );
                }

                return;
            }

            activeState = state;

            if (
                membershipStatus()
                    === "invited"
            ) {
                renderIncoming();
                startStatePolling();
                return;
            }

            if (
                membershipStatus()
                    === "joined"
            ) {
                renderStage();

                if (!connecting) {
                    await reconcilePeers({
                        announceNew: true
                    });
                }
            }
        } catch (error) {
            console.warn(
                "Group-call state refresh failed:",
                error
            );
        } finally {
            stateRefreshing = false;
        }
    }

    function startStatePolling() {
        window.clearInterval(
            statePollTimer
        );

        statePollTimer =
            window.setInterval(
                () => {
                    refreshState()
                        .catch(
                            () => {}
                        );
                },
                STATE_POLL_MS
            );
    }

    async function heartbeat() {
        if (
            !currentCallId
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        try {
            const {
                data,
                error
            } =
                await window
                    .supabaseClient
                    .rpc(
                        "touch_group_call",
                        {
                            p_call_id:
                                currentCallId
                        }
                    );

            if (
                error
                || data === false
            ) {
                await refreshState();
            }
        } catch (error) {
            console.warn(
                "Group-call heartbeat failed:",
                error
            );
        }
    }

    function startHeartbeat() {
        window.clearInterval(
            heartbeatTimer
        );

        heartbeatTimer =
            window.setInterval(
                () => {
                    heartbeat()
                        .catch(
                            () => {}
                        );
                },
                HEARTBEAT_MS
            );

        heartbeat()
            .catch(
                () => {}
            );
    }

    function startDurationTimer() {
        window.clearInterval(
            durationTimer
        );

        updateDuration();

        durationTimer =
            window.setInterval(
                updateDuration,
                1000
            );
    }

    function ensureAudioContext() {
        if (
            audioContext
            || !(
                window.AudioContext
                || window.webkitAudioContext
            )
        ) {
            return (
                audioContext
            );
        }

        const Context =
            window.AudioContext
            || window.webkitAudioContext;

        audioContext =
            new Context();

        audioContext
            .resume?.()
            .catch(
                () => {}
            );

        return audioContext;
    }

    function removeSpeakingDetector(
        userId
    ) {
        const detector =
            detectors.get(
                userId
            );

        if (!detector) {
            return;
        }

        try {
            detector.source
                ?.disconnect();
        } catch (error) {
            // Already disconnected.
        }

        detectors.delete(
            userId
        );
    }

    function installSpeakingDetector(
        userId,
        stream
    ) {
        if (
            !stream
            || !stream
                .getAudioTracks()
                .some(
                    (track) =>
                        track.readyState
                            === "live"
                )
        ) {
            return;
        }

        removeSpeakingDetector(
            userId
        );

        try {
            const context =
                ensureAudioContext();

            if (!context) {
                return;
            }

            const source =
                context
                    .createMediaStreamSource(
                        stream
                    );

            const analyser =
                context
                    .createAnalyser();

            analyser.fftSize = 256;
            analyser.smoothingTimeConstant =
                0.55;

            source.connect(
                analyser
            );

            detectors.set(
                userId,
                {
                    source,
                    analyser,
                    buffer:
                        new Uint8Array(
                            analyser.fftSize
                        )
                }
            );

            startSpeakingTimer();
        } catch (error) {
            // Speaking indicators are optional.
        }
    }

    function startSpeakingTimer() {
        if (speakingTimer) {
            return;
        }

        speakingTimer =
            window.setInterval(
                () => {
                    if (
                        !detectors.size
                    ) {
                        window.clearInterval(
                            speakingTimer
                        );

                        speakingTimer =
                            null;

                        return;
                    }

                    for (
                        const [
                            userId,
                            detector
                        ]
                        of detectors
                    ) {
                        detector.analyser
                            .getByteTimeDomainData(
                                detector.buffer
                            );

                        let sum = 0;

                        for (
                            const value
                            of detector.buffer
                        ) {
                            const centred =
                                (
                                    value
                                    - 128
                                ) / 128;

                            sum +=
                                centred
                                * centred;
                        }

                        const rms =
                            Math.sqrt(
                                sum
                                / detector
                                    .buffer
                                    .length
                            );

                        tileRecords
                            .get(
                                userId
                            )?.tile
                            .classList
                            .toggle(
                                "speaking",
                                rms > 0.045
                            );
                    }
                },
                170
            );
    }

    async function connectJoinedCall() {
        if (
            connecting
            || membershipStatus()
                !== "joined"
            || !currentCallId
        ) {
            return;
        }

        connecting = true;

        try {
            setError("");
            renderStage();

            /*
             * Acquire local media BEFORE we begin accepting SDP offers.
             *
             * V4/V5 started signalling first. A joining phone/laptop could
             * therefore answer an offer while its permission prompt was still
             * open. Chrome then generated a recvonly answer. Adding a camera
             * later with replaceTrack() cannot change an already-negotiated
             * recvonly transceiver into sendrecv without another SDP exchange.
             *
             * Starting media first guarantees the initial answer advertises
             * the tracks that are actually available.
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
                loadViewMode()
                    !== "expanded"
            ) {
                setExpanded(false);
            }
        } catch (error) {
            console.warn(
                "Group call could not fully connect:",
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

    async function resumeFromBootstrap(
        bootstrapState
    ) {
        if (
            disposed
            || !bootstrapState
                ?.call_id
        ) {
            return;
        }

        await ensureUser();
        createUi();

        if (
            currentCallId
            && currentCallId
                !== bootstrapState.call_id
        ) {
            await cleanupCallLocal();
        }

        currentCallId =
            bootstrapState.call_id;

        const state =
            await loadFullState(
                currentCallId
            );

        if (!state?.call) {
            currentCallId = null;
            return;
        }

        activeState = state;

        if (
            membershipStatus()
                === "invited"
        ) {
            renderIncoming();
            startStatePolling();
            return;
        }

        if (
            membershipStatus()
                === "joined"
        ) {
            await connectJoinedCall();
        }
    }

    async function respondToInvite(
        accept
    ) {
        if (
            actionBusy
            || !currentCallId
        ) {
            return;
        }

        if (
            accept
            && directCallActive()
        ) {
            setError(
                "End your private call before joining this group call."
            );

            return;
        }

        actionBusy = true;

        try {
            const {
                error
            } =
                await window
                    .supabaseClient
                    .rpc(
                        "respond_to_group_call",
                        {
                            p_call_id:
                                currentCallId,
                            p_accept:
                                Boolean(
                                    accept
                                )
                        }
                    );

            if (error) {
                throw error;
            }

            if (!accept) {
                await cleanupCallLocal();

                activeState = null;
                currentCallId = null;

                showToast(
                    "Group call declined."
                );

                return;
            }

            const state =
                await loadFullState(
                    currentCallId
                );

            if (!state?.call) {
                throw new Error(
                    "The group call is no longer active."
                );
            }

            activeState = state;

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
        if (
            actionBusy
            || !currentCallId
        ) {
            return;
        }

        actionBusy = true;

        const leavingCallId =
            currentCallId;

        try {
            const {
                error
            } =
                await window
                    .supabaseClient
                    .rpc(
                        "leave_group_call",
                        {
                            p_call_id:
                                leavingCallId
                        }
                    );

            if (error) {
                throw error;
            }

            await cleanupCallLocal();

            activeState = null;
            currentCallId = null;

            showToast(
                "You left the group call."
            );
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
        if (
            actionBusy
            || !currentCallId
            || !isHost()
        ) {
            return;
        }

        actionBusy = true;

        try {
            const {
                error
            } =
                await window
                    .supabaseClient
                    .rpc(
                        "end_group_call",
                        {
                            p_call_id:
                                currentCallId
                        }
                    );

            if (error) {
                throw error;
            }

            await cleanupCallLocal();

            activeState = null;
            currentCallId = null;

            showToast(
                "Group call ended."
            );
        } catch (error) {
            setError(
                error.message
                || "The group call could not be ended."
            );
        } finally {
            actionBusy = false;
        }
    }

    async function toggleMicrophone() {
        if (
            !currentCallId
            || membershipStatus()
                !== "joined"
        ) {
            return;
        }

        if (
            !localAudioTrack
            || localAudioTrack
                .readyState
                === "ended"
        ) {
            try {
                const stream =
                    await requestMicrophone();

                localAudioTrack =
                    stream
                        .getAudioTracks()[0]
                    ?? null;

                if (
                    localAudioTrack
                ) {
                    if (!localStream) {
                        localStream =
                            new MediaStream();
                    }

                    localStream
                        .addTrack(
                            localAudioTrack
                        );

                    microphoneEnabled =
                        true;

                    await syncAllSenders();

                    await renegotiateAllPeers({
                        force: true
                    });

                    installSpeakingDetector(
                        currentUser.id,
                        localStream
                    );
                }
            } catch (error) {
                setError(
                    "Microphone permission is unavailable. Check the browser site permissions."
                );

                return;
            }
        } else {
            microphoneEnabled =
                !microphoneEnabled;

            localAudioTrack.enabled =
                microphoneEnabled;
        }

        await updateServerMedia();
        renderStage();
    }

    async function toggleCamera() {
        if (
            callMode() !== "video"
            || !currentCallId
        ) {
            return;
        }

        if (screenSharing) {
            await stopScreenShare();

            if (
                cameraTrack
                && cameraTrack.readyState
                    !== "ended"
            ) {
                cameraEnabled = true;
                cameraTrack.enabled = true;

                await syncAllSenders();
                await updateServerMedia();
                renderStage();
                return;
            }
        }

        if (
            !cameraTrack
            || cameraTrack
                .readyState
                === "ended"
        ) {
            try {
                const stream =
                    await requestCamera();

                cameraTrack =
                    stream
                        .getVideoTracks()[0]
                    ?? null;

                if (
                    cameraTrack
                ) {
                    if (!localStream) {
                        localStream =
                            new MediaStream();
                    }

                    localStream
                        .addTrack(
                            cameraTrack
                        );

                    cameraEnabled =
                        true;

                    await syncAllSenders();

                    await renegotiateAllPeers({
                        force: true
                    });
                }
            } catch (error) {
                setError(
                    "Camera permission is unavailable. Check the browser site permissions."
                );

                return;
            }
        } else {
            cameraEnabled =
                !cameraEnabled;

            cameraTrack.enabled =
                cameraEnabled;
        }

        await updateServerMedia();
        renderStage();
    }

    async function stopScreenShare() {
        if (!screenTrack) {
            return;
        }

        const oldTrack =
            screenTrack;

        screenTrack = null;
        screenSharing = false;

        try {
            oldTrack.stop();
        } catch (error) {
            // Already stopped.
        }

        await syncAllSenders();
        await updateServerMedia();
        renderStage();
    }

    async function toggleScreenShare() {
        if (
            callMode() !== "video"
            || !navigator.mediaDevices
                ?.getDisplayMedia
        ) {
            return;
        }

        if (screenSharing) {
            await stopScreenShare();
            return;
        }

        try {
            const stream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true,
                        audio: false
                    });

            const track =
                stream
                    .getVideoTracks()[0]
                ?? null;

            if (!track) {
                return;
            }

            screenTrack = track;
            screenSharing = true;

            track.addEventListener(
                "ended",
                () => {
                    if (
                        screenTrack
                            === track
                    ) {
                        stopScreenShare()
                            .catch(
                                () => {}
                            );
                    }
                },
                {
                    once: true
                }
            );

            await syncAllSenders();
            await updateServerMedia();
            renderStage();
        } catch (error) {
            if (
                error?.name
                    !== "NotAllowedError"
            ) {
                setError(
                    error.message
                    || "Screen sharing could not start."
                );
            }
        }
    }

    async function refreshMicrophoneDevices() {
        ui.deviceMessage.textContent =
            "";

        if (
            !navigator.mediaDevices
                ?.enumerateDevices
        ) {
            ui.deviceMessage.textContent =
                "This browser cannot list microphones.";

            return;
        }

        const devices =
            await navigator.mediaDevices
                .enumerateDevices();

        const microphones =
            devices.filter(
                (device) =>
                    device.kind
                        === "audioinput"
            );

        const selected =
            preferredMicrophoneId();

        ui.microphoneSelect
            .replaceChildren();

        const defaultOption =
            document.createElement(
                "option"
            );

        defaultOption.value = "";
        defaultOption.textContent =
            "Default microphone";

        ui.microphoneSelect.append(
            defaultOption
        );

        microphones.forEach(
            (device, index) => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    device.deviceId;

                option.textContent =
                    device.label
                    || `Microphone ${
                        index + 1
                    }`;

                ui.microphoneSelect
                    .append(
                        option
                    );
            }
        );

        ui.microphoneSelect.value =
            Array.from(
                ui.microphoneSelect
                    .options
            ).some(
                (option) =>
                    option.value
                        === selected
            )
                ? selected
                : "";
    }

    async function openDevices() {
        ui.devicePanel.classList
            .remove("hidden");

        ui.root.classList
            .remove("hidden");

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
        ui.devicePanel.classList
            .add("hidden");

        updateRootVisibility();
    }

    async function changeMicrophone(
        deviceId
    ) {
        const stream =
            await requestMicrophone(
                deviceId
            );

        const newTrack =
            stream
                .getAudioTracks()[0]
            ?? null;

        if (!newTrack) {
            throw new Error(
                "That microphone did not provide an audio track."
            );
        }

        const oldTrack =
            localAudioTrack;

        localAudioTrack =
            newTrack;

        microphoneEnabled = true;
        newTrack.enabled = true;

        if (!localStream) {
            localStream =
                new MediaStream();
        }

        if (oldTrack) {
            localStream
                .removeTrack(
                    oldTrack
                );
        }

        localStream.addTrack(
            newTrack
        );

        await syncAllSenders();

        try {
            oldTrack?.stop();
        } catch (error) {
            // Already stopped.
        }

        savePreferredMicrophoneId(
            deviceId
        );

        installSpeakingDetector(
            currentUser.id,
            localStream
        );

        await updateServerMedia();
        renderStage();

        ui.deviceMessage.textContent =
            "Microphone changed.";
    }

    async function loadFriends() {
        const {
            data,
            error
        } =
            await window.supabaseClient
                .rpc(
                    "get_my_friends",
                    {
                        p_search: null
                    }
                );

        if (error) {
            throw error;
        }

        return (
            Array.isArray(data)
                ? data
                : []
        );
    }

    function composerSelectionLimit() {
        if (
            composerPurpose
                === "invite"
        ) {
            return Math.max(
                0,
                Number(
                    activeState?.call
                        ?.max_participants
                    ?? 0
                )
                - activeParticipants()
                    .length
            );
        }

        return (
            modeLimit(
                composerMode
            ) - 1
        );
    }

    function updateComposerSummary() {
        const limit =
            composerSelectionLimit();

        ui.selectionCount.textContent =
            `${
                composerSelected.size
            } selected`;

        ui.selectionLimit.textContent =
            limit === 1
                ? "1 spot available"
                : `${
                    limit
                } spots available`;

        ui.submitButton.disabled =
            composerSelected.size
                < 1
            || composerSelected.size
                > limit;

        ui.submitButton.textContent =
            composerPurpose
                === "invite"
                ? "Send invites"
                : `Start ${
                    composerMode
                } call`;

        ui.modePicker
            .querySelectorAll(
                "[data-gcv4-mode]"
            )
            .forEach(
                (button) => {
                    button.classList
                        .toggle(
                            "active",
                            button.dataset
                                .gcv4Mode
                                === composerMode
                        );

                    button.disabled =
                        composerPurpose
                            === "invite";
                }
            );
    }

    function renderComposerFriends() {
        ui.friendList
            .replaceChildren();

        const excluded =
            new Set(
                composerPurpose
                    === "invite"
                    ? activeParticipants()
                        .map(
                            (participant) =>
                                participant
                                    .user_id
                        )
                    : []
            );

        const available =
            composerFriends.filter(
                (friend) =>
                    !excluded.has(
                        friend.user_id
                    )
            );

        if (!available.length) {
            const empty =
                document.createElement(
                    "p"
                );

            empty.className =
                "gcv4-empty";

            empty.textContent =
                composerPurpose
                    === "invite"
                    ? "No additional friends are available to invite."
                    : "Add some friends before starting a group call.";

            ui.friendList.append(
                empty
            );

            updateComposerSummary();
            return;
        }

        const limit =
            composerSelectionLimit();

        for (
            const friend
            of available
        ) {
            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "gcv4-friend-option";

            const checkbox =
                document.createElement(
                    "input"
                );

            checkbox.type =
                "checkbox";

            checkbox.value =
                friend.user_id;

            checkbox.checked =
                composerSelected.has(
                    friend.user_id
                );

            const avatar =
                document.createElement(
                    "span"
                );

            avatar.className =
                "gcv4-friend-avatar";

            avatar.textContent =
                initials(
                    friend.username
                );

            const copy =
                document.createElement(
                    "span"
                );

            copy.className =
                "gcv4-friend-copy";

            const name =
                document.createElement(
                    "strong"
                );

            name.textContent =
                friend.username;

            const level =
                document.createElement(
                    "small"
                );

            level.textContent =
                `Level ${
                    Number(
                        friend.level
                        ?? 1
                    )
                }`;

            copy.append(
                name,
                level
            );

            checkbox.addEventListener(
                "change",
                () => {
                    if (
                        checkbox.checked
                    ) {
                        if (
                            composerSelected
                                .size
                                >= limit
                        ) {
                            checkbox.checked =
                                false;

                            setComposerMessage(
                                `That call has room for ${
                                    limit
                                } friend${
                                    limit === 1
                                        ? ""
                                        : "s"
                                } from this screen.`
                            );

                            return;
                        }

                        composerSelected
                            .add(
                                friend
                                    .user_id
                            );
                    } else {
                        composerSelected
                            .delete(
                                friend
                                    .user_id
                            );
                    }

                    setComposerMessage("");
                    updateComposerSummary();
                }
            );

            label.append(
                checkbox,
                avatar,
                copy
            );

            ui.friendList.append(
                label
            );
        }

        updateComposerSummary();
    }

    async function openComposer(
        {
            purpose = "create"
        } = {}
    ) {
        await ensureUser();
        createUi();

        if (
            purpose === "create"
            && activeState?.call
        ) {
            purpose = "invite";
        }

        if (
            purpose === "create"
            && directCallActive()
        ) {
            showToast(
                "End your private call before starting a group call.",
                "error"
            );

            return;
        }

        composerPurpose =
            purpose;

        composerMode =
            purpose === "invite"
                ? callMode()
                : "video";

        composerSelected =
            new Set();

        setComposerMessage("");

        ui.composerTitle.textContent =
            purpose === "invite"
                ? "Invite to group call"
                : "Start a group call";

        ui.composer.classList
            .remove("hidden");

        ui.backdrop.classList
            .remove("hidden");

        ui.root.classList
            .remove("hidden");

        updateRootVisibility();

        try {
            composerFriends =
                await loadFriends();

            renderComposerFriends();
        } catch (error) {
            setComposerMessage(
                error.message
                || "Friends could not be loaded."
            );
        }
    }

    function closeComposer() {
        ui.composer.classList
            .add("hidden");

        if (
            !ui.root.classList
                .contains(
                    "gcv4-expanded"
                )
        ) {
            ui.backdrop.classList
                .add("hidden");
        }

        updateRootVisibility();
    }

    async function submitComposer() {
        if (
            actionBusy
            || composerSelected.size
                < 1
        ) {
            return;
        }

        const selected =
            Array.from(
                composerSelected
            );

        const limit =
            composerSelectionLimit();

        if (
            selected.length
                > limit
        ) {
            setComposerMessage(
                "Too many players are selected for this call."
            );

            return;
        }

        actionBusy = true;
        ui.submitButton.disabled =
            true;

        try {
            if (
                composerPurpose
                    === "invite"
            ) {
                const {
                    data,
                    error
                } =
                    await window
                        .supabaseClient
                        .rpc(
                            "invite_to_group_call",
                            {
                                p_call_id:
                                    currentCallId,
                                p_invitee_ids:
                                    selected
                            }
                        );

                if (error) {
                    throw error;
                }

                closeComposer();

                showToast(
                    `${
                        Number(data ?? 0)
                    } invitation${
                        Number(data ?? 0)
                            === 1
                            ? ""
                            : "s"
                    } sent.`
                );

                await refreshState();
                return;
            }

            if (
                directCallActive()
            ) {
                throw new Error(
                    "End your private call before starting a group call."
                );
            }

            const {
                data: callId,
                error
            } =
                await window
                    .supabaseClient
                    .rpc(
                        "create_group_call",
                        {
                            p_call_mode:
                                composerMode,
                            p_invitee_ids:
                                selected
                        }
                    );

            if (error) {
                throw error;
            }

            currentCallId =
                callId;

            activeState =
                await loadFullState(
                    currentCallId
                );

            closeComposer();

            if (
                !activeState?.call
            ) {
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

    async function cleanupCallLocal() {
        window.clearInterval(
            statePollTimer
        );

        window.clearInterval(
            signalPollTimer
        );

        window.clearInterval(
            heartbeatTimer
        );

        window.clearInterval(
            durationTimer
        );

        statePollTimer = null;
        signalPollTimer = null;
        heartbeatTimer = null;
        durationTimer = null;

        if (
            signalChannel
            && window.supabaseClient
        ) {
            window.supabaseClient
                .removeChannel(
                    signalChannel
                );

            signalChannel = null;
        }

        for (
            const remoteUserId
            of Array.from(
                peers.keys()
            )
        ) {
            closePeer(
                remoteUserId
            );
        }

        peers.clear();

        for (
            const userId
            of Array.from(
                detectors.keys()
            )
        ) {
            removeSpeakingDetector(
                userId
            );
        }

        if (speakingTimer) {
            window.clearInterval(
                speakingTimer
            );

            speakingTimer = null;
        }

        if (screenTrack) {
            try {
                screenTrack.stop();
            } catch (error) {
                // Already stopped.
            }

            screenTrack = null;
        }

        if (localStream) {
            for (
                const track
                of localStream
                    .getTracks()
            ) {
                try {
                    track.stop();
                } catch (error) {
                    // Already stopped.
                }
            }
        }

        localStream = null;
        localAudioTrack = null;
        cameraTrack = null;
        screenTrack = null;

        microphoneEnabled = true;
        cameraEnabled = true;
        screenSharing = false;

        tileRecords.forEach(
            (record) =>
                record.tile.remove()
        );

        tileRecords.clear();

        if (ui.stage) {
            ui.stage.classList
                .add("hidden");
        }

        if (ui.incoming) {
            ui.incoming.classList
                .add("hidden");
        }

        if (ui.devicePanel) {
            ui.devicePanel.classList
                .add("hidden");
        }

        if (ui.backdrop) {
            ui.backdrop.classList
                .add("hidden");
        }

        if (ui.root) {
            ui.root.classList
                .remove(
                    "gcv4-expanded"
                );

            delete ui.root.dataset
                .initialViewApplied;

            updateRootVisibility();
        }

        connecting = false;
        signalCursor = 0;
        signalChain =
            Promise.resolve();
    }

    async function handleRootClick(
        event
    ) {
        const modeButton =
            event.target.closest(
                "[data-gcv4-mode]"
            );

        if (modeButton) {
            if (
                composerPurpose
                    !== "create"
            ) {
                return;
            }

            composerMode =
                modeButton.dataset
                    .gcv4Mode;

            const limit =
                composerSelectionLimit();

            while (
                composerSelected.size
                    > limit
            ) {
                const last =
                    Array.from(
                        composerSelected
                    ).at(-1);

                composerSelected
                    .delete(last);
            }

            renderComposerFriends();
            return;
        }

        const button =
            event.target.closest(
                "[data-gcv4-action]"
            );

        if (!button) {
            /*
             * A click anywhere on the active call is also a useful chance
             * to satisfy browsers that blocked media autoplay after a page
             * navigation.
             */
            ui.grid
                ?.querySelectorAll(
                    "video"
                )
                .forEach(
                    (video) => {
                        video.play()
                            .catch(
                                () => {}
                            );
                    }
                );

            audioContext
                ?.resume?.()
                .catch(
                    () => {}
                );

            return;
        }

        const action =
            button.dataset
                .gcv4Action;

        if (action === "accept") {
            await respondToInvite(
                true
            );
        } else if (
            action === "decline"
        ) {
            await respondToInvite(
                false
            );
        } else if (
            action === "expand"
        ) {
            setExpanded(true);
        } else if (
            action === "mini"
        ) {
            if (
                button === ui.backdrop
                && !ui.composer
                    .classList
                    .contains(
                        "hidden"
                    )
            ) {
                return;
            }

            setExpanded(false);
        } else if (
            action === "invite"
        ) {
            await openComposer({
                purpose: "invite"
            });
        } else if (
            action
                === "close-composer"
        ) {
            closeComposer();
        } else if (
            action
                === "submit-composer"
        ) {
            await submitComposer();
        } else if (
            action
                === "devices"
        ) {
            await openDevices();
        } else if (
            action
                === "close-devices"
        ) {
            closeDevices();
        } else if (
            action
                === "microphone"
        ) {
            await toggleMicrophone();
        } else if (
            action
                === "camera"
        ) {
            await toggleCamera();
        } else if (
            action
                === "screen"
        ) {
            await toggleScreenShare();
        } else if (
            action
                === "leave"
        ) {
            await leaveCall();
        } else if (
            action === "end"
        ) {
            const confirmed =
                window.confirm(
                    "End this group call for everyone?"
                );

            if (confirmed) {
                await endCallForAll();
            }
        }
    }

    navigator.mediaDevices
        ?.addEventListener?.(
            "devicechange",
            () => {
                if (
                    ui.devicePanel
                    && !ui.devicePanel
                        .classList
                        .contains(
                            "hidden"
                        )
                ) {
                    refreshMicrophoneDevices()
                        .catch(
                            () => {}
                        );
                }
            }
        );

    /*
     * Important: navigation closes only this page's media and peer objects.
     * It does NOT call leave_group_call. The next page's lightweight
     * bootstrap sees the still-joined membership and reconnects the call.
     */
    window.addEventListener(
        "pagehide",
        () => {
            disposed = true;

            cleanupCallLocal()
                .catch(
                    () => {}
                );
        }
    );

    createUi();

    window.groupCallEngineV4 = {
        VERSION,

        resumeFromBootstrap,

        openComposer,

        isHandlingCall() {
            return Boolean(
                currentCallId
                || activeState?.call
                || (
                    ui.composer
                    && !ui.composer
                        .classList
                        .contains(
                            "hidden"
                        )
                )
            );
        },

        get activeCall() {
            return (
                activeState?.call
                ?? null
            );
        }
    };
})();
