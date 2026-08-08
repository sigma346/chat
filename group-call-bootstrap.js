(() => {
    if (window.__groupCallBootstrapV8 || !window.supabaseClient) return;

    window.__groupCallBootstrapV8 = true;

    const BUILD = "PUSH V8.0";
    const ENGINE_SCRIPT = "group-call-engine.js?v=8.0";
    const ENGINE_STYLE = "group-call-engine.css?v=8.0";

    let currentUser = null;
    let participantChannel = null;
    let enginePromise = null;
    let refreshTimer = null;
    let refreshing = false;
    let disposed = false;

    window.__GROUP_CALL_BOOTSTRAP_PUSH__ = BUILD;
    console.info(`[GroupCall] ${BUILD} bootstrap loaded`);

    function currentFile() {
        return (
            location.pathname.split("/").pop()
            || "index.html"
        );
    }

    function normalise(data) {
        return Array.isArray(data)
            ? data[0] ?? null
            : data ?? null;
    }

    function ensureLaunchStyle() {
        if (document.querySelector("#group-call-v8-launch-style")) return;

        const style = document.createElement("style");
        style.id = "group-call-v8-launch-style";
        style.textContent = `
            .group-call-launch-v8 {
                display:inline-flex;
                align-items:center;
                justify-content:center;
                min-height:38px;
                margin-top:.8rem;
                padding:.55rem .8rem;
                border:1px solid rgba(98,230,189,.32);
                border-radius:.72rem;
                background:rgba(31,118,93,.2);
                color:#e9fff8;
                font:inherit;
                font-size:.78rem;
                font-weight:850;
                cursor:pointer;
            }
            .group-call-launch-v8:hover {
                border-color:rgba(98,230,189,.58);
                background:rgba(31,118,93,.3);
            }
        `;
        document.head.append(style);
    }

    function ensureLaunchButton() {
        if (
            currentFile() !== "friends.html"
            || document.querySelector("[data-group-call-launch-v8]")
        ) {
            return;
        }

        const target =
            document.querySelector(".friends-hero > div:first-child");

        if (!target) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className =
            "secondary-button group-call-launch-v8";
        button.dataset.groupCallLaunchV8 = "true";
        button.textContent = `Start group call · ${BUILD}`;

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                const engine = await loadEngine();
                await engine.openComposer({
                    purpose: "create"
                });
            } catch (error) {
                console.warn(
                    "Group-call composer could not be opened:",
                    error
                );
            } finally {
                button.disabled = false;
            }
        });

        target.append(button);
    }

    function ensureEngineStyle() {
        if (document.querySelector('link[data-group-call-engine-v8]')) return;

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = ENGINE_STYLE;
        link.dataset.groupCallEngineV8 = "true";
        document.head.append(link);
    }

    function loadEngine() {
        if (window.groupCallEngineV8) {
            return Promise.resolve(window.groupCallEngineV8);
        }

        if (enginePromise) return enginePromise;

        ensureEngineStyle();

        enginePromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = ENGINE_SCRIPT;
            script.async = true;
            script.dataset.groupCallEngineV8 = "true";

            script.addEventListener("load", () => {
                if (window.groupCallEngineV8) {
                    resolve(window.groupCallEngineV8);
                } else {
                    reject(
                        new Error(
                            "V7 engine loaded without registering."
                        )
                    );
                }
            });

            script.addEventListener("error", () => {
                reject(
                    new Error(
                        "V7 group-call engine could not be downloaded."
                    )
                );
            });

            document.body.append(script);
        }).catch((error) => {
            enginePromise = null;
            throw error;
        });

        return enginePromise;
    }

    async function refreshState() {
        if (
            disposed
            || refreshing
            || !currentUser
            || window.groupCallEngineV8?.isHandlingCall?.()
        ) {
            return;
        }

        refreshing = true;

        try {
            const { data, error } =
                await window.supabaseClient.rpc(
                    "get_my_group_call_bootstrap"
                );

            if (error) {
                console.warn(
                    "Group-call bootstrap state failed:",
                    error
                );
                return;
            }

            const state = normalise(data);

            if (!state?.call_id) return;

            const engine = await loadEngine();
            await engine.resumeFromBootstrap(state);
        } finally {
            refreshing = false;
        }
    }

    function scheduleRefresh() {
        if (disposed) return;

        clearTimeout(refreshTimer);

        refreshTimer =
            window.setTimeout(
                () => refreshState().catch(() => {}),
                120
            );
    }

    function subscribeMembership() {
        if (participantChannel || !currentUser) return;

        participantChannel =
            window.supabaseClient
                .channel(
                    `group-call-bootstrap-v8-${currentUser.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "group_call_participants",
                        filter:
                            `user_id=eq.${currentUser.id}`
                    },
                    () => {
                        if (
                            !window.groupCallEngineV8
                                ?.isHandlingCall?.()
                        ) {
                            scheduleRefresh();
                        }
                    }
                )
                .subscribe();
    }

    async function initialise() {
        ensureLaunchStyle();
        ensureLaunchButton();

        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user || disposed) return;

        currentUser = user;
        subscribeMembership();
        await refreshState();
    }

    window.addEventListener("focus", () => {
        if (
            !window.groupCallEngineV8
                ?.isHandlingCall?.()
        ) {
            scheduleRefresh();
        }
    });

    window.addEventListener("pagehide", () => {
        disposed = true;
        clearTimeout(refreshTimer);

        if (participantChannel) {
            window.supabaseClient.removeChannel(
                participantChannel
            );
        }
    });

    window.groupCallBootstrapV8 = {
        BUILD,
        loadEngine,
        refresh: refreshState,
        async openComposer() {
            const engine = await loadEngine();
            return engine.openComposer({
                purpose: "create"
            });
        }
    };

    setTimeout(
        () => initialise().catch((error) => {
            console.warn(
                "V7 group-call bootstrap failed:",
                error
            );
        }),
        150
    );
})();