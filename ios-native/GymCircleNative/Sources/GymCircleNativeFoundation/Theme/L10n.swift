import Foundation

/// L10n — Sprint 8.11.5.
///
/// Strings localizadas das 4 telas SwiftUI (MyCircle, AchievementDetail,
/// AchievementsView Hall da Fama, AchievementCelebration) + ProfileView.
///
/// Decisão: inline PT/EN no Swift em vez de `.strings` bundle. Razões:
///   1. Evita mexer no Package.swift (precisa `.process("Resources")` +
///      lproj dirs por linguagem, frágil em CI sem Xcode interativo)
///   2. Locale lookup via `Locale.current.language.languageCode` é trivial
///   3. Default PT-BR (mercado v1.1) com fallback EN se code != "pt"
///   4. Quando crescer a base de strings (>200), migrar pra `.strings` é
///      diff trivial — keys do enum ficam estáveis
///
/// Uso: `Text(L10n.myCircleStreakAtual.string)` ou `L10n.myCircleBadgesCount(earned: 5, total: 20).string`.
public enum L10n {
    // MARK: - MyCircleView

    case myCircleStreakAtual
    case myCircleMaiorStreak
    case myCircleTreinosMes
    case myCircleDiasAno
    case myCircleConquistas
    case myCircleTotal
    case myCircleSuaConsistencia
    case myCircleSemana
    case myCircleMes
    case myCircleAno
    case myCircleCalendarioMes
    case myCircleNiveis
    case myCircleDesafiosMes
    case myCircleCompartilharResumo
    case myCircleCompartilharResumoMes(String)
    case myCircleEscolheFoto
    case myCircleCompeticao
    case myCircleEmBreve
    case myCircleCompeticaoDescricao
    case myCircleOutroPeriodo

    // MARK: - AchievementDetailView

    case detailVoceDesbloqueou
    case detailEmProgresso
    case detailProgresso
    case detailConquistado
    case detailTotalVezes(Int)
    case detailUltimaVez
    case detailNinguemConquistou
    case detailVoceEhPrimeiro
    case detailApenasPercent(String)
    case detailDescubraDesbloquear

    // Rarity chips
    case rarityComum
    case rarityIncomum
    case rarityRaro
    case rarityEpico
    case rarityLendario

    // MARK: - AchievementsView (Hall da Fama)

    case achievementsHallFama
    case achievementsXdeY(earned: Int, total: Int)
    case achievementsTudo
    case achievementsBadges
    case achievementsMedalhas
    case achievementsTrofeus
    case achievementsReliquias
    case achievementsDesafios
    case achievementsConquistados
    case achievementsProximos
    case achievementsBloqueados
    case achievementsVazio

    // MARK: - AchievementCelebrationView

    case celebrationContinuar
    case celebrationVerDepois
    case celebrationQueueIndex(index: Int, total: Int)

    // MARK: - ProfileView

    case profileConquistasDestaque
    case profileStreak
    case profileMaior
    case profilePosts
    case profileIndisponivel
    case profileEntreParaVer

    // MARK: - Resolver

