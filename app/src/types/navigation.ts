import type { Session, SessionStatus } from './session';
import type { User } from './user';


// Root Stack Navigator Param List
// Data being passed between screens defined
export type RootStackParamList = {
  Home: undefined; // No parameters needed
  Profile: ProfileParams;
  LobbyWaiting: LobbyWaitingParams;
  JoinRoom: undefined; // User can join a room without params
  SuccessfullyJoined: SuccessfullyJoinedParams;
  MovieSwipe: MovieSwipeParams;
  GenreSelection: GenreSelectionParams;
  PlatformSelection: PlatformSelectionParams;
  FavoriteMediaSelection: FavoriteMediaSelectionParams;
  SessionTypeSelection: SessionTypeSelectionParams;
  RecommendationScreen: RecommendationScreenParams;
};


export interface ProfileParams{
    userId:string;
}

// Individual Screen Params Info
export interface LobbyWaitingParams {
    sessionId: string;
    userId: string;
    roomCode?: string;
    session?: Session;
    isHost?: boolean;
}

export interface SuccessfullyJoinedParams {
    sessionId: string;
    userId: string;
    userName: string;
    roomCode?: string;
    session?: Session;
    hostUser?: User;
    isHost?: boolean;
}

export interface MovieSwipeParams {
    sessionId: string;
    userId: string;
    sessionTypes?: ('movie' | 'show')[];
    session?: Session
}

export interface SessionTypeSelectionParams {
    sessionId: string;
    userId: string;
    session?: Session
}

export interface GenreSelectionParams {
    userId: string;
    editMode?: boolean;
}

export interface PlatformSelectionParams {
    userId: string;
    editMode?: boolean;
}

export interface FavoriteMediaSelectionParams {
    userId: string;
    editMode?: boolean;
}

export interface RecommendationScreenParams {
    sessionId: string;
}


// Screen-specific data types
export interface RoomCreationResult {
    sessionId: string;
    session: Session;
    hostUserId: string;
}

export interface RoomJoinResult {
    sessionId: string;
    session: Session;
    userId: string;
    hostUser: User;
}

export interface RoomStatusInfo {
    status: SessionStatus;
    currentUserCount: number;
    maxUsers: number;
    users: User[];
    joinCode: string;
    isFull: boolean;
    canStartMatching: boolean;
}

// Navigation helper types

export interface BaseNavigationProps {
    userId: string;
    sessionId?: string;
}

// Error information for navigation error handling
export interface NavigationError {
    code: string;
    message: string;
    details?: string;
    screen?: keyof RootStackParamList;
}

// Room/Session validation types
export interface RoomCodeValidation {
    isValid: boolean;
    session?: Session;
    error?: string;
    isFull?: boolean;
    hasStarted?: boolean;
}

// Navigation context for maintaining app state
export interface NavigationContext {
    currentUser?: User;
    currentSession?: Session;
    isHost?: boolean;
    isLoading: boolean;
    error?: NavigationError;
}

// Type guards for runtime validation
export function hasSessionParams( params: any): params is { sessionId: string; userId: string } {
    return (
        typeof params === 'object' &&
        typeof params.sessionId === 'string' &&
        typeof params.userId === 'string'
    );
}

export function isInRoomContext( context: NavigationContext): context is NavigationContext & { currentSession: Session } {
    return !!context.currentSession;
}

export type ScreenName = keyof RootStackParamList;
export type SessionScreenParams = LobbyWaitingParams | SuccessfullyJoinedParams;