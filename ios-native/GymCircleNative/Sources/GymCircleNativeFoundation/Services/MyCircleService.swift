import Foundation
import Supabase

public actor MyCircleService {
    private let client: SupabaseClient
    private let calendar: Calendar

    public init(client: SupabaseClient, calendar: Calendar = .current) {
        self.client = client
        self.calendar = calendar
    }

    public func getSummary(userId: String, date: Date = Date()) async throws -> MyCircleSummary {
        // Sprint 8.11.1 — Fan-out: dispara TODAS as queries em paralelo.
        // Latência total ≈ max(query) em vez de soma.
        async let statsRow = fetchStats(userId: userId)
        async let activityDates = fetchActivityDates(userId: userId, since: startOfYear(for: date))
        async let postsCount = fetchPostsCount(userId: userId)
        async let followersCount = fetchFollowersCount(userId: userId)
        async let streakRestoreInfo = fetchStreakRestoreInfo(userId: userId)
        async let restoresAvailable = fetchRestoresAvailable(userId: userId)

        let stats = try await statsRow
        let dates = try await activityDates
        let uniqueDates = Set(dates.map(\.activityDate))

        let workoutsThisWeek = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .weekOfYear) }.count
        let workoutsThisMonth = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .month) }.count
        let workoutsThisYear = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .year) }.count

        // Sprint 8.11.2 — datas do mês alvo (já filtradas) pro calendar.
        let monthDays = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .month) }

        // Best effort nas contagens — falha não bloqueia summary.
        let postsCountValue = (try? await postsCount) ?? 0
        let followersCountValue = (try? await followersCount) ?? 0
        let streakRestore = (try? await streakRestoreInfo) ?? false
        let restoresAvailableValue = (try? await restoresAvailable) ?? 0

        return MyCircleSummary(
            stats: GymCircleStats(
                currentStreak: stats?.currentStreak ?? 0,
                bestStreak: stats?.bestStreak ?? 0,
                workoutsThisWeek: workoutsThisWeek,
                workoutsThisMonth: workoutsThisMonth,
                workoutsThisYear: workoutsThisYear
            ),
            postsCount: postsCountValue,
            followersCount: followersCountValue,
            hasUsedStreakRestore: streakRestore,
            workoutDays: Array(monthDays).sorted(),
            streakRestoresAvailable: restoresAvailableValue
        )
    }

    /// Sprint 22.x — restauradores de streak disponíveis. Lê só a coluna da
    /// tabela base `user_stats` (não o view live) — sem sync RPC.
    private func fetchRestoresAvailable(userId: String) async throws -> Int {
        struct Row: Decodable { let streak_restores_available: Int? }
        let rows: [Row] = try await client
            .from("user_stats")
            .select("streak_restores_available")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.streak_restores_available ?? 0
    }

    public func getConsistencyRings(userId: String, date: Date = Date()) async throws -> ConsistencyRings {
        try await getSummary(userId: userId, date: date).rings
    }

    /// Sprint 8.13.2 — workout types distintos do user nos últimos N dias.
    /// Usado pelo achievement secret `cross-trainer` (3+ tipos em 7d).
    ///
    /// Sprint 20.0 — port do fix multi-tags da web (f4e1f0b, drift B10):
    /// conta primária + tags do array `workout_types` (Sprint 13), com a
    /// MESMA normalização do `normalizeForCompare` web (lowercase + sem
    /// acentos) — antes "Musculação" e "musculacao" contavam como 2 e
    /// tags secundárias eram ignoradas, divergindo do Hall web.
    public func getDistinctWorkoutTypes(userId: String, sinceDaysAgo: Int) async throws -> Int {
        let calendar = Calendar(identifier: .gregorian)
        let cutoff = calendar.date(byAdding: .day, value: -sinceDaysAgo, to: .now) ?? .now
        let cutoffKey = Self.dateFormatter.string(from: cutoff)

        let rows: [PostWorkoutTypeRow] = try await client
            .from("posts")
            .select("workout_type,workout_types")
            .eq("user_id", value: userId)
            .gte("workout_date", value: cutoffKey)
            .execute()
            .value

        var types = Set<String>()
        for row in rows {
            if let normalized = Self.normalizeWorkoutType(row.workoutType) {
                types.insert(normalized)
            }
            for tag in row.workoutTypes ?? [] {
                if let normalized = Self.normalizeWorkoutType(tag) {
                    types.insert(normalized)
                }
            }
        }
        return types.count
    }

    /// Paridade com `normalizeForCompare` (web monthlyChallenges.ts):
    /// decomposição + remoção de acentos, lowercase, trim. Vazio ⇒ nil.
    static func normalizeWorkoutType(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let normalized = raw
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    /// Sprint 8.13.2 — gym IDs distintos do user nos últimos N dias.
    /// Usado pelo achievement secret `explorer` (5+ academias em 30d).
    public func getDistinctGyms(userId: String, sinceDaysAgo: Int) async throws -> Int {
        let calendar = Calendar(identifier: .gregorian)
        let cutoff = calendar.date(byAdding: .day, value: -sinceDaysAgo, to: .now) ?? .now
        let cutoffKey = Self.dateFormatter.string(from: cutoff)

        let rows: [PostGymRow] = try await client
            .from("posts")
            .select("gym_id")
            .eq("user_id", value: userId)
            .gte("workout_date", value: cutoffKey)
            .execute()
            .value
        return Set(rows.compactMap(\.gymId)).count
    }

    /// Sprint 9.5.5 — best streak (sequência consecutiva máxima) dentro do
    /// mês alvo. Algoritmo: pega user_activity_days do mês, ordena, conta
    /// runs consecutivas em dias adjacentes.
    public func getBestStreakInMonth(userId: String, monthKey: String) async throws -> Int {
        let days = try await getWorkoutDays(userId: userId, monthKey: monthKey)
        guard !days.isEmpty else { return 0 }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"

        let sortedDates = days.compactMap { formatter.date(from: $0) }.sorted()
        guard !sortedDates.isEmpty else { return 0 }

        var best = 1
        var current = 1
        let cal = Calendar(identifier: .gregorian)
        for i in 1..<sortedDates.count {
            if let diff = cal.dateComponents([.day], from: sortedDates[i - 1], to: sortedDates[i]).day,
               diff == 1 {
                current += 1
                best = max(best, current)
            } else {
                current = 1
            }
        }
        return best
    }

    /// Sprint 9.5.5 — workout type mais frequente no mês alvo.
    /// Group + count + sort client-side (simples, baixo volume típico).
    public func getTopWorkoutType(userId: String, monthKey: String) async throws -> String? {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return nil }

        let monthStart = String(format: "%04d-%02d-01", year, month)
        let nextMonth = month == 12 ? 1 : month + 1
        let nextYear = month == 12 ? year + 1 : year
        let monthEnd = String(format: "%04d-%02d-01", nextYear, nextMonth)

        let rows: [PostWorkoutTypeRow] = try await client
            .from("posts")
            .select("workout_type")
            .eq("user_id", value: userId)
            .gte("workout_date", value: monthStart)
            .lt("workout_date", value: monthEnd)
            .execute()
            .value

        var counts: [String: Int] = [:]
        // Sprint 20.0 — workoutType virou opcional (decode defensivo);
        // o top type do recap continua contando só a tag primária (a
        // "principal" do treino), com o display original preservado.
        for row in rows {
            guard let type = row.workoutType, !type.isEmpty else { continue }
            counts[type, default: 0] += 1
        }
        return counts.max(by: { $0.value < $1.value })?.key
    }

    /// Sprint 9.5.5 — gym mais frequente no mês. Retorna nome via join
    /// com `gyms` table. Quando gym_id é null em todos posts, retorna nil.
    public func getTopGymName(userId: String, monthKey: String) async throws -> String? {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return nil }

        let monthStart = String(format: "%04d-%02d-01", year, month)
        let nextMonth = month == 12 ? 1 : month + 1
        let nextYear = month == 12 ? year + 1 : year
        let monthEnd = String(format: "%04d-%02d-01", nextYear, nextMonth)

        // PostgREST embed: posts → gyms(name) via FK gym_id
        let rows: [PostGymJoinRow] = try await client
            .from("posts")
            .select("gym_id,gyms(name)")
            .eq("user_id", value: userId)
            .gte("workout_date", value: monthStart)
            .lt("workout_date", value: monthEnd)
            .execute()
            .value

        var counts: [String: Int] = [:]
        for row in rows {
            guard let name = row.gym?.name else { continue }
            counts[name, default: 0] += 1
        }
        return counts.max(by: { $0.value < $1.value })?.key
    }

    /// Sprint 8.13.1 — posts do mês para renderizar thumbnails no calendar.
    /// Retorna lista (workout_date, post_id, image_url) ordenada por
    /// workout_date asc. UI agrupa por dia (1 thumbnail por dia, prefere
    /// o primeiro post quando há mais que 1 no mesmo dia).
    /// `includeTagged`: além dos posts próprios, traz posts em que o user foi
    /// MARCADO (aceito) como FALLBACK por dia (calendário). Off por padrão — o
    /// RecapCoverPicker usa só posts próprios (capa do recap é asset do dono).
    public func getMonthPosts(
        userId: String,
        monthKey: String,
        includeTagged: Bool = false
    ) async throws -> [MonthCalendarPost] {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return [] }

        let monthStart = String(format: "%04d-%02d-01", year, month)
        let nextMonth = month == 12 ? 1 : month + 1
        let nextYear = month == 12 ? year + 1 : year
        let monthEnd = String(format: "%04d-%02d-01", nextYear, nextMonth)

        // Sprint 9.9.6 — withRetry: getMonthPosts alimenta calendar mini-fotos
        // + RecapCoverPicker. Falha cru deixaria o calendar vazio sem warning.
        // Posts PRÓPRIOS do mês.
        let ownRows: [PostThumbnailRow] = try await withRetry {
            try await self.client
                .from("posts")
                .select("id,workout_date,image_url,thumbnail_url,poster_url,media_type")
                .eq("user_id", value: userId)
                .gte("workout_date", value: monthStart)
                .lt("workout_date", value: monthEnd)
                .order("workout_date", ascending: true)
                .execute()
                .value
        }

        // Posts em que o user foi MARCADO (aceito) — fallback por dia quando não
        // há post próprio. post_participants → posts!inner (join + filtro de mês
        // no embed). Fail-soft: erro aqui não esvazia o calendário. Só quando
        // includeTagged (calendário) — recap usa só posts próprios.
        let taggedRows: [TaggedThumbnailRow]
        if includeTagged {
            taggedRows = (try? await withRetry {
                try await self.client
                    .from("post_participants")
                    .select("posts!inner(id,workout_date,image_url,thumbnail_url,poster_url,media_type)")
                    .eq("tagged_user_id", value: userId)
                    .eq("status", value: "accepted")
                    .gte("posts.workout_date", value: monthStart)
                    .lt("posts.workout_date", value: monthEnd)
                    .execute()
                    .value
            }) ?? []
        } else {
            taggedRows = []
        }

        // Mini-foto renderizável: thumbnail → poster → image_url (este só quando
        // NÃO é vídeo — em vídeo antigo sem thumbnail/poster, image_url é o
        // ARQUIVO de vídeo e a AsyncImage quebra a célula; melhor cair fora e
        // deixar a cell sólida, paridade com o buildMonthWorkoutDays web).
        func mapRow(_ row: PostThumbnailRow) -> MonthCalendarPost? {
            let best = row.thumbnailURL
                ?? row.posterURL
                ?? (row.mediaType == "video" ? nil : row.imageURL)
            guard let raw = best, let url = URL(string: raw) else { return nil }
            return MonthCalendarPost(dateKey: row.workoutDate, postId: row.id, imageURL: url)
        }

        // PRIORIDADE: próprios primeiro, marcados depois. O buildMonth pega o
        // PRIMEIRO post por dia → o próprio vence; o marcado só preenche o dia
        // sem post próprio.
        let ownPosts = ownRows.compactMap(mapRow)
        let taggedPosts = taggedRows.compactMap(\.posts).compactMap(mapRow)
        return ownPosts + taggedPosts
    }

    /// Sprint 8.11.3 — workout days de um mês específico (YYYY-MM).
    /// Usado pela navegação calendar ← → no MyCircleView. Range filtrado
    /// no DB pra evitar transferir o ano inteiro só pra mostrar 1 mês.
    public func getWorkoutDays(userId: String, monthKey: String) async throws -> [String] {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return [] }

        let monthStart = String(format: "%04d-%02d-01", year, month)
        // 1º dia do próximo mês = limite superior (exclusive via lt)
        let nextMonth = month == 12 ? 1 : month + 1
        let nextYear = month == 12 ? year + 1 : year
        let monthEnd = String(format: "%04d-%02d-01", nextYear, nextMonth)

        let rows: [UserActivityDayRow] = try await client
            .from("user_activity_days")
            .select("activity_date")
            .eq("user_id", value: userId)
            .gte("activity_date", value: monthStart)
            .lt("activity_date", value: monthEnd)
            .execute()
            .value
        return Array(Set(rows.map(\.activityDate))).sorted()
    }

    private func fetchStats(userId: String) async throws -> UserStatsLiveRow? {
        let rows: [UserStatsLiveRow] = try await client
            .from("user_stats_live")
            .select("user_id,current_streak,best_streak,workouts_this_month,active_days_this_year,badge_is_active_today")
            .eq("user_id", value: userId)
            .execute()
            .value

        return rows.first
    }

    private func fetchActivityDates(userId: String, since: String) async throws -> [UserActivityDayRow] {
        try await client
            .from("user_activity_days")
            .select("activity_date")
            .eq("user_id", value: userId)
            .gte("activity_date", value: since)
            .execute()
            .value
    }

    /// Sprint 8.11.1 — count(posts where user_id = userId).
    /// Usa head request com count=exact pra evitar baixar rows.
    private func fetchPostsCount(userId: String) async throws -> Int {
        let response = try await client
            .from("posts")
            .select("id", head: true, count: .exact)
            .eq("user_id", value: userId)
            .execute()
        return response.count ?? 0
    }

    /// Sprint 8.11.1 — count(follows where following_id = userId).
    /// `following_id` é quem está sendo seguido. Followers = pessoas que
    /// seguem o user (follower_id apontando pra user).
    private func fetchFollowersCount(userId: String) async throws -> Int {
        let response = try await client
            .from("follows")
            .select("follower_id", head: true, count: .exact)
            .eq("following_id", value: userId)
            .execute()
        return response.count ?? 0
    }

    /// Sprint 8.11.1 — true se `user_stats.last_streak_restore_used_at` é
    /// não-nulo (qualquer uso histórico desbloqueia badge).
    private func fetchStreakRestoreInfo(userId: String) async throws -> Bool {
        let rows: [UserStatsRestoreRow] = try await client
            .from("user_stats")
            .select("last_streak_restore_used_at")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.lastStreakRestoreUsedAt != nil
    }

    // MARK: - Sprint 22.x — Streak restore (card do perfil, paridade web)

    public struct StreakRestoreInfo: Sendable {
        public let status: String
        public let available: Int
        public let deadlineAt: Date?

        /// Mesma condição do web (canRestoreStreak): disponível, tem restaurador
        /// e o prazo ainda não venceu.
        public var canRestore: Bool {
            status == "available" && available > 0 && (deadlineAt.map { $0 > Date() } ?? false)
        }
    }

    /// Recomputa (sync_my_streak_restores) e lê o estado do restaurador de
    /// streak do user — espelha o services.stats do web (sync no load + leitura
    /// das colunas de user_stats).
    public func streakRestoreInfo(userId: String) async throws -> StreakRestoreInfo {
        _ = try? await client.rpc("sync_my_streak_restores").execute()
        struct Row: Decodable {
            let status: String?
            let available: Int?
            let deadlineAt: String?
            enum CodingKeys: String, CodingKey {
                case status = "streak_restore_status"
                case available = "streak_restores_available"
                case deadlineAt = "streak_restore_deadline_at"
            }
        }
        let rows: [Row] = try await client
            .from("user_stats")
            .select("streak_restore_status,streak_restores_available,streak_restore_deadline_at")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        let row = rows.first
        return StreakRestoreInfo(
            status: row?.status ?? "none",
            available: row?.available ?? 0,
            deadlineAt: row?.deadlineAt.flatMap(Self.parseTimestamp)
        )
    }

    /// Consome 1 restaurador (RPC use_streak_restore).
    public func consumeStreakRestore() async throws {
        _ = try await client.rpc("use_streak_restore").execute()
    }

    private static func parseTimestamp(_ s: String) -> Date? {
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: s) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: s)
    }

    private func startOfYear(for date: Date) -> String {
        let year = calendar.component(.year, from: date)
        return "\(year)-01-01"
    }

    private func isDateString(_ value: String, inSameComponentAs date: Date, component: Calendar.Component) -> Bool {
        guard let parsed = Self.dateFormatter.date(from: value) else {
            return false
        }
        return calendar.isDate(parsed, equalTo: date, toGranularity: component)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct UserStatsLiveRow: Codable, Sendable {
    let userId: String
    let currentStreak: Int
    let bestStreak: Int
    let workoutsThisMonth: Int
    let activeDaysThisYear: Int
    let badgeIsActiveToday: Bool

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case workoutsThisMonth = "workouts_this_month"
        case activeDaysThisYear = "active_days_this_year"
        case badgeIsActiveToday = "badge_is_active_today"
    }
}

