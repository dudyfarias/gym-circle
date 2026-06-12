import SwiftUI
import PhotosUI

/// ComposerView — Sprint 20.4a. Substitui o placeholder "fica para a
/// próxima sprint" da tab Criar.
///
/// Escopo 20.4a: fotos da galeria (até 10, carrossel), legenda e tags de
/// treino (presets da web + livre, até 5). Câmera/vídeo/localização/
/// participantes/editar ficam pra 20.4b.
public struct ComposerView: View {
    @ObservedObject private var model: GymCircleAppModel

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var imageDatas: [Data] = []
    @State private var caption = ""
    @State private var selectedTags: [String] = []
    @State private var customTag = ""
    @State private var isPublishing = false
    @State private var publishedOK = false
    @State private var errorMessage: String?

    /// Presets idênticos ao web (PostScreen) — valor PT-BR é o que
    /// persiste em workout_type/workout_types.
    private static let tagPresets = [
        "Musculação", "Corrida", "Bike", "Funcional", "Cardio", "Mobilidade",
    ]
    private static let maxMedias = 10
    private static let maxTags = 5

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                mediaSection
                captionSection
                tagsSection
                publishButton
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Criar treino")
        .onChange(of: pickerItems) { newItems in
            Task { await loadPicked(newItems) }
        }
        .alert("Treino publicado!", isPresented: $publishedOK) {
            Button("Fechar", role: .cancel) {}
        } message: {
            Text("Seu post ja esta no feed do circle.")
        }
    }

    // MARK: - Sections

    private var mediaSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            GCText("Fotos do treino", style: .headline)

            if !imageDatas.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(imageDatas.enumerated()), id: \.offset) { index, data in
                            ZStack(alignment: .topTrailing) {
                                if let image = UIImage(data: data) {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 96, height: 120)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                }
                                Button {
                                    imageDatas.remove(at: index)
                                    if index < pickerItems.count {
                                        pickerItems.remove(at: index)
                                    }
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundStyle(.white, .black.opacity(0.55))
                                }
                                .padding(4)
                                if index == 0 {
                                    VStack {
                                        Spacer()
                                        GCText("Capa", style: .caption, color: .white)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2)
                                            .background(Capsule().fill(.black.opacity(0.55)))
                                            .padding(6)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                    }
                }
            }

            PhotosPicker(
                selection: $pickerItems,
                maxSelectionCount: Self.maxMedias,
                matching: .images
            ) {
                Label(
                    imageDatas.isEmpty
                        ? "Escolher fotos (ate \(Self.maxMedias))"
                        : "Trocar selecao (\(imageDatas.count)/\(Self.maxMedias))",
                    systemImage: "photo.on.rectangle.angled"
                )
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                )
            }
        }
    }

    private var captionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            GCText("Legenda", style: .headline)
            TextField("Como foi o treino?", text: $caption, axis: .vertical)
                .lineLimit(3...6)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                )
        }
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                GCText("Tipo de treino", style: .headline)
                Spacer()
                GCText(
                    "\(selectedTags.count)/\(Self.maxTags)",
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            }

            FlowChips(
                presets: Self.tagPresets,
                selected: selectedTags,
                onToggle: { toggleTag($0) }
            )

            HStack(spacing: 8) {
                TextField("Outro (ex: Natação)", text: $customTag)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(
                        Capsule().fill(GymCircleTheme.ColorToken.elevatedCard)
                    )
                Button {
                    let tag = customTag.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !tag.isEmpty else { return }
                    toggleTag(tag)
                    customTag = ""
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 26))
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
                .buttonStyle(.plain)
                .disabled(customTag.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var publishButton: some View {
        VStack(spacing: 10) {
            if let errorMessage {
                GCText(errorMessage, style: .caption, color: GymCircleTheme.ColorToken.pink)
            }
            Button {
                Task { await publish() }
            } label: {
                Group {
                    if isPublishing {
                        ProgressView().tint(.black)
                    } else {
                        Text("Publicar treino")
                            .font(.system(size: 16, weight: .black, design: .rounded))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            imageDatas.isEmpty
                                ? AnyShapeStyle(GymCircleTheme.ColorToken.elevatedCard)
                                : AnyShapeStyle(GymCircleTheme.ColorToken.cyan)
                        )
                )
                .foregroundStyle(imageDatas.isEmpty ? GymCircleTheme.ColorToken.secondaryText : .black)
            }
            .buttonStyle(.plain)
            .disabled(imageDatas.isEmpty || isPublishing)
        }
    }

    // MARK: - Actions

    private func toggleTag(_ tag: String) {
        if let index = selectedTags.firstIndex(of: tag) {
            selectedTags.remove(at: index)
        } else if selectedTags.count < Self.maxTags {
            selectedTags.append(tag)
            Haptics.selection()
        }
    }

    private func loadPicked(_ items: [PhotosPickerItem]) async {
        var datas: [Data] = []
        for item in items.prefix(Self.maxMedias) {
            if let data = try? await item.loadTransferable(type: Data.self) {
                datas.append(data)
            }
        }
        imageDatas = datas
    }

    private func publish() async {
        guard !imageDatas.isEmpty else { return }
        isPublishing = true
        errorMessage = nil
        defer { isPublishing = false }

        let ok = await model.publishPost(
            imageDatas: imageDatas,
            caption: caption,
            workoutTypes: selectedTags
        )
        if ok {
            Haptics.success()
            imageDatas = []
            pickerItems = []
            caption = ""
            selectedTags = []
            publishedOK = true
        } else {
            Haptics.error()
            errorMessage = model.error ?? "Nao foi possivel publicar. Tenta de novo."
        }
    }
}

/// Chips de tag com quebra de linha simples (2 fileiras horizontais
/// scrolláveis seria overkill pra 6 presets + selecionadas custom).
private struct FlowChips: View {
    let presets: [String]
    let selected: [String]
    let onToggle: (String) -> Void

    /// Presets + tags custom já escolhidas (pra dar como remover).
    private var allChips: [String] {
        presets + selected.filter { !presets.contains($0) }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(allChips, id: \.self) { tag in
                    let isOn = selected.contains(tag)
                    Button {
                        onToggle(tag)
                    } label: {
                        Text(tag)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                Capsule().fill(
                                    isOn
                                        ? GymCircleTheme.ColorToken.cyan
                                        : GymCircleTheme.ColorToken.elevatedCard
                                )
                            )
                            .foregroundStyle(isOn ? .black : GymCircleTheme.ColorToken.primaryText)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
