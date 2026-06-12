import Foundation
import Supabase
import UIKit

/// PostComposerService — Sprint 20.4a (paridade do publish web).
///
/// Contrato idêntico ao web (LiveHomeWrapper.uploadTo + posts.create):
///   - bucket "posts", path {userId}/{timestamp}-{rand}.jpg
///   - variantes: feed (1600px max edge, q0.82) + thumb (720px, q0.7)
///   - insert posts = CAPA (item 0); post_media só quando >1 mídia,
///     com a capa duplicada na position 0 (posts antigos seguem sem linhas)
public actor PostComposerService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public struct UploadedMedia: Sendable {
        public let imageURL: String
        public let thumbnailURL: String
        public let width: Int
        public let height: Int
    }

    public enum ComposerError: Error, LocalizedError {
        case invalidImage
        public var errorDescription: String? { "Imagem inválida." }
    }

    // MARK: - Upload

    /// Redimensiona (feed + thumb), sobe as duas variantes pro bucket
    /// posts e retorna as URLs públicas.
    public func uploadImage(userId: String, imageData: Data) async throws -> UploadedMedia {
        guard let original = UIImage(data: imageData) else {
            throw ComposerError.invalidImage
        }

        let feed = Self.jpegVariant(of: original, maxEdge: 1600, quality: 0.82)
        let thumb = Self.jpegVariant(of: original, maxEdge: 720, quality: 0.7)
        guard let feedData = feed.data, let thumbData = thumb.data else {
            throw ComposerError.invalidImage
        }

        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let rand = String(UUID().uuidString.prefix(6)).lowercased()
        let feedPath = "\(userId)/\(stamp)-\(rand).jpg"
        let thumbPath = "\(userId)/\(stamp)-\(rand)-thumb.jpg"

        let options = FileOptions(cacheControl: "3600", contentType: "image/jpeg")
        _ = try await client.storage.from("posts").upload(feedPath, data: feedData, options: options)
        _ = try await client.storage.from("posts").upload(thumbPath, data: thumbData, options: options)

        let feedURL = try client.storage.from("posts").getPublicURL(path: feedPath)
        let thumbURL = try client.storage.from("posts").getPublicURL(path: thumbPath)

        return UploadedMedia(
            imageURL: feedURL.absoluteString,
            thumbnailURL: thumbURL.absoluteString,
            width: Int(feed.size.width),
            height: Int(feed.size.height)
        )
    }

    // MARK: - Publish

    private struct PostInsert: Encodable {
        let user_id: String
        let image_url: String
        let media_type: String
        let thumbnail_url: String?
        let media_width: Int?
        let media_height: Int?
        let caption: String?
        let workout_type: String?
        let workout_types: [String]?
        let workout_date: String
        let location_source: String
    }

    private struct PostMediaInsert: Encodable {
        let post_id: String
        let position: Int
        let media_type: String
        let image_url: String
        let thumbnail_url: String?
        let media_width: Int?
        let media_height: Int?
    }

    /// Insere o post (capa = medias[0]) e, com >1 mídia, as linhas do
    /// carrossel. post_media é best-effort igual à web: falhou, o post
    /// degrada pra single em vez de derrubar a publicação.
    @discardableResult
    public func publish(
        userId: String,
        medias: [UploadedMedia],
        caption: String,
        workoutTypes: [String],
        workoutDate: String
    ) async throws -> String {
        guard let cover = medias.first else { throw ComposerError.invalidImage }

        let trimmedCaption = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        struct InsertedPost: Decodable { let id: String }
        let post: InsertedPost = try await client
            .from("posts")
            .insert(PostInsert(
                user_id: userId,
                image_url: cover.imageURL,
                media_type: "image",
                thumbnail_url: cover.thumbnailURL,
                media_width: cover.width,
                media_height: cover.height,
                caption: trimmedCaption.isEmpty ? nil : trimmedCaption,
                workout_type: workoutTypes.first,
                workout_types: workoutTypes.isEmpty ? nil : workoutTypes,
                workout_date: workoutDate,
                location_source: "none"
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
                    media_type: "image",
                    image_url: media.imageURL,
                    thumbnail_url: media.thumbnailURL,
                    media_width: media.width,
                    media_height: media.height
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

    // MARK: - Resize

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
