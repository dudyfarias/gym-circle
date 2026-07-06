import SwiftUI
import UniformTypeIdentifiers

public struct TrainingLibraryView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var model: GymCircleAppModel
    private let onStartPlan: (WorkoutPlan) -> Void

    private enum Section: String, CaseIterable, Identifiable {
        case plans
        case records

        var id: String { rawValue }
        var label: String {
            switch self {
            case .plans: return Loc.t("Plans", "Planilhas")
            case .records: return Loc.t("Records", "Recordes")
            }
        }
    }

    @State private var section: Section = .plans
    @State private var plans: [WorkoutPlan] = []
    @State private var records: [PersonalRecord] = []
    @State private var loading = true
    @State private var editor: WorkoutPlanEditorDraft?
    @State private var deleteTarget: WorkoutPlan?
    @State private var rankingRecord: PersonalRecord?

    public init(
        model: GymCircleAppModel,
        showRecordsInitially: Bool = false,
        onStartPlan: @escaping (WorkoutPlan) -> Void
    ) {
        self.model = model
        self.onStartPlan = onStartPlan
        _section = State(initialValue: showRecordsInitially ? .records : .plans)
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        Picker("", selection: $section) {
                            ForEach(Section.allCases) { item in
                                Text(item.label).tag(item)
                            }
                        }
                        .pickerStyle(.segmented)

                        if loading {
                            ProgressView()
                                .tint(GymCircleTheme.ColorToken.cyan)
                                .padding(.top, 50)
                        } else if section == .plans {
                            plansSection
                        } else {
                            recordsSection
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle(Loc.t("Training", "Treinos"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
                if section == .plans {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            editor = WorkoutPlanEditorDraft()
                        } label: {
                            Image(systemName: "plus")
                                .fontWeight(.bold)
                        }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                        .accessibilityLabel(Loc.t("New plan", "Nova planilha"))
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await reload() }
        .sheet(item: $editor) { draft in
            WorkoutPlanEditorView(
                model: model,
                draft: draft,
                onSaved: {
                    editor = nil
                    Task { await reloadPlans() }
                }
            )
        }
        .sheet(item: $rankingRecord) { record in
            PersonalRecordRankingView(model: model, record: record)
        }
        .confirmationDialog(
            Loc.t("Delete this plan?", "Apagar esta planilha?"),
            isPresented: Binding(
                get: { deleteTarget != nil },
                set: { if !$0 { deleteTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button(Loc.delete, role: .destructive) {
                guard let target = deleteTarget else { return }
                Task {
                    _ = await model.deleteWorkoutPlan(id: target.id)
                    deleteTarget = nil
                    await reloadPlans()
                }
            }
            Button(Loc.cancel, role: .cancel) { deleteTarget = nil }
        }
    }

    private var plansSection: some View {
        VStack(spacing: 12) {
            Button {
                editor = WorkoutPlanEditorDraft(importImmediately: true)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "doc.viewfinder")
                        .font(.system(size: 18, weight: .bold))
                        .frame(width: 42, height: 42)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(GymCircleTheme.ColorToken.cyan.opacity(0.12))
                        )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(Loc.t("Import photo or PDF", "Importar foto ou PDF"))
                            .font(.system(size: 14.5, weight: .black))
                        Text(Loc.t(
                            "Processed on this device",
                            "Processado neste aparelho"
                        ))
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.42))
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.35))
                }
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                .padding(14)
                .background(cardBackground)
            }
            .buttonStyle(.plain)

            if plans.isEmpty {
                emptyState(
                    icon: "list.clipboard",
                    title: Loc.t("No plans yet", "Nenhuma planilha ainda"),
                    body: Loc.t(
                        "Create one or import a clear photo/PDF.",
                        "Crie uma ou importe uma foto/PDF nítida."
                    )
                )
            } else {
                ForEach(plans) { plan in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(plan.name)
                                    .font(.system(size: 16, weight: .black))
                                Text(planSummary(plan))
                                    .font(.system(size: 11.5, weight: .bold))
                                    .foregroundStyle(Color.white.opacity(0.44))
                                    .lineLimit(2)
                            }
                            Spacer()
                            Menu {
                                Button {
                                    editor = WorkoutPlanEditorDraft(plan: plan)
                                } label: {
                                    Label(Loc.t("Edit", "Editar"), systemImage: "pencil")
                                }
                                Button(role: .destructive) {
                                    deleteTarget = plan
                                } label: {
                                    Label(Loc.delete, systemImage: "trash")
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .frame(width: 34, height: 34)
                                    .background(Circle().fill(Color.white.opacity(0.06)))
                            }
                            .foregroundStyle(Color.white.opacity(0.7))
                        }
                        Button {
                            onStartPlan(plan)
                            dismiss()
                        } label: {
                            Label(
                                Loc.t("Start workout", "Iniciar treino"),
                                systemImage: "play.fill"
                            )
                            .font(.system(size: 13.5, weight: .black))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .foregroundStyle(.black)
                            .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(16)
                    .background(cardBackground)
                }
            }
        }
    }

    private var recordsSection: some View {
        VStack(spacing: 12) {
            if records.isEmpty {
                emptyState(
                    icon: "trophy",
                    title: Loc.t("Your first record is next", "Seu primeiro recorde vem no próximo treino"),
                    body: Loc.t(
                        "Log weights or complete a 5K/10K run.",
                        "Registre cargas ou complete uma corrida de 5 km/10 km."
                    )
                )
            } else {
                ForEach(records) { record in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 12) {
                            Image(systemName: record.unit == "kg" ? "dumbbell.fill" : "timer")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                .frame(width: 42, height: 42)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(GymCircleTheme.ColorToken.cyan.opacity(0.12))
                                )
                            VStack(alignment: .leading, spacing: 2) {
                                Text(recordTitle(record))
                                    .font(.system(size: 14, weight: .black))
                                Text(formatRecord(record))
                                    .font(.system(size: 25, weight: .black, design: .rounded))
                                    .monospacedDigit()
                                if record.isEstimated {
                                    Text(Loc.t(
                                        "Estimated from average pace",
                                        "Estimado pelo ritmo médio"
                                    ))
                                    .font(.system(size: 10.5, weight: .bold))
                                    .foregroundStyle(Color.white.opacity(0.38))
                                }
                            }
                            Spacer()
                        }
                        Button {
                            rankingRecord = record
                        } label: {
                            Label(
                                Loc.t("Compare with friends", "Comparar com amigos"),
                                systemImage: "person.2.fill"
                            )
                            .font(.system(size: 12.5, weight: .black))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color.white.opacity(0.06)))
                        }
                        .buttonStyle(.plain)
                    }
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    .padding(16)
                    .background(cardBackground)
                }
            }
        }
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(Color.white.opacity(0.035))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.075), lineWidth: 1)
            )
    }

    private func emptyState(icon: String, title: String, body: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.36))
            Text(title)
                .font(.system(size: 16, weight: .black))
            Text(body)
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.44))
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(cardBackground)
    }

    private func reload() async {
        loading = true
        async let loadedPlans = model.workoutPlans()
        async let loadedRecords = model.personalRecords()
        plans = await loadedPlans
        records = await loadedRecords
        loading = false
    }

    private func reloadPlans() async {
        plans = await model.workoutPlans()
    }
}

