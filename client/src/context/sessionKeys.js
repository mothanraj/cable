// Shared browser-storage keys for the client-side session clock. Kept in a
// dependency-free module so both the auth provider and the idle monitor can
// use them without importing each other.
export const ACTIVITY_KEY = "cable:lastActivityAt";
export const LOGOUT_SIGNAL_KEY = "cable:logoutSignal";
export const CHANNEL_NAME = "cable-session";