private struct UserActivityDayRow: Codable, Sendable {
    let activityDate: String

    enum CodingKeys: String, CodingKey {
        case activityDate = "activity_date"
    }
}

/// Sprint 8.11.1 — `user_stats.last_streak_restore_used_at` shape mínimo.
/// Só lê 1 coluna pra checar "user já usou pelo menos 1 streak restore?".
private struct UserStatsRestoreRow: Codable, Sendable {
    let lastStreakRestoreUsedAt: Date?

    enum CodingKeys: String, CodingKey {
        case lastStreakRestoreUsedAt = "last_streak_restore_used_at"
    }
}

/// Sprint 8.13.1 — row de `posts` pra renderizar thumbnail no calendar.
/// Campos de mídia opcionais (posts antigos não têm thumbnail/poster e
/// image_url é NOT NULL hoje, mas decode defensivo evita derrubar o mês
/// inteiro por uma row fora do esperado).
private struct PostThumbnailRow: Codable, Sendable {
    let id: String
    let workoutDate: String
    let imageURL: String?
    let thumbnailURL: String?
    let posterURL: String?
    let mediaType: String?

    enum CodingKeys: String, CodingKey {
        case id
        case workoutDate = "workout_date"
        case imageURL = "image_url"
        case thumbnailURL = "thumbnail_url"
        case posterURL = "poster_url"
        case mediaType = "media_type"
    }
}

