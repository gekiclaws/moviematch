import { StyleSheet } from 'react-native';

export const SuccessfullyJoinedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
  },
  
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  
  successHeader: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#27ae60',
    textAlign: 'center',
  },
  
  infoContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  
  infoLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  
  statusContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  statusLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
    marginBottom: 8,
  },
  
  statusText: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '600',
  },
  
  messageContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  
  messageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 8,
  },
  
  messageText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },
  
  connectionIndicator: {
    alignItems: 'center',
    padding: 16,
  },
  
  connectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7f8c8d',
  },
});