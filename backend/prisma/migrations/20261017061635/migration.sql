/*
  Warnings:

  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SystemRoleEnum" AS ENUM ('CUSTOMER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "SystemRoleEnum" NOT NULL DEFAULT 'CUSTOMER';

-- DropEnum
DROP TYPE "UserRoleEnum";
