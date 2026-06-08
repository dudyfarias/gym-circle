import SwiftUI

public struct ActivityRingsView: View {
    private let rings: ConsistencyRings
    private let lineWidth: CGFloat
    /// Sprint 9.8.3 — quando true, mostra story ring rosa/azul gradient
    /// envolvendo os rings (paridade web AvatarConsistencyRings hasStory).
    private let hasStory: Bool
    /// Sprint 9.8.3 — true = story visto (dimmed); false = não visto (vibrant).
    private let storyViewed: Bool

    public init(
        rings: ConsistencyRings,
        lineWidth: CGFloat = 12,
        hasStory: Bool = false,
        storyViewed: Bool = false
    ) {
        self.rings = rings
        self.lineWidth = lineWidth
        self.hasStory = hasStory
        self.storyViewed = storyViewed
    }

    public var body: some View {
        ZStack {
            // Sprint 9.8.3 — story ring (gradient rosa→cyan) por fora dos consistency rings
            if hasStory {
                storyRing
            }

            ring(progress: rings.year, color: GymCircleTheme.ColorToken.deepBlue, inset: hasStory ? 8 : 0)
            ring(progress: rings.month, color: GymCircleTheme.ColorToken.electricBlue, inset: hasStory ? 24 : 20)
            ring(progress: rings.week, color: GymCircleTheme.ColorToken.cyan, inset: hasStory ? 40 : 40)

            VStack(spacing: 2) {
                GCText("\(Int((rings.week * 7).rounded()))", style: .number)
                    .minimumScaleFactor(0.6)
                GCText("SEMANA", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .padding(10)
        .shadow(color: GymCircleTheme.ColorToken.electricBlue.opacity(0.24), radius: 28)
    }

    /// Sprint 9.8.3 — story ring gradient (rosa #FF477E → cyan brand) ou
    /// dim (cinza) quando já visto. Paridade web AvatarConsistencyRings.
    private var storyRing: some View {
        Circle()
            .stroke(
                AngularGradient(
                    gradient: Gradient(colors: storyViewed
                        ? [Color.white.opacity(0.32), Color.white.opacity(0.16)]
                        : [
                            Color(red: 1.0, green: 0.28, blue: 0.49),    // #FF477E pink
                            Color(red: 1.0, green: 0.6, blue: 0.28),     // #FF9947 orange
                            GymCircleTheme.ColorToken.electricBlue,
                            Color(red: 1.0, green: 0.28, blue: 0.49)
                        ]),
                    center: .center
                ),
                style: StrokeStyle(lineWidth: 3, lineCap: .round)
            )
    }

    private func ring(progress: Double, color: Color, inset: CGFloat) -> some View {
        ZStack {
            Circle()
                .inset(by: inset)
                .stroke(color.opacity(0.12), lineWidth: lineWidth)
            Circle()
                .inset(by: inset)
                .trim(from: 0, to: max(0.04, min(progress, 1)))
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(GymCircleTheme.Motion.smooth, value: progress)
        }
    }
}
