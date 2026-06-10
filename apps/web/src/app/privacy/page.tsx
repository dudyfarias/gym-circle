import { LegalDocumentShell } from "@/components/gym-circle/LegalDocumentShell";

export default function PrivacyPage() {
  return (
    <LegalDocumentShell eyebrow="Documento legal" title="Política de privacidade">
      <p className="mt-3 text-[14px] font-bold leading-6 text-white/58">
        Versão alpha fechada. Esta política descreve o uso mínimo de dados para validar o produto.
      </p>

      <div className="mt-8 space-y-6 text-[14px] font-semibold leading-7 text-white/70">
        <section>
          <h2 className="text-[18px] font-black text-white">Dados coletados</h2>
          <p>
            Coletamos dados de conta, perfil, fotos/vídeos publicados, stories, check-ins, seguidores,
            curtidas, comentários, mensagens, denúncias, bloqueios e eventos de uso do produto.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-black text-white">Uso dos dados</h2>
          <p>
            Usamos os dados para autenticação, funcionamento do feed, streak, descoberta social, segurança,
            suporte, prevenção de abuso e métricas agregadas da alpha.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-black text-white">Localização</h2>
          <p>
            Localização pode ser informada voluntariamente em posts, check-ins ou busca por academia. Quando
            permitido pelo navegador, usamos a localização apenas para a ação solicitada.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-black text-white">Mensagens</h2>
          <p>
            Mensagens, fotos e vídeos enviados no chat ficam associados aos participantes para entrega e segurança
            do serviço durante a alpha.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-black text-white">Controle</h2>
          <p>
            Você pode tornar o perfil privado, bloquear usuários, denunciar conteúdo e solicitar exclusão da conta.
            O acesso administrativo é restrito à operação da alpha.
          </p>
        </section>
      </div>
    </LegalDocumentShell>
  );
}
