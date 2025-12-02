import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    fontSize: 32,
    color: '#F5C518',
    fontWeight: 'bold',
  },
  titleContainer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#F5C518',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: 'center',
    marginVertical: 10,
    minWidth: 200,
  },
  continueButtonDisabled: {
    backgroundColor: '#555',
  },
  continueButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 30,
    marginVertical: 15,
  },
  searchContainer: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 16,
  },
  mediaGrid: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  mediaCard: {
    width: '48%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  mediaCardSelected: {
    borderColor: '#F5C518',
  },
  posterImage: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  placeholderPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 197, 24, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5C518',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 30,
    color: '#000',
    fontWeight: 'bold',
  },
  mediaInfo: {
    padding: 10,
  },
  mediaTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  mediaYear: {
    color: '#aaa',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
});