export type User = {
  id: string;
  username: string;
  role: "viewer" | "creator" | "admin";
  status: string;
};
export type Stream = {
  id: number;
  slug: string;
  ownerId: string;
  name: string;
  title: string;
  game: string;
  category: string;
  description: string;
  language: string;
  thumbnailUrl: string;
  liveThumbnailUrl?: string | null;
  followers: number;
  image: string;
  avatar: number;
  tag: string;
  viewers: string;
  status: string;
  isDemo: boolean;
};
export type Message = {
  id: number;
  name: string;
  userId: string;
  role: string;
  isBot: boolean;
  text: string;
  createdAt: string;
};
