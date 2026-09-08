import { useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function SignUpScreen() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    setInfo(null);
    setIsLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { business_name: businessName } },
    });
    setIsLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      setInfo("Check your email to confirm your account, then log in.");
    }
  }

  return (
    <Screen>
      <View className="mt-16 gap-1">
        <Text className="text-3xl font-bold text-ink">Create your account</Text>
        <Text className="text-base text-subtle">Start sending quotes in minutes.</Text>
      </View>

      <View className="mt-8 gap-3">
        <Input
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Rivera Landscaping"
        />
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
          placeholder="At least 6 characters"
        />
        {error && <Text className="text-sm text-danger">{error}</Text>}
        {info && <Text className="text-sm text-success">{info}</Text>}
        <Button label="Create account" onPress={handleSignUp} loading={isLoading} />
      </View>

      <View className="mt-6 flex-row justify-center gap-1">
        <Text className="text-sm text-subtle">Already have an account?</Text>
        <Link href="/(auth)/login" className="text-sm font-semibold text-brand-600">
          Log in
        </Link>
      </View>
    </Screen>
  );
}
