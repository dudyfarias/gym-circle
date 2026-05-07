import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <article className="mx-auto max-w-[680px]">
        <Link className="text-[13px] font-black text-[var(--gc-brand)]" href="/">
          Gym Circle
        </Link>
        <h1 className="mt-6 text-[34px] font-black leading-tight">Termos de uso da alpha</h1>
        <p className="mt-3 text-[14px] font-bold leading-6 text-white/58">
          Versão alpha fechada, válida para testes com usuários convidados.
        </p>

        <div className="mt-8 space-y-6 text-[14px] font-semibold leading-7 text-white/70">
          <section>
            <h2 className="text-[18px] font-black text-white">1. Participação em teste</h2>
            <p>
              O Gym Circle está em fase alpha. Recursos podem mudar, falhar ou ficar temporariamente indisponíveis.
              Ao usar o app, você aceita participar do teste e enviar feedback de uso.
            </p>
          </section>
          <section>
            <h2 className="text-[18px] font-black text-white">2. Conteúdo social</h2>
            <p>
              Você é responsável por fotos, vídeos, comentários, check-ins e mensagens que publicar. Não publique
              conteúdo ofensivo, ilegal, íntimo sem consentimento, discriminatório ou que coloque outras pessoas em risco.
            </p>
          </section>
          <section>
            <h2 className="text-[18px] font-black text-white">3. Segurança</h2>
            <p>
              O app oferece denúncia e bloqueio. Denúncias podem ser revisadas manualmente pelo time do Gym Circle.
              Contas podem ser limitadas ou removidas durante a alpha.
            </p>
          </section>
          <section>
            <h2 className="text-[18px] font-black text-white">4. Streak e reputação</h2>
            <p>
              O streak é um indicador social de presença fitness diária. Ele não substitui orientação médica,
              acompanhamento profissional ou avaliação física.
            </p>
          </section>
          <section>
            <h2 className="text-[18px] font-black text-white">5. Exclusão</h2>
            <p>
              Você pode solicitar exclusão pelo app. Durante a alpha, a solicitação pode passar por processamento
              interno para remoção segura de dados e mídia.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
