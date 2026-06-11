import { collection, doc, Firestore, writeBatch } from "firebase/firestore";
import { Match } from "../../types";

interface SeedTeam {
  name: string;
  flag: string;
}

interface SeedGroup {
  name: string;
  teams: SeedTeam[];
}

interface SeedFixture {
  matchNumber: number;
  group: string;
  matchday: number;
  date: string;
  easternTime: string;
  homeTeam: string;
  awayTeam: string;
}

export const MATCHES_SEED_VERSION = "2026-04-10";

const TEAM_FLAGS: Record<string, string> = {
  "México": "🇲🇽", "África do Sul": "🇿🇦", "Coreia do Sul": "🇰🇷", "Tchéquia": "🇨🇿",
  "Canadá": "🇨🇦", "Bósnia e Herzegovina": "🇧🇦", "Catar": "🇶🇦", "Suíça": "🇨🇭",
  "Brasil": "🇧🇷", "Marrocos": "🇲🇦", "Haiti": "🇭🇹", "Escócia": "🏴",
  "Estados Unidos": "🇺🇸", "Paraguai": "🇵🇾", "Austrália": "🇦🇺", "Turquia": "🇹🇷",
  "Alemanha": "🇩🇪", "Curaçao": "🇨🇼", "Costa do Marfim": "🇨🇮", "Equador": "🇪🇨",
  "Países Baixos": "🇳🇱", "Japão": "🇯🇵", "Suécia": "🇸🇪", "Tunísia": "🇹🇳",
  "Bélgica": "🇧🇪", "Egito": "🇪🇬", "Irã": "🇮🇷", "Nova Zelândia": "🇳🇿",
  "Espanha": "🇪🇸", "Cabo Verde": "🇨🇻", "Arábia Saudita": "🇸🇦", "Uruguai": "🇺🇾",
  "França": "🇫🇷", "Senegal": "🇸🇳", "Iraque": "🇮🇶", "Noruega": "🇳🇴",
  "Argentina": "🇦🇷", "Argélia": "🇩🇿", "Áustria": "🇦🇹", "Jordânia": "🇯🇴",
  "Portugal": "🇵🇹", "República Democrática do Congo": "🇨🇩", "Uzbequistão": "🇺🇿", "Colômbia": "🇨🇴",
  "Inglaterra": "🏴", "Croácia": "🇭🇷", "Gana": "🇬🇭", "Panamá": "🇵🇦",
};

const GROUP_TEAMS: Record<string, string[]> = {
  "Grupo A": ["México", "África do Sul", "Coreia do Sul", "Tchéquia"],
  "Grupo B": ["Canadá", "Bósnia e Herzegovina", "Catar", "Suíça"],
  "Grupo C": ["Brasil", "Marrocos", "Haiti", "Escócia"],
  "Grupo D": ["Estados Unidos", "Paraguai", "Austrália", "Turquia"],
  "Grupo E": ["Alemanha", "Curaçao", "Costa do Marfim", "Equador"],
  "Grupo F": ["Países Baixos", "Japão", "Suécia", "Tunísia"],
  "Grupo G": ["Bélgica", "Egito", "Irã", "Nova Zelândia"],
  "Grupo H": ["Espanha", "Cabo Verde", "Arábia Saudita", "Uruguai"],
  "Grupo I": ["França", "Senegal", "Iraque", "Noruega"],
  "Grupo J": ["Argentina", "Argélia", "Áustria", "Jordânia"],
  "Grupo K": ["Portugal", "República Democrática do Congo", "Uzbequistão", "Colômbia"],
  "Grupo L": ["Inglaterra", "Croácia", "Gana", "Panamá"],
};

export const GROUPS_DATA: SeedGroup[] = Object.entries(GROUP_TEAMS).map(
  ([name, teams]) => ({
    name,
    teams: teams.map((team) => ({ name: team, flag: TEAM_FLAGS[team] })),
  })
);

