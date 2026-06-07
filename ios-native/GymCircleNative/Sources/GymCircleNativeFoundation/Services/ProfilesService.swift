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
}