public struct WorkoutPlanEditorDraft: Identifiable {
    public let id = UUID()
    public let storedId: UUID?
    public var name: String
    public var exercises: [WorkoutPlanExercise]
    public let importImmediately: Bool

    public init(
        storedId: UUID? = nil,
        name: String = "",
        exercises: [WorkoutPlanExercise] = [
            WorkoutPlanExercise(name: "", sets: nil, reps: nil)
        ],
        importImmediately: Bool = false
    ) {
        self.storedId = storedId
        self.name = name
        self.exercises = exercises
        self.importImmediately = importImmediately
    }

    public init(plan: WorkoutPlan) {
        self.init(
            storedId: plan.id,
            name: plan.name,
            exercises: plan.exercises
        )
    }
}

private struct WorkoutPlanEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: GymCircleAppModel
    let onSaved: () -> Void

    @State private var storedId: UUID?
    @State private var name: String
    @State private var exercises: [WorkoutPlanExercise]
    @State private var importing = false
    @State private var saving = false
    @State private var importError: String?
    @State private var fileImporterPresented = false

    init(
        model: GymCircleAppModel,
        draft: WorkoutPlanEditorDraft,
        onSaved: @escaping () -> Void
    ) {
        self.model = model
        self.onSaved = onSaved
        _storedId = State(initialValue: draft.storedId)
        _name = State(initialValue: draft.name)
        _exercises = State(initialValue: draft.exercises)
        _fileImporterPresented = State(initialValue: draft.importImmediately)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        Button {
                            fileImporterPresented = true
                        } label: {
                            Label(
                                Loc.t("Import photo or PDF", "Importar foto ou PDF"),
                                systemImage: "doc.viewfinder"
                            )
                            .font(.system(size: 13.5, weight: .black))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(GymCircleTheme.ColorToken.cyan.opacity(0.09))
                            )
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)

                        if importing {
                            ProgressView(Loc.t("Reading file…", "Lendo arquivo…"))
                                .tint(GymCircleTheme.ColorToken.cyan)
                        }
                        if let importError {
                            Text(importError)
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundStyle(GymCircleTheme.ColorToken.pink)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        TextField(
                            Loc.t("Plan name", "Nome da planilha"),
                            text: $name
                        )
                        .font(.system(size: 16, weight: .black))
                        .padding(14)
                        .background(fieldBackground)

                        ForEach($exercises) { $exercise in
                            VStack(spacing: 9) {
                                HStack {
                                    TextField(
                                        Loc.t("Exercise", "Exercício"),
                                        text: $exercise.name
                                    )
                                    .font(.system(size: 14.5, weight: .bold))
                                    Button {
                                        exercises.removeAll { $0.id == exercise.id }
                                        if exercises.isEmpty {
                                            exercises.append(
                                                WorkoutPlanExercise(name: "", sets: nil, reps: nil)
                                            )
                                        }
                                    } label: {
                                        Image(systemName: "trash")
                                            .foregroundStyle(Color.white.opacity(0.38))
                                    }
                                    .buttonStyle(.plain)
                                }
                                HStack(spacing: 10) {
                                    numberField(
                                        Loc.t("Sets", "Séries"),
                                        value: $exercise.sets
                                    )
                                    Text("×")
                                        .fontWeight(.black)
                                        .foregroundStyle(Color.white.opacity(0.3))
                                    numberField("Reps", value: $exercise.reps)
                                }
                            }
                            .padding(14)
                            .background(fieldBackground)
                        }

                        Button {
                            exercises.append(
                                WorkoutPlanExercise(name: "", sets: nil, reps: nil)
                            )
                        } label: {
                            Label(
                                Loc.t("Add exercise", "Adicionar exercício"),
                                systemImage: "plus"
                            )
                            .font(.system(size: 13.5, weight: .black))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                    .padding(20)
                }
            }
            .navigationTitle(
                storedId == nil
                    ? Loc.t("New plan", "Nova planilha")
                    : Loc.t("Edit plan", "Editar planilha")
            )
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(Loc.cancel) { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.save) {
                        Task { await save() }
                    }
                    .fontWeight(.black)
                    .disabled(!canSave || saving)
                }
            }
        }
        .preferredColorScheme(.dark)
        .fileImporter(
            isPresented: $fileImporterPresented,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: false
        ) { result in
            guard case let .success(urls) = result,
                  let url = urls.first else { return }
            Task { await importDocument(url) }
        }
    }

    private var canSave: Bool {
        exercises.contains { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private var fieldBackground: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(Color.white.opacity(0.055))
    }

    private func numberField(_ label: String, value: Binding<Int?>) -> some View {
        TextField(
            label,
            text: Binding(
                get: { value.wrappedValue.map(String.init) ?? "" },
                set: { value.wrappedValue = Int($0.filter(\.isNumber)) }
            )
        )
        .keyboardType(.numberPad)
        .multilineTextAlignment(.center)
        .font(.system(size: 14.5, weight: .black, design: .rounded))
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.045))
        )
    }

    private func importDocument(_ url: URL) async {
        importing = true
        importError = nil
        do {
            let imported = try await WorkoutPlanDocumentImporter.importFile(url)
            name = imported.name
            exercises = imported.exercises
        } catch {
            importError = error.localizedDescription
        }
        importing = false
    }

    private func save() async {
        saving = true
        let cleanExercises = exercises.filter {
            !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        let saved = await model.saveWorkoutPlan(
            id: storedId,
            name: name.isEmpty ? Loc.t("My plan", "Minha planilha") : name,
            exercises: cleanExercises
        )
        saving = false
        if saved {
            onSaved()
            dismiss()
        }
    }
}