// Official FIFA schedule published April 10, 2026. All source times are Eastern Time (UTC-4 in June).
const FIXTURE_DATA = `
1|A|1|2026-06-11|15:00|México|África do Sul
2|A|1|2026-06-11|22:00|Coreia do Sul|Tchéquia
3|B|1|2026-06-12|15:00|Canadá|Bósnia e Herzegovina
4|D|1|2026-06-12|21:00|Estados Unidos|Paraguai
5|C|1|2026-06-13|21:00|Haiti|Escócia
6|D|1|2026-06-13|00:00|Austrália|Turquia
7|C|1|2026-06-13|18:00|Brasil|Marrocos
8|B|1|2026-06-13|15:00|Catar|Suíça
9|E|1|2026-06-14|19:00|Costa do Marfim|Equador
10|E|1|2026-06-14|13:00|Alemanha|Curaçao
11|F|1|2026-06-14|16:00|Países Baixos|Japão
12|F|1|2026-06-14|22:00|Suécia|Tunísia
13|H|1|2026-06-15|18:00|Arábia Saudita|Uruguai
14|H|1|2026-06-15|12:00|Espanha|Cabo Verde
15|G|1|2026-06-15|21:00|Irã|Nova Zelândia
16|G|1|2026-06-15|15:00|Bélgica|Egito
17|I|1|2026-06-16|15:00|França|Senegal
18|I|1|2026-06-16|18:00|Iraque|Noruega
19|J|1|2026-06-16|21:00|Argentina|Argélia
20|J|1|2026-06-16|00:00|Áustria|Jordânia
21|L|1|2026-06-17|19:00|Gana|Panamá
22|L|1|2026-06-17|16:00|Inglaterra|Croácia
23|K|1|2026-06-17|13:00|Portugal|República Democrática do Congo
24|K|1|2026-06-17|22:00|Uzbequistão|Colômbia
25|A|2|2026-06-18|12:00|Tchéquia|África do Sul
26|B|2|2026-06-18|15:00|Suíça|Bósnia e Herzegovina
27|B|2|2026-06-18|18:00|Canadá|Catar
28|A|2|2026-06-18|21:00|México|Coreia do Sul
29|C|2|2026-06-19|20:30|Brasil|Haiti
30|C|2|2026-06-19|18:00|Escócia|Marrocos
31|D|2|2026-06-19|23:00|Turquia|Paraguai
32|D|2|2026-06-19|15:00|Estados Unidos|Austrália
33|E|2|2026-06-20|16:00|Alemanha|Costa do Marfim
34|E|2|2026-06-20|20:00|Equador|Curaçao
35|F|2|2026-06-20|13:00|Países Baixos|Suécia
36|F|2|2026-06-20|00:00|Tunísia|Japão
37|H|2|2026-06-21|18:00|Uruguai|Cabo Verde
38|H|2|2026-06-21|12:00|Espanha|Arábia Saudita
39|G|2|2026-06-21|15:00|Bélgica|Irã
40|G|2|2026-06-21|21:00|Nova Zelândia|Egito
41|I|2|2026-06-22|20:00|Noruega|Senegal
42|I|2|2026-06-22|17:00|França|Iraque
43|J|2|2026-06-22|13:00|Argentina|Áustria
44|J|2|2026-06-22|23:00|Jordânia|Argélia
45|L|2|2026-06-23|16:00|Inglaterra|Gana
46|L|2|2026-06-23|19:00|Panamá|Croácia
47|K|2|2026-06-23|13:00|Portugal|Uzbequistão
48|K|2|2026-06-23|22:00|Colômbia|República Democrática do Congo
49|C|3|2026-06-24|18:00|Escócia|Brasil
50|C|3|2026-06-24|18:00|Marrocos|Haiti
51|B|3|2026-06-24|15:00|Suíça|Canadá
52|B|3|2026-06-24|15:00|Bósnia e Herzegovina|Catar
53|A|3|2026-06-24|21:00|Tchéquia|México
54|A|3|2026-06-24|21:00|África do Sul|Coreia do Sul
55|E|3|2026-06-25|16:00|Curaçao|Costa do Marfim
56|E|3|2026-06-25|16:00|Equador|Alemanha
57|F|3|2026-06-25|19:00|Japão|Suécia
58|F|3|2026-06-25|19:00|Tunísia|Países Baixos
59|D|3|2026-06-25|22:00|Turquia|Estados Unidos
60|D|3|2026-06-25|22:00|Paraguai|Austrália
61|I|3|2026-06-26|15:00|Noruega|França
62|I|3|2026-06-26|15:00|Senegal|Iraque
63|G|3|2026-06-26|23:00|Egito|Irã
64|G|3|2026-06-26|23:00|Nova Zelândia|Bélgica
65|H|3|2026-06-26|20:00|Cabo Verde|Arábia Saudita
66|H|3|2026-06-26|20:00|Uruguai|Espanha
67|L|3|2026-06-27|17:00|Panamá|Inglaterra
68|L|3|2026-06-27|17:00|Croácia|Gana
69|J|3|2026-06-27|22:00|Argélia|Áustria
70|J|3|2026-06-27|22:00|Jordânia|Argentina
71|K|3|2026-06-27|19:30|Colômbia|Portugal
72|K|3|2026-06-27|19:30|República Democrática do Congo|Uzbequistão
`.trim();

const FIXTURES: SeedFixture[] = FIXTURE_DATA.split("\n").map((line) => {
  const [matchNumber, group, matchday, date, easternTime, homeTeam, awayTeam] = line.split("|");
  return {
    matchNumber: Number(matchNumber),
    group: `Grupo ${group}`,
    matchday: Number(matchday),
    date,
    easternTime,
    homeTeam,
    awayTeam,
  };
});

function toUtcIso(date: string, easternTime: string): string {
  return new Date(`${date}T${easternTime}:00-04:00`).toISOString();
}

export function generateGroupStageMatches(): Match[] {
  return FIXTURES.map((fixture) => {
    const homeFlag = TEAM_FLAGS[fixture.homeTeam];
    const awayFlag = TEAM_FLAGS[fixture.awayTeam];

    if (!homeFlag || !awayFlag) {
      throw new Error(`Unknown team in World Cup fixture ${fixture.matchNumber}.`);
    }

    return {
      id: `match_${fixture.matchNumber}`,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeFlag,
      awayFlag,
      group: fixture.group,
      matchday: fixture.matchday,
      date: toUtcIso(fixture.date, fixture.easternTime),
      status: "scheduled",
    };
  });
}

export async function seedMatchesToFirestore(firestoreDb: Firestore): Promise<void> {
  const matches = generateGroupStageMatches();
  const batch = writeBatch(firestoreDb);
  const matchesCollection = collection(firestoreDb, "matches");

  matches.forEach((match) => {
    batch.set(doc(matchesCollection, match.id), match);
  });

  await batch.commit();
  console.log(`Successfully seeded ${matches.length} matches to Firestore.`);
}
