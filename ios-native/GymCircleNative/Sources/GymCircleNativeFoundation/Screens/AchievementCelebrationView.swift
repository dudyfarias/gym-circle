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
        ZStack {
            // Backdrop
            Color.black.opacity(0.72).ignoresSafeArea()

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
            // Particles burst depois de 200ms
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                particles = Self.makeBurst(intensity: intensity, count: intensity.particles)
            }
            // Auto-dismiss
            DispatchQueue.main.asyncAfter(deadline: .now() + intensity.autoDismissSeconds) {
                onDismiss()
            }
        }
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

    static func makeBurst(intensity: Intensity, count: Int) -> [Particle] {
        (0..<count).map { _ in
            let angle = Double.random(in: 0...(2 * .pi))
            let speed = Double.random(in: 80...260)
            return Particle(
                color: intensity.colors.randomElement() ?? .white,
                originX: 0.5,
                originY: 0.45,
                dx: cos(angle) * speed,
                dy: sin(angle) * speed - 80, // slight up bias
                size: Double.random(in: 6...14),
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

        enum HapticKind {
            case selection, impactMedium, impactHeavy, success
        }

        static func from(rarity: AchievementRarity) -> Intensity {
            switch rarity {
            case .legendary:
                return Intensity(
                    particles: 200,
                    colors: [
                        Color(red: 0.98, green: 0.75, blue: 0.14),
                        Color(red: 0.96, green: 0.62, blue: 0.04),
                        Color(red: 0.99, green: 0.83, blue: 0.31),
                        .white
                    ],
                    glowColor: Color(red: 0.98, green: 0.75, blue: 0.14).opacity(0.42),
                    autoDismissSeconds: 6.5,
                    haptic: .success
                )
            case .epic:
                return Intensity(
                    particles: 140,
                    colors: [
                        Color(red: 0.66, green: 0.55, blue: 0.98),
                        Color(red: 0.77, green: 0.71, blue: 0.99),
                        Color(red: 0.55, green: 0.36, blue: 0.96),
                        .white
                    ],
                    glowColor: Color(red: 0.66, green: 0.55, blue: 0.98).opacity(0.40),
                    autoDismissSeconds: 5.5,
                    haptic: .impactHeavy
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
                    haptic: .impactMedium
                )
            case .uncommon:
                return Intensity(
                    particles: 55,
                    colors: [
                        Color(red: 0.20, green: 0.83, blue: 0.60),
                        Color(red: 0.65, green: 0.95, blue: 0.82),
                        Color(red: 0.06, green: 0.72, blue: 0.50),
                        .white
                    ],
                    glowColor: Color(red: 0.20, green: 0.83, blue: 0.60).opacity(0.32),
                    autoDismissSeconds: 4.2,
                    haptic: .impactMedium
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
                    haptic: .selection
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