/// Linha de post_participants com o post embutido (posts!inner) — usada pro
/// fallback de posts MARCADOS no calendário.
private struct TaggedThumbnailRow: Decodable, Sendable {
    let posts: PostThumbnailRow?
}

/// Sprint 8.13.1 — payload usado por UI calendar (1 thumbnail por dia).
public struct MonthCalendarPost: Hashable, Sendable {
    public let dateKey: String  // YYYY-MM-DD
    public let postId: String
    public let imageURL: URL
}

/// Sprint 8.13.2 — shapes só do `workout_type` e `gym_id` pros 2 secrets.
/// Sprint 20.0 — campos opcionais (decode defensivo: uma row inesperada
/// não derruba a lista inteira) + `workout_types` (multi-tags Sprint 13).
private struct PostWorkoutTypeRow: Codable, Sendable {
    let workoutType: String?
    let workoutTypes: [String]?
    enum CodingKeys: String, CodingKey {
        case workoutType = "workout_type"
        case workoutTypes = "workout_types"
    }
}

private struct PostGymRow: Codable, Sendable {
    let gymId: String?
    enum CodingKeys: String, CodingKey { case gymId = "gym_id" }
}

/// Sprint 9.5.5 — joined post + gym name pra top gym query.
private struct PostGymJoinRow: Codable, Sendable {
    let gymId: String?
    let gym: GymNameRow?

    enum CodingKeys: String, CodingKey {
        case gymId = "gym_id"
        case gym = "gyms"
    }
}

private struct GymNameRow: Codable, Sendable {
    let name: String
}
