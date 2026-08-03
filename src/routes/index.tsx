import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Futebol" },
      { name: "description", content: "Uma tela simples com a palavra Futebol." },
      { property: "og:title", content: "Futebol" },
      { property: "og:description", content: "Uma tela simples com a palavra Futebol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Plataforma de Futebol</h1>
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        Crie a primeira versão de uma plataforma responsiva de futebol e palpites simulados.

        Nesta fase, não implemente Pix, pagamentos, carteira, saque ou apostas com dinheiro real.

        Quero apenas validar o funcionamento da plataforma.

        Crie:

        1. Página inicial com três abas:
        - Jogos de hoje
        - Jogos de amanhã
        - Ao vivo

        2. Use inicialmente dados fictícios de 10 partidas de futebol.

        3. Cada partida deve mostrar:
        - campeonato
        - time da casa
        - time visitante
        - escudos
        - data
        - horário
        - placar, quando estiver ao vivo
        - status da partida

        4. Ao abrir uma partida, mostrar estes mercados:
        - resultado da partida
        - total de gols acima/abaixo de 1.5
        - total de gols acima/abaixo de 2.5
        - ambas as equipes marcam
        - total de escanteios
        - escanteios por equipe

        5. Cada opção deve ter uma odd fictícia.

        6. Ao clicar em uma odd, adicionar a seleção a um bilhete.

        7. O bilhete deve mostrar:
        - partida
        - mercado
        - seleção
        - linha
        - odd
        - odd total
        - valor simulado
        - retorno potencial simulado

        8. Permitir remover seleções do bilhete.

        9. Criar login com e-mail e senha usando Supabase Auth.

        10. Após confirmar o bilhete simulado, salvar no Supabase.

        11. Criar uma página “Meus bilhetes”.

        12. Criar um painel administrativo protegido, mostrando:
        - todos os bilhetes
        - usuário
        - data
        - valor simulado
        - odd total
        - retorno potencial
        - status
        - todas as seleções detalhadas

        13. Criar as tabelas necessárias no Supabase com Row Level Security.

        14. Não conectar nenhuma API externa ainda.

        15. Antes de executar migrations ou alterações importantes no banco, apresente o plano e aguarde autorização.
      </p>
    </div>
  );
}
