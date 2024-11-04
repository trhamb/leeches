const crypto = require("crypto");

class SessionManager {
    constructor() {
        this.activeSessions = new Map();
    }

    generateSessionToken() {
        return crypto.randomBytes(32).toString("hex");
    }

    createSession(ipAddress) {
        const sessionToken = this.generateSessionToken();
        const expiresAt = Date.now() + 6 * 60 * 60 * 1000; // 6 hour expiry

        this.activeSessions.set(sessionToken, {
            createdAt: Date.now(),
            expiresAt,
            ipAddress,
        });

        return sessionToken;
    }

    validateSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.expiresAt < Date.now()) {
            if (session) this.activeSessions.delete(sessionId);
            return false;
        }
        return true;
    }
}

module.exports = new SessionManager();
