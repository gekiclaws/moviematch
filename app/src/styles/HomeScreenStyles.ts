import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
 container: {
   flex: 1,
   backgroundColor: '#f8f9fa',
 },
 content: {
   flex: 1,
   paddingHorizontal: 24,
   paddingVertical: 20,
   justifyContent: 'center',
 },
  // Title Section
 titleContainer: {
   alignItems: 'center',
   marginBottom: 40,
 },
 appTitle: {
   fontSize: 32,
   fontWeight: 'bold',
   color: '#2c3e50',
   marginBottom: 8,
 },
 subtitle: {
   fontSize: 16,
   color: '#7f8c8d',
   fontStyle: 'italic',
 },


 // Header Section
 headerContainer: {
   alignItems: 'center',
   marginBottom: 50,
 },
 headerText: {
   fontSize: 24,
   fontWeight: '600',
   color: '#34495e',
   textAlign: 'center',
   marginBottom: 12,
   lineHeight: 30,
 },
 descriptionText: {
   fontSize: 16,
   color: '#7f8c8d',
   textAlign: 'center',
   lineHeight: 22,
 },


 // Button Section
 buttonContainer: {
   gap: 16,
   marginBottom: 40,
 },
 button: {
   borderRadius: 12,
   paddingVertical: 18,
   paddingHorizontal: 24,
   alignItems: 'center',
   shadowColor: '#000',
   shadowOffset: {
     width: 0,
     height: 2,
   },
   shadowOpacity: 0.1,
   shadowRadius: 4,
   elevation: 3,
 },
  // Create Button Styling
 createButton: {
   backgroundColor: '#3498db',
 },
 createButtonText: {
   fontSize: 18,
   fontWeight: '600',
   color: '#ffffff',
   marginBottom: 4,
 },
  // Join Button Styling
 joinButton: {
   backgroundColor: '#2ecc71',
 },
 joinButtonText: {
   fontSize: 18,
   fontWeight: '600',
   color: '#ffffff',
   marginBottom: 4,
 },
  // Button Subtext
 buttonSubtext: {
   fontSize: 14,
   color: '#ffffff',
   opacity: 0.9,
 },
});
