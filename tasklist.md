# Checklist de Tarefas - Bolão & Simulador Copa 2026 (TypeScript)

- [x] **Fase 1: Configuração e Estrutura Inicial**
  - [x] Executar o `npx --help` para verificação de opções de Next.js
  - [x] Inicializar o projeto Next.js com Tailwind CSS v4 e TypeScript no diretório `./`
  - [x] Instalar e configurar o Firebase SDK (`src/lib/firebase.ts`)
  - [x] Criar tipos e interfaces TS globais (`src/types/index.ts`)
  - [x] Criar dados estáticos de seeding para as 72 partidas da Fase de Grupos da Copa 2026 (`src/utils/seeds/matchesSeed.ts`)

- [x] **Fase 2: Banco de Dados e Serviços**
  - [x] Criar script/função para popular as partidas iniciais no Firestore na inicialização (se a coleção estiver vazia)
  - [x] Implementar motor de cálculo de pontos em `src/utils/points.ts` (cálculo de palpites "live" e "finished" em TS)
  - [x] Implementar funções de persistência no Firestore com tipagem TS (`src/lib/db.ts`):
    - [x] Criar/atualizar perfil do usuário com `role: 'user'`
    - [x] Buscar jogos por rodada/fase
    - [x] Salvar e carregar palpites (`predictions`) do usuário
    - [x] Criar e ingressar em grupos usando códigos de convite curtos
    - [x] Buscar classificação global e classificação de grupos privados (recalculando com base em jogos finalizados + jogos ao vivo)

- [x] **Fase 3: Componentes de Interface (UI/UX Clean Light Theme & Mobile-First)**
  - [x] Configurar layout base, cores do Tailwind (Azul esportivo, fundos brancos/cinzas claros) e fontes no arquivo global do Tailwind CSS
  - [x] Desenvolver tela de Login/Registro integrada ao Firebase Auth com visual limpo e moderno
  - [x] Desenvolver Bottom Nav principal (Jogos, Classificação, Grupos, Admin)
  - [x] Desenvolver Aba de Palpites (`PalpitesTab.tsx`) com filtros de rodada e inputs com botões `+`/`-`
  - [x] Desenvolver Aba de Classificação oficial da Copa (`ClassificacaoTab.tsx`) com tabelas de grupos elegantes e alto espaçamento (respiro)
  - [x] Desenvolver Aba de Ranking (`RankingTab.tsx`) com pódio azul em destaque e indicação de pontuação live vs oficial
  - [x] Desenvolver Aba de Grupos (`GruposTab.tsx`) com criação de grupos, compartilhamento de código e ranking interno
  - [x] Desenvolver Aba de Administração (`AdminTab.tsx`) disponível apenas para administradores:
    - [x] Controle de status do jogo (`scheduled` -> `live` -> `finished`)
    - [x] Edição de placar em tempo real ("live result")
    - [x] Criação de confrontos de mata-mata (Round of 32, Oitavas, Quartas, Semifinal, Final)

- [x] **Fase 4: Integração, Polimento e Testes**
  - [x] Integrar todos os fluxos de pontuação e atualização em tempo real
  - [x] Adicionar micro-animações, estados de carregamento (Skeleton loaders)
  - [x] Realizar testes de verificação conforme o plano de verificação
  - [x] Escrever o walkthrough final
