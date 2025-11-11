// -------- Progress Display --------
class ProgressDisplay {
  constructor() {
    this.currentMessage = "";
    this.currentMessageLength = 0;
    this.lastUpdate = 0;
    this.throttleMs = 100; // Update at most every 100ms
    this.startTime = Date.now();
    this.isTTY = process.stdout.isTTY;
  }

  // Format elapsed time as MM:SS or HH:MM:SS
  formatElapsedTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const secs = seconds % 60;
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Get elapsed time string
  getElapsedTime() {
    const elapsed = Date.now() - this.startTime;
    return this.formatElapsedTime(elapsed);
  }

  // Clear the current line and update with new message
  update(message) {
    const now = Date.now();
    if (now - this.lastUpdate < this.throttleMs && this.currentMessage) {
      return; // Throttle updates
    }
    this.lastUpdate = now;

    const elapsedTime = this.getElapsedTime();
    const messageWithTime = `[${elapsedTime}] ${message}`;
    const messageLength = messageWithTime.length;

    // Clear the line: move to start, clear entire line, then write new message
    if (this.isTTY) {
      // Use ANSI escape sequences for TTY
      // \r = return to start of line
      // \x1b[2K = clear entire line (more reliable than \x1b[K)
      process.stdout.write("\r\x1b[2K" + messageWithTime);
    } else {
      // For non-TTY, pad with spaces to clear previous message
      const padding = Math.max(0, this.currentMessageLength - messageLength);
      process.stdout.write(
        "\r" + messageWithTime + (padding > 0 ? " ".repeat(padding) : "")
      );
    }

    this.currentMessage = messageWithTime;
    this.currentMessageLength = messageLength;
  }

  // Create a progress bar string
  createProgressBar({ current, total, width = 40, debug = false }) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);

    return `[${bar}] ${percentage.toFixed(1)}%`;
  }

  // Final message (doesn't clear, adds newline with time taken)
  finish(message) {
    // Clear current line before printing final message
    if (this.isTTY) {
      process.stdout.write("\r\x1b[2K"); // Clear entire line
    } else {
      process.stdout.write("\r" + " ".repeat(this.currentMessageLength));
    }
    const totalTime = Date.now() - this.startTime;
    const timeTaken = this.formatElapsedTime(totalTime);
    console.log(`${message} (Time taken: ${timeTaken})`);
    this.currentMessage = "";
    this.currentMessageLength = 0;
  }
}

module.exports = {
  ProgressDisplay,
};
