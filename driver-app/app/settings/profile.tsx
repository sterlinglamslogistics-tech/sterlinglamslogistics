import { useState } from "react"
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, ActivityIndicator, Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"

const TEAL = "#0d9488"

const VEHICLES = ["MOTORCYCLE", "CAR", "BICYCLE", "VAN", "TRUCK"]

export default function ProfileScreen() {
  const { session, driver, profilePhoto, setProfilePhoto } = useDriver()
  const [name, setName] = useState(driver?.name ?? session?.name ?? "")
  const [email, setEmail] = useState(driver?.email ?? "")
  const [phone, setPhone] = useState(driver?.phone ?? session?.phone ?? "")
  const [personalId, setPersonalId] = useState("")
  const [vehicle, setVehicle] = useState(driver?.vehicle ?? "MOTORCYCLE")
  const [model, setModel] = useState(driver?.model ?? "")
  const [plate, setPlate] = useState(driver?.plate ?? "")
  const [city, setCity] = useState(driver?.area ?? "")
  const [saving, setSaving] = useState(false)
  const [showVehiclePicker, setShowVehiclePicker] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") { Alert.alert("Permission needed", "Please allow photo library access."); return }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
    if (!result.canceled && result.assets[0]) {
      await setProfilePhoto(result.assets[0].uri)
    }
  }

  function handleChangePassword() {
    Alert.prompt(
      "Current Password",
      "Enter your current password to continue",
      (currentPassword) => {
        if (!currentPassword) return
        Alert.prompt(
          "New Password",
          "Enter your new password (min 6 characters)",
          async (newPassword) => {
            if (!newPassword || newPassword.length < 6) {
              Alert.alert("Too short", "Password must be at least 6 characters.")
              return
            }
            if (!session) return
            setChangingPassword(true)
            try {
              const res = await driverFetch("/api/driver/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ driverId: session.id, currentPassword, newPassword }),
              })
              const data = await res.json() as { ok: boolean; error?: string }
              if (data.ok) {
                Alert.alert("Done", "Password updated successfully.")
              } else {
                Alert.alert("Error", data.error ?? "Failed to change password.")
              }
            } catch {
              Alert.alert("Error", "Network error. Please try again.")
            } finally {
              setChangingPassword(false)
            }
          },
          "secure-text"
        )
      },
      "secure-text"
    )
  }

  async function save() {
    if (!session) return
    setSaving(true)
    try {
      await driverFetch("/api/driver/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: session.id, name, email, vehicle, model, plate, area: city }),
      })
      Alert.alert("Saved", "Profile updated successfully.")
    } catch {
      Alert.alert("Error", "Failed to save profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const displayName = name || session?.name || "Driver"

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={TEAL} /> : <Text style={styles.saveBtn}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickPhoto} style={styles.avatarWrap}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarName}>{displayName}</Text>
        </View>

        {/* Form fields */}
        {[
          { label: "Name", value: name, set: setName, keyboardType: "default" as const },
          { label: "Email", value: email, set: setEmail, keyboardType: "email-address" as const },
          { label: "Phone", value: phone, set: setPhone, keyboardType: "phone-pad" as const },
          { label: "Personal ID", value: personalId, set: setPersonalId, keyboardType: "default" as const },
        ].map((field, i) => (
          <View key={field.label} style={[styles.fieldRow, i > 0 && styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={field.value}
              onChangeText={field.set}
              keyboardType={field.keyboardType}
              autoCapitalize="none"
              placeholder={field.label}
              placeholderTextColor="#d1d5db"
            />
          </View>
        ))}

        {/* Vehicle dropdown */}
        <View style={[styles.fieldRow, styles.fieldBorder]}>
          <Text style={styles.fieldLabel}>Vehicle</Text>
          <TouchableOpacity style={styles.vehicleSelect} onPress={() => setShowVehiclePicker(!showVehiclePicker)}>
            <Text style={styles.vehicleText}>{vehicle}</Text>
            <Feather name="chevron-down" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
        {showVehiclePicker && (
          <View style={styles.vehiclePicker}>
            {VEHICLES.map((v) => (
              <TouchableOpacity key={v} style={styles.vehicleOption} onPress={() => { setVehicle(v); setShowVehiclePicker(false) }}>
                <Text style={[styles.vehicleOptionText, v === vehicle && { color: TEAL, fontWeight: "700" }]}>{v}</Text>
                {v === vehicle && <Feather name="check" size={16} color={TEAL} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {[
          { label: "Model", value: model, set: setModel },
          { label: "Plate", value: plate, set: setPlate },
          { label: "City", value: city, set: setCity, placeholder: "Lagos, Nigeria" },
        ].map((field) => (
          <View key={field.label} style={[styles.fieldRow, styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={field.value}
              onChangeText={field.set}
              placeholder={field.placeholder ?? field.label}
              placeholderTextColor="#d1d5db"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.changePasswordBtn, changingPassword && { opacity: 0.6 }]}
          onPress={handleChangePassword}
          disabled={changingPassword}
        >
          {changingPassword
            ? <ActivityIndicator size="small" color="#374151" />
            : <Text style={styles.changePasswordText}>Change password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  saveBtn: { color: TEAL, fontSize: 16, fontWeight: "700" },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatarWrap: { position: "relative", marginBottom: 10 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: { backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 36, fontWeight: "800", color: TEAL },
  editBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: TEAL, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  avatarName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  fieldRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  fieldBorder: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  fieldLabel: { width: 110, fontSize: 15, color: "#374151" },
  fieldInput: { flex: 1, fontSize: 15, color: "#111827" },
  vehicleSelect: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vehicleText: { fontSize: 15, color: "#111827", fontWeight: "500" },
  vehiclePicker: { backgroundColor: "#f9fafb", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  vehicleOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  vehicleOptionText: { fontSize: 15, color: "#374151" },
  changePasswordBtn: { marginHorizontal: 16, marginTop: 24, backgroundColor: "#f3f4f6", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  changePasswordText: { fontSize: 15, fontWeight: "600", color: "#374151" },
})
