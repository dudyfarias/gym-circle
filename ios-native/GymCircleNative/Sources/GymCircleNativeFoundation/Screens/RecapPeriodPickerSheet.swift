import SwiftUI

/// RecapPeriodPickerSheet — Sprint 8.13.4 (paridade Sprint 5.10 web).
///
/// Sheet de seleção de período para o Monthly Recap. 2 modos:
///   - Por mês (default): grid 3-col de meses do ano corrente
///   - Por ano: lista anos passados
///
/// Callback `onSelect(period: RecapPeriod)` retorna a escolha pro caller.
/// Caller (MyCircleView) usa o periodKey pra abrir MonthlyRecapSheet
/// configurado naquele período.
public struct RecapPeriodPickerSheet: View {
    public let onSelect: (RecapPeriod) -> Void
    public let onClose: () -> Void

    @State private var activeMode: PickerMode = .month

    public init(
        onSelect: @escaping (RecapPeriod) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.onSelect = onSelect
        self.onClose = onClose
    }

    enum PickerMode: Hashable {
        case month
        case year
    }

    public var body: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                modeChips
                Divider().background(Color.white.opacity(0.06))

                ScrollView {
                    VStack(spacing: 16) {
                        switch activeMode {
                        case .month: monthsGrid
                        case .year:  yearsList
                        }
                        Spacer(minLength: 32)
                    }
                    .padding(20)
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white)
            }
            Spacer()
            Text(L10n.myCircleOutroPeriodo.string)
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(.white)
            Spacer()
            Spacer().frame(width: 36)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - Mode chips

    private var modeChips: some View {
        HStack(spacing: 6) {
            modeChip(.month, label: L10n.myCircleMes.string)
            modeChip(.year, label: L10n.myCircleAno.string)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }

    private func modeChip(_ mode: PickerMode, label: String) -> some View {
        let isActive = activeMode == mode
        return Button(action: { activeMode = mode }) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.6)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    Capsule().fill(isActive ? GymCircleTheme.ColorToken.electricBlue : Color.white.opacity(0.04))
                )
                .foregroundColor(isActive ? .black : .white.opacity(0.68))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Months grid

    private var monthsGrid: some View {
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        let currentYear = cal.component(.year, from: now)
        let currentMonth = cal.component(.month, from: now)

        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            ForEach(1...12, id: \.self) { month in
                let isFuture = month > currentMonth
                let periodKey = String(format: "%04d-%02d", currentYear, month)
                let label = monthShortName(month, year: currentYear)

                Button(action: {
                    onSelect(.init(periodKey: periodKey, label: label, kind: .month))
                }) {
                    VStack(spacing: 4) {
                        Text(label)
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundColor(isFuture ? .white.opacity(0.24) : .white)
                        Text(String(currentYear))
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white.opacity(0.42))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.white.opacity(isFuture ? 0.02 : 0.05))
                    )
                }
                .buttonStyle(.plain)
                .disabled(isFuture)
            }
        }
    }

    // MARK: - Years list

    private var yearsList: some View {
        let cal = Calendar(identifier: .gregorian)
        let currentYear = cal.component(.year, from: Date())
        // Mostra os últimos 5 anos (incluindo corrente).
        let years = (max(currentYear - 4, 2020)...currentYear).reversed()

        return VStack(spacing: 8) {
            ForEach(Array(years), id: \.self) { year in
                Button(action: {
                    onSelect(.init(periodKey: String(year), label: String(year), kind: .year))
                }) {
                    HStack {
                        Text(String(year))
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundColor(.white.opacity(0.42))
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.white.opacity(0.05))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Helpers

    private func monthShortName(_ month: Int, year: Int) -> String {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = 1
        let date = Calendar(identifier: .gregorian).date(from: comps) ?? Date()
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "LLL"
        return formatter.string(from: date).capitalized
    }
}

/// Sprint 8.13.4 — período escolhido pelo user no picker.
public struct RecapPeriod: Hashable, Sendable {
    public enum Kind: String, Sendable {
        case month
        case year
    }

    public let periodKey: String  // "YYYY-MM" ou "YYYY"
    public let label: String      // "Jun" ou "2026"
    public let kind: Kind

    public init(periodKey: String, label: String, kind: Kind) {
        self.periodKey = periodKey
        self.label = label
        self.kind = kind
    }
}
