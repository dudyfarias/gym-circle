import SwiftUI

/// AchievementDetailView — Sprint 8.5 (paridade web Sprint 7.5.2 +
/// Sprint 7.5.8 raridade % até 0.01%).
///
/// Tela de detalhe Apple Fitness style apresentada quando user toca em
/// um achievement. Stats globais carregadas async via AchievementsService.
public struct AchievementDetailView: View {
    public let achievement: Achievement
    public let userRecord: UserAchievementRecord?
    public let globalStats: AchievementGlobalStats?
    public let onClose: () -> Void

    @State private var animateIn = false

    public init(
        achievement: Achievement,
        userRecord: UserAchievementRecord? = nil,
        globalStats: AchievementGlobalStats? = nil,
        onClose: @escaping () -> Void
    ) {
        self.achievement = achievement
        self.userRecord = userRecord
        self.globalStats = globalStats
        self.onClose = onClose
    }

    public var body: some View {
        accessibleBody
            .accessibilityAddTraits(.isModal)
            .accessibilityLabel(Text("\(achievement.label) — \(achievement.description)"))
    }

    private var accessibleBody: some View {
        ZStack(alignment: .top) {
            backgroundLayer

            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 60)

                    artworkLayer
                        .padding(.vertical, 16)

                    // Sprint 9.8.2 — stagger 0/80/160ms paridade web (era 200/300/400)
                    Text(eyebrowText)
                        .font(.system(size: 12, weight: .heavy))
                        .tracking(2.0)
                        .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
                        .opacity(animateIn ? 1 : 0)
                        .animation(.easeOut(duration: 0.5), value: animateIn)

                    Text(displayLabel)
                        .font(.system(size: 28, weight: .black))
                        .tracking(-0.5)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .opacity(animateIn ? 1 : 0)
                        .offset(y: animateIn ? 0 : 12)
                        .animation(.easeOut(duration: 0.5).delay(0.08), value: animateIn)

                    Text(displayDescription)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .opacity(animateIn ? 1 : 0)
                        .offset(y: animateIn ? 0 : 12)
                        .animation(.easeOut(duration: 0.5).delay(0.16), value: animateIn)

                    if let progress = achievement.progress, !achievement.earned, !achievement.isMysterySecret {
                        progressBlock(progress: progress)
                            .padding(.top, 12)
                    }

                    if achievement.earned, !achievement.isMysterySecret, userRecord != nil {
                        statsCard
                            .padding(.top, 16)
                    }

                    rarityBlock
                        .padding(.top, 12)

                    if !achievement.earned, !achievement.isMysterySecret {
                        unlockHintBlock
                            .padding(.top, 16)
                    }

                    Spacer(minLength: 80)
                }
                .padding(.horizontal, 20)
            }

            closeButton
        }
        .onAppear {
            // Sprint 9.6.2 — paridade web simulateHaptic("brand") on mount.
            Haptics.selection()
            withAnimation { animateIn = true }
        }
    }

    // MARK: - Background

    private var backgroundLayer: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Spotlight radial
            RadialGradient(
                gradient: Gradient(colors: [
                    spotlightColor,
                    Color.clear
                ]),
                center: UnitPoint(x: 0.5, y: 0.38),
                startRadius: 0,
                endRadius: 320
            )
            .ignoresSafeArea()
            .opacity(animateIn ? 1 : 0)
            .animation(.easeOut(duration: 0.7), value: animateIn)
        }
    }

    private var spotlightColor: Color {
        // Sprint 9.6.3 — usa tokens GymCircleTheme.
        switch achievement.rarity ?? .common {
        case .legendary: return GymCircleTheme.ColorToken.rarityLegendary.opacity(0.32)
        case .epic:      return GymCircleTheme.ColorToken.rarityEpic.opacity(0.32)
        case .rare:      return GymCircleTheme.ColorToken.electricBlue.opacity(0.32)
        case .uncommon:  return GymCircleTheme.ColorToken.rarityUncommon.opacity(0.28)
        case .common:    return GymCircleTheme.ColorToken.electricBlue.opacity(0.22)
        }
    }

    // MARK: - Artwork (Sprint 8.12.2 — locked state)

    private var artworkLayer: some View {
        ZStack {
            // Glow ring (só pra earned, paridade web)
            Circle()
                .fill(spotlightColor)
                .frame(width: 220, height: 220)
                .blur(radius: 40)
                .opacity(animateIn && achievement.earned ? 1 : 0)
                .animation(.easeOut(duration: 0.8), value: animateIn)

            // Icon
            if achievement.isMysterySecret {
                Image(systemName: "questionmark")
                    .font(.system(size: 80, weight: .heavy))
                    .foregroundColor(.white.opacity(0.4))
            } else if !achievement.earned {
                // Locked: ícone dim+blur com Lock overlay flutuante.
                // Paridade ArtworkPlaceholder.locked em AchievementDetailOverlay.tsx
                ZStack {
                    BadgeIconNativeView(
                        iconKey: achievement.iconKey,
                        earned: false,
                        size: 140
                    )
                    .opacity(0.32)
                    .blur(radius: 2)

                    // Lock pill central com glass effect
                    Image(systemName: "lock.fill")
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundColor(.white.opacity(0.72))
                        .frame(width: 56, height: 56)
                        .background(
                            Circle()
                                .fill(Color.white.opacity(0.08))
                                .background(.ultraThinMaterial, in: Circle())
                        )
                        .shadow(color: .black.opacity(0.5), radius: 12, y: 4)
                }
            } else {
                BadgeIconNativeView(
                    iconKey: achievement.iconKey,
                    earned: true,
                    size: 140
                )
            }
        }
        .scaleEffect(animateIn ? 1.0 : 0.5)
        .animation(.spring(response: 0.6, dampingFraction: 0.65, blendDuration: 0.4), value: animateIn)
    }

    // MARK: - Progress

    private func progressBlock(progress: AchievementProgress) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(L10n.detailProgresso.string)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.0)
                    .foregroundColor(.white.opacity(0.44))
                Spacer()
                Text("\(progress.current)/\(progress.target)")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundColor(.white)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.06))
                    Capsule()
                        .fill(LinearGradient(
                            colors: [
                                Color(red: 0.55, green: 0.98, blue: 1.0),
                                Color(red: 0.0, green: 0.4, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ))
                        .frame(width: proxy.size.width * progress.percent)
                }
            }
            .frame(height: 8)
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Stats card

    private var statsCard: some View {
        VStack(spacing: 0) {
            if let record = userRecord {
                if let earned = formatDate(record.earnedAt) {
                    statRow(label: L10n.detailConquistado.string, value: earned)
                }
                if record.count > 1, let lastEarned = formatDate(record.lastEarnedAt) {
                    Divider().background(Color.white.opacity(0.06))
                    statRow(label: L10n.myCircleTotal.string, value: L10n.detailTotalVezes(record.count).string)
                    Divider().background(Color.white.opacity(0.06))
                    statRow(label: L10n.detailUltimaVez.string, value: lastEarned)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.035))
        )
        .padding(.horizontal, 16)
    }

    private func statRow(label: String, value: String) -> some View {
        HStack {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.44))
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .heavy))
                .foregroundColor(.white)
        }
        .padding(.vertical, 8)
    }

    private func formatDate(_ date: Date) -> String? {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = .current
        return formatter.string(from: date)
    }

    // MARK: - Rarity block

    @ViewBuilder
    private var rarityBlock: some View {
        if achievement.isMysterySecret {
            EmptyView()
        } else if let globalStats {
            if globalStats.earnedCount == 0 {
                Text(L10n.detailNinguemConquistou.string)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.56))
            } else if globalStats.earnedCount == 1 && achievement.earned {
                Text(L10n.detailVoceEhPrimeiro.string)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
            } else if let formatted = AchievementRarityFormatter.format(globalStats.percent) {
                Text(L10n.detailApenasPercent(formatted).string)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.56))
            } else if let rarity = achievement.rarity {
                rarityChip(rarity)
            }
        } else if let rarity = achievement.rarity {
            rarityChip(rarity)
        }
    }

    private func rarityChip(_ rarity: AchievementRarity) -> some View {
        // Sprint 9.6.3 — tokens centralizados.
        let (label, color): (String, Color) = {
            switch rarity {
            case .common:    return (L10n.rarityComum.string, Color.white.opacity(0.82))
            case .uncommon:  return (L10n.rarityIncomum.string, GymCircleTheme.ColorToken.rarityUncommon)
            case .rare:      return (L10n.rarityRaro.string, GymCircleTheme.ColorToken.electricBlue)
            case .epic:      return (L10n.rarityEpico.string, GymCircleTheme.ColorToken.rarityEpic)
            case .legendary: return (L10n.rarityLendario.string, GymCircleTheme.ColorToken.rarityLegendary)
            }
        }()
        return Text(label.uppercased())
            .font(.system(size: 11, weight: .heavy))
            .tracking(0.6)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(Capsule().fill(color.opacity(0.16)))
            .foregroundColor(color)
    }

    // MARK: - Unlock hint (Sprint 8.12.2)

    /// Bloco "Como desbloquear" — mostra hint visual + descrição completa.
    /// Aparece só pra achievements não-earned e não-secret. Paridade web
    /// "Como desbloquear" em AchievementDetailOverlay.tsx.
    private var unlockHintBlock: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 14, weight: .heavy))
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color.white.opacity(0.06)))
                .foregroundColor(.white.opacity(0.56))

            Text(achievement.description)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundColor(.white.opacity(0.72))
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Helpers

    private var displayLabel: String {
        achievement.isMysterySecret ? "???" : achievement.label
    }

    private var displayDescription: String {
        achievement.isMysterySecret
            ? "Descubra como desbloquear esta conquista secreta."
            : achievement.description
    }

    private var eyebrowText: String {
        achievement.earned ? L10n.detailVoceDesbloqueou.string : L10n.detailEmProgresso.string
    }

    private var closeButton: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .heavy))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white)
            }
            .accessibilityLabel(Text("Voltar")) // Sprint 9.6.1
            .padding(.leading, 16)
            .padding(.top, 16)

            Spacer()
        }
    }
}

#if DEBUG
struct AchievementDetailView_Previews: PreviewProvider {
    static var previews: some View {
        let earned = Achievement(
            kind: .relic,
            achievementId: "unbreakable",
            label: "Inquebrável",
            description: "Treinou 100 dias consecutivos. Conquista lendária.",
            earned: true,
            iconKey: .flame,
            rarity: .legendary
        )
        return AchievementDetailView(achievement: earned, onClose: {})
            .preferredColorScheme(.dark)
    }
}
#endif
