import { SessionService } from '../services/firebase/sessionService';
import { SessionErrorHandler } from './sessionErrorHandler';

/**
 * Handles session exit flow with confirmation dialog and cleanup
 * Prompts user to confirm exit, then deletes session and navigates home
 * 
 * @param sessionId - The ID of the session to delete
 * @param navigation - React Navigation object for navigation
 */
export const handleSessionExit = (
  sessionId: string,
  navigation: any
): void => {
  SessionErrorHandler.showExitConfirmation(
    async () => {
      try {
        // Delete session and clean up all users
        await SessionService.deleteSession(sessionId);
        navigation.navigate('Home');
      } catch (error) {
        console.error('Error deleting session:', error);
        // Navigate anyway even if deletion fails
        navigation.navigate('Home');
      }
    }
  );
};
