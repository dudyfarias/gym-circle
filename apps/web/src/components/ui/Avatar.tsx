import Image from "next/image";

type AvatarProps = {
  name: string;
  src?: string;
  accent?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "size-10 text-sm",
  md: "size-12 text-base",
  lg: "size-20 text-2xl",
};

const imageSizes = {
  sm: 40,
  md: 48,
  lg: 80,
};

export function Avatar({
  name,
  src,
  accent = "var(--gc-blue)",
  size = "md",
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  if (src) {
    return (
      <Image
        alt={name}
        className={[sizes[size], "rounded-full object-cover"].join(" ")}
        height={imageSizes[size]}
        src={src}
        width={imageSizes[size]}
      />
    );
  }

  return (
    <div
      className={[
        sizes[size],
        "grid rounded-full place-items-center font-extrabold text-black",
      ].join(" ")}
      style={{
        background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.86))`,
        boxShadow: `0 0 24px ${accent}38`,
      }}
    >
      {initials}
    </div>
  );
}
