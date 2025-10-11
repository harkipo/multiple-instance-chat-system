// Session utility functions for user authentication

export interface UserSession {
  userId: string;
  username: string;
  displayName?: string;
}

/**
 * Check if user has an active session
 * @returns UserSession object if session exists, null otherwise
 */
export const getActiveSession = (): UserSession | null => {
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const displayName = localStorage.getItem('displayName');

  if (userId && username) {
    return {
      userId,
      username,
      displayName: displayName || undefined,
    };
  }

  return null;
};

/**
 * Validate if the stored userId is a valid UUID format
 * @returns true if valid UUID, false otherwise
 */
export const isValidUserId = (userId: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
};

/**
 * Clear user session data from localStorage
 */
export const clearSession = (): void => {
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  localStorage.removeItem('displayName');
};

/**
 * Set user session data in localStorage
 */
export const setSession = (session: UserSession): void => {
  localStorage.setItem('userId', session.userId);
  localStorage.setItem('username', session.username);
  if (session.displayName) {
    localStorage.setItem('displayName', session.displayName);
  }
};
