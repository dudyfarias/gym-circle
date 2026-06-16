import SwiftUI

public enum GymCircleTheme {
    public enum ColorToken {
        public static let appBackground = Color.black
        /// --gc-bg-elevated #050607 (fundos atrás de cards/sheets).
        public static let backgroundElevated = Color(red: 0.0196, green: 0.0235, blue: 0.0275)
        public static let card = Color(red: 0.067, green: 0.067, blue: 0.067)
        public static let elevatedCard = Color(red: 0.110, green: 0.110, blue: 0.118)
        /// --gc-card-soft #17181a.
        public static let cardSoft = Color(red: 0.0902, green: 0.0941, blue: 0.1020)
        /// Fundo do card de post do feed (web: bg-[#0c0d0e]).
        public static let postCard = Color(red: 0.0471, green: 0.0510, blue: 0.0549)
        public static let separator = Color.white.opacity(0.06)
        /// --gc-separator-strong rgba(255,.10).
        public static let separatorStrong = Color.white.opacity(0.10)
        /// --gc-glass / --gc-glass-strong (fundo translúcido de barras/sheets).
        public static let glass = Color(red: 0.1098, green: 0.1098, blue: 0.1176).opacity(0.72)
        public static let glassStrong = Color(red: 0.0706, green: 0.0784, blue: 0.0863).opacity(0.84)
        public static let primaryText = Color.white
        public static let secondaryText = Color(red: 0.631, green: 0.631, blue: 0.667)
        /// --gc-text-tertiary do web (rgba 255 52%).
        public static let tertiaryText = Color.white.opacity(0.52)
        /// --gc-brand exato do web (#8af7ff).
        public static let cyan = Color(red: 0.541, green: 0.969, blue: 1.0)
        /// --gc-brand-soft #c7fcff (realce claro do brand).
        public static let cyanSoft = Color(red: 0.7804, green: 0.9882, blue: 1.0)
        /// --gc-orange #ff9f0a (web) — distinto do gold #FBBF24 da raridade lendária.
        public static let orange = Color(red: 1.0, green: 0.6235, blue: 0.0392)
        /// Sprint 20.3a — coração curtido (gc-pink #ff2d55 da web).
        public static let pink = Color(red: 1.0, green: 0.176, blue: 0.333)
        public static let electricBlue = Color(red: 0.188, green: 0.835, blue: 1.0)
        public static let deepBlue = Color(red: 0.0, green: 0.4, blue: 1.0)
        public static let quietBlue = Color(red: 0.188, green: 0.835, blue: 1.0).opacity(0.12)

        // Sprint 8.2 + 9.6.3 — paleta gamification por raridade + categoria.
        // RGB exatos hex web (Tailwind):
        //   gold-400 #FBBF24 = 251/255, 191/255, 36/255 = 0.9843, 0.7490, 0.1411
        //   purple-400 #A78BFA = 167/255, 139/255, 250/255 = 0.6549, 0.5451, 0.9804
        //   green-400 #34D399 = 52/255, 211/255, 153/255 = 0.2039, 0.8275, 0.6000
        //   cyan-400 #22D3EE = 34/255, 211/255, 238/255 = 0.1333, 0.8275, 0.9333
        public static let rarityCommon = Color(white: 0.78)
        public static let rarityUncommon = Color(red: 0.2039, green: 0.8275, blue: 0.6000)
        public static let rarityRare = electricBlue
        public static let rarityEpic = Color(red: 0.6549, green: 0.5451, blue: 0.9804)
        public static let rarityLegendary = Color(red: 0.9843, green: 0.7490, blue: 0.1411)

        // Sprint 8.2 — challenge difficulty tones
        public static let difficultyEasy = Color(red: 0.1333, green: 0.8275, blue: 0.9333)
        public static let difficultyMedium = electricBlue
        public static let difficultyHard = rarityEpic
        public static let difficultyLegendary = rarityLegendary
    }

    public enum Spacing {
        public static let xxs: CGFloat = 4
        public static let xs: CGFloat = 8
        public static let sm: CGFloat = 12
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 20
        public static let xl: CGFloat = 24
        public static let xxl: CGFloat = 32
    }

    public enum Radius {
        public static let control: CGFloat = 20   // --gc-radius-md
        public static let card: CGFloat = 24       // --gc-radius-lg
        public static let large: CGFloat = 28      // --gc-radius-xl
        public static let panel: CGFloat = 32      // --gc-radius-2xl
        public static let huge: CGFloat = 40       // --gc-radius-3xl
        /// Card de post do feed — web usa rounded-[32px].
        public static let postCard: CGFloat = 32
    }

    public enum Motion {
        public static let quick = Animation.easeOut(duration: 0.16)
        public static let smooth = Animation.interpolatingSpring(stiffness: 180, damping: 22)
    }
}
