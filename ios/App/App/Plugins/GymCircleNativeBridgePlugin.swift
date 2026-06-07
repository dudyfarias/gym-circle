import Foundation
import Capacitor
import SwiftUI

// Quando o Swift Package GymCircleNativeFoundation for adicionado como
// dependência local do projeto Xcode (Workspace > Add Local Package),
// descomente estes 2 imports:
// import GymCircleNativeFoundation
// import Supabase

/// Sprint 8.1 — Capacitor Plugin Bridge.
///
/// Permite que código JavaScript (Next.js dentro do WKWebView) presente
/// surfaces SwiftUI nativas via UIHostingController. Estratégia híbrida
/// que coexiste com o Capacitor app durante a migração incremental.
///
/// Capacitor 8 usa registro automático via @objc(...) — sem precisar de
/// arquivo .m bridging header separado.
///
/// JS API correspondente: apps/web/src/native/GymCircleNativeBridge.ts
///
/// Status do plugin:
///   - presentMyCircleNative: placeholder funcional (mostra UIHostingController
///     com texto stub enquanto Sprint 8.2 implementa MyCircleView completa)
///   - presentAchievementDetail: stub — Sprint 8.4
///   - presentCelebration: stub — Sprint 8.6
///   - presentAchievementsHub: stub — Sprint 8.5
///
/// NOTA AO BUILD: este arquivo só compila quando o Swift Package
/// GymCircleNativeFoundation está adicionado ao Xcode Workspace. Veja
/// docs/sprint-8-swiftui-phase-7.md § "Adicionar Swift Package no Xcode".

@objc(GymCircleNativeBridgePlugin)
public class GymCircleNativeBridgePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "GymCircleNativeBridgePlugin"
    public let jsName = "GymCircleNativeBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "presentMyCircleNative", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentAchievementDetail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentCelebration", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentAchievementsHub", returnType: CAPPluginReturnPromise),
        // Sprint 9.1 — Bridge wire-up final
        CAPPluginMethod(name: "presentOtherProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentEditProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentMonthlyRecap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]

    /// Verifica se o plugin está disponível. JS pode chamar antes de
    /// invocar surfaces nativas pra evitar erros em devices sem suporte.
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func presentMyCircleNative(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }
        let isOwnProfile = call.getBool("isOwn") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }

            let hostingController = makeMyCircleHostingController(
                userId: userId,
                isOwn: isOwnProfile,
                onDismiss: { [weak viewController] in
                    viewController?.dismiss(animated: true, completion: nil)
                }
            )

            viewController.present(hostingController, animated: true) {
                call.resolve()
            }
        }
    }

    @objc func presentAchievementDetail(_ call: CAPPluginCall) {
        guard let compositeId = call.getString("compositeId"), !compositeId.isEmpty else {
            call.reject("compositeId is required")
            return
        }
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }
            let hosting = makeAchievementDetailHostingController(
                userId: userId,
                compositeId: compositeId,
                onDismiss: { [weak viewController] in
                    viewController?.dismiss(animated: true)
                }
            )
            viewController.present(hosting, animated: true) {
                call.resolve()
            }
        }
    }

    @objc func presentCelebration(_ call: CAPPluginCall) {
        guard let compositeId = call.getString("compositeId"), !compositeId.isEmpty else {
            call.reject("compositeId is required")
            return
        }
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }
            let hosting = makeCelebrationHostingController(
                userId: userId,
                compositeId: compositeId,
                onDismiss: { [weak viewController] in
                    viewController?.dismiss(animated: true)
                }
            )
            viewController.present(hosting, animated: true) {
                call.resolve()
            }
        }
    }

    @objc func presentAchievementsHub(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }
            let hosting = makeAchievementsHubHostingController(
                userId: userId,
                onDismiss: { [weak viewController] in
                    viewController?.dismiss(animated: true)
                }
            )
            viewController.present(hosting, animated: true) {
                call.resolve()
            }
        }
    }

    // MARK: - Sprint 9.1 — 3 novos métodos

    @objc func presentOtherProfile(_ call: CAPPluginCall) {
        guard let targetUserId = call.getString("targetUserId"), !targetUserId.isEmpty else {
            call.reject("targetUserId is required")
            return
        }
        guard let currentUserId = call.getString("currentUserId"), !currentUserId.isEmpty else {
            call.reject("currentUserId is required")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }
            let hosting = makeOtherProfileHostingController(
                targetUserId: targetUserId,
                currentUserId: currentUserId,
                onDismiss: { [weak viewController] in viewController?.dismiss(animated: true) }
            )
            viewController.present(hosting, animated: true) { call.resolve() }
        }
    }

    @objc func presentEditProfile(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }
            let hosting = makeEditProfileHostingController(
                userId: userId,
                onDismiss: { [weak viewController] in viewController?.dismiss(animated: true) }
            )
            viewController.present(hosting, animated: true) { call.resolve() }
        }
    }

    @objc func presentMonthlyRecap(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }
        let monthKey = call.getString("monthKey") // opcional, default = current
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let viewController = self.bridge?.viewController else {
                call.reject("Bridge unavailable")
                return
            }
            let hosting = makeMonthlyRecapHostingController(
                userId: userId,
                monthKey: monthKey,
                onDismiss: { [weak viewController] in viewController?.dismiss(animated: true) }
            )
            viewController.present(hosting, animated: true) { call.resolve() }
        }
    }
}

