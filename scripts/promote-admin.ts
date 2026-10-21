import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Indica el email de una cuenta registrada.");
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user)
    throw new Error("La cuenta debe registrarse antes de asignar el rol.");
  await db.user.update({ where: { id: user.id }, data: { role: "admin" } });
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
