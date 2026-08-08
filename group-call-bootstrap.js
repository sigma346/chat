(() => {
    if (
        window.__groupCallBootstrapV4
        || !window.supabaseClient
    ) {
        return;
    }

    window.__groupCallBootstrapV4 = true;

    const ENGINE_VERSION = "6";
    const ENGINE_SCRIPT =
        `group-call-engine.js?v=${ENGINE_VERSION}`;
    const ENGINE_STYLE =
        `group-call-engine.css?v=${ENGINE_VERSION}`;

    let currentUser = null;
    let participantChannel = null;
    let enginePromise = null;
    let refreshTimer = null;
    let refreshing = false;
    let disposed = false;

    function normaliseBootstrapRow(data) {
        if (Array.isArray(data)) {
            return data[0] ?? null;
        }

        return data ?? null;
    }

    function currentFile() {
        return (
            window.location.pathname
                .split("/")
                .pop()
            || "index.html"
        );
    }

    function ensureLaunchButtonStyle() {
        if (
            document.querySelector(
                "#group-call-bootstrap-v4-style"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "group-call-bootstrap-v4-style";

        style.textContent = `
            .group-call-launch-v4 {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 38px;
                margin-top: 0.8rem;
                padding: 0.55rem 0.8rem;
                border: 1px solid rgba(98, 230, 189, 0.32);
                border-radius: 0.72rem;
                background: rgba(31, 118, 93, 0.2);
                color: #e9fff8;
                font: inherit;
                font-size: 0.78rem;
                font-weight: 850;
                cursor: pointer;
            }

            .group-call-launch-v4:hover,
            .group-call-launch-v4:focus-visible {
                border-color: rgba(98, 230, 189, 0.58);
                background: rgba(31, 118, 93, 0.3);
                color: #ffffff;
            }

            .group-call-launch-v4:disabled {
                opacity: 0.55;
                cursor: default;
            }
        `;

        document.head.append(style);
    }

    function ensureLaunchButton() {
        if (
            currentFile() !== "friends.html"
            || document.querySelector(
                "[data-group-call-launch-v4]"
            )
        ) {
            return;
        }

        const target = document.querySelector(
            ".friends-hero > div:first-child"
        );

        if (!target) {
            return;
        }

        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "secondary-button group-call-launch-v4";

        button.dataset.groupCallLaunchV4 = "true";
        button.textContent = "Start group call";

        Object.assign(
            button.style,
            {
                marginTop: "0.8rem"
            }
        );

        button.addEventListener(
            "click",
            async () => {
                button.disabled = true;

                try {
                    const engine =
                        await loadEngine();

                    await engine.openComposer({
                        purpose: "create"
                    });
                } catch (error) {
                    console.warn(
                        "The group-call composer could not be opened:",
                        error
                    );
                } finally {
                    button.disabled = false;
                }
            }
        );

        target.append(button);
    }

    function ensureEngineStyle() {
        if (
            document.querySelector(
                'link[data-group-call-engine-v4="true"]'
            )
        ) {
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = ENGINE_STYLE;
        link.dataset.groupCallEngineV4 = "true";

        document.head.append(link);
    }

    function loadEngine() {
        if (window.groupCallEngineV4) {
            return Promise.resolve(
                window.groupCallEngineV4
            );
        }

        if (enginePromise) {
            return enginePromise;
        }

        ensureEngineStyle();

        enginePromise = new Promise(
            (resolve, reject) => {
                const existing =
                    document.querySelector(
                        'script[data-group-call-engine-v4="true"]'
                    );

                if (existing) {
                    const waitForGlobal = () => {
                        if (
                            window.groupCallEngineV4
                        ) {
                            resolve(
                                window.groupCallEngineV4
                            );
                            return;
                        }

                        reject(
                            new Error(
                                "Group-call engine loaded without registering."
                            )
                        );
                    };

                    window.setTimeout(
                        waitForGlobal,
                        60
                    );

                    return;
                }

                const script =
                    document.createElement(
                        "script"
                    );

                script.src = ENGINE_SCRIPT;
                script.async = true;
                script.dataset.groupCallEngineV4 =
                    "true";

                script.addEventListener(
                    "load",
                    () => {
                        if (
                            window.groupCallEngineV4
                        ) {
                            resolve(
                                window.groupCallEngineV4
                            );
                        } else {
                            reject(
                                new Error(
                                    "Group-call engine did not initialise."
                                )
                            );
                        }
                    }
                );

                script.addEventListener(
                    "error",
                    () => {
                        reject(
                            new Error(
                                "Group-call engine could not be downloaded."
                            )
                        );
                    }
                );

                document.body.append(script);
            }
        ).catch((error) => {
            enginePromise = null;
            throw error;
        });

        return enginePromise;
    }

    async function refreshBootstrapState() {
        if (
            disposed
            || refreshing
            || !currentUser
        ) {
            return;
        }

        /*
         * Once the engine owns an active/incoming call, it handles its own
         * state. This prevents heartbeat updates from causing a bootstrap
         * refresh loop.
         */
        if (
            window.groupCallEngineV4
                ?.isHandlingCall?.()
        ) {
            return;
        }

        refreshing = true;

        try {
            const {
                data,
                error
            } = await window.supabaseClient.rpc(
                "get_my_group_call_bootstrap"
            );

            if (error) {
                console.warn(
                    "Group-call bootstrap state could not be read:",
                    error
                );
                return;
            }

            const state =
                normaliseBootstrapRow(data);

            if (!state?.call_id) {
                return;
            }

            const engine =
                await loadEngine();

            await engine.resumeFromBootstrap(
                state
            );
        } catch (error) {
            console.warn(
                "Group-call bootstrap refresh failed:",
                error
            );
        } finally {
            refreshing = false;
        }
    }

    function scheduleRefresh() {
        if (disposed) {
            return;
        }

        window.clearTimeout(refreshTimer);

        refreshTimer = window.setTimeout(
            refreshBootstrapState,
            120
        );
    }

    function subscribeToMembership() {
        if (
            participantChannel
            || !currentUser
        ) {
            return;
        }

        participantChannel =
            window.supabaseClient
                .channel(
                    `group-call-bootstrap-v4-${currentUser.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "group_call_participants",
                        filter:
                            `user_id=eq.${currentUser.id}`
                    },
                    (payload) => {
                        if (
                            window.groupCallEngineV4
                                ?.isHandlingCall?.()
                        ) {
                            return;
                        }

                        const status =
                            payload.new?.status
                            ?? payload.old?.status
                            ?? "";

                        if (
                            status === "invited"
                            || status === "joined"
                            || payload.eventType
                                === "DELETE"
                        ) {
                            scheduleRefresh();
                        }
                    }
                )
                .subscribe();
    }

    async function initialise() {
        ensureLaunchButtonStyle();
        ensureLaunchButton();

        try {
            const {
                data: { user },
                error
            } =
                await window.supabaseClient
                    .auth
                    .getUser();

            if (
                error
                || !user
                || disposed
            ) {
                return;
            }

            currentUser = user;
            subscribeToMembership();

            await refreshBootstrapState();
        } catch (error) {
            console.warn(
                "Group-call bootstrap could not initialise:",
                error
            );
        }
    }

    window.addEventListener(
        "focus",
        () => {
            if (
                !window.groupCallEngineV4
                    ?.isHandlingCall?.()
            ) {
                scheduleRefresh();
            }
        }
    );

    window.addEventListener(
        "pagehide",
        () => {
            disposed = true;

            window.clearTimeout(
                refreshTimer
            );

            if (
                participantChannel
                && window.supabaseClient
            ) {
                window.supabaseClient
                    .removeChannel(
                        participantChannel
                    );
            }
        }
    );

    window.groupCallBootstrapV4 = {
        loadEngine,
        refresh: refreshBootstrapState,
        async openComposer() {
            const engine =
                await loadEngine();

            return engine.openComposer({
                purpose: "create"
            });
        }
    };

    /*
     * Start after the normal page scripts have had a moment to settle.
     * This is deliberately not a MutationObserver and not a render loop.
     */
    window.setTimeout(
        initialise,
        150
    );
})();
