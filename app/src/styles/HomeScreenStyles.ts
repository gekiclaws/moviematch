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
   color: '#ffffffff',
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
   justifyContent: 'center',
   alignItems: 'center',
   gap: 16,
   marginBottom: 40,
 },
 button: {
   borderRadius: 30,
   padding: 0,
   justifyContent: 'center',
   paddingVertical: 25,
   width: '70%',
   alignItems: 'center',
 },
  // Create Button Styling
 createButton: {
   backgroundColor: '#F5C518',
 },
 createButtonText: {
   fontSize: 18,
   fontWeight: 'bold',
   color: '#000000ff',
   marginBottom: 4,
 },
  // Join Button Styling
 joinButton: {
   backgroundColor: '#F5C518',
 },
 joinButtonText: {
   fontSize: 18,
   color: '#000000ff',
   fontWeight: 'bold',
   marginBottom: 4,
 },
  // Button Subtext
 buttonSubtext: {
   fontSize: 14,
   color: '#030303ff',
   opacity: 0.9,
 },
});
