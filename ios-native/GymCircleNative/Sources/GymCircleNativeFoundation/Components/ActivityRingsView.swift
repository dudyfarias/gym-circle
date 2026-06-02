import SwiftUI

public struct ActivityRingsView: View {
    private let rings: ConsistencyRings
    private let lineWidth: CGFloat

    public init(rings: ConsistencyRings, lineWidth: CGFloat = 12) {
        self.rings = rings
        self.lineWidth = lineWidth
    }

    public var body: some View {
        ZStack {
            ring(progress: rings.year, color: GymCircleTheme.ColorToken.deepBlue, inset: 0)
            ring(progress: rings.month, color: GymCircleTheme.ColorToken.electricBlue, inset: 20)
            ring(progress: rings.week, color: GymCircleTheme.ColorToken.cyan, inset: 40)

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
