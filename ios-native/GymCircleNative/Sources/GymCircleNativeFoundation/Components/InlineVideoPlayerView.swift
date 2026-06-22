import SwiftUI
import AVKit
import AVFoundation
import Combine

/// Player de vídeo INLINE no feed (paridade web/Instagram). Antes o nativo
/// abria um player fullscreen no tap; agora o vídeo toca dentro do card:
///   - autoplay quando o card fica visível; PAUSA ao sair da tela (scroll);
///   - tap PAUSA/retoma (ícone de play aparece quando pausado);
///   - loop infinito (AVPlayerLooper);
///   - começa MUDO; botão de som no canto liga/desliga o áudio (e ativa a
///     AVAudioSession .playback pra tocar mesmo com o switch de silêncio).
/// Sem controles do sistema — usa um AVPlayerLayer custom. iOS 16+.
public struct InlineVideoPlayerView: View {
    private let posterURL: String?
    private let aspectRatio: CGFloat

    @State private var player: AVQueuePlayer
    @State private var looper: AVPlayerLooper
    @State private var isMuted = true
    @State private var isManuallyPaused = false
    @State private var isVisible = false
    @State private var isPlaying = false

    public init(videoURL: URL, posterURL: String?, aspectRatio: CGFloat) {
        self.posterURL = posterURL
        self.aspectRatio = aspectRatio
        // AVQueuePlayer + AVPlayerLooper = loop sem emendas (iOS 10+). O looper
        // precisa ser retido (daí ficar em @State) ou o loop para.
        let queue = AVQueuePlayer()
        queue.isMuted = true
        queue.actionAtItemEnd = .none
        _player = State(initialValue: queue)
        _looper = State(initialValue: AVPlayerLooper(player: queue, templateItem: AVPlayerItem(url: videoURL)))
    }

    public var body: some View {
        ZStack {
            Color.black

            PlayerLayerView(player: player)

            // Poster (still) até o vídeo começar a renderizar — evita flash
            // preto. Some assim que o player entra em .playing.
            if !isPlaying, let posterURL, let url = URL(string: posterURL) {
                GCRemoteImage(url: url, animateOnLoad: false) { Color.black }
            }

            // Ícone de play quando pausado manualmente (igual Instagram).
            if isManuallyPaused {
                Image(systemName: "play.fill")
                    .font(.system(size: 34, weight: .black))
                    .foregroundStyle(.white.opacity(0.92))
                    .shadow(radius: 8)
            }

            // Botão de som — canto inferior direito.
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button(action: toggleMute) {
                        Image(systemName: isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(Color.black.opacity(0.55)))
                    }
                    .buttonStyle(.plain)
                    .padding(10)
                    .accessibilityLabel(isMuted
                        ? Loc.t("Unmute", "Ativar som")
                        : Loc.t("Mute", "Silenciar"))
                }
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipped()
        .contentShape(Rectangle())
        .onTapGesture {
            isManuallyPaused.toggle()
            updatePlayback()
        }
        .background(visibilityReader)
        .onReceive(player.publisher(for: \.timeControlStatus)) { status in
            isPlaying = (status == .playing)
        }
        .onDisappear { player.pause() }
    }

    /// Detecta visibilidade pelo frame global vs. a tela (iOS 16 não tem
    /// onScrollVisibilityChange). Toca quando >50% do vídeo está na tela.
    private var visibilityReader: some View {
        GeometryReader { geo in
            let frame = geo.frame(in: .global)
            let screen = UIScreen.main.bounds
            let overlap = min(frame.maxY, screen.maxY) - max(frame.minY, screen.minY)
            let fraction = frame.height > 0 ? max(0, overlap) / frame.height : 0
            Color.clear
                .onChange(of: fraction > 0.5) { nowVisible in
                    isVisible = nowVisible
                    updatePlayback()
                }
                .onAppear {
                    isVisible = fraction > 0.5
                    updatePlayback()
                }
        }
    }

    private func updatePlayback() {
        if isVisible && !isManuallyPaused {
            player.play()
        } else {
            player.pause()
        }
    }

    private func toggleMute() {
        isMuted.toggle()
        player.isMuted = isMuted
        if !isMuted {
            // Igual Instagram: ao ligar o som, toca mesmo com o switch de
            // silêncio do iPhone ligado.
            try? AVAudioSession.sharedInstance().setCategory(.playback, options: [])
            try? AVAudioSession.sharedInstance().setActive(true)
        }
    }
}

/// AVPlayerLayer puro (sem controles do AVKit) — vídeo preenche o frame
/// (resizeAspectFill), igual ao object-cover do web.
private struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> PlayerContainer {
        let view = PlayerContainer()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: PlayerContainer, context: Context) {
        uiView.playerLayer.player = player
    }

    final class PlayerContainer: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}
