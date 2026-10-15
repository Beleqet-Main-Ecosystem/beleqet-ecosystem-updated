path = "/srv/beleqet-staging/beleqet-jobs-nextjs/app/freelance/[id]/page.tsx"
with open(path, "r") as f:
    lines = f.readlines()

new_lines = [
    "import Link from 'next/link';\n",
    "import FreelanceBidActions from '@/components/FreelanceBidActions';\n"
] + [l for l in lines if not l.startswith("import Link") and not l.startswith("import FreelanceBidActions")]

with open(path, "w") as f:
    f.writelines(new_lines)
print("CLEANED_IMPORTS_OK")
