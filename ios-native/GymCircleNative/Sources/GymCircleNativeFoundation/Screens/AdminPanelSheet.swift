import SwiftUI

/// AdminPanelSheet — paridade web `AdminPanelSheet` (Alpha admin, SÓ LEITURA).
/// 6 tiles de resumo + listas dos últimos dias / denúncias / bloqueios /
/// pedidos de exclusão. Gateado pra "dudy" no SettingsSheet.
public struct AdminPanelSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    @Environment(\.dismiss) private var dismiss

    @State private var summary: AdminSummary?
    @State private var daily: [AdminDailyMetric] = []
    @State private var reports: [AdminReportRow] = []
    @State private var blocks: [AdminBlockRow] = []
    @State private var deletions: [AdminDeletionRow] = []
    @State private var error: String?
    @State private var loaded = false

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if let error {
                        GCText(error, style: .caption, color: GymCircleTheme.ColorToken.pink)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 16).fill(GymCircleTheme.ColorToken.pink.opacity(0.10)))
                    }
                    statsGrid
                    section(Loc.t("Last days", "Últimos dias")) { dailyList }
                    section(Loc.t("Reports", "Denúncias"), empty: reports.isEmpty ? Loc.t("No open reports.", "Nenhuma denúncia aberta.") : nil) {
                        ForEach(reports) { r in
                            rowCard(title: r.reason ?? "—", detail: "\(r.status ?? "—") · \(shortDate(r.createdAt))")
                        }
                    }
                    section(Loc.t("Blocks", "Bloqueios"), empty: blocks.isEmpty ? Loc.t("No blocks.", "Nenhum bloqueio.") : nil) {
                        ForEach(blocks) { b in
                            rowCard(
                                title: (b.reason?.isEmpty == false ? b.reason! : Loc.t("Social block", "Bloqueio social")),
                                detail: "\(shortDate(b.createdAt)) · \(b.blockerId.prefix(6)) → \(b.blockedId.prefix(6))"
                            )
                        }
                    }
                    section(Loc.t("Account deletion", "Exclusão de conta"), empty: deletions.isEmpty ? Loc.t("No requests.", "Nenhum pedido.") : nil) {
                        ForEach(deletions) { d in
                            rowCard(title: d.reason ?? Loc.t("Deletion request", "Pedido de exclusão"), detail: "\(d.status ?? "—") · \(shortDate(d.createdAt))", icon: "trash")
                        }
                    }
                }
                .padding(20)
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("Alpha admin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
            .task {
                guard !loaded else { return }
                loaded = true
                await load()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Resumo

    private var statsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
            statTile("person.2.fill", Loc.t("Users", "Usuários"), summary?.usersRegistered ?? 0, Loc.t("signups", "cadastros"))
            statTile("photo.fill", "Posts", summary?.postsToday ?? 0, Loc.t("today", "hoje"))
            statTile("waveform.path.ecg", Loc.t("Active", "Ativos"), summary?.activeUsersToday ?? 0, Loc.t("today", "hoje"))
            statTile("flame.fill", "Streaks", summary?.streaksLitToday ?? 0, Loc.t("lit", "acesos"))
            statTile("flag.fill", Loc.t("Reports", "Denúncias"), summary?.openReports ?? 0, Loc.t("open", "abertas"))
            statTile("nosign", Loc.t("Blocks", "Bloqueios"), summary?.blocksTotal ?? 0, "total")
        }
    }

    private func statTile(_ icon: String, _ label: String, _ value: Int, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                GCText(label, style: .sectionLabel)
                Spacer(minLength: 0)
            }
            GCText("\(value)", style: .title)
            GCText(detail, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.5)))
    }

    // MARK: - Últimos dias

    private var dailyList: some View {
        ForEach(daily) { item in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    GCText(item.metricDate, style: .body)
                    Spacer()
                    GCText("\(item.activeUsers ?? 0) \(Loc.t("active", "ativos"))", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }
                HStack {
                    metric("\(item.postsCreated ?? 0)", "posts")
                    metric("\(item.storiesCreated ?? 0)", "stories")
                    metric("\(item.streaksLit ?? 0)", "streaks")
                    metric("\(item.usersRegistered ?? 0)", Loc.t("signups", "signups"))
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.5)))
        }
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            GCText(value, style: .body)
            GCText(label, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Helpers de layout

    @ViewBuilder
    private func section<Content: View>(_ title: String, empty: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            GCText(title, style: .headline)
            if let empty {
                GCText(empty, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            } else {
                content()
            }
        }
    }

    private func rowCard(title: String, detail: String, icon: String? = nil) -> some View {
        HStack(spacing: 10) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            }
            VStack(alignment: .leading, spacing: 2) {
                GCText(title, style: .body)
                GCText(detail, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.5)))
    }

    private func shortDate(_ iso: String) -> String {
        // "2026-06-23T12:00:00..." → "2026-06-23 12:00"
        let trimmed = iso.replacingOccurrences(of: "T", with: " ")
        return String(trimmed.prefix(16))
    }

    private func load() async {
        guard let admin = model.adminService else { return }
        async let s = admin.summary()
        async let d = admin.dailyMetrics()
        async let r = admin.reports()
        async let b = admin.blocks()
        async let del = admin.deletionRequests()
        summary = (try? await s) ?? nil
        daily = (try? await d) ?? []
        reports = (try? await r) ?? []
        blocks = (try? await b) ?? []
        deletions = (try? await del) ?? []
        if summary == nil && daily.isEmpty {
            error = Loc.t("Could not load admin data.", "Não foi possível carregar o admin.")
        }
    }
}
