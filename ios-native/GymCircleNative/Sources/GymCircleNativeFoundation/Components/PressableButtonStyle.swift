import SwiftUI

/// PressableButtonStyle — Sprint 11.1
///
/// Feedback visual + tátil quando user toca em qualquer Button SwiftUI.
/// Substitui `.buttonStyle(.plain)` que removia o opacity flash padrão
/// sem trazer alternativa de feedback.
///
/// Uso:
/// ```swift
/// Button(action: ...) { Label(...) }
///     .buttonStyle(PressableButtonStyle())
/// ```
///
/// Parâmetros default vieram da matriz Apple HIG:
///   - scale 0.97 (subtil, premium feel)
///   - opacity 0.78 no press (notável mas não brutal)
///   - haptic light no toque inicial
///   - spring animation 0.22s
public struct PressableButtonStyle: ButtonStyle {
    public let scale: CGFloat
    public let opacity: Double
    public let triggerHaptic: Bool

    public init(scale: CGFloat = 0.97, opacity: Double = 0.78, triggerHaptic: Bool = true) {
        self.scale = scale
        self.opacity = opacity
        self.triggerHaptic = triggerHaptic
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1.0)
            .opacity(configuration.isPressed ? opacity : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.7), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { pressed in
                if pressed && triggerHaptic {
                    Haptics.selection()
                }
            }
    }
}

/// Versão mais marcada — pra CTAs primárias (Follow, Mensagem, Salvar).
/// Scale 0.94 + opacity 0.62 = press visualmente "afundado".
public struct PrimaryPressableButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1.0)
            .opacity(configuration.isPressed ? 0.62 : 1.0)
            .animation(.spring(response: 0.18, dampingFraction: 0.65), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { pressed in
                if pressed {
                    Haptics.impactLight()
                }
            }
    }
}
