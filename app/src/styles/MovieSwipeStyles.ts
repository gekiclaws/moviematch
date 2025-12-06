import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000ff',
  },
  header: {
    position: 'absolute',  // Position on top of card
    top: 50,  // Adjust for safe area
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    fontSize: 16,
    color: '#ffffffff',
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffffff',
  },
  cardContainer: {
    color: '#333',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 100
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 40,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dislikeButton: {
    backgroundColor: '#F44336',
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },
  buttonIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noMoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  noMoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  noMoreSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },

    tutorialBox: {
        backgroundColor: '#222',
        padding: 35,
        borderRadius: 12,
        width: '80%',
        alignItems: 'center',
    },

    tutorialTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },

    tutorialText: {
        color: '#bbb',
        fontSize: 16,
        marginBottom: 25,
        textAlign: 'center',
    },

    tutorialButton: {
        backgroundColor: '#E50914',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
        marginBottom: 12,
    },

    tutorialButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    skipButton: {
        paddingVertical: 10,
    },

    skipButtonText: {
        fontSize: 16,
        color: '#bbb',
    },

    tutorialHintOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 90,
        position: 'absolute',
        pointerEvents: 'none', // allows the user to swipe
    },

    hintText: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 20,
        fontSize: 20,
        fontWeight: '700',
        borderRadius: 8,
        textAlign: 'center',
    },

    fullScreenOverlay: {
        ...StyleSheet.absoluteFillObject, // makes the overlay span the entire screen
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100, // above everything else
        position: 'absolute',
    },
    arrow: {
        fontSize: 48,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 12,
    }
    
});