// MARK: - HostingController factory

/// Sprint 8.2 — usa MyCircleView real do Foundation Package.
///
/// Dados via `MyCircleViewData.demo()` enquanto Sprint 8.3 não conecta
/// API real. Quando o app for buildado com Swift Package adicionado,
/// `import GymCircleNativeFoundation` (no topo do arquivo) precisa
/// estar descomentado.
///
/// Wrap em ZStack pra suportar onDismiss callback como overlay no
/// MyCircleView (botão X já está na sua estrutura).
private func makeMyCircleHostingController(
    userId: String,
    isOwn: Bool,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    // Sprint 8.3 — usa NativeMyCircleHost que injeta AppModel real
    // com Supabase client. Fetcha dados via MyCircleService. Quando
    // erro/loading, fallback graceful pra demo data.
    let host = NativeMyCircleHost(
        userId: userId,
        isOwn: isOwn,
        onDismiss: onDismiss
    )
    let hosting = UIHostingController(rootView: host)
    #else
    // Fallback quando Swift Package ainda não foi adicionado ao Xcode
    let view = MyCirclePlaceholderView(userId: userId, isOwn: isOwn, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

#if canImport(GymCircleNativeFoundation)
// MARK: - NativeMyCircleHost (Sprint 8.3)

/// Container que instancia GymCircleAppModel com SupabaseClient real,
/// dispara loadMyCircle() no aparecer e renderiza MyCircleView com
/// dados reais. Fallback pra demo data quando dados ainda não chegaram
/// ou erro de rede.
///
/// Lê URL/key Supabase de `Bundle.main.infoDictionary` (que Capacitor
/// popula via `capacitor.config.json` → ConfigurationManager).
private struct NativeMyCircleHost: View {
    let userId: String
    let isOwn: Bool
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel

    init(userId: String, isOwn: Bool, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.isOwn = isOwn
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    // Sprint 9.5.2 — nested fullScreenCover state pros 3 callbacks.
    // Evita o tap do user terminar em void (era stub em Sprint 8.x).
    @State private var hubOpen = false
    @State private var detailAchievement: Achievement?
    @State private var recapOpen = false
    // Sprint 9.5.3 — period picker + monthKey selecionado
    @State private var periodPickerOpen = false
    @State private var selectedRecapMonthKey: String?

    var body: some View {
        MyCircleView(
            data: model.myCircleData ?? MyCircleViewData.demo(
                userId: userId,
                isOwn: isOwn
            ),
            onClose: onDismiss,
            onTapBadgeHighlight: { hubOpen = true },
            onTapChallenge: { challenge in
                // Achievement composite "challenge:periodKey:id"
                if let match = model.achievements.first(where: { $0.achievementId == challenge.id }) {
                    detailAchievement = match
                }
            },
            onTapRecap: {
                selectedRecapMonthKey = nil
                recapOpen = true
            },
            onTapPickPeriod: { periodPickerOpen = true },
            onChangeMonth: { offset in
                // Sprint 8.11.3 — recarrega workoutDays do mês escolhido
                Task { await model.loadCalendarForMonth(offset: offset) }
            }
        )
        .task {
            // Sprint 8.3 — tenta restaurar session + buscar dados reais.
            // Quando sucesso, MyCircleView re-renderiza via @Published.
            await model.boot()
        }
        // Sprint 9.5.2 — nested presentations dentro do MyCircle nativo
        .fullScreenCover(isPresented: $hubOpen) {
            NativeAchievementsHubHost(userId: userId, onDismiss: { hubOpen = false })
        }
        .fullScreenCover(item: $detailAchievement) { achievement in
            NativeAchievementDetailHost(
                userId: userId,
                compositeId: achievement.compositeId,
                onDismiss: { detailAchievement = nil }
            )
        }
        .fullScreenCover(isPresented: $recapOpen) {
            NativeMonthlyRecapHost(
                userId: userId,
                monthKey: selectedRecapMonthKey,
                onDismiss: { recapOpen = false }
            )
        }
        .fullScreenCover(isPresented: $periodPickerOpen) {
            RecapPeriodPickerSheet(
                onSelect: { period in
                    selectedRecapMonthKey = period.periodKey
                    periodPickerOpen = false
                    // Pequeno delay pra animação do cover não conflitar
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        recapOpen = true
                    }
                },
                onClose: { periodPickerOpen = false }
            )
        }
    }

    /// Cria AppModel com client Supabase real lido das env vars Capacitor.
    /// Quando URL/key não encontradas (dev sem env), volta pra modo demo.
    /// `fileprivate` permite reuso pelos outros hosts no mesmo file (Sprint 8.9).
    fileprivate static func makeModel() -> GymCircleAppModel {
        guard let url = readSupabaseURL(),
              let key = readSupabaseAnonKey() else {
            return GymCircleAppModel() // demo mode
        }
        let client = SupabaseClient(supabaseURL: url, supabaseKey: key)
        return GymCircleAppModel(client: client)
    }

    private static func readSupabaseURL() -> URL? {
        if let str = Bundle.main.object(forInfoDictionaryKey: "NEXT_PUBLIC_SUPABASE_URL") as? String,
           let url = URL(string: str) {
            return url
        }
        if let str = ProcessInfo.processInfo.environment["NEXT_PUBLIC_SUPABASE_URL"],
           let url = URL(string: str) {
            return url
        }
        return nil
    }

    private static func readSupabaseAnonKey() -> String? {
        if let str = Bundle.main.object(forInfoDictionaryKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY") as? String {
            return str
        }
        return ProcessInfo.processInfo.environment["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    }
}
#endif

// MARK: - Sprint 8.9 hosting controllers (Detail/Celebration/Hub)

private func makeAchievementDetailHostingController(
    userId: String,
    compositeId: String,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    let host = NativeAchievementDetailHost(
        userId: userId,
        compositeId: compositeId,
        onDismiss: onDismiss
    )
    let hosting = UIHostingController(rootView: host)
    #else
    let view = MyCirclePlaceholderView(userId: userId, isOwn: false, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

private func makeCelebrationHostingController(
    userId: String,
    compositeId: String,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    let host = NativeCelebrationHost(
        userId: userId,
        compositeId: compositeId,
        onDismiss: onDismiss
    )
    let hosting = UIHostingController(rootView: host)
    #else
    let view = MyCirclePlaceholderView(userId: userId, isOwn: false, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .overFullScreen
    hosting.view.backgroundColor = .clear
    return hosting
}

private func makeAchievementsHubHostingController(
    userId: String,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    let host = NativeAchievementsHubHost(userId: userId, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: host)
    #else
    let view = MyCirclePlaceholderView(userId: userId, isOwn: false, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

#if canImport(GymCircleNativeFoundation)
// MARK: - Sprint 8.9 hosts (compõem AppModel + chamam services)

private struct NativeAchievementDetailHost: View {
    let userId: String
    let compositeId: String
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel
    @State private var record: UserAchievementRecord?
    @State private var globalStats: AchievementGlobalStats?

    init(userId: String, compositeId: String, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.compositeId = compositeId
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    var body: some View {
        let achievement = resolveAchievement()
        AchievementDetailView(
            achievement: achievement,
            userRecord: record,
            globalStats: globalStats,
            onClose: onDismiss
        )
        .task {
            await model.boot()
            // Sprint 8.9 — fetch userRecord + globalStats em paralelo
            async let recordTask = model.fetchUserRecord(compositeId: compositeId)
            async let statsTask = model.fetchGlobalStats(compositeId: compositeId)
            record = await recordTask
            globalStats = await statsTask
        }
    }

    private func resolveAchievement() -> Achievement {
        if let match = model.achievements.first(where: { $0.compositeId == compositeId }) {
            return match
        }
        // Fallback: parse compositeId pra mostrar pelo menos kind/id
        if let parsed = AchievementCompositeId.parse(compositeId) {
            return Achievement(
                kind: parsed.kind,
                achievementId: parsed.id,
                label: "Conquista",
                description: "Carregando detalhes...",
                earned: false,
                iconKey: .trophy
            )
        }
        return Achievement(
            kind: .badge,
            achievementId: "unknown",
            label: "Conquista",
            description: "",
            earned: false,
            iconKey: .trophy
        )
    }
}

private struct NativeCelebrationHost: View {
    let userId: String
    let compositeId: String
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel

    init(userId: String, compositeId: String, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.compositeId = compositeId
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    var body: some View {
        let achievement = resolveAchievement()
        AchievementCelebrationView(
            achievement: achievement,
            queueIndex: nil,
            queueTotal: nil,
            onDismiss: {
                Task {
                    await model.markCelebrated(compositeId: compositeId)
                    onDismiss()
                }
            }
        )
        .task {
            await model.boot()
        }
    }

    private func resolveAchievement() -> Achievement {
        if let match = model.achievements.first(where: { $0.compositeId == compositeId }) {
            return match
        }
        return Achievement(
            kind: .badge,
            achievementId: compositeId,
            label: "Nova conquista",
            description: "Parabéns!",
            earned: true,
            iconKey: .trophy,
            rarity: .common
        )
    }
}

private struct NativeAchievementsHubHost: View {
    let userId: String
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel
    @State private var detailAchievement: Achievement?

    init(userId: String, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    var body: some View {
        AchievementsView(
            achievements: model.achievements,
            onTap: { achievement in
                detailAchievement = achievement
            },
            onClose: onDismiss
        )
        .task {
            await model.boot()
        }
        .fullScreenCover(item: $detailAchievement) { ach in
            AchievementDetailView(
                achievement: ach,
                onClose: { detailAchievement = nil }
            )
        }
    }
}
#endif

// MARK: - Sprint 9.1 hosting factories (Other/Edit/Recap)

private func makeOtherProfileHostingController(
    targetUserId: String,
    currentUserId: String,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    let host = NativeOtherProfileHost(
        targetUserId: targetUserId,
        currentUserId: currentUserId,
        onDismiss: onDismiss
    )
    let hosting = UIHostingController(rootView: host)
    #else
    let view = MyCirclePlaceholderView(userId: targetUserId, isOwn: false, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

private func makeEditProfileHostingController(
    userId: String,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    let host = NativeEditProfileHost(userId: userId, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: host)
    #else
    let view = MyCirclePlaceholderView(userId: userId, isOwn: true, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .formSheet
    return hosting
}

private func makeMonthlyRecapHostingController(
    userId: String,
    monthKey: String?,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    #if canImport(GymCircleNativeFoundation)
    let host = NativeMonthlyRecapHost(
        userId: userId,
        monthKey: monthKey,
        onDismiss: onDismiss
    )
    let hosting = UIHostingController(rootView: host)
    #else
    let view = MyCirclePlaceholderView(userId: userId, isOwn: true, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

#if canImport(GymCircleNativeFoundation)
// MARK: - Sprint 9.1 hosts

/// Container nativo do OtherProfileView. Carrega profile + posts do target
/// user via ProfilesService + GymCircleAPI. Follow CTA stub (Sprint 9.2+
/// wirea FollowsService quando criado).
private struct NativeOtherProfileHost: View {
    let targetUserId: String
    let currentUserId: String
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel
    @State private var profile: UserProfile?
    @State private var posts: [ProfilePost] = []
    @State private var followState: OtherProfileView.FollowState = .none

    init(targetUserId: String, currentUserId: String, onDismiss: @escaping () -> Void) {
        self.targetUserId = targetUserId
        self.currentUserId = currentUserId
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    var body: some View {
        Group {
            if let profile = profile {
                OtherProfileView(
                    profile: profile,
                    posts: posts,
                    latestPost: posts.first,
                    followState: followState,
                    canSeePosts: !profile.isPrivate || followState == .accepted,
                    onToggleFollow: {
                        // Sprint 9.2+: wire FollowsService.toggle aqui.
                    },
                    onMessage: { /* Sprint 9.x: deep-link pro web chat */ },
                    onReport: { /* Sprint 9.x */ },
                    onBlock: { /* Sprint 9.x */ },
                    onOpenPost: { _ in /* Sprint 9.x: deep-link pro web post detail */ },
                    onClose: onDismiss
                )
            } else {
                ZStack {
                    Color.black.ignoresSafeArea()
                    ProgressView().tint(.white)
                }
            }
        }
        .task {
            await model.boot()
            await loadTargetProfile()
        }
    }

    private func loadTargetProfile() async {
        // Best-effort: tenta carregar do mesmo AppModel (mock por ora —
        // ProfilesService.getProfile já existe mas no AppModel é privado).
        // Pra MVP do bridge, mostra empty state quando service indisponível.
        if let loaded = await model.fetchOtherProfile(userId: targetUserId) {
            self.profile = loaded
        }
    }
}

/// Container nativo do EditProfileSheet. Hidrata com profile real do user
/// + dispara ProfilesService.updateProfile no save.
private struct NativeEditProfileHost: View {
    let userId: String
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel

    init(userId: String, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    var body: some View {
        Group {
            if let profile = model.profile {
                EditProfileSheet(
                    profile: profile,
                    onSave: { updated in
                        await model.saveProfile(
                            displayName: updated.displayName,
                            bio: updated.bio,
                            fitnessGoal: updated.fitnessGoal,
                            isPrivate: updated.isPrivate
                        )
                        onDismiss()
                    },
                    onUploadAvatar: { data in
                        await model.uploadAvatar(imageData: data)
                    },
                    onClose: onDismiss
                )
            } else {
                ZStack {
                    Color.black.ignoresSafeArea()
                    ProgressView().tint(.white)
                }
            }
        }
        .task { await model.boot() }
    }
}

/// Container nativo do MonthlyRecapSheet. Carrega stats reais + posts do
/// mês alvo + cover override. Share entrega UIImage pro UIActivityViewController.
private struct NativeMonthlyRecapHost: View {
    let userId: String
    let monthKey: String?
    let onDismiss: () -> Void

    @StateObject private var model: GymCircleAppModel
    @State private var recapData: MonthlyRecapSheet.RecapData?
    @State private var coverPickerOpen = false
    @State private var monthPosts: [MonthCalendarPost] = []

    init(userId: String, monthKey: String?, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.monthKey = monthKey
        self.onDismiss = onDismiss
        _model = StateObject(wrappedValue: NativeMyCircleHost.makeModel())
    }

    var body: some View {
        Group {
            if let data = recapData {
                MonthlyRecapSheet(
                    data: data,
                    onChangeCover: { coverPickerOpen = true },
                    onShare: presentShare,
                    onClose: onDismiss
                )
            } else {
                ZStack {
                    Color.black.ignoresSafeArea()
                    ProgressView().tint(.white)
                }
            }
        }
        .fullScreenCover(isPresented: $coverPickerOpen) {
            if let data = recapData {
                RecapCoverPickerSheet(
                    posts: monthPosts,
                    monthLabel: data.monthLabel,
                    onSelect: { postId in
                        Task {
                            await model.setRecapCover(monthKey: resolvedMonthKey, postId: postId)
                            await reloadRecap()
                            coverPickerOpen = false
                        }
                    },
                    onClose: { coverPickerOpen = false }
                )
            }
        }
        .task {
            await model.boot()
            await reloadRecap()
        }
    }

    private var resolvedMonthKey: String {
        monthKey ?? Self.currentMonthKey()
    }

    private func reloadRecap() async {
        let payload = await model.buildMonthlyRecap(monthKey: resolvedMonthKey)
        self.recapData = payload.data
        self.monthPosts = payload.posts
    }

    private func presentShare(_ image: UIImage) {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = scene.windows.first?.rootViewController else { return }
        let activity = UIActivityViewController(activityItems: [image], applicationActivities: nil)
        var top = root
        while let presented = top.presentedViewController { top = presented }
        top.present(activity, animated: true)
    }

    private static func currentMonthKey() -> String {
        let cal = Calendar(identifier: .gregorian)
        let y = cal.component(.year, from: .now)
        let m = cal.component(.month, from: .now)
        return String(format: "%04d-%02d", y, m)
    }
}
#endif

#if !canImport(GymCircleNativeFoundation)
// MARK: - Stub View (fallback quando Foundation Package não adicionado)

private struct MyCirclePlaceholderView: View {
    let userId: String
    let isOwn: Bool
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 24) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 56))
                    .foregroundColor(.orange)

                Text("Foundation Package missing")
                    .font(.system(size: 24, weight: .black))
                    .foregroundColor(.white)

                Text("Add ios-native/GymCircleNative as a Local Swift Package dependency in Xcode and rebuild. See docs/sprint-8-swiftui-phase-7.md.")
                    .font(.system(size: 13, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.white.opacity(0.72))
                    .padding(.horizontal, 32)

                Button(action: onDismiss) {
                    Text("Voltar")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(.black)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 14)
                        .background(Color.white)
                        .clipShape(Capsule())
                }
                .padding(.top, 24)
            }
        }
    }
}
#endif
