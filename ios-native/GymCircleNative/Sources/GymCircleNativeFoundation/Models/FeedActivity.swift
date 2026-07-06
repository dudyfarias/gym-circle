import Foundation

/// Entrada de atividade no feed (RPC get_home_activities) — espelho do
/// FeedCheckin. Treino gravado sem foto, com as MESMAS infos de post
/// (legenda, local, tags): modelo mutável check-in(treino) ↔ post ↔
/// carrossel. "Adicionar fotos" promove a post via posts.source_activity_id
/// (a entrada some do feed e volta se o post for apagado).
public struct FeedActivity: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let userId: String
    public let activityType: String
    public let mode: String
    public let origin: String
    public let sourceApp: String?
    public let startedAt: String?
    public let endedAt: String?
    public let elapsedS: Int
    public let avgHr: Int?
    public let maxHr: Int?
    public let activeCalories: Double?
    public let totalCalories: Double?
    // Fase 2 (GPS outdoor) — presentes quando mode == "route".
    public let distanceM: Double?
    public let movingS: Int?
    public let elevationGainM: Double?
    /// Polyline [[lat, lng], ...] downsampled — só pro sketch do mini-mapa.
    public let route: [[Double]]?
    /// Séries de musculação (só treino de força).
    public let strengthSets: [WorkoutStrengthSet]?
    public let workoutDate: String
    public let createdAt: String
    public let caption: String?
    public let workoutTypes: [String]?
    public let gymId: String?
    public let gymName: String?
    public let locationName: String?
    public let locationLatitude: Double?
    public let locationLongitude: Double?
    public let locationGoogleMapsUrl: String?
    public let username: String
    public let displayName: String?
    public let avatarURL: String?
    public let authorCurrentStreak: Int?
    public let authorBestStreak: Int?
    public let authorBadgeActive: Bool?
    public let isFollowingAuthor: Bool?
    public let visibility: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case activityType = "activity_type"
        case mode
        case origin
        case sourceApp = "source_app"
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case elapsedS = "elapsed_s"
        case avgHr = "avg_hr"
        case maxHr = "max_hr"
        case activeCalories = "active_calories"
        case totalCalories = "total_calories"
        case distanceM = "distance_m"
        case movingS = "moving_s"
        case elevationGainM = "elevation_gain_m"
        case route
        case strengthSets = "strength_sets"
        case workoutDate = "workout_date"
        case createdAt = "created_at"
        case caption
        case workoutTypes = "workout_types"
        case gymId = "gym_id"
        case gymName = "gym_name"
        case locationName = "location_name"
        case locationLatitude = "location_latitude"
        case locationLongitude = "location_longitude"
        case locationGoogleMapsUrl = "location_google_maps_url"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case authorCurrentStreak = "author_current_streak"
        case authorBestStreak = "author_best_streak"
        case authorBadgeActive = "author_badge_active"
        case isFollowingAuthor = "is_following_author"
        case visibility
    }

    public var displayAuthorName: String {
        let name = displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? username : name
    }

    /// Local exibido no card (academia cadastrada > local livre).
    public var locationLabel: String? {
        gymName ?? locationName
    }

    /// "14:59 – 15:59" (SP) a partir de started_at/ended_at — cabeçalho do
    /// overlay de detalhes (estilo Apple Atividades). Vazio sem os horários.
    public var timeRangeLabel: String {
        guard let start = Self.parseISO(startedAt) else { return "" }
        let end = Self.parseISO(endedAt)
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "HH:mm"
        let startLabel = formatter.string(from: start)
        guard let end else { return startLabel }
        return "\(startLabel) – \(formatter.string(from: end))"
    }

    /// Data longa "sex., 3 de jul." (SP) — título do overlay.
    public var longDateLabel: String {
        let base = Self.parseISO(startedAt) ?? Self.parseISO(endedAt)
        guard let base else { return "" }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "EEE, d 'de' MMM"
        return formatter.string(from: base)
    }

    private static func parseISO(_ value: String?) -> Date? {
        guard let value else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

    /// P0.1 — a entrada de atividade também alimenta o overlay de detalhes.
    public var workoutDetail: WorkoutDetailData {
        WorkoutDetailData(
            activityType: activityType,
            startedAt: startedAt,
            endedAt: endedAt,
            elapsedS: elapsedS,
            movingS: movingS,
            distanceM: distanceM,
            elevationGainM: elevationGainM,
            avgHr: avgHr,
            activeCalories: activeCalories,
            totalCalories: totalCalories,
            route: route,
            strengthSets: strengthSets,
            gymName: gymName,
            locationName: locationName,
            caption: caption
        )
    }
}

/// Uma série de musculação: repetições e carga (kg). weightKg nil = peso do corpo.
public struct WorkoutStrengthSet: Codable, Equatable, Hashable, Sendable {
    public let reps: Int
    public let weightKg: Double?

    public init(reps: Int, weightKg: Double?) {
        self.reps = reps
        self.weightKg = weightKg
    }

    enum CodingKeys: String, CodingKey {
        case reps
        case weightKg = "weight_kg"
    }
}

/// Métricas de treino pro overlay de detalhes (Apple Atividades). Fonte comum:
/// a ENTRADA de atividade e o POST promovido de treino (P0.1).
public struct WorkoutDetailData: Identifiable, Equatable, Sendable {
    public let id = UUID()
    public let activityType: String
    public let startedAt: String?
    public let endedAt: String?
    public let elapsedS: Int
    public let movingS: Int?
    public let distanceM: Double?
    public let elevationGainM: Double?
    public let avgHr: Int?
    public let activeCalories: Double?
    public let totalCalories: Double?
    public let route: [[Double]]?
    public let strengthSets: [WorkoutStrengthSet]?
    public let gymName: String?
    public let locationName: String?
    public let caption: String?

