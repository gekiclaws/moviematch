import type { Session, SessionStatus } from './session';
import type { User } from './user';


// Root Stack Navigator Param List
// Data being passed between screens defined
export type RootStackParamList = {
  Home: undefined; // No parameters needed
  LobbyWaiting: LobbyWaitingParams;
  JoinRoom: undefined; // User can join a room without params
  SuccessfullyJoined: SuccessfullyJoinedParams;
};

// Individual Screen Params Info
export interface LobbyWaitingParams {
    sessionId: string;
    userId: string;
    session?: Session;
    isHost?: boolean;
}

export interface SuccessfullyJoinedParams {
    sessionId: string;
    userId: string;
    session?: Session;
    hostUser?: User;
    isHost?: boolean;
}
