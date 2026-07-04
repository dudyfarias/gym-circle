import SwiftUI

/// Hub do "+" central (paridade CreateHubSheet web): Iniciar treino em
/// destaque + Postar treino / Check-in no grid. A tab central deixa de abrir
/// o composer direto — tudo que "cria" mora aqui.
public struct CreateHubSheet: View {
    private let onStartWorkout: () -> Void
    private let onPostWorkout: () -> Void
    private let onCheckIn: () -> Void

    public init(
        onStartWorkout: @escaping () -> Void,
        onPostWorkout: @escaping () -> Void,
        onCheckIn: @escaping () -> Void
    ) {
        self.onStartWorkout = onStartWorkout
        self.onPostWorkout = onPostWorkout
        self.onCheckIn = onCheckIn
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
