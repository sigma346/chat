(() => {
    if (window.__playerCallVideoFitLoaded) {
        return;
    }

    window.__playerCallVideoFitLoaded = true;

    function installCameraConstraintFix() {
        const mediaDevices = navigator.mediaDevices;

        if (
            !mediaDevices
            || typeof mediaDevices.getUserMedia !== "function"
            || mediaDevices.__playerCallVideoFitWrapped
        ) {
            return;
        }

        const originalGetUserMedia =
            mediaDevices.getUserMedia.bind(mediaDevices);

        mediaDevices.getUserMedia = (constraints = {}) => {
            const video = constraints?.video;

            const looksLikePlayerCallCamera =
                video
                && typeof video === "object"
                && (
                    video.width?.ideal === 1280
                    || video.height?.ideal === 720
                );

            if (!looksLikePlayerCallCamera) {
                return originalGetUserMedia(constraints);
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
                        remainingVideoConstraints.facingMode
                        ?? { ideal: "user" },
                    resizeMode:
                        remainingVideoConstraints.resizeMode
                        ?? { ideal: "none" },
                    frameRate:
                        remainingVideoConstraints.frameRate
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
            mediaDevices.__playerCallVideoFitWrapped = true;
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

        const style = document.createElement("style");
        style.id = "player-call-video-fit-styles";
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

            @media (min-width: 681px) {
                .player-call-stage[
                    data-mode="video"
                ][
                    data-remote-video-orientation="portrait"
                ] {
                    width: min(560px, calc(100vw - 32px));
                }

                .player-call-stage[
                    data-mode="video"
                ][
                    data-remote-video-orientation="square"
                ] {
                    width: min(720px, calc(100vw - 32px));
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
            }
        `;

        document.head.append(style);
    }

    function videoOrientation(video) {
        const width = Number(video?.videoWidth ?? 0);
        const height = Number(video?.videoHeight ?? 0);

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

    function updateVideoOrientation(video, kind) {
        const orientation = videoOrientation(video);

        if (!orientation) {
            return;
        }

        video.dataset.videoOrientation = orientation;

        if (kind === "remote") {
            video
                .closest(".player-call-stage")
                ?.setAttribute(
                    "data-remote-video-orientation",
                    orientation
                );
        }
    }

    function attachOrientationTracking() {
        const root = document.querySelector(
            "#player-call-root"
        );

        if (
            !root
            || root.dataset.videoFitTracking === "true"
        ) {
            return;
        }

        root.dataset.videoFitTracking = "true";

        const register = (video, kind) => {
            if (!video) {
                return;
            }

            const update = () => {
                updateVideoOrientation(video, kind);
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

        register(
            root.querySelector(
                ".player-call-remote-video"
            ),
            "remote"
        );

        register(
            root.querySelector(
                ".player-call-local-video"
            ),
            "local"
        );
    }

    function loadGroupCallBootstrap() {
        if (
            document.querySelector(
                'script[data-group-call-bootstrap-v4="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "group-call-bootstrap.js?v=4";
        script.async = true;
        script.dataset.groupCallBootstrapV4 = "true";

        script.addEventListener("error", () => {
            console.warn(
                "The lightweight group-call bootstrap could not be loaded."
            );
        });

        document.body.append(script);
    }

    installCameraConstraintFix();
    injectVideoFitStyles();

    /*
     * No whole-page MutationObserver here. The existing private-call UI is
     * created immediately after this helper, so a few small delayed checks
     * are enough and cannot create a render/update feedback loop.
     */
    window.setTimeout(
        attachOrientationTracking,
        150
    );

    window.setTimeout(
        attachOrientationTracking,
        650
    );

    window.setTimeout(
        attachOrientationTracking,
        1500
    );

    /*
     * Group calls are intentionally bootstrapped after the normal page and
     * private-call system have had time to initialise. The bootstrap itself
     * never opens media devices or creates WebRTC peers.
     */
    window.setTimeout(
        loadGroupCallBootstrap,
        1000
    );
})();
