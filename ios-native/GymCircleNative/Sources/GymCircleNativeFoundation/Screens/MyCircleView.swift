import SwiftUI

/// MyCircleView — Sprint 8.2 (paridade web Sprint 7.5).
///
/// Surface principal de progresso + gamification, nativa via SwiftUI.
/// Apresentada via Capacitor Plugin Bridge (Sprint 8.1) ou standalone
/// pelo MainTabView. Sprint 8.3 conecta com API real — por ora consome
/// `MyCircleViewData` que pode vir de `.demo()` ou estado app.
///
/// Estrutura (top → bottom):
///   A. Header — rings + nome + chip nível + chip streak
///   B. Resumo — grid 2x3 com contagens
///   C. Consistência — week/month/year com mini-progress bars
///   D. Calendário mensal — grid 7-col com dias treinados
///   E. Níveis — 4 chips (Iniciante/Consistente/Elite/Lendário)
///   F. Badge highlight — card único + counter "X de Y"
///   G. Monthly Challenges — 4 desafios com progress (Sprint 7.5.6+10)
///   H. Monthly Recap CTA — placeholder (Sprint 8.x)
public struct MyCircleView: View {
    public let data: MyCircleViewData
    public let onClose: (() -> Void)?
    public let onTapBadgeHighlight: (() -> Void)?
    public let onTapChallenge: ((MonthlyChallenge) -> Void)?
    public let onTapRecap: (() -> Void)?
    /// Sprint 9.5.3 — sub-CTA "Outro período" aciona caller pra abrir
    /// RecapPeriodPickerSheet (escolher mês/ano histórico). Quando nil,
    /// botão não aparece (back-compat).
    public let onTapPickPeriod: (() -> Void)?
    /// Sprint 8.11.3 — recebe offset de mês (-1, 0, +1...) pra recarregar
    /// `data.calendarDays`. Quando nil, chevrons não aparecem (back-compat).
    public let onChangeMonth: ((Int) -> Void)?
    /// Sprint 19 — loader do ranking da Competição (escopo × período). Quando
    /// nil, a seção mostra o placeholder "Em breve" (back-compat / demo).
    public let onLoadRanking: ((RankingScope, RankingPeriod) async -> [CircleRankingRow])?

    /// Sprint 8.11.3 — offset atual do mês exibido no calendar. 0 = hoje.
    @State private var calendarMonthOffset: Int = 0

    /// Sprint 8.12.5 — visibilidade do banner contextual da primeira visita.
    /// Inicializa lendo UserDefaults (cross-session persist), e o dismiss
    /// escreve a flag pra não voltar.
    @State private var firstVisitHintVisible: Bool = false

    /// Sprint 20.1 — Hall da Fama apresentado pelo botão da row de
    /// Conquistas em destaque (antes o AchievementsView era inalcançável
    /// no standalone). Detail aninhado via item-sheet.
    @State private var hallPresented: Bool = false
    @State private var hallDetailAchievement: Achievement?

    public init(
        data: MyCircleViewData,
        onClose: (() -> Void)? = nil,
        onTapBadgeHighlight: (() -> Void)? = nil,
        onTapChallenge: ((MonthlyChallenge) -> Void)? = nil,
        onTapRecap: (() -> Void)? = nil,
        onTapPickPeriod: (() -> Void)? = nil,
        onChangeMonth: ((Int) -> Void)? = nil,
        onLoadRanking: ((RankingScope, RankingPeriod) async -> [CircleRankingRow])? = nil
    ) {
        self.data = data
        self.onClose = onClose
        self.onTapBadgeHighlight = onTapBadgeHighlight
        self.onTapChallenge = onTapChallenge
        self.onTapRecap = onTapRecap
        self.onTapPickPeriod = onTapPickPeriod
        self.onChangeMonth = onChangeMonth
        self.onLoadRanking = onLoadRanking
    }

    public var body: some View {
        accessibleBody
            .accessibilityAddTraits(.isModal) // Sprint 9.6.1
    }

