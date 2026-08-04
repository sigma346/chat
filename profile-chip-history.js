const chipHistoryPanel =
    document.querySelector(
        "#profile-chip-history-panel"
    );

const chipHistorySummary =
    document.querySelector(
        "#chip-history-summary"
    );

const chipHistoryRangeButtons =
    document.querySelectorAll(
        ".chip-history-range-button"
    );

const chipHistoryChartShell =
    document.querySelector(
        "#chip-history-chart-shell"
    );

const chipHistoryChart =
    document.querySelector(
        "#chip-history-chart"
    );

const chipHistoryTooltip =
    document.querySelector(
        "#chip-history-tooltip"
    );

const chipHistoryStatus =
    document.querySelector(
        "#chip-history-status"
    );

const chipHistoryCurrent =
    document.querySelector(
        "#chip-history-current"
    );

const chipHistoryStart =
    document.querySelector(
        "#chip-history-start"
    );

const chipHistoryChange =
    document.querySelector(
        "#chip-history-change"
    );

const chipHistoryHigh =
    document.querySelector(
        "#chip-history-high"
    );

const chipHistoryLow =
    document.querySelector(
        "#chip-history-low"
    );


const CHIP_HISTORY_STORAGE_KEY =
    "profile-chip-history-duration";

const CHIP_HISTORY_DURATIONS =
    new Set([
        "24h",
        "7d",
        "30d",
        "90d",
        "1y",
        "all"
    ]);


let selectedChipHistoryDuration =
    window.localStorage.getItem(
        CHIP_HISTORY_STORAGE_KEY
    )
    || "30d";

let chipHistoryData = null;
let chipHistoryRequestNumber = 0;
let chipHistoryResizeObserver = null;
let renderedChartPoints = [];


if (
    !CHIP_HISTORY_DURATIONS.has(
        selectedChipHistoryDuration
    )
) {
    selectedChipHistoryDuration =
        "30d";
}


function chipHistoryProfileParameters() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const requestedId =
        parameters.get("id");

    const requestedUsername =
        parameters.get("username");

    return {
        p_user_id:
            requestedId || null,

        p_username:
            requestedId
                ? null
                : requestedUsername || null
    };
}


function formatChipHistoryNumber(
    value
) {
    return new Intl.NumberFormat(
        "en-AU"
    ).format(
        Number(value ?? 0)
    );
}


function formatCompactChipHistoryNumber(
    value
) {
    return new Intl.NumberFormat(
        "en-AU",
        {
            notation: "compact",
            maximumFractionDigits: 1
        }
    ).format(
        Number(value ?? 0)
    );
}


function formatChipHistorySigned(
    value
) {
    const amount =
        Number(value ?? 0);

    if (amount > 0) {
        return `+${formatChipHistoryNumber(
            amount
        )}`;
    }

    if (amount < 0) {
        return `−${formatChipHistoryNumber(
            Math.abs(amount)
        )}`;
    }

    return "0";
}


function formatChipHistoryDate(
    value,
    duration =
        selectedChipHistoryDuration
) {
    const date =
        new Date(value);

    const options =
        duration === "24h"
            ? {
                hour: "numeric",
                minute: "2-digit"
            }
            : duration === "7d"
                || duration === "30d"
                || duration === "90d"
                ? {
                    day: "numeric",
                    month: "short"
                }
                : {
                    month: "short",
                    year: "numeric"
                };

    return new Intl.DateTimeFormat(
        "en-AU",
        options
    ).format(date);
}


