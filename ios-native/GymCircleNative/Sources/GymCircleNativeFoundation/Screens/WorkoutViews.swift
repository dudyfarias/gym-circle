import SwiftUI

/// Hub do "+" central (paridade CreateHubSheet web): Iniciar treino em
/// destaque + Postar treino / Check-in no grid. A tab central deixa de abrir
/// o composer direto — tudo que "cria" mora aqui.
public struct CreateHubSheet: View {
    private let onStartWorkout: () -> Void
    private let onPostWorkout: () -> Void
    private let onCheckIn: () -> Void
    private let onImportHealth: (() -> Void)?

    public init(
        onStartWorkout: @escaping () -> Void,
        onPostWorkout: @escaping () -> Void,
        onCheckIn: @escaping () -> Void,
        onImportHealth: (() -> Void)? = nil
    ) {
        self.onStartWorkout = onStartWorkout
        self.onPostWorkout = onPostWorkout
        self.onCheckIn = onCheckIn
        self.onImportHealth = onImportHealth
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(Loc.t("Create", "Criar"))
                    .font(.system(size: 11, weight: .black))
                    .textCase(.uppercase)
                    .tracking(1.4)
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                Text(Loc.t("What do you want to log?", "O que você quer registrar?"))
                    .font(.system(size: 23, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            }

            // Destaque: iniciar treino (cronômetro + descanso + Saúde).
            Button {
                Haptics.impactLight()
                onStartWorkout()
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "timer")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.black)
                        .frame(width: 52, height: 52)
                        .background(
                            RoundedRectangle(cornerRadius: 17, style: .continuous)
                                .fill(GymCircleTheme.ColorToken.cyan)
                        )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(Loc.t("Start workout", "Iniciar treino"))
                            .font(.system(size: 17, weight: .black))
                            .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        Text(Loc.t(
                            "Timer, rest and Apple Health",
                            "Cronômetro, descanso e Apple Saúde"
                        ))
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.5))
                    }
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.black)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(GymCircleTheme.ColorToken.cyan))
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan.opacity(0.09))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.28), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            HStack(spacing: 12) {
                hubGridCard(
                    icon: "camera.fill",
                    title: Loc.t("Post workout", "Postar treino"),
                    detail: Loc.t("Photos, caption and tags", "Fotos, legenda e tags"),
                    action: onPostWorkout
                )
                hubGridCard(
                    icon: "mappin.and.ellipse",
                    title: Loc.t("Check-in", "Check-in"),
                    detail: Loc.t("Mark today at your gym", "Marca o dia na academia"),
                    action: onCheckIn
                )
            }

            // Treinos que já vivem no Saúde (Strava, Nike…) viram entrada.
            if let onImportHealth {
                Button {
                    Haptics.impactLight()
                    onImportHealth()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "heart.text.square.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.pink)
                        Text(Loc.t(
                            "Import from Apple Health",
                            "Importar do Apple Saúde"
                        ))
                        .font(.system(size: 13.5, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.82))
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(Color.white.opacity(0.4))
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(Color.white.opacity(0.03))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.07), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
    }

    private func hubGridCard(
        icon: String,
        title: String,
        detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            Haptics.impactLight()
            action()
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.88))
                    .frame(width: 40, height: 40)
                    .background(
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .fill(Color.white.opacity(0.07))
                    )
                Spacer(minLength: 14)
                Text(title)
                    .font(.system(size: 15, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                Text(detail)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.44))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 126, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color.white.opacity(0.035))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

/// Fluxo "Iniciar treino" nativo (paridade WebWorkoutScreen): seletor de tipo
/// estilo Apple Watch → treino ao vivo (cronômetro + timer de descanso) →
/// encerrar grava a activity (Supabase + Apple Saúde) e abre o composer —
/// o treino vira ENTRADA no feed mesmo sem foto.
public struct NativeWorkoutFlowView: View {
    @ObservedObject private var model: GymCircleAppModel
    private let onCompose: (ActivityComposerContext) -> Void
    private let onClose: () -> Void

