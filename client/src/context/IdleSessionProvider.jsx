import { useEffect, useRef } from "react";
import {
  isSessionInvalidError,
  pingActivity,
} from "../api/client";
import { useAuth } from "./AuthContext";
import {
  ACTIVITY_KEY,
  CHANNEL_NAME,
  LOGOUT_SIGNAL_KEY as LOGOUT_KEY,
} from "./sessionKeys";

// Overridable for testing (e.g. VITE_IDLE_TIMEOUT_MINUTES=1).
const IDLE_MINUTES =
  Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 45;
const MAX_SESSION_HOURS =
  Number(import.meta.env.VITE_MAX_SESSION_HOURS) || 12;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const MAX_SESSION_MS =
  MAX_SESSION_HOURS * 60 * 60 * 1000;
const SYNC_THROTTLE_MS = 60 * 1000;

/**
 * Ends the session after 45 minutes without real user interaction, or after
 * 12 hours total. Activity is tracked from input events only, so background
 * polling can never keep a session alive. Timers and logout signals are
 * shared across tabs.
 */
export function IdleSessionProvider({ children }) {
  const {
    isAuthenticated,
    logout,
    sessionStartedAt,
  } = useAuth();

  const idleTimer = useRef(null);
  const capTimer = useRef(null);
  const lastSync = useRef(0);
  const lastActivity = useRef(null);
  const ended = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimeout(idleTimer.current);
      clearTimeout(capTimer.current);
      ended.current = false;
      return undefined;
    }

    ended.current = false;

    const storedActivity = Number(
      localStorage.getItem(ACTIVITY_KEY)
    );
    lastActivity.current =
      Number.isFinite(storedActivity) && storedActivity > 0
        ? storedActivity
        : Date.now();

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;

    function endSession(reason) {
      if (ended.current) return;
      ended.current = true;

      clearTimeout(idleTimer.current);
      clearTimeout(capTimer.current);

      localStorage.setItem(
        LOGOUT_KEY,
        JSON.stringify({ reason, at: Date.now() })
      );
      channel?.postMessage({ type: "logout", reason });

      logout(reason);
    }

    function resetIdle(options = {}) {
      if (ended.current) return;

      const { broadcast = true, force = false } = options;
      const now = Date.now();

      // A background tab's timer can be throttled, and a page reload can
      // restore an old timestamp. Check real elapsed time before treating
      // an event as activity so an idle user cannot slip back in.
      if (
        !force &&
        now - lastActivity.current >= IDLE_MS
      ) {
        endSession("inactive");
        return;
      }

      lastActivity.current = now;

      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(
        () => endSession("inactive"),
        IDLE_MS
      );

      if (!broadcast) return;

      if (now - lastSync.current < SYNC_THROTTLE_MS) {
        return;
      }
      lastSync.current = now;

      localStorage.setItem(ACTIVITY_KEY, String(now));

      pingActivity().catch((error) => {
        if (isSessionInvalidError(error)) {
          endSession("expired");
        }
      });
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        resetIdle();
      }
    }

    function handleStorage(event) {
      if (
        event.key === ACTIVITY_KEY &&
        event.newValue
      ) {
        // Another tab reported real input, so this tab's idle clock must
        // reset even if this tab itself has seen no events.
        resetIdle({ broadcast: false, force: true });
      }

      if (
        event.key === LOGOUT_KEY &&
        event.newValue
      ) {
        try {
          const { reason } = JSON.parse(event.newValue);
          if (!ended.current) {
            ended.current = true;
            clearTimeout(idleTimer.current);
            clearTimeout(capTimer.current);
            logout(reason);
          }
        } catch {
          // Ignore malformed cross-tab signals.
        }
      }
    }

    if (channel) {
      channel.onmessage = (event) => {
        if (
          event.data?.type === "logout" &&
          !ended.current
        ) {
          ended.current = true;
          clearTimeout(idleTimer.current);
          clearTimeout(capTimer.current);
          logout(event.data.reason);
        }
      };
    }

    const activityEvents = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ];
    const handleActivity = () => resetIdle();

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, {
        passive: true,
      });
    });

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );
    window.addEventListener("storage", handleStorage);

    // Entering an authenticated session starts a fresh idle clock. The
    // stored timestamp belongs to whichever session wrote it and must not
    // expire the new one; a reloaded session is already validated by the
    // server during the startup refresh, so forcing here is safe.
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    resetIdle({ force: true });

    if (sessionStartedAt) {
      const msLeft =
        new Date(sessionStartedAt).getTime() +
        MAX_SESSION_MS -
        Date.now();

      capTimer.current = setTimeout(
        () => endSession("limit"),
        Math.max(0, msLeft)
      );
    }

    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(capTimer.current);

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
      window.removeEventListener(
        "storage",
        handleStorage
      );
      channel?.close();
    };
  }, [isAuthenticated, logout, sessionStartedAt]);

  return children;
}
