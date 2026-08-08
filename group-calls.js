(() => {
    // Emergency recovery build.
    // Group calls are deliberately disabled until the load-time freeze is fixed.
    if (!window.groupCalls) {
        window.groupCalls = {
            disabled: true
        };
    }
})();