function formatChipHistoryTooltipDate(
    value
) {
    return new Intl.DateTimeFormat(
        "en-AU",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(
        new Date(value)
    );
}


function setChipHistoryStatus(
    message = "",
    type = ""
) {
    chipHistoryStatus.textContent =
        message;

    chipHistoryStatus.className =
        `chip-history-status ${type}`.trim();
}


function setChipHistoryLoading(
    loading
) {
    chipHistoryPanel.classList.toggle(
        "loading",
        loading
    );

    for (
        const button
        of chipHistoryRangeButtons
    ) {
        button.disabled =
            loading;
    }
}


function updateChipHistoryRangeButtons() {
    for (
        const button
        of chipHistoryRangeButtons
    ) {
        const selected =
            button.dataset.duration
                === selectedChipHistoryDuration;

        button.classList.toggle(
            "active",
            selected
        );

        button.setAttribute(
            "aria-pressed",
            String(selected)
        );
    }
}


function clearChipHistoryChart() {
    chipHistoryChart.replaceChildren();
    renderedChartPoints = [];
    chipHistoryTooltip.classList.add(
        "hidden"
    );
}


function svgElement(
    name,
    attributes = {}
) {
    const element =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );

    for (
        const [key, value]
        of Object.entries(attributes)
    ) {
        element.setAttribute(
            key,
            String(value)
        );
    }

    return element;
}


