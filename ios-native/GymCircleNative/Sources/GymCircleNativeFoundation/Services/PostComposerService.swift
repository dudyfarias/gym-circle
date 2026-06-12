import Foundation
import Supabase
import UIKit
import AVFoundation

/// PostComposerService — Sprint 20.4a/b (paridade do publish web).
///
/// Contrato idêntico ao web (LiveHomeWrapper.uploadTo + posts.create):
///   - bucket "posts", path {userId}/{timestamp}-{rand}.{ext}
///   - foto: variantes feed (1600px, q0.82) + thumb (720px, q0.7)
///   - vídeo (20.4b): arquivo original + poster JPEG do 1º frame + duração
///   - insert posts = CAPA (item 0); post_media só quando >1 mídia
///   - 20.4b: location_source gym (gym_id + location_name) e edição de
///     caption/tags do próprio post
public actor PostComposerService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public struct UploadedMedia: Sendable {
        public let mediaType: String // "image" | "video"
        public let imageURL: String
        public let thumbnailURL: String?
        public let posterURL: String?
        public let width: Int?
        public let height: Int?
        public let durationSeconds: Double?
    }

    public enum ComposerError: Error, LocalizedError {
        case invalidImage
        case invalidVideo
        public var errorDescription: String? {
            switch self {
            case .invalidImage: return "Imagem inválida."
            case .invalidVideo: return "Vídeo inválido."
            }
        }
    }

    // MARK: - Uploads

    public func uploadImage(userId: String, imageData: Data) async throws -> UploadedMedia {
        guard let original = UIImage(data: imageData) else {
            throw ComposerError.invalidImage
        }

        let feed = Self.jpegVariant(of: original, maxEdge: 1600, quality: 0.82)
        let thumb = Self.jpegVariant(of: original, maxEdge: 720, quality: 0.7)
        guard let feedData = feed.data, let thumbData = thumb.data else {
            throw ComposerError.invalidImage
        }

        let base = Self.storageBase(userId: userId)
        let options = FileOptions(cacheControl: "3600", contentType: "image/jpeg")
        _ = try await client.storage.from("posts").upload("\(base).jpg", data: feedData, options: options)
        _ = try await client.storage.from("posts").upload("\(base)-thumb.jpg", data: thumbData, options: options)

        return UploadedMedia(
            mediaType: "image",
            imageURL: try publicURL("\(base).jpg"),
            thumbnailURL: try publicURL("\(base)-thumb.jpg"),
            posterURL: nil,
            width: Int(feed.size.width),
            height: Int(feed.size.height),
            durationSeconds: nil
        )
    }

    /// Sprint 20.4b — vídeo: sobe o arquivo original (mp4/mov) + poster
    /// JPEG do primeiro frame; extrai dimensões e duração via AVFoundation.
    public func uploadVideo(userId: String, videoData: Data) async throws -> UploadedMedia {
        // AVAsset precisa de arquivo — escreve num temp e limpa no fim.
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("composer-\(UUID().uuidString).mp4")
        try videoData.write(to: tempURL)
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let asset = AVURLAsset(url: tempURL)
        let duration = try await asset.load(.duration).seconds
        guard duration > 0 else { throw ComposerError.invalidVideo }

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        let cgPoster = try generator.copyCGImage(
            at: CMTime(seconds: 0.1, preferredTimescale: 600),
            actualTime: nil
        )
        let poster = UIImage(cgImage: cgPoster)
        let posterVariant = Self.jpegVariant(of: poster, maxEdge: 1600, quality: 0.8)
        guard let posterData = posterVariant.data else { throw ComposerError.invalidVideo }

        let base = Self.storageBase(userId: userId)
        _ = try await client.storage.from("posts").upload(
            "\(base).mp4",
            data: videoData,
            options: FileOptions(cacheControl: "3600", contentType: "video/mp4")
        )
        _ = try await client.storage.from("posts").upload(
            "\(base)-poster.jpg",
            data: posterData,
            options: FileOptions(cacheControl: "3600", contentType: "image/jpeg")
        )

        let posterURL = try publicURL("\(base)-poster.jpg")
        return UploadedMedia(
            mediaType: "video",
            imageURL: try publicURL("\(base).mp4"),
            thumbnailURL: posterURL,
            posterURL: posterURL,
            width: Int(posterVariant.size.width),
            height: Int(posterVariant.size.height),
            durationSeconds: duration
        )
    }

    // MARK: - Publish

    private struct PostInsert: Encodable {
        let user_id: String
        let image_url: String
        let media_type: String
        let thumbnail_url: String?
        let poster_url: String?
        let media_width: Int?
        let media_height: Int?
        let media_duration_seconds: Double?
        let caption: String?
        let workout_type: String?
        let workout_types: [String]?
        let workout_date: String
        let location_source: String
        let gym_id: String?
        let location_name: String?
    }

    private struct PostMediaInsert: Encodable {
        let post_id: String
        let position: Int
        let media_type: String
        let image_url: String
        let thumbnail_url: String?
        let poster_url: String?
        let media_width: Int?
        let media_height: Int?
        let media_duration_seconds: Double?
    }

    /// Insere o post (capa = medias[0]) + linhas do carrossel quando >1.
    /// post_media é best-effort igual à web: falhou, degrada pra single.
    @discardableResult
    public func publish(
        userId: String,
        medias: [UploadedMedia],
        caption: String,
        workoutTypes: [String],
        workoutDate: String,
        gymId: String? = nil,
        locationName: String? = nil
    ) async throws -> String {
        guard let cover = medias.first else { throw ComposerError.invalidImage }

        let trimmedCaption = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        struct InsertedPost: Decodable { let id: String }
        let post: InsertedPost = try await client
            .from("posts")
            .insert(PostInsert(
                user_id: userId,
                image_url: cover.imageURL,
                media_type: cover.mediaType,
                thumbnail_url: cover.thumbnailURL,
                poster_url: cover.posterURL,
                media_width: cover.width,
                media_height: cover.height,
                media_duration_seconds: cover.durationSeconds,
                caption: trimmedCaption.isEmpty ? nil : trimmedCaption,
                workout_type: workoutTypes.first,
                workout_types: workoutTypes.isEmpty ? nil : workoutTypes,
                workout_date: workoutDate,
                location_source: gymId == nil ? "none" : "gym",
                gym_id: gymId,
                location_name: gymId == nil ? nil : locationName
            ))
            .select("id")
            .single()
            .execute()
            .value

        if medias.count > 1 {
            let rows = medias.enumerated().map { index, media in
                PostMediaInsert(
                    post_id: post.id,
                    position: index,
                    media_type: media.mediaType,
                    image_url: media.imageURL,
                    thumbnail_url: media.thumbnailURL,
                    poster_url: media.posterURL,
                    media_width: media.width,
                    media_height: media.height,
                    media_duration_seconds: media.durationSeconds
                )
            }
            do {
                try await client.from("post_media").insert(rows).execute()
            } catch {
                // Best-effort (paridade web): post já está no ar como single.
            }
        }
        return post.id
    }

    /// Sprint 20.4b — edita caption/tags do próprio post (subset do
    /// EditPostSheet web; mídia nova fica pro cutover).
    public func updatePost(
        postId: String,
        userId: String,
        caption: String,
        workoutTypes: [String]
    ) async throws {
        struct PostPatch: Encodable {
            let caption: String?
            let workout_type: String?
            let workout_types: [String]?
        }
        let trimmed = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        try await client
            .from("posts")
            .update(PostPatch(
                caption: trimmed.isEmpty ? nil : trimmed,
                workout_type: workoutTypes.first,
                workout_types: workoutTypes.isEmpty ? nil : workoutTypes
            ))
            .eq("id", value: postId)
            .eq("user_id", value: userId)
            .execute()
    }

    // MARK: - Helpers

    private static func storageBase(userId: String) -> String {
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let rand = String(UUID().uuidString.prefix(6)).lowercased()
        return "\(userId)/\(stamp)-\(rand)"
    }

    private func publicURL(_ path: String) throws -> String {
        try client.storage.from("posts").getPublicURL(path: path).absoluteString
    }

    private static func jpegVariant(
        of image: UIImage,
        maxEdge: CGFloat,
        quality: CGFloat
    ) -> (data: Data?, size: CGSize) {
        let largest = max(image.size.width, image.size.height)
        let scale = min(1, maxEdge / max(largest, 1))
        let target = CGSize(
            width: (image.size.width * scale).rounded(),
            height: (image.size.height * scale).rounded()
        )
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: target, format: format)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return (resized.jpegData(compressionQuality: quality), target)
    }
}
