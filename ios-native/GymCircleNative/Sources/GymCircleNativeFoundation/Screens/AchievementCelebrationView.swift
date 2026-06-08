import SwiftUI

/// AchievementCelebrationView — Sprint 8.7 (paridade web Sprint 7.5.11).
///
/// Full-screen celebration overlay com Canvas particles SwiftUI nativos,
/// scale spring entry, e haptic via UINotificationFeedbackGenerator.
/// Escala intensidade por raridade (common 35 partículas → legendary 200).
public struct AchievementCelebrationView: View {
    public let achievement: Achievement
    public let queueIndex: Int?
    public let queueTotal: Int?
    public let onDismiss: () -> Void
    public let onSkipAll: (() -> Void)?

    @State private var animateIn = false
    @State private var particles: [Particle] = []
    @State private var sparkleAngle: Double = 0

    public init(
        achievement: Achievement,
        queueIndex: Int? = nil,
        queueTotal: Int? = nil,
        onDismiss: @escaping () -> Void,
        onSkipAll: (() -> Void)? = nil
    ) {
        self.achievement = achievement
        self.queueIndex = queueIndex
        self.queueTotal = queueTotal
        self.onDismiss = onDismiss
        self.onSkipAll = onSkipAll
    }

    private var intensity: Intensity { Intensity.from(rarity: achievement.rarity ?? .common) }
    private var showQueueBadge: Bool {
        if let total = queueTotal { return total > 1 }
        return false
    }

    public var body: some View {
        accessibleBody
            .accessibilityElement(children: .contain)
            .accessibilityLabel(Text("\(L10n.detailVoceDesbloqueou.string): \(achievement.label)"))
            .accessibilityHint(Text(achievement.description))
            .accessibilityAddTraits(.isModal)
    }

