(() => {
    if (window.__playerCallVideoFitLoaded) {
        return;
    }

    window.__playerCallVideoFitLoaded = true;

    /*
     * The main call script currently requests a fixed 1280x720 camera.
     * That can make a portrait phone camera negotiate a landscape crop.
     *
     * Intercept only that call-camera request and let the browser use
     * the camera's natural aspect/orientation instead.
     */
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

                    /*
                     * Prefer the front camera on phones, but do not force it.
                     * The browser may still use another available camera.
                     */
                    facingMode:
                        remainingVideoConstraints.facingMode
                        ?? { ideal: "user" },

                    /*
                     * "none" asks supporting browsers not to crop-and-scale
                     * the camera to satisfy an artificial target resolution.
                     * It is only an ideal constraint, so unsupported browsers
                     * simply ignore it.
                     */
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
        if (document.querySelector("#player-call-video-fit-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "player-call-video-fit-styles";
        style.textContent = `
            /*
             * Do not stretch the remote video to the dimensions of the
             * desktop call stage. Let the video keep its real aspect ratio
             * and shrink until the entire camera feed fits.
             */
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

            /*
             * The local preview used a forced 16:10 rectangle with
             * object-fit: cover, which also cropped portrait cameras.
             */
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

            .player-call-local-video[data-video-orientation="portrait"] {
                max-width: min(18%, 150px) !important;
                max-height: 46% !important;
            }

            /*
             * On desktop, reduce the width of the whole call window when
             * the remote feed is portrait. This makes a phone camera feel
             * intentional instead of floating inside a huge landscape box.
             */
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

            /*
             * Mobile remains full-screen, but the videos still retain
             * their true aspect ratio.
             */
            @media (max-width: 680px) {
                .player-call-remote-video {
                    max-width: 100% !important;
                    max-height: 100% !important;
                }

                .player-call-local-video,
                .player-call-local-video[data-video-orientation="portrait"] {
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

    function attachOrientationTracking(root) {
        if (!root || root.dataset.videoFitTracking === "true") {
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
                updateVideoOrientation(video, kind);
            };

            video.addEventListener("loadedmetadata", update);
            video.addEventListener("resize", update);
            video.addEventListener("playing", update);

            /*
             * Covers cases where this helper loads after metadata has
             * already become available.
             */
            update();
        };

        register(remoteVideo, "remote");
        register(localVideo, "local");
    }

    function watchForCallUi() {
        const existingRoot = document.querySelector(
            "#player-call-root"
        );

        if (existingRoot) {
            attachOrientationTracking(existingRoot);
            return;
        }

        const observer = new MutationObserver(() => {
            const root = document.querySelector(
                "#player-call-root"
            );

            if (!root) {
                return;
            }

            observer.disconnect();
            attachOrientationTracking(root);
        });

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }

    installCameraConstraintFix();
    injectVideoFitStyles();
    watchForCallUi();
})();
