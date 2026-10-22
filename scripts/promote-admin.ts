import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const byUsername = process.argv[2] === "--username";
  const identifier = process.argv[byUsername ? 3 : 2]?.trim();
  if (!identifier)
    throw new Error("Indica el email o --username de una cuenta registrada.");
  const user = await db.user.findUnique({
    where: byUsername
      ? { username: identifier }
      : { email: identifier.toLowerCase() },
    select: { id: true, username: true, status: true, role: true },
  });
  if (!user)
    throw new Error("La cuenta debe registrarse antes de asignar el rol.");
  if (user.status !== "active") throw new Error("La cuenta debe estar activa.");
  if (user.role !== "admin")
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { role: "admin" } }),
      db.auditEvent.create({
        data: {
          actorId: user.id,
          actorName: user.username,
          action: "admin.bootstrap",
          target: user.username,
        },
      }),
    ]);
  console.log("Rol de administrador asignado.");
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "No se pudo asignar el rol.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