    private enum Stage { case pick, live }
    @State private var stage: Stage = .pick
    @State private var kind: WorkoutActivityKind = .strength
    @State private var startedAt: Date?
    @State private var elapsedS = 0
    @State private var pausedAt: Date?
    @State private var pausedTotal: TimeInterval = 0
    // Timer de descanso: 1:00 por padrão, ajustável em passos de 10 s.
    @State private var restPreset = 60
    @State private var restRemaining = 60
    @State private var restRunning = false
    @State private var restJustDone = false
    @State private var finishing = false
    @State private var finishError: String?
    @State private var discardConfirm = false
    // P2 — séries de musculação (só treino de força).
    @State private var strengthSets: [WorkoutStrengthSet] = []
    @State private var setRepsDraft = ""
    @State private var setWeightDraft = ""
    // Importar treino do Apple Saúde direto do seletor (Strava/Nike/Watch).
    @State private var healthImportPresented = false
    @State private var trainingLibraryPresented = false
    // Fase 2 — GPS outdoor (corrida/caminhada/bike): rota/ritmo/elevação.
    @StateObject private var routeRecorder = WorkoutRouteRecorder()

    // Persistência anti-morte do app: o cronômetro deriva SEMPRE de startedAt.
    private static let storedStartKey = "gc.native.workout.startedAt"
    private static let storedKindKey = "gc.native.workout.kind"
    private static let storedPausedAtKey = "gc.native.workout.pausedAt"
    private static let storedPausedTotalKey = "gc.native.workout.pausedTotal"

    public init(
        model: GymCircleAppModel,
        onCompose: @escaping (ActivityComposerContext) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.model = model
        self.onCompose = onCompose
        self.onClose = onClose
    }

    public var body: some View {
        ZStack {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()
            if stage == .pick {
                pickStage
            } else {
                liveStage
            }
        }
        .onAppear(perform: resumeIfNeeded)
        .onReceive(
            Timer.publish(every: 1, on: .main, in: .common).autoconnect()
        ) { _ in
            tick()
        }
        .confirmationDialog(
            Loc.t("Discard this workout?", "Descartar esse treino?"),
            isPresented: $discardConfirm,
            titleVisibility: .visible
        ) {
            Button(Loc.t("Discard workout", "Descartar treino"), role: .destructive) {
                routeRecorder.stop()
                clearStored()
                onClose()
            }
            Button(Loc.t("Keep going", "Continuar treinando"), role: .cancel) {}
        }
        // Importar treino de outro app (Strava/Nike via Saúde) → entrada.
        .sheet(isPresented: $healthImportPresented) {
            HealthImportSheet(
                model: model,
                onImported: { context in
                    healthImportPresented = false
                    onCompose(context)
                },
                onClose: { healthImportPresented = false }
            )
        }
        .sheet(isPresented: $trainingLibraryPresented) {
            TrainingLibraryView(
                model: model,
                onStartPlan: { plan in
                    strengthSets = plan.exercises.flatMap { exercise in
                        let count = min(max(exercise.sets ?? 1, 1), 12)
                        return (0..<count).map { _ in
                            WorkoutStrengthSet(
                                reps: exercise.reps ?? 0,
                                weightKg: nil,
                                exercise: exercise.name
                            )
                        }
                    }
                    trainingLibraryPresented = false
                    start(.strength)
                }
            )
        }
    }

    // MARK: - Seletor de tipo (cards estilo Apple Watch, academia primeiro)

