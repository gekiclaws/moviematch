import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function FooterNav() {
  const navigation = useNavigation();

  return (
    <View style={styles.footer}>
      {/* Home Button */}
      <TouchableOpacity
        style={styles.footerItem}
        onPress={() => navigation.navigate("Home" as never)}
      >
        <Text style={styles.footerText}>Home</Text>
      </TouchableOpacity>

      {/* Profile Button */}
      <TouchableOpacity
        style={styles.footerItem}
        onPress={() => navigation.navigate("Profile" as never)}
      >
        <Text style={styles.footerText}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 25,
    backgroundColor: "#6c230fff",
    borderTopWidth: 1,
    borderTopColor: "#F5C518",
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