    public var kind: WorkoutActivityKind {
        WorkoutActivityKind(rawValue: activityType) ?? .other
    }

    public var locationLabel: String? { gymName ?? locationName }

    /// "14:59 – 15:59" (SP) a partir de started_at/ended_at.
    public var timeRangeLabel: String {
        guard let start = Self.parseISO(startedAt) else { return "" }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "HH:mm"
        let startLabel = formatter.string(from: start)
        guard let end = Self.parseISO(endedAt) else { return startLabel }
        return "\(startLabel) – \(formatter.string(from: end))"
    }

    /// "sex., 3 de jul." (SP).
    public var longDateLabel: String {
        guard let base = Self.parseISO(startedAt) ?? Self.parseISO(endedAt) else { return "" }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "EEE, d 'de' MMM"
        return formatter.string(from: base)
    }

    private static func parseISO(_ value: String?) -> Date? {
        guard let value else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

    public static func == (lhs: WorkoutDetailData, rhs: WorkoutDetailData) -> Bool {
        lhs.id == rhs.id
    }
}

/// "Integrar treino" — treino do mesmo dia do post disponível pra juntar
/// (RPC get_mergeable_activities). Selecionar vincula via merge_activity_into_post.
public struct MergeableActivity: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let activityType: String
    public let elapsedS: Int
    public let movingS: Int?
    public let distanceM: Double?
    public let elevationGainM: Double?
    public let avgHr: Int?
    public let totalCalories: Double?
    public let startedAt: String?
    public let endedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case activityType = "activity_type"
        case elapsedS = "elapsed_s"
        case movingS = "moving_s"
        case distanceM = "distance_m"
        case elevationGainM = "elevation_gain_m"
        case avgHr = "avg_hr"
        case totalCalories = "total_calories"
        case startedAt = "started_at"
        case endedAt = "ended_at"
    }

    public var kind: WorkoutActivityKind {
        WorkoutActivityKind(rawValue: activityType) ?? .other
    }
}

/// Tipos de treino do rastreio (check constraint activities_type_chk) —
/// seletor estilo Apple Exercício, academia primeiro (público principal).
public enum WorkoutActivityKind: String, CaseIterable, Identifiable, Sendable {
    case strength, run, walk, ride, other

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .strength: return Loc.t("Strength", "Musculação")
        case .run: return Loc.t("Run", "Corrida")
        case .walk: return Loc.t("Walk", "Caminhada")
        case .ride: return Loc.t("Ride", "Bike")
        case .other: return Loc.t("Other", "Outro")
        }
    }

    public var hint: String {
        switch self {
        case .strength: return Loc.t("Weights and machines", "Pesos e máquinas")
        case .run: return Loc.t("Outdoor or treadmill", "Rua ou esteira")
        case .walk: return Loc.t("Light pace counts too", "Ritmo leve também conta")
        case .ride: return Loc.t("Road or indoor bike", "Rua ou bike indoor")
        case .other: return Loc.t("Any other workout", "Qualquer outro treino")
        }
    }

    public var icon: String {
        switch self {
        case .strength: return "dumbbell.fill"
        case .run: return "figure.run"
        case .walk: return "figure.walk"
        case .ride: return "bicycle"
        case .other: return "bolt.heart.fill"
        }
    }

    /// Tipos outdoor gravam rota por GPS (Fase 2); musculação/outro = sessão.
    public var usesRoute: Bool {
        self == .run || self == .walk || self == .ride
    }

    /// Tag preset do composer correspondente (mesmos valores PT-BR que o web
    /// persiste em workout_types). nil = sem pré-seleção.
    public var composerTag: String? {
        switch self {
        case .strength: return "Musculação"
        case .run: return "Corrida"
        case .ride: return "Bike"
        case .walk: return "Cardio"
        case .other: return nil
        }
    }
}

/// Contexto do treino encerrado dentro do composer: o publish sem foto salva
/// legenda/tags/local NA ENTRADA; com foto vira post ligado por
/// source_activity_id.
public struct ActivityComposerContext: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: WorkoutActivityKind
    public let elapsedS: Int
    public let workoutDate: String
    public let avgHr: Int?
    public let activeCalories: Double?

    public init(
        id: String,
        kind: WorkoutActivityKind,
        elapsedS: Int,
        workoutDate: String,
        avgHr: Int? = nil,
        activeCalories: Double? = nil
    ) {
        self.id = id
        self.kind = kind
        self.elapsedS = elapsedS
        self.workoutDate = workoutDate
        self.avgHr = avgHr
        self.activeCalories = activeCalories
    }
}

/// "5,02 km" (vírgula/ponto seguem o locale do aparelho).
public func gymCircleFormatKm(_ meters: Double) -> String {
    String(format: "%.2f km", meters / 1000)
}

/// "6:12 /km" a partir de segundos por km.
public func gymCircleFormatPace(_ secPerKm: Int) -> String {
    "\(secPerKm / 60):" + String(format: "%02d", secPerKm % 60) + " /km"
}

/// "45:12" ou "1:02:45" — mesmo formato do cronômetro e do card (web
/// formatElapsed).
public func gymCircleFormatElapsed(_ seconds: Int) -> String {
    let total = max(0, seconds)
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let secs = total % 60
    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, secs)
    }
    return String(format: "%02d:%02d", minutes, secs)
}
