import SwiftUI

// MARK: - AchievementArtifactView (Sprint 22 — paridade web AchievementArtifact3D)

/// Artefato pseudo-3D do Hall. **A FORMA codifica a raridade** (disco →
/// quadrado → hexágono → escudo → estrela), com gradiente + glow por raridade
/// e um monograma central. Substitui o `BadgeIconNativeView` (ícone) no Hall,
/// espelhando o web pós-Sprint 22.
///
/// Estados:
///   - locked (`!earned`): grayscale + dim + cadeado.
///   - mistério (secreto não-conquistado): disco escuro neutro + "?" — NUNCA
///     vaza forma/cor/monograma reais.
public struct AchievementArtifactView: View {
    public let achievement: Achievement
    public let size: CGFloat
    public let glow: Bool

    public init(achievement: Achievement, size: CGFloat = 56, glow: Bool = false) {
        self.achievement = achievement
        self.size = size
        self.glow = glow
    }

    private var isMystery: Bool { achievement.secret && !achievement.earned }
    private var locked: Bool { !achievement.earned }
    private var rarity: AchievementRarity { achievement.rarity ?? .common }
    private var shape: RarityArtifactShape {
        RarityArtifactShape(rarity: isMystery ? .common : rarity)
    }

    public var body: some View {
        ZStack {
            if glow && !isMystery && !locked && rarity != .common {
                shape
                    .fill(Self.glowColor(rarity))
                    .frame(width: size * 1.08, height: size * 1.08)
                    .blur(radius: size * 0.20)
            }

            shape
                .fill(fillGradient)
                .overlay(
                    // brilho diagonal (paridade highlight do web)
                    shape.fill(
                        LinearGradient(
                            colors: [Color.white.opacity(0.45), .clear, Color.black.opacity(0.22)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                )
                .frame(width: size, height: size)
                .grayscale(locked ? 1 : 0)
                .opacity(locked ? 0.45 : 1)
                .shadow(
                    color: Self.glowColor(rarity).opacity(locked ? 0 : 0.32),
                    radius: size * 0.12, x: 0, y: size * 0.09
                )

            Text(monogram)
                .font(.system(size: size * 0.34, weight: .black, design: .rounded))
                .foregroundStyle(isMystery ? Color.white.opacity(0.5) : Color.black.opacity(0.74))

            if locked && !isMystery {
                Image(systemName: "lock.fill")
                    .font(.system(size: size * 0.26, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.85))
                    .shadow(radius: 2)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(isMystery ? "???" : achievement.label)
    }

    private var monogram: String {
        isMystery ? "?" : Self.monogram(for: achievement)
    }

    private var fillGradient: LinearGradient {
        if isMystery {
            return LinearGradient(
                colors: [Color(white: 0.30), Color(white: 0.07)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        }
        let stops = Self.gradientStops(rarity)
        return LinearGradient(colors: stops, startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    // MARK: - Raridade → gradiente / glow (paridade shellClass/glowClass web)

    static func gradientStops(_ rarity: AchievementRarity) -> [Color] {
        switch rarity {
        case .common:    return [hex(0xE5E7EB), hex(0x9CA3AF), hex(0x4B5563)]
        case .uncommon:  return [hex(0xA7F3D0), hex(0x34D399), hex(0x047857)]
        case .rare:      return [hex(0xBFDBFE), hex(0x3B82F6), hex(0x1E3A8A)]
        case .epic:      return [hex(0xE9D5FF), hex(0xA855F7), hex(0x6B21A8)]
        case .legendary: return [hex(0xFDE68A), hex(0xF59E0B), hex(0xB45309)]
        }
    }

    static func glowColor(_ rarity: AchievementRarity) -> Color {
        switch rarity {
        case .common:    return Color.white.opacity(0.05)
        case .uncommon:  return hex(0x34D399)
        case .rare:      return hex(0x3B82F6)
        case .epic:      return hex(0xA855F7)
        case .legendary: return hex(0xF59E0B)
        }
    }

    private static func hex(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }

    // MARK: - Monograma (port de MONOGRAM_MAP + deriveMonogram do web)

    private static let monogramMap: [String: String] = [
        "badge:first-workout": "1",
        "badge:early-bird": "M",
        "badge:night-owl": "C",
        "badge:cross-trainer": "3",
        "badge:explorer": "5",
        "medal:streak-3": "3",
        "medal:streak-7": "7",
        "medal:streak-14": "14",
        "medal:streak-30": "30",
        "medal:workouts-50": "50",
        "medal:streak-recovered": "R",
        "trophy:streak-60": "60",
        "trophy:active-week": "5",
        "trophy:month-active": "15",
        "trophy:year-active": "100",
        "trophy:friends-50": "50",
        "trophy:network-100": "100",
        "trophy:community-200": "200",
        "trophy:social-10": "10",
        "trophy:prolific-100": "100",
        "relic:unbreakable": "∞",
        "relic:circle-master": "300",
        "relic:streak-365": "365",
        "relic:founder-2026": "26",
    ]

    static func monogram(for achievement: Achievement) -> String {
        if let mapped = monogramMap["\(achievement.kind.rawValue):\(achievement.achievementId)"] {
            return mapped
        }
        if achievement.kind == .challenge {
            // "2026-06" → "6" (mês sem zero à esquerda)
            if let periodKey = achievement.periodKey {
                let parts = periodKey.split(separator: "-")
                if parts.count >= 2, let month = Int(parts[1]), (1...12).contains(month) {
                    return String(month)
                }
            }
            return "★"
        }
        if let target = achievement.progress?.target {
            return String(target)
        }
        let trimmed = achievement.label.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "•" : String(trimmed.prefix(1)).uppercased()
    }
}

// MARK: - RarityArtifactShape (5 silhuetas por raridade)

/// A silhueta do artefato por raridade. Mesmos polígonos do web (clip-path).
public struct RarityArtifactShape: Shape, Sendable {
    public let rarity: AchievementRarity

    public init(rarity: AchievementRarity) {
        self.rarity = rarity
    }

    public func path(in rect: CGRect) -> Path {
        switch rarity {
        case .common:
            return Path(ellipseIn: rect)
        case .uncommon:
            return Path(roundedRect: rect, cornerRadius: min(rect.width, rect.height) * 0.22, style: .continuous)
        case .rare:
            return polygon(in: rect, points: [
                (0.50, 0.00), (0.93, 0.25), (0.93, 0.75),
                (0.50, 1.00), (0.07, 0.75), (0.07, 0.25),
            ])
        case .epic:
            return polygon(in: rect, points: [
                (0.10, 0.06), (0.90, 0.06), (0.90, 0.50),
                (0.50, 1.00), (0.10, 0.50),
            ])
        case .legendary:
            return polygon(in: rect, points: [
                (0.50, 0.00), (0.61, 0.35), (0.98, 0.35), (0.68, 0.57),
                (0.79, 0.91), (0.50, 0.70), (0.21, 0.91), (0.32, 0.57),
                (0.02, 0.35), (0.39, 0.35),
            ])
        }
    }

    private func polygon(in rect: CGRect, points: [(CGFloat, CGFloat)]) -> Path {
        var path = Path()
        for (index, point) in points.enumerated() {
            let cgPoint = CGPoint(
                x: rect.minX + point.0 * rect.width,
                y: rect.minY + point.1 * rect.height
            )
            if index == 0 { path.move(to: cgPoint) } else { path.addLine(to: cgPoint) }
        }
        path.closeSubpath()
        return path
    }
}
