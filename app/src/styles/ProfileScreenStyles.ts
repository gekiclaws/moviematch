import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 20,
    textAlign: "center",
  },

  section: {
    marginBottom: 30,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  editText: {
    color: "#1E90FF",
    fontSize: 16,
  },

  box: {
    backgroundColor: "#6c230fff",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#F5C518",
  },

  boxItem: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 6,
  },

  footer: {
    height: 60,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333",
    backgroundColor: "#1A1A1A",
  },

  footerItem: {
    flex: 1,
    alignItems: "center",
  },

  footerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});