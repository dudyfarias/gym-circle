"use client";

/**
 * Fallback de último recurso: dispara se o próprio root layout (ou um
 * provider acima do app router) crashar. Por isso ele REPLACES o
 * layout — precisa montar <html> e <body> próprios.
 *
 * É raro chegar aqui — geralmente significa erro em React server-side
 * ou crash no provider. Mas Apple não tolera tela branca.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          background: "#000",
          color: "#fff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 28,
            padding: 24,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Caímos feio
          </h1>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              opacity: 0.72,
              marginTop: 12,
            }}
          >
            O Gym Circle teve um problema sério ao carregar. Recarregue ou tente
            de novo daqui a pouco.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                opacity: 0.42,
                marginTop: 16,
              }}
            >
              ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              height: 48,
              padding: "0 24px",
              background: "#30d5ff",
              color: "#000",
              border: 0,
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 900,
              cursor: "pointer",
            }}
            type="button"
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
