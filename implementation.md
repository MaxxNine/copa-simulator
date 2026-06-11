# Plano de Implementação - Bolão & Simulador Copa do Mundo 2026 (TypeScript)

Este projeto consiste em um aplicativo mobile-first de palpites (bolão) e classificação para a Copa do Mundo de 2026, projetado para amigos jogarem juntos. Ele incluirá registro de usuários, gerenciamento de grupos privados, envio de palpites rodada por rodada, visualização de tabelas de grupos oficiais (calculadas dinamicamente) e um ranking ao vivo dos usuários baseado nas pontuações.

Será desenvolvido utilizando **Next.js (App Router)**, **TypeScript**, **Tailwind CSS v4** e **Firebase** (Auth e Firestore).

---

## Identidade Visual (Clean & Modern Light Theme)

* **Tema Principal:** Fundo claro (`#F8FAFC` / `#FFFFFF`) com tipografia nítida e escura (`#0F172A`).
* **Cor de Destaque:** Azul Esportivo (`#0284C7` / `#0369A1` - tons de azul céu e oceano), substituindo o verde tradicional nos botões, abas ativas e marcações de liderança.
* **Respiro & Espaçamento:** Maior preenchimento (`padding`), margens confortáveis e bordas arredondadas e suaves nos cards. As tabelas de classificação dos grupos e rankings terão bastante espaço em branco (`cell padding`) para facilitar a leitura.
* **Elementos Visuais:** Divisores sutis, sombras suaves (`shadow-sm`) e efeitos de destaque em azul para indicar a rodada ativa ou posições de classificação.

---

## Estrutura do Simulador e Bolão

1. **Fase de Grupos (72 jogos):** Pré-semeada no banco de dados. Os usuários preenchem seus palpites jogo a jogo.
2. **Cálculo de Tabela de Grupos (Simulação):** Conforme as partidas reais são decididas e atualizadas pelos administradores, a tabela de classificação de cada grupo (Pontos, Jogos, Vitórias, Gols, etc.) é calculada dinamicamente e exibida na aba de Classificação.
3. **Mata-Mata (Round of 32 em diante):** A partir dos 32 classificados reais confirmados pela FIFA, os administradores cadastram as partidas de mata-mata no painel. Os usuários então realizam seus palpites para estas novas fases.
4. **Ranking de Usuários (Live Rank):** 
   - Usuários ganham pontos conforme acertam placares exatos (5 pontos), saldo de gols + vencedor (3 pontos) ou apenas vencedor (2 pontos).
   - O ranking recalcula os pontos parciais em tempo real quando um jogo está `'live'` (em andamento), mostrando a variação da classificação antes de oficializar o término (`'finished'`).
   - É possível ter múltiplos administradores (usuários com `role: 'admin'`) para atualizar os jogos em andamento simultaneamente.

---

## Definição de Tipos (TypeScript Interfaces)

### `User`
```typescript
interface UserProfile {
  id: string; // UID do Firebase
  displayName: string;
  email: string;
  role: 'user' | 'admin';
  totalPoints: number;
  stats: {
    exactScores: number;
    correctResults: number;
  };
}
```

### `Match`
```typescript
interface Match {
  id: string; // Ex: g_a_1, r32_1
  homeTeam: string;
  awayTeam: string;
  homeFlag: string; // Emoji da bandeira ou código ISO
  awayFlag: string;
  group: string; // "Grupo A" ... "Final"
  matchday: number; // Rodada (1, 2, 3) ou Fase Eliminatória (4=32avos, 5=Oitavas, etc.)
  date: string; // ISO String / Timestamp
  status: 'scheduled' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
}
```

### `Prediction`
```typescript
interface Prediction {
  id: string; // userId_matchId
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
}
```

### `Group`
```typescript
interface Group {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  members: string[]; // UIDs dos usuários membros
}
```

---

## Estrutura de Arquivos Proposta

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   └── globals.css
├── components/
│   ├── PalpitesTab.tsx
│   ├── ClassificacaoTab.tsx
│   ├── RankingTab.tsx
│   ├── GruposTab.tsx
│   ├── AdminTab.tsx
│   └── ui/ (botões, inputs com padding extra)
├── lib/
│   ├── firebase.ts
│   └── db.ts
├── utils/
│   ├── points.ts
│   └── seeds/
│       └── matchesSeed.ts
└── types/
    └── index.ts
```

---

## Plano de Verificação

### Testes Manuais
1. **Verificação de Permissões**: Validar se apenas usuários com `role: 'admin'` conseguem ver a aba e realizar alterações no painel administrativo.
2. **Preenchimento de Palpites**: Garantir que as alterações nos palpites salvam automaticamente ou através de um botão de salvar rápido, e que o input se mantém limpo e utilizável no mobile.
3. **Criação de Confrontos Eliminatórios**: Verificar no Admin se a inserção de um novo jogo cria a partida no Firestore e se ela passa a aparecer sob o filtro "Mata-Mata" na tela do usuário comum.
4. **Atualização Live**: Confirmar se ao alterar um placar de partida `live`, os rankings e tabelas de classificação atualizam imediatamente com os pontos parciais.
