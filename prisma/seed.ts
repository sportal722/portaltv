import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/password";
import { seedStreams } from "../lib/fixtures";
const db = new PrismaClient();
async function main() {
  // Synthetic showcase accounts cannot be used to log in: random passwords are discarded.
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  for (const stream of seedStreams) {
    const username = stream.name.toLowerCase();
    const owner = await db.user.upsert({
      where: { email: `${username}@showcase.invalid` },
      update: {},
      create: {
        email: `${username}@showcase.invalid`,
        username: stream.name,
        passwordHash,
        role: "creator",
      },
    });
    await db.stream.upsert({
      where: { slug: `showcase-${stream.id}` },
      update: {},
      create: {
        slug: `showcase-${stream.id}`,
        ownerId: owner.id,
        title: stream.title,
        game: stream.game,
        category: stream.category,
        image: stream.image,
        avatar: stream.avatar,
        tag: stream.tag,
        isDemo: true,
        status: "offline",
      },
    });
  }
  console.log(
    "Canales de ejemplo creados. Sin contraseñas públicas ni emisiones simuladas.",
  );
}
main()
  .catch(() => {
    console.error("No se pudo cargar el seed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