function drawChipHistoryChart() {
    clearChipHistoryChart();

    const rawPoints =
        Array.isArray(
            chipHistoryData?.points
        )
            ? chipHistoryData.points
            : [];

    const points =
        rawPoints
            .map((point) => ({
                at:
                    new Date(
                        point.at
                    ).getTime(),

                balance:
                    Number(
                        point.balance
                    )
            }))
            .filter((point) =>
                Number.isFinite(point.at)
                && Number.isFinite(
                    point.balance
                )
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    first.at
                    - second.at
            );

    if (points.length === 0) {
        setChipHistoryStatus(
            "No chip history has been recorded for this player yet."
        );

        return;
    }

    setChipHistoryStatus();

    const shellRectangle =
        chipHistoryChartShell
            .getBoundingClientRect();

    const width =
        Math.max(
            Math.round(
                shellRectangle.width
            ),
            320
        );

    const height =
        width < 560
            ? 280
            : 340;

    const padding = {
        top: 20,
        right: 18,
        bottom: 45,
        left:
            width < 560
                ? 56
                : 72
    };

    const plotWidth =
        width
        - padding.left
        - padding.right;

    const plotHeight =
        height
        - padding.top
        - padding.bottom;

    let minimumTime =
        points[0].at;

    let maximumTime =
        points[
            points.length - 1
        ].at;

    if (
        maximumTime
        <= minimumTime
    ) {
        minimumTime -=
            30 * 60 * 1000;

        maximumTime +=
            30 * 60 * 1000;
    }

    let minimumBalance =
        Math.min(
            ...points.map(
                (point) =>
                    point.balance
            )
        );

    let maximumBalance =
        Math.max(
            ...points.map(
                (point) =>
                    point.balance
            )
        );

    const balanceSpan =
        maximumBalance
        - minimumBalance;

    const balancePadding =
        balanceSpan > 0
            ? Math.max(
                balanceSpan * 0.1,
                1
            )
            : Math.max(
                Math.abs(
                    maximumBalance
                ) * 0.08,
                10
            );

    minimumBalance =
        Math.max(
            0,
            minimumBalance
                - balancePadding
        );

    maximumBalance +=
        balancePadding;

    if (
        maximumBalance
        <= minimumBalance
    ) {
        maximumBalance =
            minimumBalance + 1;
    }

    const scaleX =
        (timestamp) =>
            padding.left
            + (
                (
                    timestamp
                    - minimumTime
                )
                / (
                    maximumTime
                    - minimumTime
                )
            )
            * plotWidth;

    const scaleY =
        (balance) =>
            padding.top
            + (
                1
                - (
                    (
                        balance
                        - minimumBalance
                    )
                    / (
                        maximumBalance
                        - minimumBalance
                    )
                )
            )
            * plotHeight;

    chipHistoryChart.setAttribute(
        "viewBox",
        `0 0 ${width} ${height}`
    );

    chipHistoryChart.setAttribute(
        "aria-label",
        `${chipHistoryData.username}'s chip balance over ${chipHistoryData.duration_label}.`
    );

    const title =
        svgElement("title");

    title.textContent =
        `${chipHistoryData.username}'s chip history`;

    const description =
        svgElement("desc");

    description.textContent =
        `Balance changed from ${formatChipHistoryNumber(
            chipHistoryData.start_balance
        )} to ${formatChipHistoryNumber(
            chipHistoryData.current_balance
        )} chips.`;

    chipHistoryChart.append(
        title,
        description
    );

    const gridGroup =
        svgElement(
            "g",
            {
                class:
                    "chip-history-grid"
            }
        );

    const yTickCount = 5;

    for (
        let index = 0;
        index < yTickCount;
        index += 1
    ) {
        const ratio =
            index
            / (
                yTickCount - 1
            );

        const y =
            padding.top
            + ratio * plotHeight;

        const balance =
            maximumBalance
            - ratio
            * (
                maximumBalance
                - minimumBalance
            );

        gridGroup.append(
            svgElement(
                "line",
                {
                    x1:
                        padding.left,
                    y1:
                        y,
                    x2:
                        width
                        - padding.right,
                    y2:
                        y
                }
            )
        );

        const label =
            svgElement(
                "text",
                {
                    x:
                        padding.left - 9,
                    y:
                        y + 4,
                    class:
                        "chip-history-axis-label",
                    "text-anchor":
                        "end"
                }
            );

        label.textContent =
            formatCompactChipHistoryNumber(
                Math.max(
                    0,
                    Math.round(balance)
                )
            );

        gridGroup.append(
            label
        );
    }

    const xTickCount =
        width < 560
            ? 4
            : 6;

    for (
        let index = 0;
        index < xTickCount;
        index += 1
    ) {
        const ratio =
            index
            / (
                xTickCount - 1
            );

        const timestamp =
            minimumTime
            + ratio
            * (
                maximumTime
                - minimumTime
            );

        const x =
            padding.left
            + ratio * plotWidth;

        const label =
            svgElement(
                "text",
                {
                    x,
                    y:
                        height - 15,
                    class:
                        "chip-history-axis-label",
                    "text-anchor":
                        index === 0
                            ? "start"
                            : index
                                === xTickCount - 1
                                ? "end"
                                : "middle"
                }
            );

        label.textContent =
            formatChipHistoryDate(
                timestamp
            );

        gridGroup.append(
            label
        );
    }

    chipHistoryChart.append(
        gridGroup
    );

    renderedChartPoints =
        points.map(
            (
                point,
                index
            ) => ({
                ...point,

                index,

                x:
                    scaleX(
                        point.at
                    ),

                y:
                    scaleY(
                        point.balance
                    )
            })
        );

    let linePath = "";
    let areaPath = "";

    renderedChartPoints
        .forEach(
            (
                point,
                index
            ) => {
                if (index === 0) {
                    linePath =
                        `M ${point.x} ${point.y}`;

                    areaPath =
                        `M ${point.x} `
                        + `${padding.top + plotHeight}`
                        + ` L ${point.x} ${point.y}`;

                    return;
                }

                linePath +=
                    ` H ${point.x}`
                    + ` V ${point.y}`;

                areaPath +=
                    ` H ${point.x}`
                    + ` V ${point.y}`;
            }
        );

    const lastPoint =
        renderedChartPoints[
            renderedChartPoints.length - 1
        ];

    areaPath +=
        ` L ${lastPoint.x} `
        + `${padding.top + plotHeight}`
        + " Z";

    const area =
        svgElement(
            "path",
            {
                d:
                    areaPath,
                class:
                    "chip-history-area"
            }
        );

    const line =
        svgElement(
            "path",
            {
                d:
                    linePath,
                class:
                    "chip-history-line"
            }
        );

    chipHistoryChart.append(
        area,
        line
    );

    if (
        renderedChartPoints.length
        <= 70
    ) {
        const pointGroup =
            svgElement(
                "g",
                {
                    class:
                        "chip-history-points"
                }
            );

        for (
            const point
            of renderedChartPoints
        ) {
            pointGroup.append(
                svgElement(
                    "circle",
                    {
                        cx:
                            point.x,
                        cy:
                            point.y,
                        r:
                            2.5
                    }
                )
            );
        }

        chipHistoryChart.append(
            pointGroup
        );
    }

    const hoverLine =
        svgElement(
            "line",
            {
                class:
                    "chip-history-hover-line hidden",
                y1:
                    padding.top,
                y2:
                    padding.top
                    + plotHeight
            }
        );

    const hoverPoint =
        svgElement(
            "circle",
            {
                class:
                    "chip-history-hover-point hidden",
                r:
                    5
            }
        );

    const interactionLayer =
        svgElement(
            "rect",
            {
                class:
                    "chip-history-interaction-layer",
                x:
                    padding.left,
                y:
                    padding.top,
                width:
                    plotWidth,
                height:
                    plotHeight
            }
        );

    function hideTooltip() {
        hoverLine.classList.add(
            "hidden"
        );

        hoverPoint.classList.add(
            "hidden"
        );

        chipHistoryTooltip.classList.add(
            "hidden"
        );
    }

    function showNearestPoint(
        event
    ) {
        const bounds =
            chipHistoryChart
                .getBoundingClientRect();

        const svgX =
            (
                event.clientX
                - bounds.left
            )
            * (
                width
                / bounds.width
            );

        let nearest =
            renderedChartPoints[0];

        let nearestDistance =
            Math.abs(
                nearest.x
                - svgX
            );

        for (
            const point
            of renderedChartPoints
        ) {
            const distance =
                Math.abs(
                    point.x
                    - svgX
                );

            if (
                distance
                < nearestDistance
            ) {
                nearest =
                    point;

                nearestDistance =
                    distance;
            }
        }

        hoverLine.setAttribute(
            "x1",
            nearest.x
        );

        hoverLine.setAttribute(
            "x2",
            nearest.x
        );

        hoverPoint.setAttribute(
            "cx",
            nearest.x
        );

        hoverPoint.setAttribute(
            "cy",
            nearest.y
        );

        hoverLine.classList.remove(
            "hidden"
        );

        hoverPoint.classList.remove(
            "hidden"
        );

        const previousPoint =
            renderedChartPoints[
                Math.max(
                    nearest.index - 1,
                    0
                )
            ];

        const pointChange =
            nearest.balance
            - previousPoint.balance;

        chipHistoryTooltip.innerHTML =
            `<strong>${formatChipHistoryNumber(
                nearest.balance
            )} chips</strong>`
            + `<span>${formatChipHistoryTooltipDate(
                nearest.at
            )}</span>`
            + (
                nearest.index > 0
                    ? `<small>${formatChipHistorySigned(
                        pointChange
                    )} since previous point</small>`
                    : ""
            );

        chipHistoryTooltip.classList.remove(
            "hidden"
        );

        const shellBounds =
            chipHistoryChartShell
                .getBoundingClientRect();

        const screenX =
            bounds.left
            + nearest.x
            * (
                bounds.width
                / width
            )
            - shellBounds.left;

        const screenY =
            bounds.top
            + nearest.y
            * (
                bounds.height
                / height
            )
            - shellBounds.top;

        const tooltipWidth =
            chipHistoryTooltip
                .offsetWidth;

        const tooltipHeight =
            chipHistoryTooltip
                .offsetHeight;

        const left =
            Math.min(
                Math.max(
                    screenX
                    - tooltipWidth / 2,
                    8
                ),
                shellBounds.width
                - tooltipWidth
                - 8
            );

        const top =
            Math.max(
                screenY
                - tooltipHeight
                - 14,
                8
            );

        chipHistoryTooltip.style.left =
            `${left}px`;

        chipHistoryTooltip.style.top =
            `${top}px`;
    }

    interactionLayer.addEventListener(
        "pointermove",
        showNearestPoint
    );

    interactionLayer.addEventListener(
        "pointerdown",
        showNearestPoint
    );

    interactionLayer.addEventListener(
        "pointerleave",
        hideTooltip
    );

    chipHistoryChart.append(
        hoverLine,
        hoverPoint,
        interactionLayer
    );
}


