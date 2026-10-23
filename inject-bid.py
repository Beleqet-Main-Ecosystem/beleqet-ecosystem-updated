with open("/srv/beleqet-staging/beleqet-jobs-nextjs/app/freelance/[id]/page.tsx", "r") as f:
    text = f.read()

if "FreelanceBidActions" not in text:
    text = "import FreelanceBidActions from '@/components/FreelanceBidActions';\n" + text

import re
pattern = r'<div className="mt-6 rounded-xl bg-primary/5[\s\S]*?</div>\s*</aside>'
replacement = '<FreelanceBidActions gigId={gig.id} gigTitle={gig.title} budgetDefault={gig.budgetMin} />\n        </aside>'

text = re.sub(pattern, replacement, text)

with open("/srv/beleqet-staging/beleqet-jobs-nextjs/app/freelance/[id]/page.tsx", "w") as f:
    f.write(text)

print("INJECT_SUCCESS")