    private var accessibleBody: some View {
        ZStack {
            // Backdrop
            // Sprint 9.6.5 — backdrop com blur ultraThinMaterial pra paridade
            // com web `backdrop-blur-2xl` premium Apple Fitness feel.
            ZStack {
                Color.black.opacity(0.72)
                Rectangle().fill(.ultraThinMaterial).opacity(0.55)
            }
            .ignoresSafeArea()

            // Spotlight radial
            RadialGradient(
                gradient: Gradient(colors: [intensity.glowColor, .clear]),
                center: UnitPoint(x: 0.5, y: 0.45),
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()
            .opacity(animateIn ? 1 : 0)
            .animation(.easeOut(duration: 0.7), value: animateIn)

            // Particles canvas
            ParticlesCanvas(particles: particles, animateIn: animateIn)

            // Conteúdo central
            VStack(spacing: 0) {
                if showQueueBadge, let idx = queueIndex, let total = queueTotal {
                    Text(L10n.celebrationQueueIndex(index: idx, total: total).string)
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(1.2)
                        .foregroundColor(.white.opacity(0.64))
                        .padding(.bottom, 16)
                        .opacity(animateIn ? 1 : 0)
                }

                ZStack {
                    Circle()
                        .fill(intensity.glowColor)
                        .frame(width: 200, height: 200)
                        .blur(radius: 50)
                        .opacity(animateIn ? 1 : 0)

                    BadgeIconNativeView(
                        iconKey: achievement.iconKey,
                        earned: true,
                        size: 140
                    )
                    .scaleEffect(animateIn ? 1.0 : 0.35)
                    .animation(.spring(response: 0.6, dampingFraction: 0.65, blendDuration: 0.4), value: animateIn)

                    // Sprint 9.8.1 — SparkleDecor 3 estrelas pra rarity ≥ epic
                    if let rarity = achievement.rarity,
                       rarity == .epic || rarity == .legendary {
                        sparkleDecor
                    }
                }
                .padding(.vertical, 24)

                Text(L10n.detailVoceDesbloqueou.string)
                    .font(.system(size: 12, weight: .heavy))
                    .tracking(2.0)
                    .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
                    .padding(.top, 8)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.5).delay(0.24), value: animateIn)

                Text(achievement.label)
                    .font(.system(size: 28, weight: .black))
                    .tracking(-0.5)
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 12)
                    .animation(.easeOut(duration: 0.5).delay(0.34), value: animateIn)

                Text(achievement.description)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.76))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .padding(.top, 8)
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 12)
                    .animation(.easeOut(duration: 0.5).delay(0.42), value: animateIn)

                VStack(spacing: 8) {
                    Button(action: onDismiss) {
                        Text(L10n.celebrationContinuar.string)
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundColor(.black)
                            .padding(.horizontal, 32)
                            .padding(.vertical, 14)
                            .frame(maxWidth: 280)
                            .background(Capsule().fill(Color.white))
                    }

                    if showQueueBadge, let onSkipAll {
                        Button(action: onSkipAll) {
                            Text(L10n.celebrationVerDepois.string)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white.opacity(0.64))
                                .padding(.horizontal, 24)
                                .padding(.vertical, 10)
                                .frame(maxWidth: 280)
                                .background(Capsule().fill(Color.white.opacity(0.06)))
                        }
                    }
                }
                .padding(.top, 32)
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 12)
                .animation(.easeOut(duration: 0.5).delay(0.54), value: animateIn)
            }
            .padding(.horizontal, 24)
        }
        .onAppear {
            triggerHaptic()
            withAnimation {
                animateIn = true
            }
            // Particles burst depois de 200ms (centro)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                particles = Self.makeBurst(
                    intensity: intensity,
                    count: intensity.particles,
                    originX: 0.5,
                    originY: 0.45
                )
            }
            // Sprint 9.8.1 — burst secundário pra rarity ≥ epic (2 lados, 450ms)
            if let rarity = achievement.rarity,
               rarity == .epic || rarity == .legendary {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
                    let extraCount = intensity.particles / 3
                    particles.append(contentsOf: Self.makeBurst(
                        intensity: intensity, count: extraCount, originX: 0.2, originY: 0.55
                    ))
                    particles.append(contentsOf: Self.makeBurst(
                        intensity: intensity, count: extraCount, originX: 0.8, originY: 0.55
                    ))
                }
            }
            // Auto-dismiss
            DispatchQueue.main.asyncAfter(deadline: .now() + intensity.autoDismissSeconds) {
                onDismiss()
            }
        }
    }

    // MARK: - Sparkle decor (Sprint 9.8.1 — paridade web SparkleDecor)

    /// 3 estrelas SF Symbol "sparkle" douradas nos cantos da artwork.
    /// Animação `repeatForever` 1800ms ease-in-out (paridade web `animate-pulse`).
    private var sparkleDecor: some View {
        ZStack {
            sparkleStar(x: -90, y: -70, size: 22, delay: 0)
            sparkleStar(x: 95, y: -60, size: 18, delay: 0.4)
            sparkleStar(x: -75, y: 85, size: 16, delay: 0.8)
        }
        .opacity(animateIn ? 1 : 0)
    }

    private func sparkleStar(x: CGFloat, y: CGFloat, size: CGFloat, delay: Double) -> some View {
        Image(systemName: "sparkle")
            .font(.system(size: size, weight: .heavy))
            .foregroundColor(GymCircleTheme.ColorToken.rarityLegendary)
            .shadow(color: GymCircleTheme.ColorToken.rarityLegendary.opacity(0.6), radius: 8)
            .offset(x: x, y: y)
            .scaleEffect(animateIn ? 1.0 : 0.5)
            .opacity(animateIn ? 0.92 : 0)
            .animation(
                .easeInOut(duration: 1.8)
                    .repeatForever(autoreverses: true)
                    .delay(delay),
                value: animateIn
            )
    }

    // MARK: - Particles

    struct Particle: Identifiable {
        let id = UUID()
        let color: Color
        let originX: Double
        let originY: Double
        let dx: Double
        let dy: Double
        let size: Double
        let rotation: Double
    }

    /// Sprint 9.8.1 — agora aceita origem (x,y) + escala por rarity.
    static func makeBurst(
        intensity: Intensity,
        count: Int,
        originX: Double = 0.5,
        originY: Double = 0.45
    ) -> [Particle] {
        (0..<count).map { _ in
            let angle = Double.random(in: 0...(2 * .pi))
            let speed = Double.random(in: 80...260)
            return Particle(
                color: intensity.colors.randomElement() ?? .white,
                originX: originX,
                originY: originY,
                dx: cos(angle) * speed,
                dy: sin(angle) * speed - 80, // slight up bias
                size: Double.random(in: 6...14) * intensity.particleScale,
                rotation: Double.random(in: 0...360)
            )
        }
    }

    // MARK: - Haptic

    private func triggerHaptic() {
        let kind = intensity.haptic
        switch kind {
        case .success:
            let gen = UINotificationFeedbackGenerator()
            gen.notificationOccurred(.success)
        case .impactHeavy:
            let gen = UIImpactFeedbackGenerator(style: .heavy)
            gen.impactOccurred()
        case .impactMedium:
            let gen = UIImpactFeedbackGenerator(style: .medium)
            gen.impactOccurred()
        case .selection:
            let gen = UISelectionFeedbackGenerator()
            gen.selectionChanged()
        }
    }

    // MARK: - Intensity

    struct Intensity {
        let particles: Int
        let colors: [Color]
        let glowColor: Color
        let autoDismissSeconds: Double
        let haptic: HapticKind
        /// Sprint 9.8.1 — escala da partícula (common 0.7 → legendary 1.4).
        let particleScale: Double

        enum HapticKind {
            case selection, impactMedium, impactHeavy, success
        }

        static func from(rarity: AchievementRarity) -> Intensity {
            switch rarity {
            case .legendary:
                return Intensity(
                    particles: 200,
                    colors: [
                        GymCircleTheme.ColorToken.rarityLegendary,
                        Color(red: 0.96, green: 0.62, blue: 0.04),
                        Color(red: 0.99, green: 0.83, blue: 0.31),
                        .white
                    ],
                    glowColor: GymCircleTheme.ColorToken.rarityLegendary.opacity(0.42),
                    autoDismissSeconds: 6.5,
                    haptic: .success,
                    particleScale: 1.4 // Sprint 9.8.1
                )
            case .epic:
                return Intensity(
                    particles: 140,
                    colors: [
                        GymCircleTheme.ColorToken.rarityEpic,
                        Color(red: 0.77, green: 0.71, blue: 0.99),
                        Color(red: 0.55, green: 0.36, blue: 0.96),
                        .white
                    ],
                    glowColor: GymCircleTheme.ColorToken.rarityEpic.opacity(0.40),
                    autoDismissSeconds: 5.5,
                    haptic: .success, // Sprint 9.8.1 paridade web (era impactHeavy)
                    particleScale: 1.2
                )
            case .rare:
                return Intensity(
                    particles: 90,
                    colors: [
                        Color(red: 0.19, green: 0.84, blue: 1.0),
                        Color(red: 0.55, green: 0.98, blue: 1.0),
                        Color(red: 0.0, green: 0.4, blue: 1.0),
                        .white
                    ],
                    glowColor: Color(red: 0.19, green: 0.84, blue: 1.0).opacity(0.36),
                    autoDismissSeconds: 5.0,
                    haptic: .impactMedium,
                    particleScale: 1.0
                )
            case .uncommon:
                return Intensity(
                    particles: 55,
                    colors: [
                        GymCircleTheme.ColorToken.rarityUncommon,
                        Color(red: 0.65, green: 0.95, blue: 0.82),
                        Color(red: 0.06, green: 0.72, blue: 0.50),
                        .white
                    ],
                    glowColor: GymCircleTheme.ColorToken.rarityUncommon.opacity(0.32),
                    autoDismissSeconds: 4.2,
                    haptic: .impactMedium,
                    particleScale: 0.85
                )
            case .common:
                return Intensity(
                    particles: 35,
                    colors: [
                        Color(red: 0.19, green: 0.84, blue: 1.0),
                        Color(red: 0.55, green: 0.98, blue: 1.0),
                        .white
                    ],
                    glowColor: Color(red: 0.19, green: 0.84, blue: 1.0).opacity(0.28),
                    autoDismissSeconds: 3.5,
                    haptic: .selection,
                    particleScale: 0.7
                )
            }
        }
    }
}

// MARK: - Particles Canvas

private struct ParticlesCanvas: View {
    let particles: [AchievementCelebrationView.Particle]
    let animateIn: Bool

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let elapsed = timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 100)
                for p in particles {
                    let t = max(0, elapsed.truncatingRemainder(dividingBy: 3.0)) // 3s loop
                    let progress = min(1.0, t / 2.5)
                    let x = size.width * p.originX + p.dx * progress
                    let y = size.height * p.originY + p.dy * progress + 350 * progress * progress // gravity
                    let opacity = max(0, 1.0 - progress * progress * 1.6)

                    let rect = CGRect(x: x - p.size / 2, y: y - p.size / 2, width: p.size, height: p.size)
                    context.opacity = opacity
                    context.fill(Path(roundedRect: rect, cornerRadius: 2), with: .color(p.color))
                }
            }
        }
        .allowsHitTesting(false)
        .opacity(animateIn ? 1 : 0)
    }
}