function renderChipHistorySummary() {
    const change =
        Number(
            chipHistoryData.change
            ?? 0
        );

    const changeText =
        formatChipHistorySigned(
            change
        );

    chipHistorySummary.textContent =
        change === 0
            ? `No net change over ${chipHistoryData.duration_label.toLowerCase()}`
            : `${changeText} chips over ${chipHistoryData.duration_label.toLowerCase()}`;

    chipHistorySummary.className =
        "profile-section-summary "
        + (
            change > 0
                ? "positive"
                : change < 0
                    ? "negative"
                    : "neutral"
        );

    chipHistoryCurrent.textContent =
        `${formatChipHistoryNumber(
            chipHistoryData.current_balance
        )} chips`;

    chipHistoryStart.textContent =
        `${formatChipHistoryNumber(
            chipHistoryData.start_balance
        )} chips`;

    chipHistoryChange.textContent =
        `${changeText} chips`;

    chipHistoryChange.className =
        change > 0
            ? "positive"
            : change < 0
                ? "negative"
                : "neutral";

    chipHistoryHigh.textContent =
        `${formatChipHistoryNumber(
            chipHistoryData.maximum_balance
        )} chips`;

    chipHistoryLow.textContent =
        `${formatChipHistoryNumber(
            chipHistoryData.minimum_balance
        )} chips`;

    const firstRecordedAt =
        chipHistoryData
            .first_recorded_at
            ? new Date(
                chipHistoryData
                    .first_recorded_at
            )
            : null;

    const requestedStart =
        chipHistoryData.range_start
            ? new Date(
                chipHistoryData
                    .range_start
            )
            : null;

    if (
        firstRecordedAt
        && requestedStart
        && firstRecordedAt
            > requestedStart
    ) {
        setChipHistoryStatus(
            `Recorded history begins ${formatChipHistoryTooltipDate(
                firstRecordedAt
            )}. Earlier balances are unavailable.`,
            "notice"
        );
    }
}


