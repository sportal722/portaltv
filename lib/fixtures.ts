export type SeedStream = {
  id: number;
  name: string;
  title: string;
  game: string;
  image: string;
  avatar: number;
  tag: string;
  category: string;
};
export const seedStreams: SeedStream[] = [
  {
    id: 1,
    name: "Kaizen",
    title: "Rankeds con el squad. Hoy se sube 🚀",
    game: "Counter-Strike 2",
    image: "valorant",
    avatar: 0,
    tag: "Competitivo",
    category: "Gaming",
  },
  {
    id: 2,
    name: "LunaVibes",
    title: "Un intento más y nos vamos… ¿o no? ✨",
    game: "Elden Ring",
    image: "elden",
    avatar: 1,
    tag: "Español",
    category: "Gaming",
  },
  {
    id: 3,
    name: "AlexRush",
    title: "A por la victoria. ¡Únete al equipo!",
    game: "Apex Legends",
    image: "minecraft",
    avatar: 2,
    tag: "Con la comunidad",
    category: "Esports",
  },
  {
    id: 4,
    name: "NiaPlays",
    title: "Night City nunca duerme 🌙",
    game: "Cyberpunk 2077",
    image: "cyberpunk",
    avatar: 3,
    tag: "Chill",
    category: "Gaming",
  },
  {
    id: 5,
    name: "DaniDrive",
    title: "Sin frenos por México 🏎️",
    game: "Forza Horizon 5",
    image: "forza",
    avatar: 4,
    tag: "Carreras",
    category: "Gaming",
  },
  {
    id: 6,
    name: "SofiSound",
    title: "Música para desconectar y charlar",
    game: "Música y comunidad",
    image: "hollow",
    avatar: 5,
    tag: "Lo-fi",
    category: "Música",
  },
  {
    id: 7,
    name: "Mika",
    title: "Un café y nos ponemos al día ☕",
    game: "Charlando",
    image: "cyberpunk",
    avatar: 6,
    tag: "Comunidad",
    category: "Charlando",
  },
  {
    id: 8,
    name: "Kaizen",
    title: "Fuera del setup: explorando la ciudad",
    game: "IRL",
    image: "forza",
    avatar: 0,
    tag: "Aventura",
    category: "IRL",
  },
];
