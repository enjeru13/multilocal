import { PrismaClient } from "@prisma/client";
declare global {
  var prisma: PrismaClient | undefined;
}
const prismaClientSingleton = () => {
  if (process.env.NODE_ENV === "production") {
    return new PrismaClient();
  } else {
    if (!global.prisma) {
      global.prisma = new PrismaClient();
    }
    return global.prisma;
  }
};

const prisma = prismaClientSingleton();

export default prisma;
