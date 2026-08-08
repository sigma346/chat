(() => {
    if (window.__playerCallVideoFitLoaded) {
        return;
    }

    window.__playerCallVideoFitLoaded = true;

    const VIEW_STORAGE_KEY = "player-call-view-v2";
    const trackedPeerConnections = new Set();

    let continuityUser = null;
    let continuityChannel = null;
    let reconnectRequestedForCallId = "";
    let autoRejoinedCallId = "";

    /*
     * The normal call script previously registered a pagehide handler which
     * ended an accepted call every time GitHub Pages navigated to another
     * HTML file. Suppress only that exact handler. Other pagehide listeners
     * on the site still behave normally.
     */
    function installCrossPageCallPersistence() {
        if (window.__playerCallPagehidePersistenceInstalled) {
            return;
        }

        window.__playerCallPagehidePersistenceInstalled = true;

        const nativeAddEventListener =
            window.addEventListener;

        window.addEventListener = function (
            type,
            listener,
            options
        ) {
            if (
                type === "pagehide"
                && typeof listener === "function"
                && listener.name === "sendUnloadEnd"
            ) {
                return;
            }

            return nativeAddEventListener.call(
                this,
                type,
                listener,
                options
            );
        };
    }

    /*
     * Remember the RTCPeerConnection created by player-calls.js. This lets
     * the original caller perform an ICE-restart offer when the recipient
     * moves to another page and asks to reconnect.
     */
    function installPeerConnectionTracking() {
        if (
            !window.RTCPeerConnection
            || window.RTCPeerConnection
                .__playerCallContinuityWrapped
        ) {
            return;
        }

        const NativeRTCPeerConnection =
            window.RTCPeerConnection;

        function TrackedRTCPeerConnection(...args) {
            const connection =
                new NativeRTCPeerConnection(...args);

            trackedPeerConnections.add(connection);

            connection.addEventListener(
                "connectionstatechange",
                () => {
                    if (
                        connection.connectionState === "closed"
                    ) {
                        trackedPeerConnections.delete(
                            connection
                        );
                    }
                }
            );

            return connection;
        }

        TrackedRTCPeerConnection.prototype =
            NativeRTCPeerConnection.prototype;

        Object.setPrototypeOf(
            TrackedRTCPeerConnection,
            NativeRTCPeerConnection
        );

        Object.defineProperty(
            TrackedRTCPeerConnection,
            "__playerCallContinuityWrapped",
            {
                value: true
            }
        );

        window.RTCPeerConnection =
            TrackedRTCPeerConnection;
    }

    function activePeerConnection() {
        return Array
            .from(trackedPeerConnections)
            .reverse()
            .find(
                (connection) =>
                    connection.signalingState !== "closed"
            )
            ?? null;
    }

    /*
     * The main call script requests a fixed 1280x720 camera. Intercept only
     * that request and let mobile cameras retain their natural orientation.
     */
    function installCameraConstraintFix() {
        const mediaDevices = navigator.mediaDevices;

        if (
            !mediaDevices
            || typeof mediaDevices.getUserMedia
                !== "function"
            || mediaDevices.__playerCallVideoFitWrapped
        ) {
            return;
        }

        const originalGetUserMedia =
            mediaDevices.getUserMedia.bind(
                mediaDevices
            );

        mediaDevices.getUserMedia = (
            constraints = {}
        ) => {
            const video = constraints?.video;

            const looksLikePlayerCallCamera =
                video
                && typeof video === "object"
                && (
                    video.width?.ideal === 1280
                    || video.height?.ideal === 720
                );

            if (!looksLikePlayerCallCamera) {
                return originalGetUserMedia(
                    constraints
                );
            }

            const {
                width,
                height,
                aspectRatio,
                ...remainingVideoConstraints
            } = video;

            return originalGetUserMedia({
                ...constraints,
                video: {
                    ...remainingVideoConstraints,
                    facingMode:
                        remainingVideoConstraints
                            .facingMode
                        ?? { ideal: "user" },
                    resizeMode:
                        remainingVideoConstraints
                            .resizeMode
                        ?? { ideal: "none" },
                    frameRate:
                        remainingVideoConstraints
                            .frameRate
                        ?? { ideal: 24, max: 30 }
                }
            });
        };

        try {
            Object.defineProperty(
                mediaDevices,
                "__playerCallVideoFitWrapped",
                {
                    value: true,
                    configurable: true
                }
            );
        } catch (error) {
            mediaDevices
                .__playerCallVideoFitWrapped = true;
        }
    }

    function injectVideoFitStyles() {
        if (
            document.querySelector(
                "#player-call-video-fit-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "player-call-video-fit-styles";

        style.textContent = `
            .player-call-remote-video {
                width: auto !important;
                height: auto !important;
                max-width: 100% !important;
                max-height: 100% !important;
                min-width: 0;
                min-height: 0;
                object-fit: contain !important;
                object-position: center center !important;
                aspect-ratio: auto !important;
                background: #070b10;
            }

            .player-call-local-video {
                width: auto !important;
                height: auto !important;
                max-width: min(25%, 230px) !important;
                max-height: 42% !important;
                aspect-ratio: auto !important;
                object-fit: contain !important;
                object-position: center center !important;
                background: #070b10 !important;
            }

            .player-call-local-video[
                data-video-orientation="portrait"
            ] {
                max-width: min(18%, 150px) !important;
                max-height: 46% !important;
            }

            .player-call-stage-size-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 28px;
                padding: 5px 8px;
                border: 1px solid rgba(
                    255,
                    255,
                    255,
                    0.14
                );
                border-radius: 8px;
                background: rgba(
                    255,
                    255,
                    255,
                    0.055
                );
                color: #dce6ef;
                font: inherit;
                font-size: 0.67rem;
                font-weight: 850;
                line-height: 1;
                cursor: pointer;
            }

            .player-call-stage-size-button:hover,
            .player-call-stage-size-button:focus-visible {
                border-color: rgba(
                    167,
                    242,
                    217,
                    0.52
                );
                background: rgba(
                    167,
                    242,
                    217,
                    0.11
                );
                color: #ffffff;
            }

            /*
             * Active calls are non-modal by default. The website underneath
             * remains clickable while this class is present.
             */
            .player-call-root.player-call-minimised
            .player-call-backdrop {
                display: none !important;
            }

            .player-call-root.player-call-minimised
            .player-call-stage {
                top: auto !important;
                right: 14px !important;
                bottom: 14px !important;
                left: auto !important;
                transform: none !important;

                grid-template-rows:
                    auto
                    minmax(180px, 34vh)
                    auto
                    auto !important;

                width: min(
                    390px,
                    calc(100vw - 28px)
                ) !important;
                max-height: min(
                    72vh,
                    620px
                ) !important;

                border-radius: 16px !important;
                box-shadow:
                    0 20px 70px
                    rgba(0, 0, 0, 0.56) !important;
            }

            .player-call-root.player-call-minimised
            .player-call-stage[
                data-mode="audio"
            ] {
                grid-template-rows:
                    auto
                    auto
                    auto !important;
                width: min(
                    360px,
                    calc(100vw - 28px)
                ) !important;
            }

            .player-call-root.player-call-minimised
            .player-call-stage[
                data-mode="audio"
            ]
            .player-call-media {
                display: none !important;
            }

            .player-call-root.player-call-minimised
            .player-call-stage-header {
                gap: 10px;
                padding: 10px 11px;
            }

            .player-call-root.player-call-minimised
            .player-call-stage-peer {
                font-size: 0.9rem;
            }

            .player-call-root.player-call-minimised
            .player-call-stage-meta {
                grid-template-columns:
                    auto
                    auto;
                align-items: center;
                gap: 3px 8px;
            }

            .player-call-root.player-call-minimised
            .player-call-stage-meta
            .player-call-stage-size-button {
                grid-column: 1 / -1;
                justify-self: end;
            }

            .player-call-root.player-call-minimised
            .player-call-media {
                min-height: 0;
            }

            .player-call-root.player-call-minimised
            .player-call-local-video {
                right: 8px !important;
                bottom: 8px !important;
                max-width: 29% !important;
                max-height: 38% !important;
                border-radius: 9px;
            }

            .player-call-root.player-call-minimised
            .player-call-controls {
                gap: 5px;
                padding: 8px;
            }

            .player-call-root.player-call-minimised
            .player-call-control {
                min-width: 0;
                flex: 1 1 0;
                min-height: 32px;
                padding: 7px 5px;
                font-size: 0.66rem;
            }

            .player-call-root.player-call-minimised
            .player-call-error {
                font-size: 0.69rem;
            }

            @media (min-width: 681px) {
                .player-call-stage[
                    data-mode="video"
                ][
                    data-remote-video-orientation="portrait"
                ] {
                    width: min(
                        560px,
                        calc(100vw - 32px)
                    );
                }

                .player-call-stage[
                    data-mode="video"
                ][
                    data-remote-video-orientation="square"
                ] {
                    width: min(
                        720px,
                        calc(100vw - 32px)
                    );
                }
            }

            @media (max-width: 680px) {
                .player-call-remote-video {
                    max-width: 100% !important;
                    max-height: 100% !important;
                }

                .player-call-local-video,
                .player-call-local-video[
                    data-video-orientation="portrait"
                ] {
                    width: auto !important;
                    height: auto !important;
                    max-width: 32% !important;
                    max-height: 38% !important;
                }

                /*
                 * player-calls.css normally makes the active call full-screen
                 * on phones. Mini mode deliberately overrides that rule.
                 */
                .player-call-root.player-call-minimised
                .player-call-stage {
                    inset: auto 8px 8px auto !important;
                    transform: none !important;
                    width: calc(
                        100vw - 16px
                    ) !important;
                    max-height: 62vh !important;
                    border: 1px solid rgba(
                        255,
                        255,
                        255,
                        0.14
                    ) !important;
                    border-radius: 14px !important;
                    grid-template-rows:
                        auto
                        minmax(155px, 30vh)
                        auto
                        auto !important;
                }

                .player-call-root.player-call-minimised
                .player-call-stage[
                    data-mode="audio"
                ] {
                    grid-template-rows:
                        auto
                        auto
                        auto !important;
                }
            }

            @media (max-width: 430px) {
                .player-call-root.player-call-minimised
                .player-call-stage-meta
                .player-call-connection {
                    display: none;
                }

                .player-call-root.player-call-minimised
                .player-call-control[
                    data-call-action="devices"
                ] {
                    display: none;
                }
            }
        `;

        document.head.append(style);
    }

    function videoOrientation(video) {
        const width =
            Number(video?.videoWidth ?? 0);

        const height =
            Number(video?.videoHeight ?? 0);

        if (!width || !height) {
            return "";
        }

        const ratio = width / height;

        if (ratio < 0.9) {
            return "portrait";
        }

        if (ratio > 1.1) {
            return "landscape";
        }

        return "square";
    }

    function updateVideoOrientation(
        video,
        kind
    ) {
        const orientation =
            videoOrientation(video);

        if (!orientation) {
            return;
        }

        video.dataset.videoOrientation =
            orientation;

        if (kind === "remote") {
            video
                .closest(".player-call-stage")
                ?.setAttribute(
                    "data-remote-video-orientation",
                    orientation
                );
        }
    }

    function attachOrientationTracking(root) {
        if (
            !root
            || root.dataset.videoFitTracking
                === "true"
        ) {
            return;
        }

        root.dataset.videoFitTracking = "true";

        const remoteVideo = root.querySelector(
            ".player-call-remote-video"
        );

        const localVideo = root.querySelector(
            ".player-call-local-video"
        );

        const register = (video, kind) => {
            if (!video) {
                return;
            }

            const update = () => {
                updateVideoOrientation(
                    video,
                    kind
                );
            };

            video.addEventListener(
                "loadedmetadata",
                update
            );

            video.addEventListener(
                "resize",
                update
            );

            video.addEventListener(
                "playing",
                update
            );

            update();
        };

        register(remoteVideo, "remote");
        register(localVideo, "local");
    }

    function currentCall() {
        return window.playerCalls
            ?.activeCall
            ?? null;
    }

    function loadViewPreference(callId) {
        try {
            const stored =
                JSON.parse(
                    window.sessionStorage.getItem(
                        VIEW_STORAGE_KEY
                    )
                    || "null"
                );

            if (
                stored?.callId === callId
                && stored?.mode === "expanded"
            ) {
                return "expanded";
            }
        } catch (error) {
            // A blocked sessionStorage should not break calls.
        }

        return "mini";
    }

    function saveViewPreference(
        callId,
        mode
    ) {
        if (!callId) {
            return;
        }

        try {
            window.sessionStorage.setItem(
                VIEW_STORAGE_KEY,
                JSON.stringify({
                    callId,
                    mode
                })
            );
        } catch (error) {
            // A blocked sessionStorage should not break calls.
        }
    }

    function setMiniMode(minimised) {
        const root = document.querySelector(
            "#player-call-root"
        );

        const stage = root?.querySelector(
            ".player-call-stage"
        );

        if (!root || !stage) {
            return;
        }

        root.classList.toggle(
            "player-call-minimised",
            minimised
        );

        stage.setAttribute(
            "aria-modal",
            String(!minimised)
        );

        const backdrop = root.querySelector(
            ".player-call-backdrop"
        );

        if (minimised) {
            backdrop?.classList.add("hidden");
        } else if (
            !stage.classList.contains("hidden")
        ) {
            backdrop?.classList.remove("hidden");
        }

        const button = root.querySelector(
            ".player-call-stage-size-button"
        );

        if (button) {
            button.textContent =
                minimised
                    ? "Expand"
                    : "Mini";

            button.title =
                minimised
                    ? "Expand call"
                    : "Return to mini-player";

            button.setAttribute(
                "aria-label",
                button.title
            );
        }

        const call = currentCall();

        if (call?.id) {
            saveViewPreference(
                call.id,
                minimised
                    ? "mini"
                    : "expanded"
            );
        }
    }

    function ensureStageControls(root) {
        const meta = root?.querySelector(
            ".player-call-stage-meta"
        );

        if (
            !meta
            || meta.querySelector(
                ".player-call-stage-size-button"
            )
        ) {
            return;
        }

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "player-call-stage-size-button";

        button.textContent = "Expand";

        button.setAttribute(
            "aria-label",
            "Expand call"
        );

        button.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                setMiniMode(
                    !root.classList.contains(
                        "player-call-minimised"
                    )
                );
            }
        );

        meta.append(button);
    }

    async function ensureContinuityUser() {
        if (continuityUser) {
            return continuityUser;
        }

        if (!window.supabaseClient) {
            return null;
        }

        try {
            const {
                data: { user }
            } =
                await window.supabaseClient
                    .auth
                    .getUser();

            continuityUser = user ?? null;
        } catch (error) {
            continuityUser = null;
        }

        return continuityUser;
    }

    async function sendReconnectRequest(call) {
        const user =
            await ensureContinuityUser();

        if (
            !user
            || !call?.id
            || call.status !== "accepted"
            || call.callee_id !== user.id
            || reconnectRequestedForCallId
                === call.id
        ) {
            return;
        }

        /*
         * Wait until player-calls.js has created the new local peer
         * connection on this page. The caller will then ICE-restart its
         * existing connection when it receives this request.
         */
        let connection = null;

        for (
            let attempt = 0;
            attempt < 12;
            attempt += 1
        ) {
            connection =
                activePeerConnection();

            if (connection) {
                break;
            }

            await new Promise(
                (resolve) =>
                    window.setTimeout(
                        resolve,
                        150
                    )
            );
        }

        if (!connection) {
            return;
        }

        reconnectRequestedForCallId =
            call.id;

        const { error } =
            await window.supabaseClient.rpc(
                "send_player_call_signal",
                {
                    p_call_id: call.id,
                    p_signal_type:
                        "rejoin_request",
                    p_payload: {
                        page:
                            window.location
                                .pathname,
                        requested_at:
                            new Date()
                                .toISOString()
                    }
                }
            );

        if (error) {
            reconnectRequestedForCallId = "";

            console.warn(
                "Call reconnect request failed:",
                error
            );
        }
    }

    async function createReconnectOffer(
        call,
        attempt = 0
    ) {
        const user =
            await ensureContinuityUser();

        if (
            !user
            || !call?.id
            || call.status !== "accepted"
            || call.caller_id !== user.id
        ) {
            return;
        }

        const connection =
            activePeerConnection();

        if (!connection) {
            if (attempt < 8) {
                window.setTimeout(
                    () => {
                        createReconnectOffer(
                            call,
                            attempt + 1
                        );
                    },
                    180
                );
            }

            return;
        }

        if (
            connection.signalingState
                !== "stable"
        ) {
            if (attempt < 8) {
                window.setTimeout(
                    () => {
                        createReconnectOffer(
                            call,
                            attempt + 1
                        );
                    },
                    220
                );
            }

            return;
        }

        try {
            const offer =
                await connection.createOffer({
                    iceRestart: true
                });

            await connection
                .setLocalDescription(offer);

            const { error } =
                await window.supabaseClient.rpc(
                    "send_player_call_signal",
                    {
                        p_call_id: call.id,
                        p_signal_type: "offer",
                        p_payload: {
                            description:
                                connection
                                    .localDescription
                                    .toJSON()
                        }
                    }
                );

            if (error) {
                throw error;
            }
        } catch (error) {
            console.warn(
                "Call renegotiation failed:",
                error
            );
        }
    }

    async function setupContinuitySignals() {
        if (
            continuityChannel
            || !window.supabaseClient
        ) {
            return;
        }

        const user =
            await ensureContinuityUser();

        if (!user) {
            return;
        }

        continuityChannel =
            window.supabaseClient
                .channel(
                    `player-call-continuity-${user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "player_call_signals",
                        filter:
                            `recipient_id=eq.${user.id}`
                    },
                    (payload) => {
                        const signal =
                            payload.new;

                        if (
                            signal?.signal_type
                                !== "rejoin_request"
                        ) {
                            return;
                        }

                        const call =
                            currentCall();

                        if (
                            !call
                            || call.id
                                !== signal.call_id
                        ) {
                            return;
                        }

                        createReconnectOffer(
                            call
                        );
                    }
                )
                .subscribe();
    }

    function autoRejoinIfNeeded(root) {
        const call = currentCall();

        if (
            !call
            || call.status !== "accepted"
        ) {
            autoRejoinedCallId = "";
            reconnectRequestedForCallId = "";
            return;
        }

        const stage = root.querySelector(
            ".player-call-stage"
        );

        if (
            stage
            && !stage.classList.contains(
                "hidden"
            )
        ) {
            if (
                root.dataset
                    .continuityViewCallId
                !== call.id
            ) {
                root.dataset
                    .continuityViewCallId =
                    call.id;

                setMiniMode(
                    loadViewPreference(
                        call.id
                    ) !== "expanded"
                );
            }
        }

        const rejoinButton =
            root.querySelector(
                '[data-call-action="rejoin"]'
            );

        const callCard =
            root.querySelector(
                ".player-call-card"
            );

        const rejoinVisible =
            rejoinButton
            && callCard
            && !callCard.classList
                .contains("hidden")
            && !rejoinButton.classList
                .contains("hidden")
            && !rejoinButton.disabled;

        if (
            !rejoinVisible
            || autoRejoinedCallId
                === call.id
        ) {
            return;
        }

        autoRejoinedCallId = call.id;

        rejoinButton.click();

        window.setTimeout(
            () => {
                const refreshedCall =
                    currentCall();

                if (
                    refreshedCall?.id
                        === call.id
                ) {
                    sendReconnectRequest(
                        refreshedCall
                    );
                }
            },
            700
        );
    }

    function maintainCallUi() {
        const root = document.querySelector(
            "#player-call-root"
        );

        if (!root) {
            return;
        }

        attachOrientationTracking(root);
        ensureStageControls(root);
        autoRejoinIfNeeded(root);

        const call = currentCall();

        if (
            !call
            || call.status !== "accepted"
        ) {
            root.classList.remove(
                "player-call-minimised"
            );

            delete root.dataset
                .continuityViewCallId;
        }
    }

    function installMiniPlayerHandlers() {
        document.addEventListener(
            "click",
            (event) => {
                const backdrop =
                    event.target.closest(
                        "#player-call-root "
                        + ".player-call-backdrop"
                    );

                if (!backdrop) {
                    return;
                }

                const call =
                    currentCall();

                if (
                    call?.status
                        !== "accepted"
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                setMiniMode(true);
            },
            true
        );

        const observer =
            new MutationObserver(
                maintainCallUi
            );

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "class",
                    "data-mode"
                ]
            }
        );

        window.setInterval(
            maintainCallUi,
            500
        );
    }

    function loadGroupCallSystem() {
        if (!document.querySelector('link[data-group-calls="true"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "group-calls.css?v=1";
            link.dataset.groupCalls = "true";
            document.head.append(link);
        }

        if (document.querySelector('script[data-group-calls="true"]')) {
            return;
        }

        const script = document.createElement("script");
        script.src = "group-calls.js?v=1";
        script.async = false;
        script.dataset.groupCalls = "true";
        script.addEventListener("error", () => {
            console.warn("The group call system could not be loaded.");
        });
        document.body.append(script);
    }

    installCrossPageCallPersistence();
    installPeerConnectionTracking();
    installCameraConstraintFix();
    injectVideoFitStyles();
    installMiniPlayerHandlers();

    setupContinuitySignals()
        .catch((error) => {
            console.warn(
                "Call continuity could not start:",
                error
            );
        });

    maintainCallUi();
    loadGroupCallSystem();
})();