function renderChipHistory() {
    updateChipHistoryRangeButtons();
    renderChipHistorySummary();
    drawChipHistoryChart();
}


async function loadChipHistory(
    duration =
        selectedChipHistoryDuration
) {
    selectedChipHistoryDuration =
        duration;

    window.localStorage.setItem(
        CHIP_HISTORY_STORAGE_KEY,
        duration
    );

    updateChipHistoryRangeButtons();
    setChipHistoryLoading(true);

    setChipHistoryStatus(
        "Loading chip history..."
    );

    const requestNumber =
        chipHistoryRequestNumber + 1;

    chipHistoryRequestNumber =
        requestNumber;

    try {
        const {
            data,
            error
        } =
            await window.supabaseClient.rpc(
                "get_public_chip_history",
                {
                    ...chipHistoryProfileParameters(),

                    p_duration:
                        duration
                }
            );

        if (
            requestNumber
            !== chipHistoryRequestNumber
        ) {
            return;
        }

        if (error) {
            throw error;
        }

        chipHistoryData =
            data;

        renderChipHistory();

    } catch (error) {
        console.error(
            "Chip history could not be loaded:",
            error
        );

        setChipHistoryStatus(
            error.message
            || "Chip history could not be loaded.",
            "error"
        );

        clearChipHistoryChart();

    } finally {
        if (
            requestNumber
            === chipHistoryRequestNumber
        ) {
            setChipHistoryLoading(false);
        }
    }
}


for (
    const button
    of chipHistoryRangeButtons
) {
    button.addEventListener(
        "click",
        () => {
            loadChipHistory(
                button.dataset.duration
            );
        }
    );
}


if (
    "ResizeObserver"
    in window
) {
    chipHistoryResizeObserver =
        new ResizeObserver(
            () => {
                if (chipHistoryData) {
                    drawChipHistoryChart();
                }
            }
        );

    chipHistoryResizeObserver.observe(
        chipHistoryChartShell
    );
} else {
    window.addEventListener(
        "resize",
        () => {
            if (chipHistoryData) {
                drawChipHistoryChart();
            }
        }
    );
}


window.addEventListener(
    "beforeunload",
    () => {
        chipHistoryResizeObserver
            ?.disconnect();
    }
);


loadChipHistory();
