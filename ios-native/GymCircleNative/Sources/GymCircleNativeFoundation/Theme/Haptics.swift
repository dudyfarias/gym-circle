import Foundation
import UIKit

/// Haptics — Sprint 9.6.2 (paridade `simulateHaptic` web).
///
/// Centraliza disparos de feedback tátil para garantir paridade visual
/// e auditável com o app web. Web usa `simulateHaptic("brand")` pra
/// taps padrão (calendar, chevron, badge); aqui mapeamos pra
/// `UISelectionFeedbackGenerator` (selection-light na Apple HIG).
///
/// Estados pesados (achievement unlock, level up) usam
/// `UINotificationFeedbackGenerator.notificationOccurred(.success)`.
public enum Haptics {
    /// Tap padrão — chevron, chip, navegação, escolha em picker.
    /// Equivalente web: `simulateHaptic("brand")`.
    public static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    /// Tap leve — toggle, switch, secundário.
    public static func impactLight() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Tap médio — abrir sheet, expandir card.
    public static func impactMedium() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Sucesso — save persistido, achievement desbloqueado.
    public static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }

    /// Erro — falha de save, validation rejeitada.
    public static func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.error)
    }
}