private struct PersonalRecordRankingView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: GymCircleAppModel
    let record: PersonalRecord
    @State private var rows: [PersonalRecordLeaderboardRow] = []
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ZStack {
                GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()
                if loading {
                    ProgressView()
                        .tint(GymCircleTheme.ColorToken.cyan)
                } else if rows.isEmpty {
                    Text(Loc.t(
                        "No other marks yet.",
                        "Ainda não há outras marcas."
                    ))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.45))
                } else {
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(rows) { row in
                                HStack(spacing: 12) {
                                    Text("\(row.rank)")
                                        .font(.system(size: 13, weight: .black))
                                        .frame(width: 32, height: 32)
                                        .background(Circle().fill(Color.white.opacity(0.07)))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(row.displayName)
                                            .font(.system(size: 14, weight: .black))
                                        Text("@\(row.username)")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(Color.white.opacity(0.38))
                                    }
                                    Spacer()
                                    Text(formatRecord(row))
                                        .font(.system(size: 15, weight: .black, design: .rounded))
                                        .monospacedDigit()
                                }
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .fill(Color.white.opacity(0.04))
                                )
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .navigationTitle(Loc.t("Circle ranking", "Ranking do circle"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            rows = await model.personalRecordLeaderboard(
                metric: record.metric,
                exerciseKey: record.exerciseKey
            )
            loading = false
        }
    }
}

