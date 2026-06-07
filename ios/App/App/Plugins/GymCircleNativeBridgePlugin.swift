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

    var body: some View {
        MyCircleView(
            data: model.myCircleData ?? MyCircleViewData.demo(
                userId: userId,
                isOwn: isOwn
            ),
            onClose: onDismiss,
            onTapBadgeHighlight: {
                // Sprint 8.5 — aqui chama presentAchievementsHub
            },
            onTapChallenge: { _ in
                // Sprint 8.4 — aqui chama presentAchievementDetail
            },
            onTapRecap: {
                // Sprint 8.x — aqui chama presentRecapNative
            },
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
