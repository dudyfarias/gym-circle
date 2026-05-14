import { Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

type BrandMarkProps = {
  size?: number;
  showWordmark?: boolean;
};

/**
 * Native port of apps/web BrandMark SVG. Same viewBox, same paths.
 * Glow filter is skipped — RN-SVG filter support is unreliable; the
 * design still reads clearly without it.
 */
export function BrandMark({ size = 44, showWordmark = false }: BrandMarkProps) {
  return (
    <View className="flex-row items-center gap-3">
      <Svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        accessibilityLabel="Gym Circle"
      >
        <Defs>
          <LinearGradient id="gc-brand-c" x1="18" x2="82" y1="18" y2="82">
            <Stop offset="0%" stopColor="#c7fcff" />
            <Stop offset="52%" stopColor="#8af7ff" />
            <Stop offset="100%" stopColor="#30d5ff" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="42" fill="rgba(6,17,22,0.74)" />
        <Path
          d="M70 24A34 34 0 1 0 70 76"
          stroke="url(#gc-brand-c)"
          strokeLinecap="round"
          strokeWidth={11}
          fill="none"
        />
        <Path
          d="M62 36A20 20 0 1 0 62 64"
          opacity={0.52}
          stroke="url(#gc-brand-c)"
          strokeLinecap="round"
          strokeWidth={7}
          fill="none"
        />
        <Circle cx="72" cy="70" r="6" fill="#8af7ff" />
      </Svg>
      {showWordmark ? (
        <View>
          <Text className="text-[18px] font-black uppercase leading-none text-white">
            Gym
          </Text>
          <Text className="-mt-1 text-[18px] font-black uppercase leading-none text-white">
            Circle
          </Text>
        </View>
      ) : null}
    </View>
  );
}