private func planSummary(_ plan: WorkoutPlan) -> String {
    plan.exercises.map { exercise in
        if let sets = exercise.sets, let reps = exercise.reps {
            return "\(exercise.name) \(sets)×\(reps)"
        }
        return exercise.name
    }
    .joined(separator: " · ")
}

private func recordTitle(_ record: PersonalRecord) -> String {
    if let exercise = record.exerciseName { return exercise }
    switch record.metric {
    case .strengthWeight:
        return Loc.t("Heaviest weight", "Maior carga")
    case .run5KTime:
        return Loc.t("Best 5K", "Melhor 5 km")
    case .run10KTime:
        return Loc.t("Best 10K", "Melhor 10 km")
    }
}

private func formatRecord(_ record: PersonalRecord) -> String {
    formatRecord(unit: record.unit, value: record.value, reps: record.reps)
}

private func formatRecord(_ record: PersonalRecordLeaderboardRow) -> String {
    formatRecord(unit: record.unit, value: record.value, reps: record.reps)
}

private func formatRecord(unit: String, value: Double, reps: Int?) -> String {
    if unit == "seconds" {
        let seconds = max(0, Int(value.rounded()))
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let remainder = seconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, remainder)
        }
        return String(format: "%d:%02d", minutes, remainder)
    }
    let weight = value.rounded() == value
        ? String(Int(value))
        : String(format: "%.1f", value)
    if let reps {
        return "\(weight) kg × \(reps)"
    }
    return "\(weight) kg"
}
