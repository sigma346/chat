(() => {
    if (window.__playerCallVideoFitV7) return;
    window.__playerCallVideoFitV7 = true;

    const BUILD = "PUSH V7.1";
    window.__CALL_PUSH_LOADER__ = BUILD;

    function installCameraConstraintFix() {
        const mediaDevices = navigator.mediaDevices;

        if (
            !mediaDevices
            || typeof mediaDevices.getUserMedia !== "function"
            || mediaDevices.__playerCallVideoFitWrapped
        ) {
            return;
        }

        const original =
            mediaDevices.getUserMedia.bind(mediaDevices);

        mediaDevices.getUserMedia = (constraints = {}) => {
            const video = constraints?.video;

            const looksLikePrivateCallCamera =
                video
                && typeof video === "object"
                && (
                    video.width?.ideal === 1280
                    || video.height?.ideal === 720
                );

            if (!looksLikePrivateCallCamera) {
                return original(constraints);
            }

            const {
                width,
                height,
                aspectRatio,
                ...rest
            } = video;

            return original({
                ...constraints,
                video: {
                    ...rest,
                    facingMode:
                        rest.facingMode
                        ?? { ideal: "user" },
                    resizeMode:
                        rest.resizeMode
                        ?? { ideal: "none" },
                    frameRate:
                        rest.frameRate
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
        } catch {
            mediaDevices.__playerCallVideoFitWrapped = true;
        }
    }

    function injectStyles() {
        if (document.querySelector("#player-call-video-fit-v7-styles")) return;

        const style = document.createElement("style");
        style.id = "player-call-video-fit-v7-styles";

        style.textContent = `
            .player-call-remote-video,
            .player-call-local-video {
                object-fit: contain !important;
                object-position: center center !important;
                aspect-ratio: auto !important;
                background:#070b10;
            }

            .player-call-remote-video {
                width:auto !important;
                height:auto !important;
                max-width:100% !important;
                max-height:100% !important;
            }

            .player-call-local-video {
                width:auto !important;
                height:auto !important;
                max-width:min(25%,230px) !important;
                max-height:42% !important;
            }
        `;

        document.head.append(style);
    }

    function loadBootstrap() {
        if (document.querySelector('script[data-group-call-bootstrap-v7]')) {
            return;
        }

        const script = document.createElement("script");
        script.src = "group-call-bootstrap.js?v=7.1";
        script.async = true;
        script.dataset.groupCallBootstrapV7 = "true";

        script.addEventListener("error", () => {
            console.warn(
                `${BUILD} group-call bootstrap could not be loaded.`
            );
        });

        document.body.append(script);
    }

    installCameraConstraintFix();
    injectStyles();

    setTimeout(loadBootstrap, 900);
})();