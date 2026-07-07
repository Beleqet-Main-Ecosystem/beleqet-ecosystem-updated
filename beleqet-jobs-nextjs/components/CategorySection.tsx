import CategoryGrid from "./CategoryGrid";
import { fetchCategories } from "@/lib/api";

export default async function CategorySection() {
  const categories = await fetchCategories();
  return <CategoryGrid categories={categories.slice(0, 7)} />;
}
