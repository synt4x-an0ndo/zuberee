-- Adds the third (and last) role level. Roles are now read from users.role
-- only; the roles / user_roles / role_permissions tables are no longer used
-- for authorization.
--
--   ADMIN      full access, including users and roles
--   MODERATOR  the admin panel except users and roles
--   CUSTOMER   the storefront only
--
-- The enum is recreated instead of "ALTER TYPE ... ADD VALUE" so the migration
-- is safe inside the transaction Prisma wraps migrations in.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'MODERATOR');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
DROP TYPE "UserRole_old";