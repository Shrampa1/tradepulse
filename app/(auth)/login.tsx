import { useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setIsLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <Screen>
      <View className="mt-16 gap-1">
        <Text className="text-3xl font-bold text-ink">TradePulse</Text>
        <Text className="text-base text-subtle">Quotes and invoices, in the field.</Text>
      </View>

      <View className="mt-8 gap-3">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@business.com"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error && <Text className="text-sm text-danger">{error}</Text>}
        <Button label="Log in" onPress={handleLogin} loading={isLoading} />
      </View>

      <View className="mt-6 flex-row justify-center gap-1">
        <Text className="text-sm text-subtle">New here?</Text>
        <Link href="/(auth)/sign-up" className="text-sm font-semibold text-brand-600">
          Create an account
        </Link>
      </View>
    </Screen>
  );
}
