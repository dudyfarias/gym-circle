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

/// Sprint 8.1 placeholder. Renderiza tela stub enquanto Sprint 8.2
/// implementa MyCircleView nativa completa. Quando 8.2 chegar, substitui
/// o `MyCirclePlaceholderView` pelo `MyCircleView` real do Foundation
/// Package.
private func makeMyCircleHostingController(
    userId: String,
    isOwn: Bool,
    onDismiss: @escaping () -> Void
) -> UIViewController {
    let placeholderView = MyCirclePlaceholderView(
        userId: userId,
        isOwn: isOwn,
        onDismiss: onDismiss
    )
    let hosting = UIHostingController(rootView: placeholderView)
    hosting.modalPresentationStyle = .fullScreen
    return hosting
}

// MARK: - Stub View (Sprint 8.1 placeholder)

private struct MyCirclePlaceholderView: View {
    let userId: String
    let isOwn: Bool
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 24) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(LinearGradient(
                        colors: [.cyan, .blue],
                        startPoint: .top,
                        endPoint: .bottom
                    ))

                Text("MyCircle Nativo")
                    .font(.system(size: 28, weight: .black))
                    .foregroundColor(.white)

                Text("Em construção — Sprint 8.2 implementa rings + badges + monthly challenges aqui.")
                    .font(.system(size: 14, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.white.opacity(0.72))
                    .padding(.horizontal, 32)

                VStack(spacing: 4) {
                    Text("userId:")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white.opacity(0.5))
                    Text(userId)
                        .font(.system(size: 11, weight: .regular, design: .monospaced))
                        .foregroundColor(.white.opacity(0.8))
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Text(isOwn ? "Próprio perfil" : "Outro user")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding(.top, 8)

                Button(action: onDismiss) {
                    Text("Voltar")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(.black)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 14)
                        .background(Color.white)
                        .clipShape(Capsule())
                }
                .padding(.top, 16)
            }
        }
    }
}
