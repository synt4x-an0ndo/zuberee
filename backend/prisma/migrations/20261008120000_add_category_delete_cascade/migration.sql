ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS "categories_parentId_fkey";
ALTER TABLE public.categories
ADD CONSTRAINT "categories_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES public.categories(id)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS "products_categoryId_fkey";
ALTER TABLE public.products
ADD CONSTRAINT "products_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES public.categories(id)
ON DELETE CASCADE ON UPDATE CASCADE;
