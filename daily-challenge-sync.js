(() => {
    if (window.__dailyChallengeSyncLoaded) {
        return;
    }

    window.__dailyChallengeSyncLoaded = true;

    let syncRunning = false;
    let syncInterval = null;

    async function syncDailyChallenges() {
        if (
            syncRunning
            || !window.supabaseClient
        ) {
            return null;
        }

        syncRunning = true;

        try {
            const {
                data: { user }
            } = await window.supabaseClient.auth.getUser();

            if (!user) {
                return null;
            }

            const {
                data,
                error
            } = await window.supabaseClient.rpc(
                "refresh_my_daily_challenges"
            );

            if (error) {
                /*
                    The script is loaded globally. Stay quiet when the
                    migration has not been installed yet rather than
                    breaking every unrelated page.
                */
                return null;
            }

            window.dispatchEvent(
                new CustomEvent(
                    "daily-challenges-state",
                    {
                        detail: data
                    }
                )
            );

            if (Number(data?.newly_completed ?? 0) > 0) {
                window.dispatchEvent(
                    new CustomEvent(
                        "daily-challenges-completed",
                        {
                            detail: data
                        }
                    )
                );
            }

            return data;
        } catch (error) {
            console.warn(
                "Daily challenge progress could not be synchronised:",
                error
            );

            return null;
        } finally {
            syncRunning = false;
        }
    }

    window.syncDailyChallenges =
        syncDailyChallenges;

    syncDailyChallenges();

    syncInterval = window.setInterval(
        syncDailyChallenges,
        20000
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                syncDailyChallenges();
            }
        }
    );

    window.addEventListener(
        "beforeunload",
        () => {
            if (syncInterval) {
                window.clearInterval(syncInterval);
            }
        }
    );
})();
