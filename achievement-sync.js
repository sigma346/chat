(() => {
    if (window.__achievementSyncLoaded) {
        return;
    }

    window.__achievementSyncLoaded = true;

    const refreshIntervalMilliseconds = 60_000;

    async function refreshAchievements() {
        if (!window.supabaseClient) {
            return;
        }

        try {
            const {
                data: { user },
                error: userError
            } = await window.supabaseClient.auth.getUser();

            if (userError || !user) {
                return;
            }

            const storageKey =
                `achievement-refresh:${user.id}`;

            const previousRefresh = Number(
                window.sessionStorage.getItem(storageKey) ?? 0
            );

            if (
                Date.now() - previousRefresh
                < refreshIntervalMilliseconds
            ) {
                return;
            }

            const {
                data,
                error
            } = await window.supabaseClient.rpc(
                "refresh_my_achievements"
            );

            if (error) {
                throw error;
            }

            window.sessionStorage.setItem(
                storageKey,
                String(Date.now())
            );

            const newUnlocks = Number(
                data?.new_unlocks ?? 0
            );

            if (newUnlocks > 0) {
                window.dispatchEvent(
                    new CustomEvent(
                        "player-achievements-unlocked",
                        {
                            detail: {
                                count: newUnlocks,
                                total: Number(
                                    data?.total_unlocked ?? 0
                                )
                            }
                        }
                    )
                );
            }
        } catch (error) {
            console.warn(
                "Achievements could not be refreshed:",
                error
            );
        }
    }

    refreshAchievements();
})();
