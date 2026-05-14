import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const profile = {
  name: "Eduardo",
  username: "edu.fit",
  bio: "Lifestyle fitness, consistência e treino cedo.",
  location: "Pulse Club Recife · Recife",
  initial: "E",
  stats: { posts: 1, followers: 1284, following: 318 },
  streakDays: 6,
  streakLabel: "Consistente",
  monthlyCount: 3,
  monthlyLabel: "maio",
  completion: 85,
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 3)}`.replace(".", ".");
  return n.toString();
}

function StatColumn({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-[18px] font-black text-gc-fg">
        {value >= 1000 ? value.toLocaleString("pt-BR") : value}
      </Text>
      <Text className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-gc-fg-muted">
        {label}
      </Text>
    </View>
  );
}

function TopBar() {
  return (
    <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
      <View className="flex-row items-center gap-3">
        <Image
          source={require("@/assets/images/gym-circle-brand-mark.png")}
          style={{ width: 40, height: 40, borderRadius: 999 }}
          contentFit="contain"
        />
        <View>
          <Text className="text-[10px] font-black uppercase tracking-widest text-gc-fg-muted">
            Gym Circle
          </Text>
          <Text className="text-[24px] font-black leading-none text-gc-fg">
            Perfil
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Pressable className="size-10 items-center justify-center rounded-full bg-white/[0.06]">
          <Ionicons name="search" size={18} color="white" />
        </Pressable>
        <Pressable className="size-10 items-center justify-center rounded-full bg-white/[0.06]">
          <Ionicons name="notifications-outline" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

function Avatar() {
  return (
    <View className="size-[72px] items-center justify-center rounded-full bg-gc-brand">
      <Text className="text-[28px] font-black text-gc-brand-ink">
        {profile.initial}
      </Text>
    </View>
  );
}

function StreakCard() {
  return (
    <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-gc-separator bg-gc-bg-elevated px-4 py-3">
      <View className="flex-row items-center gap-3">
        <View className="size-9 items-center justify-center rounded-full border border-gc-brand/30 bg-gc-brand/10">
          <Ionicons name="flame" size={16} color="#8af7ff" />
        </View>
        <Text className="text-[15px] font-black text-gc-fg">
          {profile.streakDays}d{" "}
          <Text className="font-bold text-gc-fg-muted">
            · {profile.streakLabel}
          </Text>
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="flex-row items-center gap-1 rounded-full border border-gc-separator bg-white/[0.04] px-2.5 py-1">
          <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text className="text-[12px] font-black text-gc-fg-muted">
            {profile.monthlyCount}
          </Text>
        </View>
        <Text className="text-[12px] font-black text-gc-fg-muted">
          {profile.monthlyLabel}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color="rgba(255,255,255,0.5)"
        />
      </View>
    </View>
  );
}

function CompletionCard() {
  return (
    <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-gc-separator bg-gc-bg-elevated px-4 py-3">
      <View className="flex-1">
        <Text className="text-[14px] font-black text-gc-fg">
          Perfil {profile.completion}% completo
        </Text>
        <Text className="mt-0.5 text-[12px] font-bold text-gc-fg-muted">
          Foto de perfil
        </Text>
      </View>
      <Pressable className="rounded-full bg-gc-brand px-4 py-2">
        <Text className="text-[12px] font-black text-gc-brand-ink">
          Completar
        </Text>
      </Pressable>
    </View>
  );
}

function PostThumb() {
  return (
    <View className="size-[120px] overflow-hidden rounded-2xl border border-gc-separator bg-gc-bg-elevated">
      <View className="size-full items-center justify-center bg-white/[0.03]">
        <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.3)" />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gc-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        <TopBar />

        {/* Avatar + stats */}
        <View className="flex-row items-center px-5 pt-4">
          <Avatar />
          <View className="ml-3 flex-1 flex-row items-center">
            <StatColumn value={profile.stats.posts} label="Posts" />
            <StatColumn value={profile.stats.followers} label="Seguidores" />
            <StatColumn value={profile.stats.following} label="Seguindo" />
          </View>
        </View>

        {/* Name + bio + location */}
        <View className="px-5 pt-4">
          <Text className="text-[20px] font-black text-gc-fg">
            {profile.name}
          </Text>
          <Text className="text-[13px] font-bold text-gc-fg-muted">
            @{profile.username}
          </Text>
          <Text className="mt-2 text-[14px] font-medium text-gc-fg">
            {profile.bio}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-[12px] font-bold text-gc-fg-muted">
              {profile.location}
            </Text>
          </View>
        </View>

        {/* Edit profile */}
        <View className="px-5 pt-4">
          <Pressable className="flex-row items-center justify-center gap-2 rounded-full border border-gc-separator bg-white/[0.04] py-3">
            <Ionicons name="pencil" size={14} color="white" />
            <Text className="text-[14px] font-black text-gc-fg">
              Editar perfil
            </Text>
          </Pressable>

          <CompletionCard />
          <StreakCard />
        </View>

        {/* Posts grid */}
        <View className="mt-5 flex-row flex-wrap gap-1.5 px-5">
          <PostThumb />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
