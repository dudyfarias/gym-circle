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
    // Timer de descanso (presets iguais ao web REST_PRESETS_S).
    @State private var restPreset = 60
    @State private var restRemaining = 0
    @State private var restRunning = false
    @State private var restJustDone = false
    @State private var finishing = false
    @State private var finishError: String?
    @State private var discardConfirm = false

    private static let restPresets = [60, 90, 120]
    // Persistência anti-morte do app: o cronômetro deriva SEMPRE de startedAt.
    private static let storedStartKey = "gc.native.workout.startedAt"
    private static let storedKindKey = "gc.native.workout.kind"

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
                clearStored()
                onClose()
            }
            Button(Loc.t("Keep going", "Continuar treinando"), role: .cancel) {}
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
            }
            .padding(20)
        }
    }

    // MARK: - Treino ao vivo (data-first: tempo gigante + descanso)

    private var liveStage: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: kind.icon)
                        .font(.system(size: 13, weight: .bold))
                    Text(kind.label)
                        .font(.system(size: 13, weight: .black))
                }
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(GymCircleTheme.ColorToken.cyan.opacity(0.10)))

                Spacer()

                HStack(spacing: 6) {
                    Circle()
                        .fill(GymCircleTheme.ColorToken.cyan)
                        .frame(width: 7, height: 7)
                    Text(Loc.t("Live", "Ao vivo"))
                        .font(.system(size: 11, weight: .black))
                        .textCase(.uppercase)
                        .tracking(1.0)
                        .foregroundStyle(Color.white.opacity(0.6))
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            Spacer()

            VStack(spacing: 6) {
                Text(Loc.t("Total time", "Tempo total"))
                    .font(.system(size: 12, weight: .black))
                    .textCase(.uppercase)
                    .tracking(1.4)
                    .foregroundStyle(Color.white.opacity(0.4))
                Text(gymCircleFormatElapsed(elapsedS))
                    .font(.system(size: 72, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    .contentTransition(.numericText())
                Text(Loc.t(
                    "Saved to Apple Health when you finish.",
                    "Vai pro Apple Saúde quando você encerrar."
                ))
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.4))
            }

            Spacer()

            restSection
                .padding(.horizontal, 20)

            VStack(spacing: 10) {
                if let finishError {
                    Text(finishError)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.pink)
                        .multilineTextAlignment(.center)
                }
                Button {
                    Task { await finish() }
                } label: {
                    HStack(spacing: 8) {
                        if finishing {
                            ProgressView().tint(.black)
                        } else {
                            Image(systemName: "flag.checkered")
                                .font(.system(size: 15, weight: .black))
                        }
                        Text(Loc.t("Finish workout", "Encerrar treino"))
                            .font(.system(size: 16, weight: .black))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                    .foregroundStyle(.black)
                }
                .buttonStyle(.plain)
                .disabled(finishing)

                Button {
                    discardConfirm = true
                } label: {
                    Text(Loc.t("Discard", "Descartar"))
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.46))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .disabled(finishing)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 14)
        }
    }

    private var restSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text(Loc.t("Rest", "Descanso"))
                    .font(.system(size: 12, weight: .black))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Color.white.opacity(0.42))
                Spacer()
                if restRunning || restRemaining > 0 {
                    Text(gymCircleFormatElapsed(restRemaining))
                        .font(.system(size: 22, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(
                            restJustDone
                                ? GymCircleTheme.ColorToken.cyan
                                : GymCircleTheme.ColorToken.primaryText
                        )
                }
            }

            if restRunning || restRemaining > 0 {
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

            HStack(spacing: 8) {
                ForEach(Self.restPresets, id: \.self) { preset in
                    Button {
                        startRest(preset)
                    } label: {
                        Text("\(preset)s")
                            .font(.system(size: 13, weight: .black))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(
                                Capsule().fill(
                                    restRunning && restPreset == preset
                                        ? GymCircleTheme.ColorToken.cyan.opacity(0.16)
                                        : Color.white.opacity(0.05)
                                )
                            )
                            .foregroundStyle(
                                restRunning && restPreset == preset
                                    ? GymCircleTheme.ColorToken.cyan
                                    : Color.white.opacity(0.78)
                            )
                    }
                    .buttonStyle(.plain)
                }
                if restRunning || restRemaining > 0 {
                    Button {
                        restRunning = false
                        restRemaining = 0
                        restJustDone = false
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .black))
                            .foregroundStyle(Color.white.opacity(0.6))
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(Color.white.opacity(0.05)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Loc.t("Cancel rest", "Cancelar descanso"))
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color.white.opacity(0.03))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Lógica

    private func resumeIfNeeded() {
        let defaults = UserDefaults.standard
        let storedStart = defaults.double(forKey: Self.storedStartKey)
        guard storedStart > 0 else { return }
        startedAt = Date(timeIntervalSince1970: storedStart)
        if let raw = defaults.string(forKey: Self.storedKindKey),
           let storedKind = WorkoutActivityKind(rawValue: raw) {
            kind = storedKind
        }
        elapsedS = currentElapsed()
        stage = .live
    }

    private func start(_ option: WorkoutActivityKind) {
        Haptics.impactLight()
        let now = Date()
        kind = option
        startedAt = now
        elapsedS = 0
        finishError = nil
        stage = .live
        let defaults = UserDefaults.standard
        defaults.set(now.timeIntervalSince1970, forKey: Self.storedStartKey)
        defaults.set(option.rawValue, forKey: Self.storedKindKey)
    }

    private func tick() {
        guard stage == .live else { return }
        elapsedS = currentElapsed()
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
        return max(0, Int(Date().timeIntervalSince(startedAt).rounded()))
    }

    private func startRest(_ preset: Int) {
        Haptics.impactLight()
        restPreset = preset
        restRemaining = preset
        restRunning = true
        restJustDone = false
    }

    private func finish() async {
        guard let startedAt, !finishing else { return }
        finishing = true
        finishError = nil
        let context = await model.finishNativeWorkout(
            kind: kind,
            startedAt: startedAt,
            endedAt: Date()
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
