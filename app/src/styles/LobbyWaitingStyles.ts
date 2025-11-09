import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000ff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ffffffff',
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header Section
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 16,
    color: '#ffffffff',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Room Code Section
  roomCodeContainer: {
    marginBottom: 30,
  },
  roomCodeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  roomCodeBox: {
    backgroundColor: '#6c230fff',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#ffffffff',
  },
  roomCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffffff',
    letterSpacing: 4,
    marginBottom: 8,
  },
  copyHint: {
    fontSize: 14,
    color: '#c0c9c9ff',
  },

  // Status Section
  statusContainer: {
    marginBottom: 30,
    
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 12,
  },
  statusBox: {
    backgroundColor: '#6c230fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusDotWaiting: {
    backgroundColor: '#f3e412ff',
  },
  statusDotReady: {
    backgroundColor: '#2ecc71',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffffff',
  },

  // User Count Section
  userCountContainer: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 16,
  },
  userCountText: {
    fontSize: 14,
    color: '#ffffffff',
    marginBottom: 12,
  },
  userList: {
    gap: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  userName: {
    fontSize: 14,
    color: '#ffffffff',
  },

  // Button Section
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#15ad55ff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  leaveButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },

  // Instructions Section
  instructionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
    marginBottom: 4,
  },
});