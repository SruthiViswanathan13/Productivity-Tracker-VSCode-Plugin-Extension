let interval;

function startActivityTimer(getLastActivityTime, idleThreshold, onActiveSecond) {
    interval = setInterval(() => {
        if (Date.now() - getLastActivityTime() < idleThreshold) {
            onActiveSecond();
        }
    }, 1000);
    return interval;
}

function stopActivityTimer() {
    clearInterval(interval);
}

module.exports = { startActivityTimer, stopActivityTimer };