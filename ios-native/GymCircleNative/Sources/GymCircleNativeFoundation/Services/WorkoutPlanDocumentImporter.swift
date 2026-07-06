import Foundation
import PDFKit
import UIKit
@preconcurrency import Vision

public struct WorkoutPlanImportResult: Sendable {
    public let name: String
    public let exercises: [WorkoutPlanExercise]
}

public enum WorkoutPlanDocumentImportError: LocalizedError {
    case tooLarge
    case unsupported
    case unreadable

    public var errorDescription: String? {
        switch self {
        case .tooLarge:
            return Loc.t(
                "The file must be up to 25 MB.",
                "O arquivo precisa ter até 25 MB."
            )
        case .unsupported:
            return Loc.t(
                "Choose a photo or PDF.",
                "Escolha uma foto ou PDF."
            )
        case .unreadable:
            return Loc.t(
                "No exercises were recognized. Try a sharper image.",
                "Nenhum exercício foi reconhecido. Tente uma imagem mais nítida."
            )
        }
    }
}

public enum WorkoutPlanDocumentImporter {
    private static let maxBytes = 25 * 1024 * 1024
    private static let maxPDFPages = 12

    public static func importFile(_ url: URL) async throws -> WorkoutPlanImportResult {
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }

        let values = try url.resourceValues(forKeys: [.fileSizeKey])
        if (values.fileSize ?? 0) > maxBytes {
            throw WorkoutPlanDocumentImportError.tooLarge
        }

        let text: String
        if url.pathExtension.lowercased() == "pdf" {
            text = try await textFromPDF(url)
        } else if let image = UIImage(contentsOfFile: url.path),
                  let cgImage = image.cgImage {
            text = try await recognize(cgImage)
        } else {
            throw WorkoutPlanDocumentImportError.unsupported
        }

        let result = parse(text: text, fallbackName: url.deletingPathExtension().lastPathComponent)
        guard !result.exercises.isEmpty else {
            throw WorkoutPlanDocumentImportError.unreadable
        }
        return result
    }

    private static func textFromPDF(_ url: URL) async throws -> String {
        guard let document = PDFDocument(url: url) else {
            throw WorkoutPlanDocumentImportError.unreadable
        }
        var chunks: [String] = []
        let count = min(document.pageCount, maxPDFPages)
        for index in 0..<count {
            guard let page = document.page(at: index) else { continue }
            let pageText = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if pageText.count >= 24 {
                chunks.append(pageText)
                continue
            }
            let thumbnail = page.thumbnail(
                of: CGSize(width: 1800, height: 2400),
                for: .mediaBox
            )
            if let cgImage = thumbnail.cgImage {
                chunks.append(try await recognize(cgImage))
            }
        }
        return chunks.joined(separator: "\n")
    }

    private static func recognize(_ image: CGImage) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let text = (request.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n") ?? ""
                continuation.resume(returning: text)
            }
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["pt-BR", "en-US"]
            request.usesLanguageCorrection = true
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try VNImageRequestHandler(cgImage: image).perform([request])
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private static func parse(
        text: String,
        fallbackName: String
    ) -> WorkoutPlanImportResult {
        let lines = text
            .replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: .newlines)
            .map(clean)
            .filter { !$0.isEmpty }

        let patterns = [
            #"^(.+?)\s*(?:[-–—:]\s*)?(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*(?:reps?|repetições?))?.*$"#,
            #"^(.+?)\s*(?:[-–—:]\s*)?(\d{1,2})\s*(?:séries?|series|sets?)\s*(?:de\s*)?(\d{1,3})(?:\s*(?:reps?|repetições?))?.*$"#,
            #"^(.+?)\s{2,}(\d{1,2})\s+(\d{1,3})(?:\s|$).*$"#,
            #"^(.+?)[;,]\s*(\d{1,2})\s*[;,]\s*(\d{1,3})(?:\s|$).*$"#
        ]
        let expressions = patterns.compactMap {
            try? NSRegularExpression(pattern: $0, options: [.caseInsensitive])
        }
        var exercises: [WorkoutPlanExercise] = []
        var seen = Set<String>()

        for line in lines {
            guard !isHeader(line),
                  let parsed = parseExercise(line, expressions: expressions) else {
                continue
            }
            let key = "\(parsed.name.lowercased())|\(parsed.sets ?? 0)|\(parsed.reps ?? 0)"
            guard seen.insert(key).inserted else { continue }
            exercises.append(parsed)
        }

        let title = lines.first {
            !isHeader($0) && parseExercise($0, expressions: expressions) == nil
        }
        return WorkoutPlanImportResult(
            name: String((title ?? fallbackName.replacingOccurrences(of: "_", with: " ")).prefix(80)),
            exercises: exercises
        )
    }

    private static func parseExercise(
        _ line: String,
        expressions: [NSRegularExpression]
    ) -> WorkoutPlanExercise? {
        let nsLine = line as NSString
        let fullRange = NSRange(location: 0, length: nsLine.length)
        for expression in expressions {
            guard let match = expression.firstMatch(in: line, range: fullRange),
                  match.numberOfRanges >= 4 else { continue }
            let name = nsLine.substring(with: match.range(at: 1))
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: ":;,–—- "))
            guard !name.isEmpty,
                  let sets = Int(nsLine.substring(with: match.range(at: 2))),
                  let reps = Int(nsLine.substring(with: match.range(at: 3))),
                  sets > 0,
                  reps > 0 else { continue }
            return WorkoutPlanExercise(
                name: name,
                sets: min(sets, 20),
                reps: min(reps, 999)
            )
        }
        return nil
    }

    private static func clean(_ line: String) -> String {
        line
            .replacingOccurrences(
                of: #"^[\s•●▪◦*\-–—]+"#,
                with: "",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"^\d{1,3}[.)]\s+"#,
                with: "",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"\s+"#,
                with: " ",
                options: .regularExpression
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isHeader(_ line: String) -> Bool {
        line.range(
            of: #"^(exercício|exercicio|exercise|movimento|séries?|series|sets?|reps?|repetições?|carga|peso)(\s+|$)"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}
