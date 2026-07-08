# App Store Review — background location / workout routes

## Contexto

O Gym Circle usa localização durante treinos outdoor, como caminhada e corrida, para registrar rota, distância, ritmo e duração do exercício.

## Como o usuário vê o benefício dentro do app

- Ao finalizar um treino de caminhada/corrida com GPS, o usuário pode publicar o treino no feed.
- Posts de caminhada/corrida exibem resumo de distância, tempo e ritmo.
- Quando existe rota, o card do feed mostra um mapa real compacto com a rota do exercício.
- O usuário pode abrir o detalhe do treino para ver os dados do exercício com mais contexto.
- A rota, a distância e o ritmo aparecem como parte da experiência principal do app, não como coleta invisível.

## Privacidade e controle do usuário

- A rota só aparece em treinos que o usuário publica no feed.
- Esta sprint não altera o consentimento nem publica treinos privados automaticamente.
- A localização exibida em posts continua seguindo as regras de privacidade já existentes do produto.

## Justificativa para background location

A localização em background permite registrar treinos outdoor com mais consistência quando o usuário troca de tela, bloqueia o iPhone ou mantém o app em segundo plano durante o exercício.

Sem esse acesso, o app pode perder trechos de rota, distorcer distância/ritmo e reduzir a confiabilidade dos registros de caminhada/corrida.

## Evidência funcional no app

Fluxo esperado para demonstração:

1. Iniciar caminhada ou corrida.
2. Permitir localização.
3. Fazer o percurso com o app ativo ou em segundo plano.
4. Encerrar treino.
5. Publicar no feed.
6. Abrir o feed e verificar o card com resumo e mapa.
7. Abrir o detalhe do treino para ver rota/dados do exercício.
