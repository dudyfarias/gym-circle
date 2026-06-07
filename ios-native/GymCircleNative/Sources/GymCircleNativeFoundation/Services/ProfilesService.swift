import Foundation
import Supabase

/// ProfilesService — Sprint 8.11.1.
///
/// Lookup do perfil real do user autenticado. Mapeia `profiles` table
/// pra `UserProfile`. Separado do MyCircleService pra ter responsabilidade
/// clara (Single Responsibility) — MyCircleService cuida só de stats
/// agregados/contagens, ProfilesService cuida do row de identidade.
///
/// Quando o backend evoluir com RPC consolidado (`get_user_full_snapshot`),
/// esse service vira um wrapper desse RPC.
public actor ProfilesService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Busca o profile row do user autenticado. Retorna nil quando linha
    /// não encontrada (usuário recém-criado ou sem trigger ainda).
    public func getProfile(userId: String) async throws -> UserProfile? {
        let rows: [UserProfile] = try await client
            .from("profiles")
            .select("id,user_id,username,display_name,avatar_url,bio,fitness_goal,is_private,featured_achievements,created_at")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Sprint 8.13.5 — busca foto de capa que o user escolheu pro Monthly Recap
    /// de um mês específico. Retorna postId ou nil (auto-pick fallback).
    /// JSONB shape: `{ "2026-05": "post_uuid", "2026-04": "post_uuid" }`.
    public func getMonthlyRecapCover(userId: String, monthKey: String) async throws -> String? {
        let rows: [MonthlyRecapCoversRow] = try await client
            .from("profiles")
            .select("monthly_recap_covers")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.covers?[monthKey]
    }

    /// Sprint 8.13.5 — persiste escolha de capa pro mês. Passa nil pra
    /// remover override (volta pro auto-pick).
    public func setMonthlyRecapCover(userId: String, monthKey: String, postId: String?) async throws {
        // Lê mapa atual, muta, escreve. Sem RPC ainda — direct table update
        // com merge JSONB no client. Para concurrent writes, RPC seria
        // mais robusto (Sprint 9+ migration possível).
        let current = try await fetchCoversMap(userId: userId)
        var next = current
        if let postId {
            next[monthKey] = postId
        } else {
            next.removeValue(forKey: monthKey)
        }

        struct UpdatePayload: Encodable {
            let monthlyRecapCovers: [String: String]
            enum CodingKeys: String, CodingKey {
                case monthlyRecapCovers = "monthly_recap_covers"
            }
        }
        let payload = UpdatePayload(monthlyRecapCovers: next)
        try await client
            .from("profiles")
            .update(payload)
            .eq("user_id", value: userId)
            .execute()
    }

    /// Sprint 8.13.7 — atualiza campos editáveis do profile.
    /// Apenas campos opcionais não-nil são enviados (PATCH-like).
    public func updateProfile(
        userId: String,
        displayName: String? = nil,
        bio: String? = nil,
        fitnessGoal: String? = nil,
        isPrivate: Bool? = nil
    ) async throws {
        struct UpdatePayload: Encodable {
            var displayName: String?
            var bio: String?
            var fitnessGoal: String?
            var isPrivate: Bool?

            enum CodingKeys: String, CodingKey {
                case displayName = "display_name"
                case bio
                case fitnessGoal = "fitness_goal"
                case isPrivate = "is_private"
            }
        }
        let payload = UpdatePayload(
            displayName: displayName,
            bio: bio,
            fitnessGoal: fitnessGoal,
            isPrivate: isPrivate
        )
        try await client
            .from("profiles")
            .update(payload)
            .eq("user_id", value: userId)
            .execute()
    }

    private func fetchCoversMap(userId: String) async throws -> [String: String] {
        let rows: [MonthlyRecapCoversRow] = try await client
            .from("profiles")
            .select("monthly_recap_covers")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.covers ?? [:]
    }
}

/// Sprint 8.13.5 — shape mínimo só do JSONB de capas.
private struct MonthlyRecapCoversRow: Codable, Sendable {
    let covers: [String: String]?

    enum CodingKeys: String, CodingKey {
        case covers = "monthly_recap_covers"
    }
}
