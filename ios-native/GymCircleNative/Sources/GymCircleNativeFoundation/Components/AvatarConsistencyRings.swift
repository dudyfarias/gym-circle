import SwiftUI

/// AvatarConsistencyRings — paridade web (assinatura visual do Gym Circle):
/// a foto do usuário centralizada com 3 anéis concêntricos (semana / mês /
/// ano) e, opcionalmente, um story ring por fora.
///
/// Diferente do `ActivityRingsView` (a widget de stats com NÚMERO no centro,
/// usada no MyCircle): aqui os strokes/gaps são proporcionais ao tamanho —
/// igual ao `AvatarConsistencyRings.tsx` — pra a foto preencher o anel
/// interno. Geometria (externo → interno): ano · mês · semana · avatar.
public struct AvatarConsistencyRings: View {
    private let rings: ConsistencyRings
    private let avatarURL: String?
    private let fallback: String
    private let size: CGFloat
    private let hasStory: Bool
    private let storyViewed: Bool

    public init(
        rings: ConsistencyRings,
        avatarURL: String?,
        fallback: String,
        size: CGFloat = 150,
        hasStory: Bool = false,
        storyViewed: Bool = false
    ) {
        self.rings = rings
        self.avatarURL = avatarURL
        self.fallback = fallback
        self.size = size
        self.hasStory = hasStory
        self.storyViewed = storyViewed
    }

    public var body: some View {
        // Strokes/gaps proporcionais (mesma fórmula do web).
        let stroke = max(5, (size * 0.032).rounded())
        let ringGap = max(3, (size * 0.022).rounded())
        let storyGap = max(4, (size * 0.03).rounded())
        let ringStep = stroke + ringGap

        // O story ring (se houver) fica na borda; os anéis de consistência
        // começam abaixo dele. A folga do story é RESERVADA sempre que
        // hasStory (visto ou não) pra evitar layout shift ao ver o story.
        let storyInset = stroke / 2
        let outerInset = storyInset + (hasStory ? stroke + storyGap : 0)
        let weekInset = outerInset + 2 * ringStep

        // Avatar preenche o interior do anel mais interno (semana) com folga.
        let avatarPadding = max(6, (size * 0.04).rounded())
        let avatarDiameter = max(32, size - 2 * (weekInset + stroke / 2 + avatarPadding))

        ZStack {
            // Story ring só desenhado quando há story NOVO (web: visto → some).
            if hasStory && !storyViewed {
                Circle()
                    .inset(by: storyInset)
                    .stroke(storyGradient, lineWidth: stroke)
            }

            ringCircle(progress: rings.year,  color: GymCircleTheme.ColorToken.deepBlue,     inset: outerInset,             stroke: stroke)
            ringCircle(progress: rings.month, color: GymCircleTheme.ColorToken.electricBlue, inset: outerInset + ringStep,  stroke: stroke)
            ringCircle(progress: rings.week,  color: GymCircleTheme.ColorToken.cyan,         inset: weekInset,              stroke: stroke)

            GCAvatar(url: avatarURL, fallback: fallback, size: avatarDiameter)
        }
        .frame(width: size, height: size)
    }

    private func ringCircle(progress: Double, color: Color, inset: CGFloat, stroke: CGFloat) -> some View {
        ZStack {
            // Track constante (cyan/16%, igual web) — garante os 3 anéis
            // visíveis mesmo com progresso 0.
            Circle()
                .inset(by: inset)
                .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.16), lineWidth: stroke)
            Circle()
                .inset(by: inset)
                .trim(from: 0, to: max(0.02, min(progress, 1)))
                .stroke(color, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(GymCircleTheme.Motion.smooth, value: progress)
        }
    }

    /// Story ring com o gradiente da MARCA (brand → mês → ano), igual ao web
    /// (`gc-story-gradient`: var(--gc-brand) → consistency-month → year).
    /// Linear diagonal como o web — NÃO rosa/laranja.
    private var storyGradient: LinearGradient {
        LinearGradient(
            colors: [
                GymCircleTheme.ColorToken.cyan,
                GymCircleTheme.ColorToken.electricBlue,
                GymCircleTheme.ColorToken.deepBlue
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
