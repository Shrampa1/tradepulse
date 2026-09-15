import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function ProfileScreen() {
  const { session } = useAuth();
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      supabase
        .from("profiles")
        .select("full_name")
        .single()
        .then(({ data }) => {
          if (!isActive) return;
          setFullName(data?.full_name ?? "");
          setIsLoading(false);
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleSaveName() {
    setIsSavingName(true);
    setNameError(null);
    setNameSaved(false);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setNameError("You must be signed in.");
      setIsSavingName(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("user_id", userData.user.id);

    setIsSavingName(false);
    if (error) {
      setNameError(error.message);
      return;
    }
    setNameSaved(true);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setIsSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword("");
    setPasswordSaved(true);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
  }

  if (isLoading) {
    return (
      <Screen>
        <Text className="mt-10 text-center text-sm text-subtle">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="mt-2 text-2xl font-bold text-ink">Profile</Text>

      <Card className="gap-3">
        <Input label="Email" value={session?.user.email ?? ""} editable={false} />
        <Input label="Your name" value={fullName} onChangeText={setFullName} placeholder="Jane Contractor" />
        {nameError && <Text className="text-sm text-danger">{nameError}</Text>}
        {nameSaved && <Text className="text-sm text-success">Saved.</Text>}
        <Button label="Save name" variant="secondary" onPress={handleSaveName} loading={isSavingName} />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Change password</Text>
        <Input
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="At least 6 characters"
        />
        {passwordError && <Text className="text-sm text-danger">{passwordError}</Text>}
        {passwordSaved && <Text className="text-sm text-success">Password updated.</Text>}
        <Button
          label="Update password"
          variant="secondary"
          onPress={handleChangePassword}
          loading={isSavingPassword}
        />
      </Card>

      <Button
        label="Sign out"
        variant="destructive"
        onPress={handleSignOut}
        loading={isSigningOut}
      />
    </Screen>
  );
}