    public var string: String {
        let isEN = Self.isEnglishLocale()
        switch self {
        // MyCircle
        case .myCircleStreakAtual:        return isEN ? "Current streak"     : "Streak atual"
        case .myCircleMaiorStreak:        return isEN ? "Best streak"        : "Maior streak"
        case .myCircleTreinosMes:         return isEN ? "Workouts this month": "Treinos no mês"
        case .myCircleDiasAno:            return isEN ? "Days this year"     : "Dias no ano"
        case .myCircleConquistas:         return isEN ? "Earned"             : "Conquistas"
        case .myCircleTotal:              return isEN ? "Total"              : "Total"
        case .myCircleSuaConsistencia:    return isEN ? "Your Consistency"   : "Sua Consistência"
        case .myCircleSemana:             return isEN ? "Week"               : "Semana"
        case .myCircleMes:                return isEN ? "Month"              : "Mês"
        case .myCircleAno:                return isEN ? "Year"               : "Ano"
        case .myCircleCalendarioMes:      return isEN ? "Monthly Calendar"   : "Calendário do mês"
        case .myCircleNiveis:             return isEN ? "Levels"             : "Níveis"
        case .myCircleDesafiosMes:        return isEN ? "Monthly challenges" : "Desafios do mês"
        case .myCircleCompartilharResumo: return isEN ? "Share monthly recap": "Compartilhar resumo"
        case .myCircleCompartilharResumoMes(let mes):
            return isEN ? "Share \(mes) recap" : "Compartilhar resumo de \(mes)"
        case .myCircleEscolheFoto:        return isEN ? "You pick the cover photo" : "Você escolhe a foto da capa"
        case .myCircleCompeticao:         return isEN ? "Competition"          : "Competição"
        case .myCircleEmBreve:            return isEN ? "Coming soon"          : "Em breve"
        case .myCircleCompeticaoDescricao:
            return isEN ? "Compete with your circle in weekly leagues."
                        : "Compita com seu circle em ligas semanais."
        case .myCircleOutroPeriodo:       return isEN ? "Pick another period"  : "Outro período"

        // Detail
        case .detailVoceDesbloqueou: return isEN ? "YOU UNLOCKED" : "VOCÊ DESBLOQUEOU"
        case .detailEmProgresso:     return isEN ? "IN PROGRESS"   : "EM PROGRESSO"
        case .detailProgresso:       return isEN ? "PROGRESS"      : "PROGRESSO"
        case .detailConquistado:     return isEN ? "Earned"        : "Conquistado"
        case .detailTotalVezes(let n):
            return isEN ? "\(n) times" : "\(n) vezes"
        case .detailUltimaVez:       return isEN ? "Last time"     : "Última vez"
        case .detailNinguemConquistou:
            return isEN
                ? "Nobody has earned this yet. Be the first!"
                : "Ninguém conquistou esta ainda. Seja o primeiro!"
        case .detailVoceEhPrimeiro:
            return isEN ? "✦ You're the first to earn this!" : "✦ Você é o primeiro a conquistar esta!"
        case .detailApenasPercent(let pct):
            return isEN ? "Only \(pct) of users have this achievement." : "Apenas \(pct) dos usuários possuem esta conquista."
        case .detailDescubraDesbloquear:
            return isEN ? "Discover how to unlock" : "Descubra como desbloquear"

        // Rarity
        case .rarityComum:     return isEN ? "Common"    : "Comum"
        case .rarityIncomum:   return isEN ? "Uncommon"  : "Incomum"
        case .rarityRaro:      return isEN ? "Rare"      : "Raro"
        case .rarityEpico:     return isEN ? "Epic"      : "Épico"
        case .rarityLendario:  return isEN ? "Legendary" : "Lendário"

        // Hall da Fama
        case .achievementsHallFama:    return isEN ? "Hall of Fame" : "Hall da Fama"
        case .achievementsXdeY(let earned, let total):
            return isEN ? "\(earned) of \(total) earned" : "\(earned) de \(total) conquistadas"
        case .achievementsTudo:        return isEN ? "All"         : "Tudo"
        case .achievementsBadges:      return isEN ? "Badges"      : "Badges"
        case .achievementsMedalhas:    return isEN ? "Medals"      : "Medalhas"
        case .achievementsTrofeus:     return isEN ? "Trophies"    : "Troféus"
        case .achievementsReliquias:   return isEN ? "Relics"      : "Relíquias"
        case .achievementsDesafios:    return isEN ? "Challenges"  : "Desafios"
        case .achievementsConquistados:return isEN ? "Earned"      : "Conquistados"
        case .achievementsProximos:    return isEN ? "Next up"     : "Próximos"
        case .achievementsBloqueados:  return isEN ? "Locked"      : "Bloqueados"
        case .achievementsVazio:       return isEN ? "No achievements in this category yet." : "Nenhuma conquista nesta categoria ainda."

        // Celebration
        case .celebrationContinuar: return isEN ? "Continue" : "Continuar"
        case .celebrationVerDepois: return isEN ? "View later" : "Ver depois"
        case .celebrationQueueIndex(let i, let total):
            return isEN ? "\(i) OF \(total)" : "\(i) DE \(total)"

        // Profile
        case .profileConquistasDestaque: return isEN ? "FEATURED ACHIEVEMENTS" : "CONQUISTAS EM DESTAQUE"
        case .profileStreak:             return isEN ? "Streak" : "Streak"
        case .profileMaior:              return isEN ? "Best"   : "Maior"
        case .profilePosts:              return isEN ? "Posts"  : "Posts"
        case .profileIndisponivel:       return isEN ? "Profile unavailable" : "Perfil indisponível"
        case .profileEntreParaVer:       return isEN ? "Sign in to see your native profile." : "Entre na conta para ver seu perfil nativo."
        }
    }

    private static func isEnglishLocale() -> Bool {
        let code = Locale.current.language.languageCode?.identifier
            ?? Locale.current.identifier.prefix(2).lowercased()
        return code.hasPrefix("en")
    }
}
