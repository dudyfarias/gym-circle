import SwiftUI
import UIKit

/// Cache de imagens DECODIFICADAS em memória (key = URL). Resolve o "sem foto →
/// pisca → carrega" do `AsyncImage` cru, que re-baixa E re-decodifica toda vez
/// que a célula reaparece (scroll de volta, reabrir tela). Combina com o
/// `URLCache.shared` (disco, via `ImageCacheBootstrap`) pra persistir entre
/// sessões — assim a 2ª abertura do app já mostra as fotos na hora.
final class ImageMemoryCache {
    static let shared = ImageMemoryCache()
    private let cache = NSCache<NSString, UIImage>()

    private init() {
        cache.countLimit = 400                       // ~400 imagens decodificadas
        cache.totalCostLimit = 96 * 1024 * 1024      // teto ~96MB (custo = bytes)
    }

    func image(for key: String) -> UIImage? {
        cache.object(forKey: key as NSString)
    }

    func insert(_ image: UIImage, for key: String) {
        let cost = image.cgImage.map { $0.bytesPerRow * $0.height } ?? 0
        cache.setObject(image, forKey: key as NSString, cost: cost)
    }
}

/// Configura o `URLCache.shared` (disco + memória) UMA vez no boot. O
/// `URLSession.shared` usa esse cache com `.useProtocolCachePolicy`, então
/// respeita o `cache-control` que o Supabase Storage manda — fotos voltam do
/// disco entre sessões sem nova requisição de rede.
public enum ImageCacheBootstrap {
    private static var configured = false

    @MainActor public static func configure() {
        guard !configured else { return }
        configured = true
        URLCache.shared = URLCache(
            memoryCapacity: 32 * 1024 * 1024,    // 32MB respostas em RAM
            diskCapacity: 320 * 1024 * 1024,     // 320MB em disco
            directory: nil
        )
    }
}

/// Imagem remota com cache (memória + disco) e fade só no load de rede.
/// Substitui `AsyncImage` nos hot paths (avatares + fotos do feed). Cache-hit
/// aparece INSTANTÂNEO (já entra com a imagem no init, sem flash de
/// placeholder). Sempre renderiza `.resizable().scaledToFill()` — o caller
/// aplica frame/aspectRatio/clip como antes.
public struct GCRemoteImage<Placeholder: View>: View {
    private let url: URL?
    private let animateOnLoad: Bool
    @ViewBuilder private let placeholder: () -> Placeholder

    @State private var uiImage: UIImage?

    public init(
        url: URL?,
        animateOnLoad: Bool = true,
        @ViewBuilder placeholder: @escaping () -> Placeholder
    ) {
        self.url = url
        self.animateOnLoad = animateOnLoad
        self.placeholder = placeholder
        // Cache-hit síncrono: entra já com a imagem, sem piscar o placeholder.
        if let url, let cached = ImageMemoryCache.shared.image(for: url.absoluteString) {
            _uiImage = State(initialValue: cached)
        }
    }

    public var body: some View {
        ZStack {
            if let uiImage {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else {
                placeholder()
            }
        }
        .task(id: url?.absoluteString) { await load() }
    }

    private func load() async {
        guard uiImage == nil, let url else { return }
        let key = url.absoluteString
        if let cached = ImageMemoryCache.shared.image(for: key) {
            uiImage = cached
            return
        }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let image = UIImage(data: data) else { return }
        ImageMemoryCache.shared.insert(image, for: key)
        if animateOnLoad {
            withAnimation(.easeOut(duration: 0.28)) { uiImage = image }
        } else {
            uiImage = image
        }
    }
}
