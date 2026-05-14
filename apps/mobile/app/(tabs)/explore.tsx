import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gc-bg" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-[14px] font-bold text-gc-fg-muted">
          Aba de exploração ainda não foi portada pro POC nativo.
        </Text>
        <Text className="mt-2 text-center text-[12px] font-medium text-gc-fg-soft">
          O POC valida só a tela de Perfil por enquanto.
        </Text>
      </View>
    </SafeAreaView>
  );
}
