import { Alert, AlertButton } from 'react-native';

/**
 * Session Error Handler - Centralized error handling for session-related issues
 * Provides consistent error messages and user feedback across the app
 */

export interface SessionErrorHandlerOptions {
  title?: string;
  message?: string;
  onConfirm?: () => void;
  isDismissed?: boolean;
}

/**
 * Show alert when session has been ended/deleted
 * Prevents duplicate alerts by tracking if already dismissed
 */
let sessionEndedAlertDismissed = false;

export const SessionErrorHandler = {
  /**
   * Reset the session ended flag (useful when mounting/unmounting)
   */
  resetSessionEndedFlag: () => {
    sessionEndedAlertDismissed = false;
  },

  /**
   * Show session ended alert - prevents duplicate alerts
   * @param options - Configuration for the alert
   */
  showSessionEnded: (options?: SessionErrorHandlerOptions) => {
    if (sessionEndedAlertDismissed) {
      console.log('Session ended alert already shown, skipping duplicate');
      return;
    }

    sessionEndedAlertDismissed = true;

    const title = options?.title || 'Session Ended';
    const message = options?.message || 'The session has been ended.';
    
    const buttons: AlertButton[] = [
      {
        text: 'OK',
        onPress: () => {
          sessionEndedAlertDismissed = false; // Reset for next session
          options?.onConfirm?.();
        },
      },
    ];

    Alert.alert(title, message, buttons);
  },

  /**
   * Show partner left alert (for when other user exits)
   * @param options - Configuration for the alert
   */
  showPartnerLeft: (options?: SessionErrorHandlerOptions) => {
    if (sessionEndedAlertDismissed) {
      console.log('Partner left alert already shown, skipping duplicate');
      return;
    }

    sessionEndedAlertDismissed = true;

    const title = options?.title || 'Session Ended';
    const message = options?.message || 'Your partner has left the session.';
    
    const buttons: AlertButton[] = [
      {
        text: 'OK',
        onPress: () => {
          sessionEndedAlertDismissed = false; // Reset for next session
          options?.onConfirm?.();
        },
      },
    ];

    Alert.alert(title, message, buttons);
  },

  /**
   * Show exit confirmation alert
   * @param onConfirm - Callback when user confirms exit
   * @param onCancel - Callback when user cancels exit
   */
  showExitConfirmation: (onConfirm: () => void, onCancel?: () => void) => {
    Alert.alert(
      'Exit Session',
      'Are you sure you want to exit? This will end the session for all users.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: onConfirm,
        }
      ]
    );
  },

  /**
   * Clear the session ended flag when navigating away
   */
  clearSessionState: () => {
    sessionEndedAlertDismissed = false;
  },
};

export default SessionErrorHandler;