    private var pickStage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(Loc.t("What's the workout?", "Qual é o treino de hoje?"))
                            .font(.system(size: 25, weight: .black))
                            .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        Text(Loc.t(
                            "Pick the type — the timer starts right away.",
                            "Escolha o tipo — o cronômetro já começa a contar."
                        ))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.48))
                    }
                    Spacer()
                    Button {
                        onClose()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.82))
                            .frame(width: 38, height: 38)
                            .background(Circle().fill(Color.white.opacity(0.055)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Loc.close)
                }

                VStack(spacing: 10) {
                    ForEach(WorkoutActivityKind.allCases) { option in
                        Button {
                            start(option)
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: option.icon)
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                    .frame(width: 48, height: 48)
                                    .background(
                                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                                            .fill(GymCircleTheme.ColorToken.cyan.opacity(0.10))
                                    )
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.label)
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                                    Text(option.hint)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(Color.white.opacity(0.44))
                                }
                                Spacer()
                                Image(systemName: "play.fill")
                                    .font(.system(size: 13, weight: .black))
                                    .foregroundStyle(.black)
                                    .frame(width: 34, height: 34)
                                    .background(Circle().fill(GymCircleTheme.ColorToken.cyan))
                            }
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 22, style: .continuous)
                                    .fill(Color.white.opacity(0.035))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 22, style: .continuous)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                Button {
                    Haptics.impactLight()
                    trainingLibraryPresented = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "list.clipboard.fill")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                            .frame(width: 42, height: 42)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(GymCircleTheme.ColorToken.cyan.opacity(0.11))
                            )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Loc.t("Plans & records", "Planilhas e recordes"))
                                .font(.system(size: 14.5, weight: .black))
                                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                            Text(Loc.t(
                                "Prepare workouts and compare your best marks",
                                "Prepare treinos e compare suas melhores marcas"
                            ))
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.44))
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(Color.white.opacity(0.36))
                    }
                    .padding(14)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Color.white.opacity(0.035))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(Color.white.opacity(0.075), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                // Já treinou em outro app? Importa do Saúde sem cronometrar.
                Button {
                    Haptics.impactLight()
                    healthImportPresented = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "heart.text.square.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.pink)
                        Text(Loc.t(
                            "Import an existing workout",
                            "Importar um treino já feito"
                        ))
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.82))
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(Color.white.opacity(0.4))
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(Color.white.opacity(0.03))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.07), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
            .padding(20)
        }
    }

    // MARK: - Treino ao vivo (mesmo mostrador do web/Capacitor)

    private var liveStage: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: kind.icon)
                        .font(.system(size: 13, weight: .bold))
                    Text(kind.label)
                        .font(.system(size: 13, weight: .black))
                }
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(Color.white.opacity(0.08)))

                Spacer()

                Text(
                    isPaused
                        ? Loc.t("Paused", "Pausado")
                        : Loc.t("Active", "Ativo")
                )
                .font(.system(size: 11, weight: .black))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(
                    isPaused
                        ? Color.yellow
                        : GymCircleTheme.ColorToken.cyan
                )
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    VStack(spacing: 6) {
                        Text(Loc.t("Workout time", "Tempo de treino"))
                            .font(.system(size: 12, weight: .black))
                            .textCase(.uppercase)
                            .tracking(1.8)
                            .foregroundStyle(Color.white.opacity(0.4))
                        Text(gymCircleFormatElapsed(elapsedS))
                            .font(.system(size: 72, weight: .black, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(
                                isPaused
                                    ? Color.yellow
                                    : GymCircleTheme.ColorToken.cyan
                            )
                            .contentTransition(.numericText())
                    }
                    .padding(.top, 38)

                    summaryMetricsRow
                        .padding(.top, 30)

                    if kind.usesRoute {
                        routeMetricsRow
                            .padding(.top, 20)
                    }

                    if kind == .strength {
                        restSection
                            .padding(.top, 20)
                        strengthSetsSection
                            .padding(.top, 20)
                    }

                    if let finishError {
                        Text(finishError)
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.pink)
                            .multilineTextAlignment(.center)
                            .padding(.top, 14)
                    }
                }
                .padding(.horizontal, 20)
            }

            VStack(spacing: 8) {
                HStack(alignment: .top, spacing: 26) {
                    workoutControl(
                        icon: "stop.fill",
                        label: Loc.t("Finish", "Encerrar"),
                        color: GymCircleTheme.ColorToken.pink,
                        disabled: finishing
                    ) {
                        Task { await finish() }
                    }
                    workoutControl(
                        icon: isPaused ? "play.fill" : "pause.fill",
                        label: isPaused
                            ? Loc.t("Resume", "Retomar")
                            : Loc.t("Pause", "Pausar"),
                        color: GymCircleTheme.ColorToken.cyan,
                        iconColor: .black
                    ) {
                        togglePause()
                    }
                    workoutControl(
                        icon: "chevron.down",
                        label: Loc.t("Close", "Fechar"),
                        color: Color.white.opacity(0.09)
                    ) {
                        onClose()
                    }
                }

                Button {
                    discardConfirm = true
                } label: {
                    Text(Loc.t("Discard workout", "Descartar treino"))
                        .font(.system(size: 12.5, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.28))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
                .disabled(finishing)
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 10)
        }
    }

    private var summaryMetricsRow: some View {
        HStack(spacing: 14) {
            summaryMetric(
                label: Loc.t("Started", "Início"),
                value: startedClock
            )
            summaryMetric(
                label: Loc.t("Paused", "Pausado"),
                value: gymCircleFormatElapsed(pausedSeconds)
            )
            summaryMetric(
                label: Loc.t("Total cal.", "Cal. totais"),
                value: "—"
            )
        }
        .padding(.vertical, 18)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 1)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 1)
        }
    }

    private func summaryMetric(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 10, weight: .black))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(Color.white.opacity(0.42))
                .lineLimit(1)
            Text(value)
                .font(.system(size: 24, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func workoutControl(
        icon: String,
        label: String,
        color: Color,
        iconColor: Color = .white,
        disabled: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(color)
                        .frame(width: 68, height: 68)
                    if disabled {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: icon)
                            .font(.system(size: 21, weight: .black))
                            .foregroundStyle(iconColor)
                    }
                }
                Text(label)
                    .font(.system(size: 11.5, weight: .black))
                    .foregroundStyle(Color.white.opacity(0.68))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }

    /// Distância / Ritmo / Elevação ao vivo (GPS). Aviso quando negado.
    private var routeMetricsRow: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                routeMetric(
                    label: Loc.t("Distance", "Distância"),
                    value: gymCircleFormatKm(routeRecorder.distanceM)
                )
                routeMetric(
                    label: Loc.t("Pace", "Ritmo"),
                    value: routeRecorder.paceSecPerKm.map(gymCircleFormatPace) ?? "—"
                )
                routeMetric(
                    label: Loc.t("Elevation", "Elevação"),
                    value: "\(Int(routeRecorder.elevationGainM.rounded())) m"
                )
            }
            if routeRecorder.authorizationDenied {
                Text(Loc.t(
                    "No location access — counting time only. Allow it in Settings.",
                    "Sem acesso à localização — contando só o tempo. Libere nos Ajustes."
                ))
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.44))
                .multilineTextAlignment(.center)
            }
        }
    }

    private func routeMetric(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 10.5, weight: .black))
                .textCase(.uppercase)
                .tracking(0.8)
                .foregroundStyle(Color.white.opacity(0.4))
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.03))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    private var restSection: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "timer")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    .frame(width: 40, height: 40)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(GymCircleTheme.ColorToken.cyan.opacity(0.12))
                    )
                VStack(alignment: .leading, spacing: 1) {
                    Text(Loc.t("Rest", "Descanso"))
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    Text(Loc.t("Timer between sets", "Timer entre séries"))
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.38))
                }
                Spacer()
                if restRunning {
                    Text(Loc.t("In progress", "Em andamento"))
                        .font(.system(size: 10, weight: .black))
                        .textCase(.uppercase)
                        .tracking(1.0)
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }

            HStack(spacing: 14) {
                Button {
                    adjustRest(by: -10)
                } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 19, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.88))
                        .frame(width: 54, height: 54)
                        .background(Circle().fill(Color.white.opacity(0.06)))
                }
                .buttonStyle(.plain)
                .disabled(restPreset <= 10)
                .accessibilityLabel(Loc.t("Remove 10 seconds", "Diminuir 10 segundos"))

                Text(gymCircleFormatElapsed(restRemaining))
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(
                        restJustDone
                            ? GymCircleTheme.ColorToken.cyan
                            : GymCircleTheme.ColorToken.primaryText
                    )
                    .frame(maxWidth: .infinity)

                Button {
                    adjustRest(by: 10)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 19, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.88))
                        .frame(width: 54, height: 54)
                        .background(Circle().fill(Color.white.opacity(0.06)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Loc.t("Add 10 seconds", "Adicionar 10 segundos"))
            }

            if restRunning {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.08))
                        Capsule()
                            .fill(GymCircleTheme.ColorToken.cyan)
                            .frame(
                                width: geo.size.width
                                    * CGFloat(restRemaining) / CGFloat(max(1, restPreset))
                            )
                            .animation(.linear(duration: 0.9), value: restRemaining)
                    }
                }
                .frame(height: 6)
            }

            Button {
                if restRunning {
                    restRunning = false
                    restRemaining = restPreset
                    restJustDone = false
                } else {
                    startRest()
                }
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: restRunning ? "xmark" : "timer")
                        .font(.system(size: 15, weight: .bold))
                    Text(
                        restRunning
                            ? Loc.t("Cancel rest", "Cancelar descanso")
                            : Loc.t("Start rest", "Iniciar descanso")
                    )
                    .font(.system(size: 13, weight: .black))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(
                    restRunning
                        ? Color.white
                        : Color.black
                )
                .background(
                    Capsule().fill(
                        restRunning
                            ? Color.white.opacity(0.065)
                            : GymCircleTheme.ColorToken.cyan
                    )
                )
            }
            .buttonStyle(.plain)
            .disabled(isPaused && !restRunning)
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.white.opacity(0.03))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Lógica

    private var isPaused: Bool {
        pausedAt != nil
    }

    private var pausedSeconds: Int {
        let livePause = pausedAt.map { max(0, Date().timeIntervalSince($0)) } ?? 0
        return max(0, Int((pausedTotal + livePause).rounded()))
    }

    private var startedClock: String {
        guard let startedAt else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: startedAt)
    }

    private func resumeIfNeeded() {
        let defaults = UserDefaults.standard
        let storedStart = defaults.double(forKey: Self.storedStartKey)
        guard storedStart > 0 else { return }
        startedAt = Date(timeIntervalSince1970: storedStart)
        pausedTotal = max(0, defaults.double(forKey: Self.storedPausedTotalKey))
        let storedPausedAt = defaults.double(forKey: Self.storedPausedAtKey)
        pausedAt = storedPausedAt > 0
            ? Date(timeIntervalSince1970: storedPausedAt)
            : nil
        if let raw = defaults.string(forKey: Self.storedKindKey),
           let storedKind = WorkoutActivityKind(rawValue: raw) {
            kind = storedKind
        }
        elapsedS = currentElapsed()
        stage = .live
        // Retomada pós-kill: a rota anterior se perdeu com o processo —
        // religa o GPS e grava o trecho restante (parcial > nada).
        if kind.usesRoute, !isPaused { routeRecorder.start() }
    }

    // MARK: - Editor de séries (só treino de força)

    private var strengthSetsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(Loc.t("Sets", "Séries"))
                .font(.system(size: 11, weight: .black))
                .kerning(1.6)
                .textCase(.uppercase)
                .foregroundStyle(Color.white.opacity(0.4))
                .frame(maxWidth: .infinity, alignment: .leading)
            if !strengthSets.isEmpty {
                VStack(spacing: 6) {
                    ForEach(Array(strengthSets.enumerated()), id: \.offset) { index, set in
                        VStack(alignment: .leading, spacing: 5) {
                            if let exercise = set.exercise,
                               index == 0 || strengthSets[index - 1].exercise != exercise {
                                Text(exercise)
                                    .font(.system(size: 13.5, weight: .black))
                                    .foregroundStyle(Color.white.opacity(0.84))
                            }
                            HStack {
                                Text(Loc.t(
                                    "Set \(setNumber(at: index))",
                                    "Série \(setNumber(at: index))"
                                ))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.white.opacity(0.62))
                                Spacer()
                                Text(WorkoutDetailOverlay.setLabel(set))
                                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                                Button {
                                    strengthSets.remove(at: index)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(Color.white.opacity(0.4))
                                        .padding(.leading, 10)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(Loc.t("Remove set", "Remover série"))
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.white.opacity(0.04))
                            )
                        }
                    }
                }
            }
            HStack(spacing: 8) {
                setField(Loc.t("Reps", "Reps"), text: $setRepsDraft, keyboard: .numberPad)
                setField(Loc.t("Weight (kg)", "Carga (kg)"), text: $setWeightDraft, keyboard: .decimalPad)
                Button {
                    addStrengthSet()
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .heavy))
                        .foregroundStyle(.black)
                        .frame(width: 44, height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(GymCircleTheme.ColorToken.cyan)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Loc.t("Add set", "Adicionar série"))
                .disabled((Int(setRepsDraft) ?? 0) <= 0)
                .opacity((Int(setRepsDraft) ?? 0) <= 0 ? 0.4 : 1)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(red: 0.043, green: 0.051, blue: 0.055))
        )
    }

    private func setField(
        _ label: String,
        text: Binding<String>,
        keyboard: UIKeyboardType
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .black))
                .kerning(1.2)
                .textCase(.uppercase)
                .foregroundStyle(Color.white.opacity(0.35))
            TextField("", text: text)
                .keyboardType(keyboard)
                .font(.system(size: 15, weight: .heavy, design: .rounded))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white.opacity(0.06))
                )
        }
        .frame(maxWidth: .infinity)
    }

    private func addStrengthSet() {
        guard let reps = Int(setRepsDraft), reps > 0 else { return }
        let weight = Double(setWeightDraft.replacingOccurrences(of: ",", with: "."))
        strengthSets.append(
            WorkoutStrengthSet(
                reps: reps,
                weightKg: weight,
                exercise: strengthSets.last?.exercise
            )
        )
        setRepsDraft = ""
        setWeightDraft = ""
        Haptics.selection()
    }

    private func setNumber(at index: Int) -> Int {
        guard index > 0 else { return 1 }
        let exercise = strengthSets[index].exercise
        var count = 1
        var cursor = index - 1
        while cursor >= 0, strengthSets[cursor].exercise == exercise {
            count += 1
            cursor -= 1
        }
        return count
    }

    private func start(_ option: WorkoutActivityKind) {
        Haptics.impactLight()
        let now = Date()
        kind = option
        startedAt = now
        elapsedS = 0
        pausedAt = nil
        pausedTotal = 0
        restPreset = 60
        restRemaining = 60
        restRunning = false
        restJustDone = false
        finishError = nil
        stage = .live
        let defaults = UserDefaults.standard
        defaults.set(now.timeIntervalSince1970, forKey: Self.storedStartKey)
        defaults.set(option.rawValue, forKey: Self.storedKindKey)
        defaults.removeObject(forKey: Self.storedPausedAtKey)
        defaults.set(0, forKey: Self.storedPausedTotalKey)
        if option.usesRoute { routeRecorder.start() }
    }

    private func tick() {
        guard stage == .live else { return }
        elapsedS = currentElapsed()
        guard !isPaused else { return }
        guard restRunning else { return }
        restRemaining = max(0, restRemaining - 1)
        if restRemaining == 0 {
            restRunning = false
            restJustDone = true
            Haptics.success()
        }
    }

    private func currentElapsed() -> Int {
        guard let startedAt else { return 0 }
        let referenceDate = pausedAt ?? Date()
        let activeDuration = referenceDate.timeIntervalSince(startedAt) - pausedTotal
        return max(0, Int(activeDuration.rounded()))
    }

    private func togglePause() {
        let now = Date()
        let defaults = UserDefaults.standard
        if let pausedAt {
            pausedTotal += max(0, now.timeIntervalSince(pausedAt))
            self.pausedAt = nil
            defaults.removeObject(forKey: Self.storedPausedAtKey)
            defaults.set(pausedTotal, forKey: Self.storedPausedTotalKey)
            if kind.usesRoute { routeRecorder.resume() }
        } else {
            pausedAt = now
            defaults.set(now.timeIntervalSince1970, forKey: Self.storedPausedAtKey)
            defaults.set(pausedTotal, forKey: Self.storedPausedTotalKey)
            if kind.usesRoute { routeRecorder.pause() }
        }
        elapsedS = currentElapsed()
        Haptics.impactLight()
    }

    private func adjustRest(by delta: Int) {
        let nextPreset = min(15 * 60, max(10, restPreset + delta))
        let appliedDelta = nextPreset - restPreset
        restPreset = nextPreset
        if restRunning {
            restRemaining = min(15 * 60, max(0, restRemaining + appliedDelta))
        } else {
            restRemaining = nextPreset
            restJustDone = false
        }
        Haptics.impactLight()
    }

    private func startRest() {
        Haptics.impactLight()
        restRemaining = restPreset
        restRunning = true
        restJustDone = false
    }

    private func finish() async {
        guard let startedAt, !finishing else { return }
        finishing = true
        finishError = nil
        // Rota primeiro (para o GPS); nil = sessão indoor/sem sinal.
        let route = kind.usesRoute ? routeRecorder.stop() : nil
        let context = await model.finishNativeWorkout(
            kind: kind,
            startedAt: startedAt,
            endedAt: Date(),
            elapsedS: currentElapsed(),
            route: route,
            strengthSets: kind == .strength ? strengthSets : nil
        )
        finishing = false
        if let context {
            Haptics.success()
            clearStored()
            onCompose(context)
        } else {
            Haptics.error()
            finishError = model.error
                ?? Loc.t(
                    "Couldn't save your workout. Try again.",
                    "Não deu pra salvar o treino. Tenta de novo."
                )
        }
    }

    private func clearStored() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Self.storedStartKey)
        defaults.removeObject(forKey: Self.storedKindKey)
        defaults.removeObject(forKey: Self.storedPausedAtKey)
        defaults.removeObject(forKey: Self.storedPausedTotalKey)
        strengthSets = []
        setRepsDraft = ""
        setWeightDraft = ""
    }
}

