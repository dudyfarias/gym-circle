import Foundation
import Supabase
import UIKit
import UserNotifications

@MainActor
public final class NativePushTokenStore: ObservableObject {
    public static let shared = NativePushTokenStore()

    @Published public private(set) var token: String?
    @Published public private(set) var lastError: String?

    private init() {}

    public func setTokenData(_ data: Data) {
        token = data.map { String(format: "%02x", $0) }.joined()
        lastError = nil
    }

    public func setError(_ error: Error) {
        lastError = error.localizedDescription
    }
}

public actor NativePushNotificationsService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public enum PushError: Error, LocalizedError {
        case permissionDenied
        case tokenUnavailable

        public var errorDescription: String? {
            switch self {
            case .permissionDenied:
                return "Permissão de notificações não foi concedida."
            case .tokenUnavailable:
                return "O iPhone ainda não retornou um token APNs."
            }
        }
    }

    public func requestPermissionAndRegisterWithAPNs() async throws {
        let granted = try await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])
        guard granted else { throw PushError.permissionDenied }
        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    public func upsertCurrentToken(userId: String, appVersion: String? = nil) async throws {
        guard let token = await NativePushTokenStore.shared.token else {
            throw PushError.tokenUnavailable
        }
        try await upsertToken(
            userId: userId,
            token: token,
            appVersion: appVersion ?? Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        )
    }

    public func upsertToken(userId: String, token: String, appVersion: String?) async throws {
        struct TokenRow: Encodable {
            let user_id: String
            let platform: String
            let token: String
            let device_id: String
            let app_version: String?
            let last_seen_at: String
            let revoked_at: String?
        }

        try await client
            .from("device_push_tokens")
            .upsert(
                TokenRow(
                    user_id: userId,
                    platform: "ios",
                    token: token,
                    device_id: UIDevice.current.identifierForVendor?.uuidString ?? "ios-device",
                    app_version: appVersion,
                    last_seen_at: ISO8601DateFormatter().string(from: .now),
                    revoked_at: nil
                ),
                onConflict: "token"
            )
            .execute()
    }

    public func revokeCurrentToken(userId: String) async throws {
        guard let token = await NativePushTokenStore.shared.token else { return }
        struct RevokePatch: Encodable { let revoked_at: String }
        try await client
            .from("device_push_tokens")
            .update(RevokePatch(revoked_at: ISO8601DateFormatter().string(from: .now)))
            .eq("user_id", value: userId)
            .eq("token", value: token)
            .execute()
    }
}