    private var accessibleBody: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    if firstVisitHintVisible && data.isOwn && data.canSeeDetails {
                        firstVisitHintBanner
                    }
                    headerSection
                    if !data.canSeeDetails {
                        // Sprint 8.12.4 — perfil privado sem follow aprovado:
                        // Header já mostra avatar/nome/level/streak públicos,
                        // resto fica trancado.
                        privacyLockNotice
                    } else {
                        summaryGrid
                        consistencySection
                        calendarSection
                        levelsSection
                        // Sprint 20.1 — paridade 15.5 web: a MESMA row de
                        // Conquistas em destaque do perfil, com botão pill
                        // que abre o Hall da Fama (sempre visível no own,
                        // mesmo sem conquistas — a entrada nunca some).
                        if data.isOwn {
                            featuredAchievementsSection
                        }
                        if data.isOwn, !data.monthlyChallenges.isEmpty {
                            monthlyChallengesSection
                        }
                        if data.isOwn {
                            recapCTASection
                            competitionSection
                        }
                    }
                    Spacer(minLength: 32)
                }
                .padding(.horizontal, 20)
                .padding(.top, 80) // Espaço pra close button overlay
                .padding(.bottom, 24)
            }

            if let onClose {
                closeButtonOverlay(action: onClose)
            }
        }
        .onAppear {
            // Sprint 8.12.5 — checa UserDefaults pra primeira visita do hub.
            // Persist é por user (avoid mostrar pra outro user logado depois).
            firstVisitHintVisible = data.isOwn
                && data.canSeeDetails
                && !UserDefaults.standard.bool(forKey: firstVisitHintKey)
        }
    }

    // MARK: - First-visit hint (Sprint 8.12.5)

    private var firstVisitHintKey: String {
        "gymcircle.myCircle.firstVisitHint.seen.\(data.userId)"
    }

    /// Banner contextual mostrado UMA VEZ pra dono do MyCircle. Explica os
    /// 3 pilares (rings, badges, calendar). Tap "Entendi" persiste cross-session.
    private var firstVisitHintBanner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .heavy))
                .frame(width: 28, height: 28)
                .background(Circle().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.18)))
                .foregroundColor(GymCircleTheme.ColorToken.electricBlue)

            VStack(alignment: .leading, spacing: 8) {
                Text(L10n.myCircleFirstVisitHint.string)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundColor(.white.opacity(0.86))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: dismissFirstVisitHint) {
                    Text(L10n.myCircleFirstVisitDismiss.string)
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.4)
                        .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
                }
                .buttonStyle(PressableButtonStyle())
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(GymCircleTheme.ColorToken.electricBlue.opacity(0.24), lineWidth: 1)
                )
        )
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    private func dismissFirstVisitHint() {
        Haptics.selection()
        UserDefaults.standard.set(true, forKey: firstVisitHintKey)
        withAnimation(.easeOut(duration: 0.24)) {
            firstVisitHintVisible = false
        }
    }

    // MARK: - A. Header

    private var headerSection: some View {
        VStack(spacing: 12) {
            // Paridade web: o header do hub usa a foto no centro dos anéis
            // (AvatarConsistencyRings), não o número — o número de treinos vive
            // no summaryGrid (B) e na explicação de consistência (C).
            AvatarConsistencyRings(
                rings: ConsistencyRings(
                    workoutsThisWeek: data.stats.workoutsThisWeek,
                    workoutsThisMonth: data.stats.workoutsThisMonth,
                    workoutsThisYear: data.stats.workoutsThisYear
                ),
                avatarURL: data.avatarURL?.absoluteString,
                fallback: data.username,
                size: 130, // paridade web (AvatarConsistencyRings size=130)
                hasStory: data.hasStory,
                storyViewed: data.storyViewed
            )

            VStack(spacing: 4) {
                GCText(data.displayName, style: .title, color: GymCircleTheme.ColorToken.primaryText)
                GCText("@\(data.username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }

            HStack(spacing: 8) {
                streakBadge
                levelBadge
            }
        }
    }

    // Sprint 9.8.3 — pulse anim quando isLit (treinou hoje).
    @State private var flameAnimating: Bool = false

    private var streakBadge: some View {
        let isLit = data.streakLitToday
        return HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .font(.system(size: 12, weight: .heavy))
                .scaleEffect(isLit && flameAnimating ? 1.18 : 1.0)
                .animation(
                    isLit
                    ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true)
                    : .default,
                    value: flameAnimating
                )
            Text("\(data.stats.currentStreak) \(L10n.streakDays.string)")
                .font(.system(size: 12, weight: .heavy))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(
            isLit
            ? Color(red: 1.0, green: 0.6, blue: 0.28).opacity(0.18) // orange glow
            : GymCircleTheme.ColorToken.electricBlue.opacity(0.16)
        ))
        .foregroundColor(
            isLit
            ? Color(red: 1.0, green: 0.6, blue: 0.28)
            : GymCircleTheme.ColorToken.electricBlue
        )
        .onAppear {
            if isLit { flameAnimating = true }
        }
    }

    private var levelBadge: some View {
        Text(data.currentLevel.shortLabel.uppercased())
            .font(.system(size: 10, weight: .heavy))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color.white.opacity(0.06)))
            .foregroundColor(GymCircleTheme.ColorToken.primaryText.opacity(0.82))
    }

    // MARK: - B. Summary Grid 2x3

    private var summaryGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
            spacing: 8
        ) {
            SummaryStatCardView(label: L10n.myCircleStreakAtual.string, value: "\(data.stats.currentStreak)d")
            SummaryStatCardView(label: L10n.myCircleMaiorStreak.string, value: "\(data.stats.bestStreak)d")
            SummaryStatCardView(label: L10n.myCircleTreinosMes.string, value: "\(data.stats.workoutsThisMonth)")
            SummaryStatCardView(label: L10n.myCircleDiasAno.string, value: "\(data.stats.workoutsThisYear)")
            // Paridade web: cards Posts + Restauradores (era Conquistas/Total).
            SummaryStatCardView(label: Loc.t("Posts", "Posts"), value: "\(data.postsCount)")
            SummaryStatCardView(label: Loc.t("Restores", "Restauradores"), value: "\(data.streakRestoresAvailable)")
        }
    }

    // MARK: - C. Consistência

    private var consistencySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(L10n.myCircleSuaConsistencia.string)

            VStack(spacing: 14) {
                RingProgressRowView(
                    label: L10n.myCircleSemana.string,
                    value: "\(data.stats.workoutsThisWeek)/7",
                    progressPercent: Double(data.stats.workoutsThisWeek) / 7.0,
                    color: GymCircleTheme.ColorToken.cyan
                )
                RingProgressRowView(
                    label: L10n.myCircleMes.string,
                    value: "\(data.stats.workoutsThisMonth)",
                    progressPercent: Double(data.stats.workoutsThisMonth) / 30.0,
                    color: GymCircleTheme.ColorToken.electricBlue
                )
                RingProgressRowView(
                    label: L10n.myCircleAno.string,
                    value: "\(data.stats.workoutsThisYear)",
                    progressPercent: Double(data.stats.workoutsThisYear) / 365.0,
                    color: GymCircleTheme.ColorToken.deepBlue
                )
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.035))
            )
        }
    }

    // MARK: - D. Calendar (Sprint 8.11.3 — navegação ← →)

    private var calendarSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionTitle(L10n.myCircleCalendarioMes.string)
                Spacer()
                if onChangeMonth != nil {
                    calendarMonthNav
                }
            }
            MonthlyCalendarGridView(days: data.calendarDays, todayKey: todayKey)
        }
    }

    private var calendarMonthNav: some View {
        HStack(spacing: 8) {
            Button(action: { changeMonth(by: -1) }) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 12, weight: .heavy))
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white.opacity(0.72))
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text(L10n.calendarPrevMonth.string))

            Text(currentMonthLabel)
                .font(.system(size: 12, weight: .heavy))
                .foregroundColor(.white)
                .frame(minWidth: 96)

            Button(action: { changeMonth(by: 1) }) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .heavy))
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(calendarMonthOffset >= 0 ? .white.opacity(0.32) : .white.opacity(0.72))
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(calendarMonthOffset >= 0) // não navega pra futuro
            .accessibilityLabel(Text(L10n.calendarNextMonth.string))
        }
    }

    /// Re-renderiza label do mês baseado no offset corrente.
    private var currentMonthLabel: String {
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "America/Sao_Paulo") {
            calendar.timeZone = tz
        }
        let target = calendar.date(byAdding: .month, value: calendarMonthOffset, to: .now) ?? .now
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = .current
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: target).capitalized
    }

    private func changeMonth(by delta: Int) {
        let newOffset = calendarMonthOffset + delta
        guard newOffset <= 0 else { return } // sem futuro
        // Sprint 9.6.2 — paridade web simulateHaptic("brand").
        Haptics.selection()
        calendarMonthOffset = newOffset
        onChangeMonth?(newOffset)
    }

    private var todayKey: String {
        let formatter = ISO8601DateFormatter()
        return String(formatter.string(from: .now).prefix(10))
    }

    // MARK: - E. Levels

    private var levelsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(L10n.myCircleNiveis.string)

            VStack(spacing: 8) {
                ForEach(data.allLevels) { level in
                    LevelChipView(
                        level: level,
                        isCurrent: level.id == data.currentLevel.id,
                        isPast: data.stats.currentStreak >= level.minDays
                    )
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.035))
            )
        }
    }

    // MARK: - F. Conquistas em destaque (Sprint 20.1 — paridade 15.5 web)
    //
    // Substitui o badgeHighlightSection da 5.9 (BadgeHighlightCardView),
    // igual ao que a web fez na 15.5. O botão pill do header apresenta o
    // AchievementsView (Hall) — primeira porta de entrada do Hall no
    // standalone. onTapBadgeHighlight (bridge legado) continua atendido:
    // tap num card chama o detail nativo direto.

    @ViewBuilder
    private var featuredAchievementsSection: some View {
        FeaturedAchievementsRowView(
            achievements: data.featuredAchievements,
            onOpenDetail: { achievement in
                hallDetailAchievement = achievement
            },
            onOpenHall: { hallPresented = true }
        )
        .sheet(isPresented: $hallPresented) {
            // Detail ANINHADO no conteúdo do Hall: um view só apresenta
            // um sheet por vez, então o tap dentro do Hall precisa
            // apresentar a partir do próprio AchievementsView.
            AchievementsView(
                achievements: data.allAchievements,
                onTap: { achievement in
                    hallDetailAchievement = achievement
                },
                onClose: { hallPresented = false }
            )
            .sheet(item: $hallDetailAchievement) { achievement in
                achievementDetailSheet(achievement)
            }
        }
        // Tap direto num card da row (Hall fechado) apresenta daqui.
        .sheet(item: $hallDetailAchievement) { achievement in
            achievementDetailSheet(achievement)
        }
    }

    @ViewBuilder
    private func achievementDetailSheet(_ achievement: Achievement) -> some View {
        AchievementDetailView(
            achievement: achievement,
            onClose: { hallDetailAchievement = nil }
        )
    }

    // MARK: - G. Monthly Challenges

    private var monthlyChallengesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(L10n.myCircleDesafiosMes.string)

            VStack(spacing: 8) {
                ForEach(data.monthlyChallenges) { challenge in
                    Button(action: { onTapChallenge?(challenge) }) {
                        MonthlyChallengeRowView(challenge: challenge)
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
        }
    }

    // MARK: - H. Recap CTA

    // Sprint 9.5.3 — recap CTA agora é VStack: CTA principal + sub-CTA "Outro período"
    @ViewBuilder
    private var recapCTASection: some View {
        VStack(spacing: 8) {
            recapCTAPrimary
            if onTapPickPeriod != nil {
                recapCTASecondary
            }
        }
    }

    private var recapCTAPrimary: some View {
        Button(action: { onTapRecap?() }) {
            HStack(spacing: 12) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(
                        Circle().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.14))
                    )
                    .foregroundColor(GymCircleTheme.ColorToken.electricBlue)

                VStack(alignment: .leading, spacing: 4) {
                    GCText(L10n.myCircleCompartilharResumoMes(currentMonthShortLabel).string, style: .body, color: GymCircleTheme.ColorToken.primaryText)
                    GCText(L10n.myCircleEscolheFoto.string, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.42))
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                GymCircleTheme.ColorToken.electricBlue.opacity(0.08),
                                Color.white.opacity(0.02),
                                Color.clear
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    /// Sprint 9.5.3 — sub-CTA "Outro período" abre RecapPeriodPickerSheet.
    /// Paridade web Sprint 5.10 (CTA secundário abaixo do principal).
    private var recapCTASecondary: some View {
        Button(action: { onTapPickPeriod?() }) {
            HStack {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 12, weight: .heavy))
                Text(L10n.myCircleOutroPeriodo.string)
                    .font(.system(size: 12, weight: .heavy))
                    .tracking(0.4)
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.system(size: 11, weight: .heavy))
                    .opacity(0.62)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Privacy lock (Sprint 8.12.4, paridade canSeeDetails web)

    /// Card centralizado com Lock icon + título + corpo. Mostrado quando
    /// `data.canSeeDetails == false` (perfil privado sem follow aprovado).
    private var privacyLockNotice: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 22, weight: .heavy))
                .frame(width: 56, height: 56)
                .background(
                    Circle().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.14))
                )
                .foregroundColor(GymCircleTheme.ColorToken.electricBlue)

            Text(L10n.myCirclePrivacyTitle.string)
                .font(.system(size: 16, weight: .heavy))
                .foregroundColor(.white)

            Text(L10n.myCirclePrivacyBody.string)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundColor(.white.opacity(0.56))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    // MARK: - I. Competição (Sprint 19 — ranking real; placeholder se sem loader)

    @ViewBuilder
    private var competitionSection: some View {
        if let onLoadRanking {
            CompetitionSectionView(currentUserId: data.userId, onLoad: onLoadRanking)
        } else {
            competitionPlaceholderSection
        }
    }

    private var competitionPlaceholderSection: some View {
        VStack(spacing: 10) {
            Image(systemName: "trophy")
                .font(.system(size: 26, weight: .regular))
                .foregroundColor(.white.opacity(0.32))

            Text("\(L10n.myCircleCompeticao.string) · \(L10n.myCircleEmBreve.string)")
                .font(.system(size: 14, weight: .heavy))
                .foregroundColor(.white)

            Text(L10n.myCircleCompeticaoDescricao.string)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white.opacity(0.52))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(
                    Color.white.opacity(0.08),
                    style: StrokeStyle(lineWidth: 1, dash: [4, 4])
                )
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Color.white.opacity(0.02))
                )
        )
    }

    /// Mês corrente abreviado em locale ativo. Usado pelo Recap CTA pra
    /// trocar "Compartilhar resumo" → "Compartilhar resumo de maio".
    private var currentMonthShortLabel: String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "LLLL"
        return formatter.string(from: .now)
    }

    // MARK: - Helpers

    private func sectionTitle(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 13, weight: .heavy))
            .tracking(0.6)
            .foregroundColor(GymCircleTheme.ColorToken.secondaryText.opacity(0.7))
    }

    private func closeButtonOverlay(action: @escaping () -> Void) -> some View {
        HStack {
            Spacer()
            Button(action: action) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.08)))
                    .foregroundColor(.white)
            }
            .padding(.top, 16)
            .padding(.trailing, 20)
        }
    }
}

#if DEBUG
struct MyCircleView_Previews: PreviewProvider {
    static var previews: some View {
        MyCircleView(
            data: MyCircleViewData.demo(userId: "u1", isOwn: true),
            onClose: {},
            onTapBadgeHighlight: {},
            onTapChallenge: { _ in },
            onTapRecap: {}
        )
        .preferredColorScheme(.dark)
    }
}
#endif