/// "Integrar treino" — lista os treinos do mesmo dia do post que ainda podem
/// ser juntados. Selecionar vincula o treino ao post (source_activity_id): o
/// post passa a mostrar as estatísticas e o treino some do feed.
public struct IntegrateWorkoutSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    private let post: FeedPost
    private let onIntegrated: () -> Void
    private let onClose: () -> Void

    @State private var activities: [MergeableActivity] = []
    @State private var loading = true
    @State private var integratingId: String?

    public init(
        model: GymCircleAppModel,
        post: FeedPost,
        onIntegrated: @escaping () -> Void,
        onClose: @escaping () -> Void
    ) {
        self.model = model
        self.post = post
        self.onIntegrated = onIntegrated
        self.onClose = onClose
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Loc.t("Add a workout", "Integrar treino"))
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    Text(Loc.t(
                        "Pick a workout from this day. Its stats show on the post and it leaves the feed.",
                        "Escolha um treino deste dia. As estatísticas aparecem no post e o treino sai do feed."
                    ))
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.46))
                }
                Spacer()
                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.82))
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.white.opacity(0.055)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Loc.close)
            }

            if loading {
                HStack {
                    Spacer()
                    ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                    Spacer()
                }
                .padding(.vertical, 40)
            } else if activities.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "timer")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.3))
                    Text(Loc.t(
                        "No free workout on this day.",
                        "Nenhum treino livre neste dia."
                    ))
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.5))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 36)
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(activities) { activity in
                            workoutRow(activity)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .task {
            activities = await model.mergeableActivities(
                workoutDate: post.workoutDate ?? ""
            )
            loading = false
        }
    }

    private func workoutRow(_ activity: MergeableActivity) -> some View {
        let hasRoute = (activity.distanceM ?? 0) > 0
        return HStack(spacing: 12) {
            Image(systemName: hasRoute ? "map.fill" : "timer")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(.black)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(activity.kind.label)
                    .font(.system(size: 14.5, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                Text(
                    [
                        hasRoute
                            ? gymCircleFormatKm(activity.distanceM ?? 0)
                            : gymCircleFormatElapsed(activity.elapsedS),
                        activity.avgHr.map { "\($0) bpm" },
                        activity.totalCalories.map { "\(Int($0.rounded())) kcal" },
                    ]
                    .compactMap { $0 }
                    .joined(separator: " · ")
                )
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.46))
                .lineLimit(1)
            }
            Spacer()
            if integratingId == activity.id {
                ProgressView().tint(GymCircleTheme.ColorToken.cyan)
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(Color.white.opacity(0.4))
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white.opacity(0.03))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            guard integratingId == nil else { return }
            Task { await integrate(activity) }
        }
    }

    private func integrate(_ activity: MergeableActivity) async {
        integratingId = activity.id
        let ok = await model.integrateWorkoutIntoPost(
            postId: post.id,
            activityId: activity.id
        )
        integratingId = nil
        if ok {
            Haptics.success()
            onIntegrated()
        } else {
            Haptics.error()
        }
    }
}

