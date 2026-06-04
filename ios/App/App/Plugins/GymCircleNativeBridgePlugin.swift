import Foundation
import Capacitor
import SwiftUI

// Quando o Swift Package GymCircleNativeFoundation for adicionado como
// dependência local do projeto Xcode (Workspace > Add Local Package),
// descomente este import:
// import GymCircleNativeFoundation

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
        // Sprint 8.4 vai implementar — por ora retorna pendência
        call.reject("AchievementDetail bridge not implemented yet (Sprint 8.4)")
        _ = compositeId
        _ = userId
    }

    @objc func presentCelebration(_ call: CAPPluginCall) {
        guard let compositeId = call.getString("compositeId"), !compositeId.isEmpty else {
            call.reject("compositeId is required")
            return
        }
        // Sprint 8.6 vai implementar
        call.reject("Celebration bridge not implemented yet (Sprint 8.6)")
        _ = compositeId
    }

    @objc func presentAchievementsHub(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }
        // Sprint 8.5 vai implementar
        call.reject("AchievementsHub bridge not implemented yet (Sprint 8.5)")
        _ = userId
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
    let view = MyCircleView(
        data: MyCircleViewData.demo(userId: userId, isOwn: isOwn),
        onClose: onDismiss,
        onTapBadgeHighlight: {
            // Sprint 8.5 — aqui chama presentAchievementsHub
        },
        onTapChallenge: { _ in
            // Sprint 8.4 — aqui chama presentAchievementDetail
        },
        onTapRecap: {
            // Sprint 8.x — aqui chama presentRecapNative
        }
    )
    let hosting = UIHostingController(rootView: view)
    #else
    // Fallback quando Swift Package ainda não foi adicionado ao Xcode
    let view = MyCirclePlaceholderView(userId: userId, isOwn: isOwn, onDismiss: onDismiss)
    let hosting = UIHostingController(rootView: view)
    #endif
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

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
