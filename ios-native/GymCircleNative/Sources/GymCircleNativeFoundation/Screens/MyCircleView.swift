import SwiftUI

public struct MyCircleView: View {
    private let summary: MyCircleSummary
    private let isLoading: Bool
    private let error: String?
    private let onRetry: () -> Void

    public init(
        summary: MyCircleSummary,
        isLoading: Bool = false,
        error: String? = nil,
        onRetry: @escaping () -> Void = {}
    ) {
        self.summary = summary
        self.isLoading = isLoading
        self.error = error
        self.onRetry = onRetry
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                if isLoading {
                    loadingState
                } else if let error {
                    GCErrorState(
                        title: "Meu Circle indisponivel",
                        subtitle: error,
                        retryTitle: "Tentar de novo",
                        onRetry: onRetry
                    )
                } else {
                    GCGlassPanel {
                        VStack(spacing: 18) {
                            ActivityRingsView(rings: summary.rings)
                                .frame(maxWidth: 260)

                            VStack(spacing: 4) {
                                GCText("\(summary.stats.currentStreak)d", style: .title, color: GymCircleTheme.ColorToken.cyan)
                                GCText("streak atual", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }

                    HStack(spacing: 12) {
                        metric("Semana", "\(summary.stats.workoutsThisWeek)/7")
                        metric("Mes", "\(summary.stats.workoutsThisMonth)")
                        metric("Ano", "\(summary.stats.workoutsThisYear)")
                    }

                    if summary.badges.isEmpty {
                        GCEmptyState(title: "Badges em breve", subtitle: "A base nativa ja esta pronta para conquistas.")
                    } else {
                        ForEach(summary.badges) { badge in
                            GCCard {
                                VStack(alignment: .leading, spacing: 4) {
                                    GCText(badge.title, style: .headline)
                                    GCText(badge.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Meu Circle")
    }

    private var loadingState: some View {
        VStack(spacing: 18) {
            GCGlassPanel {
                VStack(spacing: 18) {
                    ActivityRingsView(rings: ConsistencyRings(workoutsThisWeek: 0, workoutsThisMonth: 0, workoutsThisYear: 0))
                        .frame(maxWidth: 260)
                        .opacity(0.55)
                    GCSkeletonBlock(height: 18, radius: 9)
                        .frame(width: 120)
                }
                .frame(maxWidth: .infinity)
            }
            HStack(spacing: 12) {
                GCSkeletonBlock(height: 96, radius: 22)
                GCSkeletonBlock(height: 96, radius: 22)
                GCSkeletonBlock(height: 96, radius: 22)
            }
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        GCCard {
            VStack(alignment: .leading, spacing: 8) {
                GCText(title, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                GCText(value, style: .headline, color: GymCircleTheme.ColorToken.cyan)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
