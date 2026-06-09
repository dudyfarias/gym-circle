import Link from "next/link";

export const metadata = {
  title: "Suporte — Gym Circle",
  description:
    "Central de suporte do Gym Circle. Fale com a gente, tire dúvidas e saiba como gerenciar sua conta.",
};

const SUPPORT_EMAIL = "dudy.cappia@gmail.com";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <article className="mx-auto max-w-[680px]">
        <Link className="text-[13px] font-black text-[var(--gc-brand)]" href="/">
          Gym Circle
        </Link>
        <h1 className="mt-6 text-[34px] font-black leading-tight">Suporte</h1>
        <p className="mt-3 text-[14px] font-bold leading-6 text-white/58">
          Precisa de ajuda com o Gym Circle? A gente responde rápido. Use o e-mail
          abaixo ou consulte as perguntas frequentes.
        </p>

        {/* Contato direto */}
        <section className="mt-8 rounded-[20px] border border-[var(--gc-brand)]/24 bg-[var(--gc-brand)]/[0.06] p-5">
          <h2 className="text-[18px] font-black text-white">Fale com a gente</h2>
          <p className="mt-2 text-[14px] font-semibold leading-7 text-white/70">
            E-mail de suporte:
          </p>
          <a
            className="mt-1 inline-block text-[16px] font-black text-[var(--gc-brand)] underline-offset-4 hover:underline"
            href={`mailto:${SUPPORT_EMAIL}?subject=Suporte%20Gym%20Circle`}
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-3 text-[13px] font-semibold leading-6 text-white/52">
            Respondemos em até 48 horas úteis. Inclua seu @username e uma descrição
            do que aconteceu (e prints, se possível) para agilizar.
          </p>
        </section>

        {/* FAQ */}
        <div className="mt-8 space-y-6 text-[14px] font-semibold leading-7 text-white/70">
          <section>
            <h2 className="text-[18px] font-black text-white">Como faço login?</h2>
            <p>
              O login é por e-mail OU @username, junto com sua senha. Esqueceu a
              senha? Na tela de entrada, toque em &ldquo;Esqueci a senha&rdquo; para
              receber o link de redefinição por e-mail.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-black text-white">Como publico um treino?</h2>
            <p>
              Toque no botão da câmera na barra inferior, escolha foto ou vídeo,
              selecione a academia e o tipo de treino, escreva uma legenda e publique.
              O dia treinado entra automaticamente no seu streak e no calendário.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-black text-white">O que é o streak?</h2>
            <p>
              É a sua sequência de dias treinando. Cada treino publicado mantém o
              streak aceso. Se esquecer um dia, você tem restaurações mensais para
              não perder a sequência.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-black text-white">Como deixo minha conta privada?</h2>
            <p>
              Em Perfil &gt; Configurações, ative &ldquo;Conta privada&rdquo;. Só quem
              você aprovar poderá ver seus posts, stories e calendário.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-black text-white">Como bloqueio ou denuncio alguém?</h2>
            <p>
              Abra o perfil da pessoa e use as ações de bloquear ou denunciar.
              Bloqueios são imediatos e impedem qualquer interação nos dois sentidos.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-black text-white">Como excluo minha conta?</h2>
            <p>
              Em Perfil &gt; Configurações &gt; Excluir conta. A exclusão remove seu
              perfil e conteúdo conforme nossa política de privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-black text-white">Notificações push</h2>
            <p>
              Pedimos permissão de notificações na primeira interação relevante. Você
              pode ligar e desligar a qualquer momento nas configurações do app e do
              iPhone.
            </p>
          </section>
        </div>

        {/* Links legais */}
        <div className="mt-10 flex flex-wrap gap-4 text-[13px] font-black">
          <Link className="text-[var(--gc-brand)] hover:underline" href="/privacy">
            Política de privacidade
          </Link>
          <Link className="text-[var(--gc-brand)] hover:underline" href="/terms">
            Termos de uso
          </Link>
        </div>

        <p className="mt-10 text-[12px] font-bold text-white/36">
          © 2026 Eduardo Farias · Gym Circle
        </p>
      </article>
    </main>
  );
}