/// Import do Apple Saúde (Slice 3): treinos gravados por outros apps
/// (Strava, Nike Run Club, Apple Watch…) viram ENTRADA no feed (origin
/// imported) — mesmas infos e mesma mutação a post do treino ao vivo.
public struct HealthImportSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    private let onImported: (ActivityComposerContext) -> Void
    private let onClose: () -> Void

    @State private var workouts: [HealthWorkoutSummary] = []
    @State private var loading = true
    @State private var importingId: String?
    @State private var importedIds: Set<String> = []
    @State private var errorMessage: String?

    public init(
        model: GymCircleAppModel,
        onImported: @escaping (ActivityComposerContext) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.model = model
        self.onImported = onImported
        self.onClose = onClose
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Loc.t("Import from Health", "Importar do Saúde"))
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    Text(Loc.t(
                        "Last 14 days — Strava, Nike, Apple Watch and more.",
                        "Últimos 14 dias — Strava, Nike, Apple Watch e mais."
                    ))
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.46))
                }
                Spacer()
                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.82))
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.white.opacity(0.055)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Loc.close)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.pink)
            }

            if loading {
                HStack {
                    Spacer()
                    ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                    Spacer()
                }
                .padding(.vertical, 40)
            } else if workouts.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "heart.text.square")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.3))
                    Text(Loc.t(
                        "No workouts found in Apple Health.",
                        "Nenhum treino encontrado no Apple Saúde."
                    ))
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.5))
                    Text(Loc.t(
                        "Check the Health permission in Settings.",
                        "Confira a permissão do Saúde nos Ajustes."
                    ))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.36))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 36)
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(workouts) { workout in
                            workoutRow(workout)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .task {
            workouts = await model.recentHealthWorkouts()
            loading = false
        }
    }

    private func workoutRow(_ workout: HealthWorkoutSummary) -> some View {
        let kind = WorkoutActivityKind(rawValue: workout.activityKind) ?? .other
        let imported = importedIds.contains(workout.id)
        return HStack(spacing: 12) {
            Image(systemName: kind.icon)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan.opacity(0.10))
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(workout.workoutActivityType)
                    .font(.system(size: 14.5, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                Text(
                    [
                        Self.dayLabel(workout.startDate),
                        gymCircleFormatElapsed(Int(workout.durationSeconds.rounded())),
                        workout.activeEnergyKilocalories.map { "\(Int($0.rounded())) kcal" },
                        workout.sourceName,
                    ]
                    .compactMap { $0 }
                    .joined(separator: " · ")
                )
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.46))
                .lineLimit(1)
            }
            Spacer()
            Button {
                Task { await importWorkout(workout) }
            } label: {
                if importingId == workout.id {
                    ProgressView().tint(.black)
                        .frame(width: 76, height: 34)
                        .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                } else {
                    Text(
                        imported
                            ? Loc.t("Imported", "Importado")
                            : Loc.t("Import", "Importar")
                    )
                    .font(.system(size: 12.5, weight: .black))
                    .foregroundStyle(imported ? Color.white.opacity(0.4) : .black)
                    .frame(width: 76, height: 34)
                    .background(
                        Capsule().fill(
                            imported
                                ? Color.white.opacity(0.06)
                                : GymCircleTheme.ColorToken.cyan
                        )
                    )
                }
            }
            .buttonStyle(.plain)
            .disabled(imported || importingId != nil)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white.opacity(0.03))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    private func importWorkout(_ workout: HealthWorkoutSummary) async {
        importingId = workout.id
        errorMessage = nil
        let context = await model.importHealthWorkout(workout)
        importingId = nil
        if let context {
            Haptics.success()
            importedIds.insert(workout.id)
            onImported(context)
        } else {
            Haptics.error()
            errorMessage = model.error
                ?? Loc.t("Couldn't import this workout.", "Não deu pra importar esse treino.")
            // "Já importado" também marca a linha — evita repetir o toque.
            if errorMessage == Loc.t(
                "This workout was already imported.",
                "Esse treino já foi importado."
            ) {
                importedIds.insert(workout.id)
            }
        }
    }

    /// "Hoje", "Ontem" ou dd/MM (SP).
    private static func dayLabel(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        if calendar.isDateInToday(date) { return Loc.t("Today", "Hoje") }
        if calendar.isDateInYesterday(date) { return Loc.t("Yesterday", "Ontem") }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "dd/MM"
        return formatter.string(from: date)
    }
}
