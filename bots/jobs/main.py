import asyncio
import hmac
import re
import aiohttp
import telegram
import logging
import os
import sys
from functools import lru_cache
from collections import defaultdict
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'server'))
from voting_routes import init_challenge_db, register_challenge_routes
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove, WebAppInfo, KeyboardButton
from telegram.ext import ( Application, 
                          CommandHandler, 
                          MessageHandler, 
                          CallbackQueryHandler, 
                          filters, ContextTypes, 
                          ConversationHandler, PicklePersistence )

load_dotenv()
# --- CONFIGURATION WITH YOUR FILE IDs ---
CONFIG = {
    'telegram_token': os.getenv("BOT_TOKEN"),
    'wp_api_url': os.getenv("WORDPRESS_API_URL"),
    'webhook_url': os.getenv("BOT_WEBHOOK_URL"),
    'mini_app_url': (os.getenv("MINI_APP_URL") or "https://beleqetjobs.com").rstrip('/'),
    'candidate_promo_photo_id': os.getenv("CANDIDATE_PROMO_PHOTO_ID"),
    'employer_promo_photo_id': os.getenv("EMPLOYER_PROMO_PHOTO_ID"),
    'admin_ids': [int(x.strip()) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()],
    'challenge_mini_app_url': (os.getenv("CHALLENGE_MINI_APP_URL") or "https://webhook.beleqet.com/challenge").rstrip('/'),
}

# --- More verbose logging setup ---
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
# Suppress noisy logs from httpx, used by python-telegram-bot
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

LANGUAGE, ROLE, NAME, PHONE, EMAIL, TG_USERNAME, PASSWORD, CHANGE_LANGUAGE, TRADE_LICENSE, JOB_TITLE, COMPANY_NAME = range(11)
BROADCAST_MESSAGE, BROADCAST_BUTTON_TEXT, BROADCAST_BUTTON_URL, BROADCAST_CONFIRM = range(11, 15)
# New states go after the old ones: conversations saved in bot_data.pickle keep their numbers.
CONTACT_NAME, EMAIL_CODE, NEW_EMAIL = range(15, 18)
# Job seekers: where they live. "I already have an account": email, then the emailed code.
GENDER, COUNTRY, COUNTRY_TYPED, CITY, LINK_EMAIL, LINK_CODE = range(18, 24)

MIN_PASSWORD_LENGTH = 8
# Everything a registration collects; cleared when a new registration picks its role.
REGISTRATION_KEYS = ('name', 'contact_name', 'company_name', 'phone', 'email', 'password', 'job_title',
                     'gender', 'country', 'city', 'tg_username', 'link_email')
EMAIL_PATTERN = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

# Where most job seekers live, as buttons; anyone else types their country.
COUNTRY_BUTTONS = [('ET', 'Ethiopia', 'ኢትዮጵያ'), ('SA', 'Saudi Arabia', 'ሳዑዲ አረቢያ'),
                   ('AE', 'UAE', 'ዱባይ (UAE)'), ('KE', 'Kenya', 'ኬንያ'), ('DJ', 'Djibouti', 'ጅቡቲ')]

# Typed country names (English, and the commonest in Amharic) to ISO codes.
COUNTRY_NAMES = {
    'ethiopia': 'ET', 'ኢትዮጵያ': 'ET', 'kenya': 'KE', 'ኬንያ': 'KE', 'djibouti': 'DJ', 'ጅቡቲ': 'DJ',
    'somalia': 'SO', 'somaliland': 'SO', 'sudan': 'SD', 'south sudan': 'SS', 'eritrea': 'ER', 'uganda': 'UG',
    'tanzania': 'TZ', 'rwanda': 'RW', 'egypt': 'EG', 'nigeria': 'NG', 'ghana': 'GH', 'south africa': 'ZA',
    'saudi arabia': 'SA', 'saudi': 'SA', 'ሳዑዲ': 'SA', 'ሳዑዲ አረቢያ': 'SA',
    'united arab emirates': 'AE', 'uae': 'AE', 'dubai': 'AE', 'ዱባይ': 'AE', 'qatar': 'QA', 'kuwait': 'KW',
    'bahrain': 'BH', 'oman': 'OM', 'jordan': 'JO', 'lebanon': 'LB', 'ሊባኖስ': 'LB', 'israel': 'IL', 'yemen': 'YE',
    'turkey': 'TR', 'türkiye': 'TR', 'united states': 'US', 'usa': 'US', 'america': 'US', 'አሜሪካ': 'US',
    'canada': 'CA', 'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB', 'germany': 'DE', 'france': 'FR',
    'italy': 'IT', 'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO', 'switzerland': 'CH', 'australia': 'AU',
    'china': 'CN', 'india': 'IN', 'japan': 'JP', 'south korea': 'KR', 'korea': 'KR', 'malaysia': 'MY',
}

# Ethiopian cities as buttons: stored as spelled in job locations, shown in the person's language.
ETHIOPIAN_CITIES = [('Addis Ababa', 'አዲስ አበባ'), ('Adama', 'አዳማ'), ('Bahir Dar', 'ባሕር ዳር'),
                    ('Dire Dawa', 'ድሬ ዳዋ'), ('Gondar', 'ጎንደር'), ('Hawassa', 'ሀዋሳ'), ('Jimma', 'ጅማ'),
                    ('Jijiga', 'ጅጅጋ'), ('Mekele', 'መቀሌ'), ('Dessie', 'ደሴ')]

TRANSLATIONS = {
    'en': {
        'link_success': "Your account has been successfully linked!",
        'link_transfer_success': "You have successfully transferred your account to this new Telegram profile.",
        'select_language': "Please select your language:",
        'select_role': "Select your role:",
        'welcome_back': "Welcome back, {name}! You’re logged in as a {role}.\nSelect an option from the menu below:",
        'pending_employer': "You’re already registered as an Employer, but your account is still pending approval. You’ll be notified once approved.",
        'status_error': "Sorry, I couldn’t check your registration status. Let’s proceed with registration.",
        'role_selected': "Selected role: {role}\nNow, Please provide your full name:",
        'enter_email': "Great! Now please enter your email address:",
        'enter_contact_name': "Thanks! Now your own full name (the contact person for this company):",
        'invalid_email': "Invalid email address. Please enter a valid email address:",
        'email_exists': "Email already registered. Please enter a different email address for registration.",
        'email_error': "Sorry, I couldn't verify email availability at the moment. Please try again later.",
        'enter_password': "Nice! Now choose a password of at least 8 characters. You'll use it with your email to sign in on beleqetjobs.com:",
        'password_too_short': "That password is too short. Please use at least 8 characters:",
        'password_hidden': "For your safety, I deleted the message with your password.",
        'code_sent': "We sent a 6-digit code to {email}. Type it here to confirm your email.\nNot there? Check your spam folder.",
        'code_confirmed': "Your email is confirmed. ✅ You can post jobs now.",
        'code_format': "Please type the 6 digits from the email.",
        'code_resend': "Send a new code",
        'code_change_email': "Change email",
        'code_later': "Later",
        'code_later_text': "No problem. Tap Post Job when you're ready and I'll send you a new code.",
        'enter_new_email': "Type the email address you want to use:",
        'confirm_to_post': "To post jobs, first confirm your email address. It keeps job seekers safe from fake job ads.",
        'add_email_to_post': "To post jobs, add your email address first; I'll send you a code to confirm it. It keeps job seekers safe from fake job ads.",
        'send_code_to': "Send a code to {email}",
        'add_email': "Add my email",
        'confirm_now': "One last step: confirm your email, so you can post jobs.",
        'job_review_note': "New jobs are checked by our team before they go live. We'll email you when yours is approved.",
        'code_failed': "Sorry, that didn't work: {error}",
        'registration_success': "Registration successful! You're now registered on our Job platform.\n",
        'pending_approval': "Your account is pending approval. You’ll be notified once approved.\n",
        'registration_details': "Name: {name}\nEmail: {email}\nRole: {role}",
        'registration_failed': "Registration failed: {error} (Status: {status})",
        'server_error': "Sorry, there was an error connecting to the server: {error}",
        'cancel': "Registration cancelled. You can start again with /start",
        'approved_employer': "Congratulations! Your Employer account has been approved by the admin. You can now log in and start using the platform.\nSelect an option from the menu below:",
        'open_section': "Click below to open {section}:",
        'change_language_prompt': "Please select your new language:",
        'language_updated': "Your language has been successfully updated.",
        'enter_job_title': "What is your professional Job Title? (e.g. Accountant, Driver, Developer):",
        'role_selected_candidate': "Selected role: Job Seeker\nNow, please provide your full name:",
        'role_selected_employer': "Selected role: Employer\nNow, please provide your Company Name:",
        'enter_trade_license': """Hello! We are thrilled to have you join the Beleqet Jobs community.

To ensure the highest quality of job postings on our platform, we just need to verify your account details. Please provide a clear copy of the following documents (PDF, PNG, or JPEG):

    <b>Companies:</b> Trade License and Business TIN Certificate.
    <b>Individuals:</b> A valid National ID, Passport, or Driver’s License.

Our team will review these promptly so you can start hiring your next great talent!""",
        'invalid_file_type': "Invalid file type. Please upload a PDF, PNG, or JPEG file. Not more than 5MB.",
        'processing_registration': "Uploading file and processing your registration... Please wait.",
        'denied_employer': "Your registration was denied. ❌\nYou can try again with better documents",
        'enter_phone': "Please enter your phone number (Required):",
        'enter_tg_username': "Please enter your Telegram username.\nLet employers reach you directly! Enter your Telegram username to make it easier for recruiters to contact you about job opportunities.",
        'skip': "Skip ➡️",
        'role_existing': "I already have an account",
        'use_this_name': "Use: {name}",
        'name_or_type': "What's your full name? Tap to use your Telegram name, or type it.",
        'share_phone_prompt': "Now share your phone number with the button below, so employers can call you.",
        'share_phone_button': "📱 Share my phone number",
        'share_phone_only': "Please use the button below. It shares the number on your Telegram account.",
        'phone_received': "Thanks, {phone} ✅",
        'ask_gender': "What is your gender?",
        'gender_male': "Male",
        'gender_female': "Female",
        'ask_country': "Which country do you live in?",
        'other_country': "Other country",
        'type_country': "Type the name of the country you live in, in English (for example: Kenya):",
        'ask_city': "Which city do you live in? Tap it, or type it.",
        'other_city': "Other city",
        'type_city': "Type the name of the city you live in:",
        'registration_details_no_email': "Name: {name}\nRole: {role}",
        'link_enter_email': "Type the email address of your Beleqet account:",
        'link_code_sent': "We sent a 6-digit code to {email}. Type it here to connect this Telegram to your account.\nNot there? Check your spam folder.",
        'link_done': "Done! This Telegram is now connected to your account, {name}. Choose an option below:",
        'link_failed': "Sorry, that didn't work: {error}",
        'link_other_email': "Use another email",
        'link_cancel': "Cancel",
        'link_cancelled': "OK. Send /start whenever you want to register or connect your account.",
        'menu': {
            'dashboard': "Dashboard",
            'my_profile': "My Profile",
            'my_applications': "My Applications",
            'post_job': "Post Job",
            'applicants': "Applicants",
            'my_jobs': "My Jobs",
            'job_list': "Jobs",
            'challenge': "SGS Challenge"
        }
    },
    'am': {
        'link_success': "መለያዎ በተሳካ ሁኔታ ተገናኝቷል!",
        'link_transfer_success': "መለያዎን ወደዚህ አዲስ የቴሌግራም ፕሮፋይል በተሳካ ሁኔታ አስተላልፈዋል።",
        'select_language': "እባክዎ ቋንቋዎን ይምረጡ:",
        'welcome_back': "እንኳን ተመልሰው በደህና መጡ አቶ፣ {name}! እንደ በ'ሮልነት' {role} ገብተዋል(ተካተዋል)።\nአማራጮችን ከታች ከቀረበዉ ሜኑ መሀከል ማግኘትና መምረጥ ይችላሉ:",
        'pending_employer': "እንደ ቀጣሪ ተደርገው ተመዝግበዋል፣ ሆኖም ግን አካውንትዎ ገና አልጸደቀም። እንደጸደቀ ወዲያዉኑ ይነገረዎታል።",
        'status_error': "ይቅርታ፣ የምዝገባ ደረጃዎን(ሁኔታዎን)መፈተሽና ማረጋገጥ አልቻልኩም። ስለዚህ ወደ ምዝገባው እናምራ።",
        'select_role': "እባክዎ ሚናዎን ይምረጡ:",
        'role_selected': "የተመረጠ ሚና: {role}\nአሁን ደግሞ፣ ሙሉ ስምዎን ያስገቡ:",
        'enter_email': "በጣም ጥሩ! አሁን ደግሞ የኢሜል አድራሻዎን ያስገቡ:",
        'enter_contact_name': "እናመሰግናለን! አሁን የእርስዎን ሙሉ ስም ያስገቡ (የድርጅቱ ተጠሪ):",
        'invalid_email': "ልክ ያልሆነ(የማይሰራ)የኢሜል አድራሻ!!እባክዎ ትክክለኛ የኢሜል አድራሻ ያስገቡ:",
        'email_exists': "ይህ ኢሜል ቀድሞ ተመዝግቧል። እባክዎ ለምዝገባ የሚሆን ሌላ የኢሜል አድራሻ ያስገቡ።",
        'email_error': "ይቅርታ፣ በአሁኑ ጊዜ የኢሜሉን መገኘት መቻልና አለመቻል ማረጋገጥ አልቻልኩም። እባክዎ ቆይተው ይሞክሩ።",
        'enter_password': "ጥሩ! አሁን ቢያንስ 8 ፊደላት ወይም ቁጥሮች ያሉት የይለፍ ቃል ይምረጡ። በbeleqetjobs.com ለመግባት ከኢሜልዎ ጋር ይጠቀሙበታል:",
        'password_too_short': "የይለፍ ቃሉ በጣም አጭር ነው። እባክዎ ቢያንስ 8 ፊደላት ወይም ቁጥሮች ይጠቀሙ:",
        'password_hidden': "ለደህንነትዎ፣ የይለፍ ቃልዎን የያዘውን መልዕክት አጥፍቻለሁ።",
        'code_sent': "ባለ 6 አሃዝ ኮድ ወደ {email} ልከናል። ኢሜልዎን ለማረጋገጥ ኮዱን እዚህ ይጻፉ።\nካላገኙት የስፓም (spam) ማህደሩን ይመልከቱ።",
        'code_confirmed': "ኢሜልዎ ተረጋግጧል። ✅ አሁን ስራ መለጠፍ ይችላሉ።",
        'code_format': "እባክዎ ከኢሜሉ ላይ ያሉትን 6 አሃዞች ይጻፉ።",
        'code_resend': "አዲስ ኮድ ላክ",
        'code_change_email': "ኢሜል ቀይር",
        'code_later': "በኋላ",
        'code_later_text': "ችግር የለም። ሲዘጋጁ «ሥራ መለጠፍ» የሚለውን ይጫኑ፤ አዲስ ኮድ እልክልዎታለሁ።",
        'enter_new_email': "መጠቀም የሚፈልጉትን የኢሜል አድራሻ ይጻፉ:",
        'confirm_to_post': "ስራ ለመለጠፍ መጀመሪያ የኢሜል አድራሻዎን ያረጋግጡ። ይህ ስራ ፈላጊዎችን ከሀሰተኛ የስራ ማስታወቂያዎች ይጠብቃል።",
        'add_email_to_post': "ስራ ለመለጠፍ መጀመሪያ የኢሜል አድራሻዎን ያስገቡ፤ ለማረጋገጥ ኮድ እልክልዎታለሁ። ይህ ስራ ፈላጊዎችን ከሀሰተኛ የስራ ማስታወቂያዎች ይጠብቃል።",
        'send_code_to': "ኮድ ወደ {email} ላክ",
        'add_email': "ኢሜሌን ጨምር",
        'confirm_now': "አንድ የመጨረሻ ደረጃ፦ ስራ መለጠፍ እንዲችሉ ኢሜልዎን ያረጋግጡ።",
        'job_review_note': "አዳዲስ ስራዎች ከመታተማቸው በፊት በቡድናችን ይገመገማሉ። ስራዎ ሲጸድቅ በኢሜል እናሳውቅዎታለን።",
        'code_failed': "ይቅርታ፣ አልተሳካም፦ {error}",
        'registration_success': "ምዝገባው ተሳክቷል! አሁን በሥራ ፕላትፎርማችን ላይ ተመዝግበዋል።\n",
        'pending_approval': "መለያ አካውንትዎ ፈቃድ እየጠበቀ ነው።ተፈቅዶ ሲያልቅ ይነገርዎታል\n",
        'registration_details': "ስም: {name}\nኢሜል: {email}\nሚና: {role}",
        'registration_failed': "ምዝገባው አልተሳካም {error} (ሁኔታ: {status})",
        'server_error': "ይቅርታ፣ ከ'ሰర్ቨር'በመገናኘት ሂደት ላይ አንዳች ስህተት(ኢረር)ተፈጥሯል: {error}",
        'cancel': "ምዝገባ ተሰርዟል። ሆኖም /start የሚለውን በመጠቀም እንደገና መጀመር ይችላሉ።",
        'approved_employer': "ኦ! እንኳን ደስ ያለዎት! አድሚኒስትሬተሩ የቀጣሪነት አካውንትዎን ተቀብሎታል። አሁን መግባትና ፕላትፎርሙን መጠቀም ይችላሉ።\nከታች ባለው ሜኑ ይጠቀሙ:",
        'open_section': "ያለውን ጠቅ ያርጉ ለመክፈት ከታች {section}:",
        'change_language_prompt': "እባክዎ አዲሱን ቋንቋዎን ይምረጡ:",
        'language_updated': "ቋንቋዎ በተሳካ ሁኔታ ተለውጧል።",
        'enter_job_title': "የሥራ መደብዎ ምንድን ነው? (ምሳሌ፡ አካውንታንት፣ ሾፌር፣ ዲቨሎፐር):",
        'role_selected_candidate': "የተመረጠ ሚና: ሥራ ፈላጊ\nአሁን ደግሞ፣ ሙሉ ስምዎን ያስገቡ:",
        'role_selected_employer': "የተመረጠ ሚና: ቀጣሪ\nአሁን ደግሞ፣ የድርጅቱን ስም ያስገቡ:",
        'enter_trade_license': """ሰላም! የበለቀት ስራዎች (Beleqet Jobs) ማህበረሰብ አባል ስለሆኑ በጣም ደስተኞች ነን።

በድረ-ገጻችን ላይ የሚወጡ የስራ ማስታወቂያዎች ተአማኒነት ያላቸው እና ጥራት ያላቸው መሆናቸውን ለማረጋገጥ፣ የተቋምዎን ወይም የግል መረጃዎን ማረጋገጥ ይኖርብናል። እባክዎ የሚከተሉትን ሰነዶች በ(PDF, PNG, ወይም JPEG) ቅርጸት ያያይዙ፦

    <b>ለድርጅቶች፦</b> የፀና የንግድ ፈቃድ እና የንግድ ታክስ ከፋይ መለያ ቁጥር (TIN) ሰርተፍኬት።
    <b>ለግለሰቦች፦</b> የታደሰ ብሄራዊ መታወቂያ፣ ፓስፖርት፣ ወይም የመንጃ ፈቃድ።

የላኩትን ሰነዶች በፍጥነት መርምረን ስናጠናቅቅ፣ ምርጥ ሰራተኞችን ወዲያውኑ መቅጠር መጀመር ይችላሉ!""",
        'invalid_file_type': "የፋይል አይነት ልክ አይደለም። እባክዎ PDF፣ PNG ወይም JPEG ፋይል ይጫኑ። ከ5MB በላይ አይደለም።",
        'processing_registration': "ፋይሉን እየጫንን እና ምዝገባዎን እያጠናቀቅን ነው... እባክዎ ይጠብቁ።",
        'denied_employer': "የቀጣሪነት ምዝገባ ጥያቄዎ ውድቅ ተደርጓል። ❌\nትክክለኛ ሰነዶችን በመያዝ እንደገና መመዝገብ ይችላሉ።",
        'enter_phone': "እባክዎ ስልክ ቁጥርዎን ያስገቡ (ግዴታ):",
        'enter_tg_username': "እባክዎ የቴሌግራም ተጠቃሚ ስምዎን (ዩዘርኔም) ያስገቡ።\nአሰሪዎች በቀጥታ እንዲያገኙዎ ያድርጉ! ቀጣሪዎች ስለ ስራ እድሎች በቀላሉ ሊያነጋግሩዎ እንዲችሉ የቴሌግራም የተጠቃሚ ስምዎን ያስገቡ።",
        'skip': "ዝለል ➡️",
        'role_existing': "መለያ አለኝ",
        'use_this_name': "ይህን ይጠቀሙ፦ {name}",
        'name_or_type': "ሙሉ ስምዎ ማን ነው? የቴሌግራም ስምዎን ለመጠቀም ይጫኑ፣ ወይም ይጻፉት።",
        'share_phone_prompt': "አሁን ቀጣሪዎች እንዲደውሉልዎ ከታች ባለው ቁልፍ ስልክ ቁጥርዎን ያጋሩ።",
        'share_phone_button': "📱 ስልክ ቁጥሬን አጋራ",
        'share_phone_only': "እባክዎ ከታች ያለውን ቁልፍ ይጠቀሙ። በቴሌግራም መለያዎ ላይ ያለውን ቁጥር ያጋራል።",
        'phone_received': "እናመሰግናለን፣ {phone} ✅",
        'ask_gender': "ጾታዎ ምንድን ነው?",
        'gender_male': "ወንድ",
        'gender_female': "ሴት",
        'ask_country': "የሚኖሩት በየትኛው አገር ነው?",
        'other_country': "ሌላ አገር",
        'type_country': "የሚኖሩበትን አገር ስም በእንግሊዝኛ ይጻፉ (ለምሳሌ፦ Kenya):",
        'ask_city': "የሚኖሩት በየትኛው ከተማ ነው? ይጫኑት፣ ወይም ይጻፉት።",
        'other_city': "ሌላ ከተማ",
        'type_city': "የሚኖሩበትን ከተማ ስም ይጻፉ:",
        'registration_details_no_email': "ስም: {name}\nሚና: {role}",
        'link_enter_email': "የBeleqet መለያዎን ኢሜል አድራሻ ይጻፉ:",
        'link_code_sent': "ባለ 6 አሃዝ ኮድ ወደ {email} ልከናል። ይህን ቴሌግራም ከመለያዎ ጋር ለማገናኘት ኮዱን እዚህ ይጻፉ።\nካላገኙት የስፓም (spam) ማህደሩን ይመልከቱ።",
        'link_done': "ተጠናቋል! ይህ ቴሌግራም አሁን ከመለያዎ ጋር ተገናኝቷል፣ {name}። ከታች አማራጭ ይምረጡ:",
        'link_failed': "ይቅርታ፣ አልተሳካም፦ {error}",
        'link_other_email': "ሌላ ኢሜል ይጠቀሙ",
        'link_cancel': "ሰርዝ",
        'link_cancelled': "እሺ። ለመመዝገብ ወይም መለያዎን ለማገናኘት በፈለጉ ጊዜ /start ይላኩ።",
        'menu': {
            'dashboard': "ዳሽቦርድ",
            'my_profile': "የእኔ መገለጫ",
            'my_applications': "የእኔ ማመልከቻዎች",
            'post_job': "ሥራ መለጠፍ",
            'applicants': "አመልካቾች",
            'my_jobs': "የእኔ ሥራዎች",
            'job_list': "ስራዎች",
            'challenge': "SGS Challenge"
        }
    }
}

ROLE_BACKEND = {
    'employer': 'wp_job_board_pro_employer',
    'candidate': 'wp_job_board_pro_candidate'
}

def normalize_role(role: str) -> str:
    if not isinstance(role, str) or not role:
        return 'Unknown'
    role_clean = role.strip().lower()
    if role_clean in ('employer', 'wp_job_board_pro_employer'):
        return 'Employer'
    if role_clean in ('candidate', 'wp_job_board_pro_candidate'):
        return 'Candidate'
    return 'Unknown'


def password_ok(text: str) -> bool:
    """The website's rule: at least 8 characters. A shorter one was once kept silently and unusable."""
    return isinstance(text, str) and len(text) >= MIN_PASSWORD_LENGTH


def six_digit_code(text: str):
    """The emailed code from what the person typed ("123 456" works too), or None."""
    digits = re.sub(r'\s', '', text or '')
    return digits if re.fullmatch(r'\d{6}', digits) else None


def menu_key_for(text: str):
    """(menu key, language) when the text is one of the menu buttons, in either language."""
    for l_code, l_data in TRANSLATIONS.items():
        for key, value in l_data.get('menu', {}).items():
            if value == text:
                return key, l_code
    return None


def registration_payload(user_data: dict, telegram_user) -> dict:
    """
    What the API keeps from a registration: everything the person typed, plus the Telegram
    username Telegram itself reports (not typed, so it can't be someone else's).
    """
    role_input = user_data.get('role_input', '')
    return {
        'telegram_id': str(telegram_user.id),
        'name': user_data.get('name'),
        # The employer's own name; the company name goes to their company profile.
        'contact_name': user_data.get('contact_name', '') if role_input == 'employer' else '',
        'email': user_data.get('email') if role_input == 'employer' else None,
        'password': user_data.get('password') if role_input == 'employer' else None,
        'username': f"tg_{telegram_user.id}",
        'role': ROLE_BACKEND.get(role_input, user_data.get('role', 'candidate')),
        'language': user_data.get('language', 'en'),
        'phone': user_data.get('phone', ''),
        'tg_username': getattr(telegram_user, 'username', None) or '',
        'job_title': user_data.get('job_title', ''),
        'company_name': user_data.get('company_name', ''),
        'gender': user_data.get('gender'),
        'country': user_data.get('country'),
        'city': user_data.get('city'),
    }

def country_from_text(text: str):
    """ISO code for a typed country name or code ("Kenya", "ke", "ኬንያ"), or None."""
    cleaned = re.sub(r'\s+', ' ', (text or '').strip()).lower()
    if re.fullmatch(r'[a-z]{2}', cleaned):
        return cleaned.upper()
    return COUNTRY_NAMES.get(cleaned)


def own_phone(message, telegram_user):
    """The number from a shared contact, only when it's the person's own (Telegram-verified)."""
    contact = getattr(message, 'contact', None)
    if not contact or not contact.phone_number:
        return None
    if contact.user_id and telegram_user and contact.user_id != telegram_user.id:
        return None
    number = re.sub(r'[\s-]', '', contact.phone_number)
    return number if number.startswith('+') else '+' + number


def role_keyboard(lang: str) -> InlineKeyboardMarkup:
    t = TRANSLATIONS[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Employer" if lang == 'en' else "ቀጣሪ", callback_data='employer'),
         InlineKeyboardButton("Job Seeker" if lang == 'en' else "ሥራ ፈላጊ", callback_data='candidate')],
        [InlineKeyboardButton(t['role_existing'], callback_data='existing')],
    ])


def full_telegram_name(telegram_user) -> str:
    parts = [getattr(telegram_user, 'first_name', None), getattr(telegram_user, 'last_name', None)]
    return ' '.join(p.strip() for p in parts if p and p.strip())


# The buttons open the Mini App's own screens (the website's /tg pages, made for Telegram).
MINI_APP = f"{CONFIG['mini_app_url']}/tg"

MENU_URLS = {
    'candidate': {
        'dashboard': MINI_APP,
        'my_profile': f"{MINI_APP}/profile",
        'my_applications': f"{MINI_APP}/applications",
        'job_list': MINI_APP,
    },
    'employer': {
        'post_job': f"{MINI_APP}/post-job",
        'dashboard': f"{MINI_APP}/employer",
        'my_profile': f"{MINI_APP}/profile",
        'my_jobs': f"{MINI_APP}/employer",
        'applicants': f"{MINI_APP}/employer",
    }
}

class BotContext:
    def __init__(self):
        self.session: aiohttp.ClientSession = None
        self.application: Application = None
        self.rate_limiter = None

bot_context = BotContext()

@lru_cache(maxsize=128)
def get_keyboard(role: str, lang: str, is_admin: bool = False) -> ReplyKeyboardMarkup:
    if lang not in TRANSLATIONS or 'menu' not in TRANSLATIONS[lang]:
        lang = 'en'
    menu = TRANSLATIONS[lang]['menu']
    role_friendly = normalize_role(role)
    if role_friendly == 'Candidate':
        options = [
            [menu['job_list'], menu['my_profile']],
            [menu['my_applications'], menu['dashboard']],
            [menu['challenge']]
        ]
    else:
        options = [
            [menu['post_job'], menu['dashboard']],
            [menu['applicants'], menu['my_jobs']],
            [menu['my_profile']],
            [menu['challenge']]
        ]
    
    if is_admin:
        options.append(["📣 Broadcast Message"])
        
    return ReplyKeyboardMarkup(options, resize_keyboard=True, one_time_keyboard=False)


class RateLimiter:
    def __init__(self, messages_per_second: int = 1, max_burst: int = 30):
        self.rate = messages_per_second
        self.burst = max_burst
        self.tokens = defaultdict(lambda: max_burst)
        self.last_refill = defaultdict(lambda: asyncio.get_event_loop().time())
        self.lock = asyncio.Lock()

    async def _refill(self, chat_id: int):
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_refill[chat_id]
        new_tokens = min(self.burst, self.tokens[chat_id] + elapsed * self.rate)
        self.tokens[chat_id] = new_tokens
        self.last_refill[chat_id] = now

    async def _send_request(self, chat_id: int, method, **kwargs):
        async with self.lock:
            await self._refill(chat_id)
            if self.tokens[chat_id] < 1:
                wait_time = (1 - self.tokens[chat_id]) / self.rate
                await asyncio.sleep(wait_time)
                await self._refill(chat_id)
            self.tokens[chat_id] -= 1

        try:
            return await method(chat_id=chat_id, **kwargs)
        except telegram.error.Forbidden as e:
            # Gracefully handle blocked/deactivated users
            logger.warning(f"Skipping chat_id {chat_id}: {e.message}")
            raise e # We still raise it so the calling function (broadcast) knows it failed
        except Exception as e:
            if "Too Many Requests" in str(e):
                retry_after = int(str(e).split("retry after ")[-1]) if "retry after" in str(e) else 5
                await asyncio.sleep(retry_after)
                return await self._send_request(chat_id, method, **kwargs)
            else:
                logger.error(f"Failed to send request for chat_id {chat_id}: {e}", exc_info=True)
                raise

    async def send_message(self, chat_id: int, text: str, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.send_message,
            text=text,
            **kwargs
        )

    async def send_photo(self, chat_id: int, photo, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.send_photo,
            photo=photo,
            **kwargs
        )

    async def copy_message(self, chat_id: int, from_chat_id: int, message_id: int, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.copy_message,
            from_chat_id=from_chat_id,
            message_id=message_id,
            **kwargs
        )

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # 1. Determine chat_id and effective_user safely
    user = update.effective_user
    if update.message:
        chat_id = update.message.chat_id
    elif update.callback_query:
        chat_id = update.callback_query.message.chat_id
    else:
        return ConversationHandler.END

    # --- PRIORITY 1: Deep linking for REGISTRATION from a job post ---
    if context.args and context.args[0].startswith("register_job-"):
        job_info = context.args[0].replace("register_", "")
        context.user_data['post_registration_job'] = job_info
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("English", callback_data='en'), InlineKeyboardButton("አማርኛ", callback_data='am')]
        ])
        await bot_context.rate_limiter.send_message(
            chat_id,
            "Welcome! To view this job, you need to register first.\n\n"
            "እባክዎ ቋንቋዎን ይምረጡ:\nPlease select your language:",
            reply_markup=keyboard
        )
        return LANGUAGE

    # --- PRIORITY 2: Deep linking for viewing a JOB ---
    if context.args and context.args[0].startswith("job-"):
        job_slug = context.args[0].split("job-", 1)[1]
        job_detail_url = f"{MINI_APP}/jobs/{job_slug}"
        if not job_detail_url.startswith(('http://', 'https://')):
             job_detail_url = 'https://' + job_detail_url
             
        keyboard = [[InlineKeyboardButton("View Job Details", web_app=WebAppInfo(url=job_detail_url))]]
        await bot_context.rate_limiter.send_message(
            chat_id,
            "Click the button below to view the job details:", 
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return ConversationHandler.END

    # --- PRIORITY 3: Deep linking for SGS CHALLENGE ---
    if context.args and context.args[0] == "challenge":
        await challenge_command(update, context)
        return ConversationHandler.END

    # --- PRIORITY 4: Deep linking for ACCOUNT LINKING ---
    if context.args:
        telegram_id = str(user.id)
        token = context.args[0]
        if len(token) == 32:
            async with bot_context.session.post(
                f"{CONFIG['wp_api_url']}/../link-telegram",
                json={'token': token, 'telegram_id': telegram_id},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    role = normalize_role(data.get('role'))
                    lang = context.user_data.get('language', 'en')
                    link_type = data.get('link_type', 'new')

                    context.user_data['role'] = role
                    context.user_data['language'] = lang
                    
                    success_message = TRANSLATIONS[lang].get('link_transfer_success') if link_type == 'transfer' else TRANSLATIONS[lang].get('link_success')
                    welcome_message = TRANSLATIONS[lang]['welcome_back'].format(name=user.first_name, role=role)
                    
                    await bot_context.rate_limiter.send_message(
                        chat_id,
                        text=f"{success_message}\n\n{welcome_message}",
                        reply_markup=get_keyboard(role, lang, user.id in CONFIG['admin_ids'])
                    )
                else:
                    await bot_context.rate_limiter.send_message(chat_id, "Error: Linking failed.")
            return ConversationHandler.END

    # --- PRIORITY 4: Regular start logic (Status Check) ---
    telegram_id = str(user.id)
    async with bot_context.session.get(f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}", timeout=30) as response:
        if response.status == 200:
            data = await response.json()
            if data.get('registered'):
                lang = data.get('language') or 'en'
                role_raw = data.get('role', 'unknown')
                status_raw = data.get('status', 'pending').lower()
                role_friendly = normalize_role(role_raw)

                if status_raw == 'denied' and normalize_role(role_raw) == 'Employer':
                    logger.info(f"Employer {telegram_id} was denied. Restarting registration.")
                    context.user_data.clear() 
                else:
                    context.user_data['language'] = lang
                    context.user_data['role'] = role_friendly 
                    
                    if role_raw == 'candidate' or (role_raw == 'employer' and status_raw == 'approved'):
                        is_admin = user.id in CONFIG['admin_ids']
                        
                        await bot_context.rate_limiter.send_message(
                            chat_id,
                            TRANSLATIONS[lang]['welcome_back'].format(name=user.first_name, role=role_friendly),
                            reply_markup=get_keyboard(role_friendly, lang, is_admin)
                        )
                        return ConversationHandler.END
                    
                    elif role_raw == 'employer' and status_raw == 'pending':
                        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['pending_employer'])
                        return ConversationHandler.END

    # --- RE-REGISTRATION / NEW USER ---
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("English", callback_data='en'), InlineKeyboardButton("አማርኛ", callback_data='am')]
    ])
    await bot_context.rate_limiter.send_message(
        chat_id,
        "እባክዎ ቋንቋዎን ይምረጡ:\nPlease select your language:",
        reply_markup=keyboard
    )
    return LANGUAGE

async def handle_language_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    lang = query.data
    
    if lang not in ['en', 'am']:
        logger.warning(f"Unexpected callback data in language selection: {lang}")
        return LANGUAGE 

    context.user_data['language'] = lang
    logger.info(f"Language selected: {lang} for new user {query.from_user.id}")

    await query.edit_message_text(TRANSLATIONS[lang]['select_role'], reply_markup=role_keyboard(lang))
    return ROLE

async def change_language_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point for the /language command."""
    # Check if user is registered first
    telegram_id = str(update.effective_user.id)
    async with bot_context.session.get(f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}") as response:
        if response.status != 200 or not (await response.json()).get('registered'):
            await update.message.reply_text("You need to be registered to change the language. Please use /start to register.")
            return ConversationHandler.END
            
    lang = context.user_data.get('language', 'en')
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("English", callback_data='lang_en'), InlineKeyboardButton("አማርኛ", callback_data='lang_am')]
    ])
    await bot_context.rate_limiter.send_message(
        update.message.chat_id,
        TRANSLATIONS[lang]['change_language_prompt'],
        reply_markup=keyboard
    )
    return CHANGE_LANGUAGE

async def handle_language_update(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handles the actual language update."""
    query = update.callback_query
    await query.answer()

    new_lang = query.data.split('_')[1]  # Extracts 'en' or 'am' from 'lang_en' or 'lang_am'
    telegram_id = str(query.from_user.id)

    # Update language on the backend
    async with bot_context.session.post(
        f"{CONFIG['wp_api_url']}/../update-language",
        json={'telegram_id': telegram_id, 'language': new_lang},
        timeout=aiohttp.ClientTimeout(total=10)
    ) as response:
        if response.status == 200:
            context.user_data['language'] = new_lang
            role = await get_user_role(telegram_id)
            await query.edit_message_text(text=TRANSLATIONS[new_lang]['language_updated'])
            # Show the main menu in the new language
            if role != 'unknown':
                 await bot_context.rate_limiter.send_message(
                    query.message.chat_id,
                    text=f"Menu (in {new_lang}):",
                    reply_markup=get_keyboard(role.capitalize(), new_lang, query.from_user.id in CONFIG['admin_ids'])
                )
        else:
            lang = context.user_data.get('language', 'en')
            await query.edit_message_text(text=TRANSLATIONS[lang]['server_error'].format(error='Could not update language'))

    return ConversationHandler.END

async def handle_role_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    role_input = query.data
    lang = context.user_data.get('language', 'en')

    ROLE_MAP = {
        'employer': 'wp_job_board_pro_employer',
        'candidate': 'wp_job_board_pro_candidate'
    }

    if role_input == 'existing':
        await query.edit_message_text(TRANSLATIONS[lang]['link_enter_email'])
        return LINK_EMAIL

    if role_input not in ROLE_MAP:
        if role_input in ['en', 'am']:
            if context.user_data.get('language') != role_input:
                context.user_data['language'] = role_input
                try:
                    await query.edit_message_text(TRANSLATIONS[role_input]['select_role'], reply_markup=role_keyboard(role_input))
                except telegram.error.BadRequest as e:
                    if "Message is not modified" not in str(e):
                        raise e
            return ROLE
        return LANGUAGE

    for key in REGISTRATION_KEYS:
        context.user_data.pop(key, None)
    context.user_data.update({
        'role_input': role_input,
        'role': normalize_role(role_input)
    })

    if role_input == 'employer':
        await query.edit_message_text(TRANSLATIONS[lang]['role_selected_employer'])
        return COMPANY_NAME
    # Job seekers: the name on their Telegram is one tap away.
    name = full_telegram_name(query.from_user)
    buttons = [[InlineKeyboardButton(TRANSLATIONS[lang]['use_this_name'].format(name=name)[:60], callback_data='use_tg_name')]] if name else []
    await query.edit_message_text(
        TRANSLATIONS[lang]['name_or_type'] if name else TRANSLATIONS[lang]['role_selected_candidate'],
        reply_markup=InlineKeyboardMarkup(buttons) if buttons else None,
    )
    return NAME
    
async def get_company_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return COMPANY_NAME
    context.user_data['company_name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_contact_name'])
    return CONTACT_NAME

async def get_contact_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """The employer's own name: the account is theirs, the company is its profile."""
    message = update.effective_message
    if not message or not message.text:
        return CONTACT_NAME
    context.user_data['contact_name'] = message.text.strip()
    context.user_data['name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_phone'])
    return PHONE

def share_phone_keyboard(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(TRANSLATIONS[lang]['share_phone_button'], request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )


async def ask_for_phone(chat_id: int, lang: str) -> int:
    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['share_phone_prompt'], reply_markup=share_phone_keyboard(lang))
    return PHONE


async def get_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return NAME
    context.user_data['name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    return await ask_for_phone(message.chat_id, lang)


async def use_telegram_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language', 'en')
    name = full_telegram_name(query.from_user) or 'Telegram User'
    context.user_data['name'] = name
    try:
        await query.edit_message_reply_markup(reply_markup=None)
    except Exception:
        pass
    return await ask_for_phone(query.message.chat_id, lang)

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message:
        return PHONE

    lang = context.user_data.get('language', 'en')

    # Job seekers share the number Telegram verified; it's how employers reach them.
    if context.user_data.get('role_input') != 'employer':
        phone = own_phone(message, update.effective_user)
        if not phone:
            await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['share_phone_only'], reply_markup=share_phone_keyboard(lang))
            return PHONE
        context.user_data['phone'] = phone
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['phone_received'].format(phone=phone), reply_markup=ReplyKeyboardRemove())
        return await ask_gender(message.chat_id, lang)

    phone_input = None

    if message.contact and message.contact.phone_number:
        phone_input = message.contact.phone_number.strip()
        if phone_input.startswith('251') and not phone_input.startswith('+251'):
            phone_input = '+' + phone_input
    elif message.text:
        phone_input = message.text.strip()

    if not phone_input:
        return PHONE

    ethiopian_phone_pattern = r'^(\+251|0)[79][0-9]{8}$'
    
    if not re.match(ethiopian_phone_pattern, phone_input):
        error_msg = (
            "Invalid format. Please enter a valid Ethiopian number starting with 09... or 07..." 
            if lang == 'en' else 
            "ልክ ያልሆነ ቅርጸት። እባክዎ በ 09... ወይም 07... የሚጀምር ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ"
        )
        await bot_context.rate_limiter.send_message(message.chat_id, error_msg)
        return PHONE

    context.user_data['phone'] = phone_input
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['enter_email']
    )
    return EMAIL

async def ask_gender(chat_id: int, lang: str) -> int:
    t = TRANSLATIONS[lang]
    keyboard = InlineKeyboardMarkup([[InlineKeyboardButton(t['gender_male'], callback_data='gender_MALE'),
                                      InlineKeyboardButton(t['gender_female'], callback_data='gender_FEMALE')]])
    await bot_context.rate_limiter.send_message(chat_id, t['ask_gender'], reply_markup=keyboard)
    return GENDER


async def get_gender(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language', 'en')
    context.user_data['gender'] = query.data.split('_', 1)[1]
    t = TRANSLATIONS[lang]
    rows = [[InlineKeyboardButton(en if lang == 'en' else am, callback_data=f'country_{code}')]
            for code, en, am in COUNTRY_BUTTONS]
    rows.append([InlineKeyboardButton(t['other_country'], callback_data='country_other')])
    chosen = t['gender_male'] if context.user_data['gender'] == 'MALE' else t['gender_female']
    await query.edit_message_text(f"{t['ask_gender']} {chosen}")
    await bot_context.rate_limiter.send_message(query.message.chat_id, t['ask_country'], reply_markup=InlineKeyboardMarkup(rows))
    return COUNTRY


async def ask_city(chat_id: int, context: ContextTypes.DEFAULT_TYPE) -> int:
    lang = context.user_data.get('language', 'en')
    t = TRANSLATIONS[lang]
    if context.user_data.get('country') == 'ET':
        labels = [en if lang == 'en' else am for en, am in ETHIOPIAN_CITIES]
        rows = [[InlineKeyboardButton(labels[i], callback_data=f'city_{i}'),
                 InlineKeyboardButton(labels[i + 1], callback_data=f'city_{i + 1}')]
                for i in range(0, len(labels) - 1, 2)]
        rows.append([InlineKeyboardButton(t['other_city'], callback_data='city_other')])
        await bot_context.rate_limiter.send_message(chat_id, t['ask_city'], reply_markup=InlineKeyboardMarkup(rows))
    else:
        await bot_context.rate_limiter.send_message(chat_id, t['type_city'])
    return CITY


async def get_country(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language', 'en')
    choice = query.data.split('_', 1)[1]
    if choice == 'other':
        await query.edit_message_text(TRANSLATIONS[lang]['type_country'])
        return COUNTRY_TYPED
    context.user_data['country'] = choice
    names = {code: (en if lang == 'en' else am) for code, en, am in COUNTRY_BUTTONS}
    await query.edit_message_text(f"{TRANSLATIONS[lang]['ask_country']} {names.get(choice, choice)}")
    return await ask_city(query.message.chat_id, context)


async def get_typed_country(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return COUNTRY_TYPED
    # An unknown name isn't worth stopping for: the person can fix it in their profile.
    context.user_data['country'] = country_from_text(message.text)
    return await ask_city(message.chat_id, context)


async def get_city(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    lang = context.user_data.get('language', 'en')
    query = update.callback_query
    if query:
        await query.answer()
        choice = query.data.split('_', 1)[1]
        if choice == 'other':
            await query.edit_message_text(TRANSLATIONS[lang]['type_city'])
            return CITY
        city = ETHIOPIAN_CITIES[int(choice)][0]
        await query.edit_message_text(f"{TRANSLATIONS[lang]['ask_city']} {city}")
        chat_id = query.message.chat_id
    else:
        message = update.effective_message
        if not message or not message.text:
            return CITY
        city = re.sub(r'\s+', ' ', message.text).strip()[:80]
        chat_id = message.chat_id
    context.user_data['city'] = city
    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['enter_job_title'])
    return JOB_TITLE


async def check_email_exists(email: str) -> dict:
    try:
        url = f"{CONFIG['wp_api_url']}/../check-user?email={email}"
        async with bot_context.session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            if response.status == 200:
                return await response.json()
            logger.warning(f"Email check returned HTTP status {response.status} from {url}")
            return None
    except Exception as e:
        logger.error(f"Error checking email availability for {email}: {e}")
        return None

async def get_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        if update.callback_query:
            await update.callback_query.answer()
        return EMAIL

    email = message.text.strip().lower()
    lang = context.user_data.get('language', 'en')

    if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['invalid_email']
        )
        return EMAIL

    result = await check_email_exists(email)
    
    if result is not None:
        is_registered = result.get('email_registered', False)
        can_proceed = result.get('can_reregister', False)

        if is_registered and not can_proceed:
            await bot_context.rate_limiter.send_message(
                message.chat_id,
                TRANSLATIONS[lang]['email_exists']
            )
            return EMAIL
    else:
        logger.warning(f"Could not verify email {email} availability upfront; proceeding with registration.")

    context.user_data['email'] = email

    # The Telegram username comes from Telegram itself when registering, so there's nothing to ask.
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_password'])
    return PASSWORD

async def get_tg_username(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Only for conversations saved before the username question was dropped."""
    lang = context.user_data.get('language', 'en')
    
    if update.callback_query:
        await update.callback_query.answer()
        context.user_data['tg_username'] = ""
        await bot_context.rate_limiter.send_message(
            update.callback_query.message.chat_id, 
            TRANSLATIONS[lang]['enter_password']
        )
    else:
        message = update.effective_message
        if not message or not message.text:
            return TG_USERNAME
        context.user_data['tg_username'] = message.text.strip()
        await bot_context.rate_limiter.send_message(
            message.chat_id, 
            TRANSLATIONS[lang]['enter_password']
        )
        
    return PASSWORD

async def get_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return PASSWORD

    user_data = context.user_data
    lang = user_data.get('language', 'en')
    # The password shouldn't stay readable in the chat. Bots may delete messages in private chats.
    try:
        await message.delete()
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['password_hidden'])
    except Exception as e:
        logger.info(f"Could not delete a password message: {e}")
    if not password_ok(message.text):
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['password_too_short'])
        return PASSWORD
    user_data['password'] = message.text
    role_input = user_data.get('role_input', '')

    if role_input == 'employer':
        return await submit_registration(update, context)
    
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['enter_job_title']
    )
    return JOB_TITLE

async def get_job_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return JOB_TITLE
    context.user_data['job_title'] = message.text.strip()
    return await submit_registration(update, context)

async def get_trade_license(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message:
        return TRADE_LICENSE
    user_data = context.user_data
    lang = user_data.get('language', 'en')
    telegram_id = str(update.effective_user.id)
    chat_id = message.chat_id
    
    import time
    timestamp = int(time.time())
    
    document = message.document
    photo = message.photo
    
    MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB limit
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

    if document:
        if document.file_size and document.file_size > MAX_FILE_BYTES:
            await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
            return TRADE_LICENSE
        raw_name = document.file_name or "trade_license.pdf"
        original_ext = raw_name.lower().split('.')[-1] if '.' in raw_name else 'pdf'
        if original_ext not in ALLOWED_EXTENSIONS:
            await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
            return TRADE_LICENSE
        file_name = f"TG_{telegram_id}_{timestamp}.{original_ext}"
        file_obj = await document.get_file()
    elif photo:
        best_photo = photo[-1]
        if best_photo.file_size and best_photo.file_size > MAX_FILE_BYTES:
            await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
            return TRADE_LICENSE
        file_name = f"TG_{telegram_id}_{timestamp}.jpg"
        file_obj = await best_photo.get_file()
    else:
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
        return TRADE_LICENSE

    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['processing_registration'])

    # Download as bytes (no Base64 encoding needed)
    file_bytes = await file_obj.download_as_bytearray()
    
    user_data['trade_license_bytes'] = bytes(file_bytes)
    user_data['trade_license_name'] = file_name
    
    return await submit_registration(update, context)

async def submit_registration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Submits the final registration data to the WordPress API."""
    user_data = context.user_data
    lang = user_data.get('language', 'en')
    chat_id = update.effective_chat.id if update.effective_chat else (update.effective_message.chat_id if update.effective_message else None)
    payload = registration_payload(user_data, update.effective_user)
    next_state = ConversationHandler.END

    try:
        req_kwargs = {'json': payload}

        async with bot_context.session.post(CONFIG['wp_api_url'], **req_kwargs, timeout=60) as response:
            if response.status == 201 or response.status == 200:
                data = await response.json()
                context.user_data['role'] = normalize_role(data.get('role'))
                context.user_data['language'] = data.get('language') or lang
                status = data.get('status', 'approved')
                role = normalize_role(user_data.get('role_input', ''))
                # Employers confirm their email before posting jobs; job seekers don't have to.
                if role == 'Employer' and not data.get('email_confirmed') and chat_id:
                    next_state = EMAIL_CODE
                
                msg = TRANSLATIONS[lang]['registration_success']
                if status == 'pending':
                    msg += TRANSLATIONS[lang]['pending_approval']

                details = (
                    TRANSLATIONS[lang]['registration_details'].format(name=user_data.get('name'), email=user_data.get('email'), role=role)
                    if user_data.get('email') else
                    TRANSLATIONS[lang]['registration_details_no_email'].format(name=user_data.get('name'), role=role)
                )
                
                if chat_id:
                    await bot_context.rate_limiter.send_message(
                        chat_id, text=msg + details,
                        reply_markup=get_keyboard(role, lang, update.effective_user.id in CONFIG['admin_ids']) if status != 'pending' else None
                    )

                # Post-registration redirect logic
                post_reg_job = context.user_data.get('post_registration_job')
                if post_reg_job and chat_id:
                    clean_slug = post_reg_job.replace('job-', '')
                    mini_app_job_url = f"{MINI_APP}/jobs/{clean_slug}"
                    
                    if lang == 'am':
                        btn_text = "ስራውን ለመክፈት እዚህ ይጫኑ"
                        success_txt = "ምዝገባው ተጠናቋል! አሁን ማየት ወደ ፈለጉት ስራ እንመልስዎ።"
                    else:
                        btn_text = "Click Here to Open the Job"
                        success_txt = "Registration complete! Now, let's get you back to the job you wanted to see."
                        
                    keyboard = [[InlineKeyboardButton(btn_text, web_app=WebAppInfo(url=mini_app_job_url))]]
                    await bot_context.rate_limiter.send_message(
                        chat_id,
                        text=success_txt,
                        reply_markup=InlineKeyboardMarkup(keyboard)
                    )
            else:
                try:
                    error_data = await response.json()
                    error_message = error_data.get('message', 'An unknown error occurred.')
                except Exception:
                    error_message = f"Could not parse server response. Status: {response.status}"

                if chat_id:
                    await bot_context.rate_limiter.send_message(
                        chat_id,
                        TRANSLATIONS[lang]['registration_failed'].format(error=error_message, status=response.status)
                    )

    except Exception as e:
        logger.error(f"Error during registration submission: {e}", exc_info=True)
        if chat_id:
            await bot_context.rate_limiter.send_message(
                chat_id, TRANSLATIONS[lang]['server_error'].format(error="an unexpected issue")
            )
    finally:
        keys_to_remove = ['trade_license_bytes', 'trade_license_name', 'password', 'role_input']
        for key in keys_to_remove:
            context.user_data.pop(key, None)

        logger.info(f"Cleaned up heavy registration data for user {update.effective_user.id}")

    if next_state == EMAIL_CODE:
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['confirm_now'])
        return await send_email_code(chat_id, context, str(update.effective_user.id))
    return ConversationHandler.END


# --- EMAIL CONFIRMATION (employers, before posting jobs) ---

async def bot_api(path: str, payload: dict):
    """POST to one of the API's bot endpoints; (HTTP status, JSON body or {})."""
    try:
        async with bot_context.session.post(
            f"{CONFIG['wp_api_url']}/../{path}",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            try:
                data = await response.json()
            except Exception:
                data = {}
            return response.status, data if isinstance(data, dict) else {}
    except Exception as e:
        logger.error(f"Bot API call {path} failed: {e}")
        return 0, {}


def api_message(data: dict, fallback: str = 'please try again in a moment') -> str:
    message = data.get('message') if isinstance(data, dict) else None
    if isinstance(message, list):
        message = '; '.join(str(m) for m in message)
    return message or fallback


def code_keyboard(lang: str) -> InlineKeyboardMarkup:
    t = TRANSLATIONS[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t['code_resend'], callback_data='code_resend'),
         InlineKeyboardButton(t['code_change_email'], callback_data='code_change')],
        [InlineKeyboardButton(t['code_later'], callback_data='code_later')],
    ])


def post_job_markup(lang: str) -> InlineKeyboardMarkup:
    label = TRANSLATIONS[lang]['menu']['post_job']
    return InlineKeyboardMarkup([[InlineKeyboardButton(label, web_app=WebAppInfo(url=MENU_URLS['employer']['post_job']))]])


async def send_email_code(chat_id: int, context: ContextTypes.DEFAULT_TYPE, telegram_id: str, email: str = None) -> int:
    """Asks the API to email a code (to `email` when given, after setting it). The next state."""
    lang = context.user_data.get('language') or 'en'
    payload = {'telegram_id': telegram_id}
    if email:
        payload['email'] = email
    status, data = await bot_api('email-code', payload)
    if status == 200 and data.get('already_confirmed'):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['code_confirmed'], reply_markup=post_job_markup(lang))
        return ConversationHandler.END
    if status == 200 and data.get('sent'):
        await bot_context.rate_limiter.send_message(
            chat_id,
            TRANSLATIONS[lang]['code_sent'].format(email=data.get('email') or email or ''),
            reply_markup=code_keyboard(lang),
        )
        return EMAIL_CODE
    await bot_context.rate_limiter.send_message(
        chat_id, TRANSLATIONS[lang]['code_failed'].format(error=api_message(data))
    )
    # A bad or taken address: ask for another. Too many codes, or no answer: try again later.
    if status in (400, 409):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['enter_new_email'])
        return NEW_EMAIL
    return ConversationHandler.END


async def leave_for_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """A menu button pressed mid-confirmation ends it and does what the button says."""
    text = update.effective_message.text if update.effective_message else None
    if text and menu_key_for(text):
        await handle_menu_selection(update, context)
        return True
    return False


async def handle_email_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return EMAIL_CODE
    if await leave_for_menu(update, context):
        return ConversationHandler.END
    lang = context.user_data.get('language') or 'en'
    code = six_digit_code(message.text)
    if not code:
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['code_format'])
        return EMAIL_CODE
    status, data = await bot_api('confirm-email', {'telegram_id': str(update.effective_user.id), 'code': code})
    if status == 200 and data.get('confirmed'):
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['code_confirmed'] + "\n\n" + TRANSLATIONS[lang]['job_review_note'],
            reply_markup=post_job_markup(lang),
        )
        return ConversationHandler.END
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['code_failed'].format(error=api_message(data)),
        reply_markup=code_keyboard(lang),
    )
    return EMAIL_CODE


async def handle_new_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return NEW_EMAIL
    if await leave_for_menu(update, context):
        return ConversationHandler.END
    lang = context.user_data.get('language') or 'en'
    email = message.text.strip().lower()
    if not re.match(EMAIL_PATTERN, email):
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['invalid_email'])
        return NEW_EMAIL
    return await send_email_code(message.chat_id, context, str(update.effective_user.id), email)


async def code_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Send / Send a new code, Change email, Later."""
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language') or 'en'
    chat_id = query.message.chat_id
    if query.data == 'code_later':
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['code_later_text'])
        return ConversationHandler.END
    if query.data == 'code_change':
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['enter_new_email'])
        return NEW_EMAIL
    return await send_email_code(chat_id, context, str(query.from_user.id))


# --- "I ALREADY HAVE AN ACCOUNT": link this Telegram to it with a code sent to its email ---

def link_keyboard(lang: str) -> InlineKeyboardMarkup:
    t = TRANSLATIONS[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t['code_resend'], callback_data='link_resend'),
         InlineKeyboardButton(t['link_other_email'], callback_data='link_change')],
        [InlineKeyboardButton(t['link_cancel'], callback_data='link_cancel')],
    ])


async def send_link_code(chat_id: int, context: ContextTypes.DEFAULT_TYPE, telegram_id: str) -> int:
    lang = context.user_data.get('language') or 'en'
    email = context.user_data.get('link_email')
    status, data = await bot_api('link-account', {'telegram_id': telegram_id, 'email': email})
    if status == 200 and data.get('sent'):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_code_sent'].format(email=data.get('email') or email), reply_markup=link_keyboard(lang))
        return LINK_CODE
    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_failed'].format(error=api_message(data)))
    # No such account, or not an email: ask again. Too many codes, or no answer: stop here.
    if status in (400, 403, 404):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_enter_email'])
        return LINK_EMAIL
    return ConversationHandler.END


async def get_link_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return LINK_EMAIL
    lang = context.user_data.get('language') or 'en'
    email = message.text.strip().lower()
    if not re.match(EMAIL_PATTERN, email):
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['invalid_email'])
        return LINK_EMAIL
    context.user_data['link_email'] = email
    return await send_link_code(message.chat_id, context, str(update.effective_user.id))


async def get_link_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return LINK_CODE
    lang = context.user_data.get('language') or 'en'
    code = six_digit_code(message.text)
    if not code:
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['code_format'])
        return LINK_CODE
    user = update.effective_user
    status, data = await bot_api('link-account/confirm', {
        'telegram_id': str(user.id),
        'email': context.user_data.get('link_email'),
        'code': code,
        'tg_username': getattr(user, 'username', None) or '',
    })
    if status == 200 and data.get('linked'):
        lang = data.get('language') or lang
        role = normalize_role(data.get('role'))
        context.user_data.update({'language': lang, 'role': role})
        context.user_data.pop('link_email', None)
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['link_done'].format(name=data.get('first_name') or ''),
            reply_markup=get_keyboard(role, lang, user.id in CONFIG['admin_ids']),
        )
        return ConversationHandler.END
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['link_failed'].format(error=api_message(data)), reply_markup=link_keyboard(lang))
    return LINK_CODE


async def link_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language') or 'en'
    chat_id = query.message.chat_id
    if query.data == 'link_cancel':
        context.user_data.pop('link_email', None)
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_cancelled'])
        return ConversationHandler.END
    if query.data == 'link_change':
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_enter_email'])
        return LINK_EMAIL
    return await send_link_code(chat_id, context, str(query.from_user.id))


async def ask_to_confirm_email(chat_id: int, lang: str, account: dict) -> None:
    """An employer tapped Post Job without a confirmed email: offer to send a code or add an email."""
    t = TRANSLATIONS[lang]
    if account.get('has_email') and account.get('email'):
        text = t['confirm_to_post']
        buttons = [[InlineKeyboardButton(t['send_code_to'].format(email=account['email']), callback_data='code_send')],
                   [InlineKeyboardButton(t['code_change_email'], callback_data='code_change')]]
    else:
        text = t['add_email_to_post']
        buttons = [[InlineKeyboardButton(t['add_email'], callback_data='code_change')]]
    await bot_context.rate_limiter.send_message(chat_id, text, reply_markup=InlineKeyboardMarkup(buttons))

async def handle_menu_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:

    if not update.message or not update.message.text:
        return

    text = update.message.text
    user = update.effective_user
    telegram_id = str(user.id)
    
    # --- !! REPLACEMENT LOGIC !! ---
    # 1. Try to get role and language from the cache first
    role = normalize_role(context.user_data.get('role'))
    lang = context.user_data.get('language')

    # 2. If not in cache, fetch from API (fallback for safety)
    if role == 'Unknown' or not lang:
        logger.info(f"Cache miss for user {telegram_id}. Fetching from API.")
        async with bot_context.session.get(
            f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}",
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data.get('registered'):
                    role = normalize_role(data.get('role', 'unknown'))
                    lang = data.get('language', 'en')
                    # Save to cache for next time
                    context.user_data['role'] = role
                    context.user_data['language'] = lang
    
    if not lang:
        lang = 'en'
    # --- !! END OF REPLACEMENT !! ---

    # 1. First look up the menu key in the user's current language
    menu_key = None
    if lang in TRANSLATIONS and 'menu' in TRANSLATIONS[lang]:
        menu_key = next((key for key, value in TRANSLATIONS[lang]['menu'].items() if value == text), None)

    # 2. If not matched, search across ALL available languages (handles language switch or keyboard mismatch)
    if not menu_key:
        for l_code, l_data in TRANSLATIONS.items():
            for key, val in l_data.get('menu', {}).items():
                if val == text:
                    menu_key = key
                    lang = l_code
                    context.user_data['language'] = lang
                    break
            if menu_key:
                break
    
    if not menu_key or not role or role.lower() == 'unknown':
        logger.warning(f"Menu handler failed for user {telegram_id}. Text: '{text}'. Role: {role}. Menu Key: {menu_key}")
        return

    if menu_key == 'challenge':
        await challenge_command(update, context)
        return

    # Posting needs a confirmed email; asked fresh each time, since it may have just been confirmed.
    if role == 'Employer' and menu_key == 'post_job':
        account = await fetch_account(telegram_id)
        if account is not None and account.get('registered') and not account.get('email_confirmed'):
            await ask_to_confirm_email(update.message.chat_id, lang, account)
            return

    if role == 'Candidate' and menu_key in ['dashboard', 'my_profile', 'my_applications', 'job_list']:
        photo_id = CONFIG.get('candidate_promo_photo_id')
        
        caption = """ምርጥ የሥራ ዕድሎች ለማቅረብ ከቀዳሚ ቀጣሪዎች እና ድርጅቶች ጋር እንሰራለን።\n
        ችሎታዎች ዋጋ አላቸው፤ በሚያስፈልጉበት ቦታዎች ላይ ያግኟቸው።\n

➡️በዌብሳይታችን ላይ <b>በነፃ</b>፣ ሲቪዎትን በተለያዩ ይዘት ባላቸው ቴምፕሌትስ በማዘጋጀት ተጠቃሚ እንዲሆኑ እናደርጋለን።\n
➡️ለኢንተርቪ ከመጠራቶት በፊት፣ <b>እንዴት</b> እና <b>በምን</b> መልኩ ልዘጋጅ ብለው እንዳይጨነቁ በማሰብ፣ ዓለማቀፋዊ ዕይታ ያላቸውን ምክረ-ሐሳቦች በማቅረብ ጭንቀቶን እናቀላለል፣\n
➡️<b>የዜሮ</b> እና <b>የተለያዩ ዓመታት</b>፣ የሥራ ቅጥር ማስታወቂያዎችን በብዛት በቴሌግራም እና በዌብሳይታችን ላይ፣በሰፊው ተደራሽ እንዲሆኑ በመልቀቅ የስራ ባለቤት እናደርጎታለን።\n       
ለፈጣን የስራ ማስታወቂያዎች <b>የቴሌግራም ቻናላችንን ይቀላቀሉ</b> እና <b>አሁኑኑ ለማመልከት ድረገጻችንን ይጎብኙ!</b>በቀላሉ በእጅ ስልኮትያገኛሉ።\n
https://t.me/BeleqetJobs <b>እና</b>\n
https://beleqetjobs.com ላይማስታወቂያዎችን በመመልከት <b>አሁኑኑ</b> ያመልክቱ"""

        if photo_id:
            await bot_context.rate_limiter.send_photo(
                chat_id=update.message.chat_id,
                photo=photo_id,
                caption=caption,
                parse_mode='HTML'
            )

    if role == 'Employer' and menu_key in ['post_job', 'dashboard', 'my_profile', 'my_jobs', 'applicants']:
        photo_id = CONFIG.get('employer_promo_photo_id')

        caption = """እኛ <b>Beleqet Jobs</b> የእርሶን ጭንቀትና የጊዜ ብክነት ለማብቃት፣ ከሺህ በላይ አመልካቾች መካከል ትክክለኛውን ሰው በፍጥነት እናገኝልዎታለን። ከእንግዲህ የሚያስጨንቅ ፍለጋ የለም!
ትክክለኛውን እጩ በደቂቃዎች ውስጥ ወደ እርስዎ እናመጣለን።

ማስታወቂያ ከማውጣት እስከ ኢንተርቪው ድረስ ያለውን የቅጥር ውስብስብነት ስናግዞት፣ እርስዎ በዋና ስራዎ ላይያተኩሩ። ሸክሙን ከትከሻዎ ላይ እናነሳለን።

የቅጥር ፈተናዎች እንዳያዘገዩዎት። የእኛ ቁርጠኛ ቡድን ልዩ ፍላጎቶችዎን በመረዳት ይሠራል፣ ለድርጅትዎ የስራ ባህል እና መስፈርቶች በትክክል የሚስማሙ የተመረጡ እጩዎችን ያቀርባል።

ቅጥርዎን ያስተላልፉ – እንዴት እንደሆነ ይወቁ!

ተስማሚ የሰው ኃይልዎን ለመገንባት ከእኛ ጋር ይስሩ!

ዛሬውኑ የ<b>Beleqet Jobs</b>ን
➡️የቴሌግራም(https://t.me/BeleqetJobs) እና
➡️የዌብሳይት(https://beleqetjobs.com) ገፆቻችንን በመቀላቀልይመልከቱ!

<b>Beleqet Jobs</b> ለንግድዎ፣ ለቤተሰብዎና ለጓደኞችዎ ተጨማሪ ትርፍ ጊዜ በመስጠት የቅጥር ጊዜዎን ይቀንሳል፣ ጭንቀትዎን ያቀላል፣ ለእርሶም የሚገባዎትን እረፍት ይሰጥዎታል"""

        if photo_id:
            await bot_context.rate_limiter.send_photo(
                chat_id=update.message.chat_id,
                photo=photo_id,
                caption=caption,
                parse_mode='HTML'
            )

    links = MENU_URLS.get('candidate' if role == "Candidate" else 'employer', {})

    if menu_key in links:
        url = links[menu_key]
        keyboard = [[InlineKeyboardButton(text, web_app=WebAppInfo(url=url))]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        message_text = TRANSLATIONS[lang]['open_section'].format(section=text)
        if menu_key == 'post_job':
            message_text += "\n\n" + TRANSLATIONS[lang]['job_review_note']
        await bot_context.rate_limiter.send_message(
            chat_id=update.message.chat_id,
            text=message_text,
            reply_markup=reply_markup
        )

async def fetch_account(telegram_id: str):
    """The API's check-user answer for this Telegram account, or None if it can't be reached."""
    try:
        async with bot_context.session.get(
            f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}",
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            if response.status == 200:
                return await response.json()
    except Exception as e:
        logger.error(f"check-user failed for {telegram_id}: {e}")
    return None

async def get_user_role(telegram_id: str) -> str:
    async with bot_context.session.get(
        f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}",
        timeout=aiohttp.ClientTimeout(total=10)
    ) as response:
        if response.status == 200:
            data = await response.json()
            return data.get('role', 'unknown').capitalize() if data.get('registered') else 'unknown'
    return 'unknown'

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id if update.effective_chat else (update.effective_message.chat_id if update.effective_message else None)
    if chat_id:
        await bot_context.rate_limiter.send_message(
            chat_id,
            TRANSLATIONS[context.user_data.get('language', 'en')]['cancel']
        )
    context.user_data.clear()
    return ConversationHandler.END

async def restart_from_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    return await start(update, context)

async def health_check(request: web.Request) -> web.Response:
    logger.info("Health check endpoint was accessed.")
    return web.Response(text="Bot is running!")

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error(msg="Exception while handling an update:", exc_info=context.error)
    
    if isinstance(context.error, telegram.error.Forbidden):
        return
    try:
        if isinstance(update, Update) and update.effective_message:
            text = "Sorry, an unexpected error occurred. Please use /start to restart the process."
            await update.effective_message.reply_text(text)
    except Exception as e:
        logger.error(f"Failed to send error notification: {e}")

async def webhook_handler(request: web.Request) -> web.Response:
    # 1. Security Check: Validate Secret Token
    expected_token = os.getenv("WEBHOOK_SECRET_TOKEN")
    provided_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")

    if not expected_token or not provided_token or not hmac.compare_digest(provided_token, expected_token):
        logger.warning(f"Unauthorized webhook access attempt from {request.remote}")
        return web.Response(text="Forbidden", status=403)
    
    logger.info(f"Incoming authorized webhook request to path: {request.path}")
    try:
        data = await request.json()
        action = data.get('action')

        if action == 'manual_payment_uploaded':
            order_id = data.get('order_id')
            amount = data.get('amount')
            currency = data.get('currency')
            reference = data.get('reference')
            receipt_url = data.get('receipt_url')

            caption = (
                f"🚨 <b>New Manual Payment Uploaded!</b>\n\n"
                f"<b>Order ID:</b> #{order_id}\n"
                f"<b>Total Amount:</b> {amount} {currency}\n"
                f"<b>Reference:</b> <code>{reference}</code>"
            )
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Approve", callback_data=f"approve_payment_{order_id}"),
                    InlineKeyboardButton("❌ Reject", callback_data=f"reject_payment_{order_id}")
                ]
            ])
            for admin_id in CONFIG['admin_ids']:
                try:
                    await bot_context.rate_limiter.send_photo(
                        chat_id=admin_id,
                        photo=receipt_url,
                        caption=caption,
                        reply_markup=keyboard,
                        parse_mode='HTML'
                    )
                except Exception as e:
                    logger.error(f"Failed to send manual payment notification to admin {admin_id}: {e}")
            return web.Response(text="OK", status=200)

        # Existing logic for user approval/denial
        telegram_id = data.get('telegram_id')
        status = data.get('status')
        role = data.get('role')
        language = data.get('language', 'en')
        message_override = data.get('message')

        if not telegram_id:
            return web.Response(text="Missing telegram_id", status=400)

        # 1. Initialize variables
        notification_text = ""
        current_reply_markup = None # This will hold either the Menu or the Inline Button

        # 2. Handle Approved Status
        if status == 'approved':
            if role == 'wp_job_board_pro_employer':
                notification_text = TRANSLATIONS[language].get('approved_employer', '')
            else:
                notification_text = TRANSLATIONS[language].get('registration_success', '')
            
            # Show the actual Menu Button for approved users
            friendly_role = normalize_role(role)
            is_admin = int(telegram_id) in CONFIG['admin_ids']
            current_reply_markup = get_keyboard(friendly_role, language, is_admin)
            
            # Update cache
            chat_data = bot_context.application.user_data.get(int(telegram_id))
            if chat_data is not None:
                chat_data['role'] = friendly_role
                chat_data['language'] = language

        # 3. Handle Denied Status
        elif status == 'denied':
            notification_text = TRANSLATIONS[language].get('denied_employer', '')
            btn_text = "Register Again" if language == 'en' else "እንደገና ይመዝገቡ"
            current_reply_markup = InlineKeyboardMarkup([[
                InlineKeyboardButton(btn_text, callback_data='restart_reg')
            ]])

        final_message = message_override if message_override else notification_text

        # 4. Send message
        try:
            await bot_context.rate_limiter.send_message(
                chat_id=telegram_id,
                text=final_message,
                reply_markup=current_reply_markup,
                parse_mode='HTML'
            )
        except telegram.error.Forbidden:
            logger.info(f"Webhook failed: Bot was blocked by user {telegram_id}")
            return web.Response(text="User blocked bot", status=200)

        return web.Response(text="OK", status=200)

    except Exception as e:
        logger.error(f"Error in webhook_handler: {e}", exc_info=True)
        return web.Response(text="Internal Server Error", status=500)

    # --- 📣 BROADCAST HANDLERS ---
async def broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.effective_user.id not in CONFIG['admin_ids']:
        return ConversationHandler.END

    await update.message.reply_text(
        "📣 **Admin Broadcast Mode**\n\n"
        "Please send the message you want to broadcast to ALL registered users.\n"
        "You can send text, a photo, a video, or forward a message.\n\n"
        "Send /cancel to abort.",
        parse_mode='Markdown',
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("/cancel")]], resize_keyboard=True)
    )
    return BROADCAST_MESSAGE

async def broadcast_get_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # Save the original message ID
    context.user_data['broadcast_msg_id'] = update.message.message_id

    await update.message.reply_text(
        "Message received! Do you want to add a custom button with a link to the bottom of this message?\n\n"
        "🔘 **If YES:** Type the text for the button (e.g., 'Click Here' or 'Apply Now').\n"
        "⏩ **If NO:** Just send /skip.",
        parse_mode='Markdown'
    )
    return BROADCAST_BUTTON_TEXT

async def broadcast_skip_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_text'] = None
    context.user_data['broadcast_btn_url'] = None
    return await show_broadcast_confirmation(update, context)

async def broadcast_get_button_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_text'] = update.message.text
    await update.message.reply_text(
        "Great! Now send the **URL/Link** for the button (e.g., `https://google.com`):",
        parse_mode='Markdown'
    )
    return BROADCAST_BUTTON_URL

async def broadcast_get_button_url(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    url = update.message.text.strip()
    
    # Simple validation to ensure Telegram accepts the URL
    if not url.startswith(("http://", "https://", "t.me/")):
        await update.message.reply_text("⚠️ Please enter a valid URL starting with `http://`, `https://`, or `t.me/`", parse_mode='Markdown')
        return BROADCAST_BUTTON_URL
        
    context.user_data['broadcast_btn_url'] = url
    return await show_broadcast_confirmation(update, context)

async def show_broadcast_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Helper function to show the final confirmation screen."""
    keyboard = [[
        InlineKeyboardButton("Test Mode (Count Only) 🧪", callback_data="broadcast_test"),
    ],[
        InlineKeyboardButton("Confirm Broadcast ✅", callback_data="broadcast_confirm"),
        InlineKeyboardButton("Cancel ❌", callback_data="broadcast_cancel")
    ]]
    
    btn_text = context.user_data.get('broadcast_btn_text')
    btn_url = context.user_data.get('broadcast_btn_url')
    
    preview_msg = "All set! "
    if btn_text and btn_url:
        preview_msg += f"\n\n**Attached Button:** [{btn_text}]({btn_url})"
        
    await update.message.reply_text(
        f"{preview_msg}\n\nWhat would you like to do?\n\n"
        "🧪 **Test Mode:** Just count the database users, don't send anything.\n"
        "✅ **Confirm:** Send this message to ALL registered users.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard),
        disable_web_page_preview=True
    )
    return BROADCAST_CONFIRM

async def broadcast_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    import asyncio
    query = update.callback_query
    await query.answer()
    admin_chat_id = update.effective_chat.id

    # --- NEW: Generate the correct menu dynamically ---
    admin_role = context.user_data.get('role', 'employer')
    admin_lang = context.user_data.get('language', 'en')
    current_menu = get_keyboard(admin_role, admin_lang, is_admin=True)
    # ------------------------------------------------

    if query.data == "broadcast_cancel":
        await query.edit_message_text("Broadcast cancelled.")
        context.user_data.pop('broadcast_msg_id', None)
        context.user_data.pop('broadcast_btn_text', None)
        context.user_data.pop('broadcast_btn_url', None)
        # Replaced admin_menu_markup with current_menu
        await bot_context.rate_limiter.send_message(chat_id=admin_chat_id, text="Returning to menu.", reply_markup=current_menu)
        return ConversationHandler.END

    if query.data in ["broadcast_confirm", "broadcast_test"]:
        is_test = (query.data == "broadcast_test")
        action_text = "🚀 Testing API connection..." if is_test else "🚀 Fetching users and starting broadcast..."
        await query.edit_message_text(action_text)

        msg_id = context.user_data.get('broadcast_msg_id')
        btn_text = context.user_data.get('broadcast_btn_text')
        btn_url = context.user_data.get('broadcast_btn_url')
        
        custom_markup = None
        if btn_text and btn_url:
            custom_markup = InlineKeyboardMarkup([[InlineKeyboardButton(btn_text, url=btn_url)]])

        success_count = 0
        fail_count = 0

        try:
            base_url = CONFIG['wp_api_url'].rstrip('/register') 
            fetch_url = f"{base_url}/get-all-telegram-ids"

            async with bot_context.session.get(fetch_url, timeout=30) as response:
                if response.status != 200:
                    await bot_context.rate_limiter.send_message(admin_chat_id, f"❌ API Error: HTTP {response.status}")
                    return ConversationHandler.END
                
                data = await response.json()
                telegram_ids = data.get('telegram_ids', [])

            total_users = len(telegram_ids)

            if total_users == 0:
                await bot_context.rate_limiter.send_message(admin_chat_id, "⚠️ No users found via the WordPress API.")
                return ConversationHandler.END

            if is_test:
                sample_ids = ", ".join(str(uid) for uid in telegram_ids[:10])
                if total_users > 10: sample_ids += "..."
                
                await bot_context.rate_limiter.send_message(
                    chat_id=admin_chat_id,
                    text=f"✅ **WordPress API Test Successful!**\n\n**Total Users Found:** `{total_users}`\n**Sample IDs:** `{sample_ids}`",
                    parse_mode='Markdown',
                    reply_markup=current_menu # Replaced here
                )
            else:   
                for target_id in telegram_ids:
                    try:
                        await bot_context.rate_limiter.copy_message(
                            chat_id=int(target_id),
                            from_chat_id=admin_chat_id,
                            message_id=msg_id,
                            reply_markup=custom_markup 
                        )
                        success_count += 1
                    except telegram.error.Forbidden:
                        # This is now caught specifically without a full stack trace
                        fail_count += 1
                    except Exception as e:
                        logger.warning(f"Unexpected failure for {target_id}: {e}")
                        fail_count += 1

                    await asyncio.sleep(0.05) 

                await bot_context.rate_limiter.send_message(
                    chat_id=admin_chat_id,
                    text=f"✅ **Broadcast Complete!**\n\nSent to: `{success_count}` users\nFailed: `{fail_count}` users",
                    parse_mode='Markdown',
                    reply_markup=current_menu # Replaced here
                )

        except Exception as e:
            logger.error(f"Broadcast error: {e}", exc_info=True)
            await bot_context.rate_limiter.send_message(admin_chat_id, f"An error occurred: {e}", reply_markup=current_menu) # Replaced here

        context.user_data.pop('broadcast_msg_id', None)
        context.user_data.pop('broadcast_btn_text', None)
        context.user_data.pop('broadcast_btn_url', None)
        return ConversationHandler.END

async def broadcast_cancel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    admin_role = context.user_data.get('role', 'employer')
    admin_lang = context.user_data.get('language', 'en')
    current_menu = get_keyboard(admin_role, admin_lang, is_admin=True)
    # --------------------------------------------------

    await update.message.reply_text("Broadcast cancelled.", reply_markup=current_menu)
    context.user_data.pop('broadcast_msg_id', None)
    context.user_data.pop('broadcast_btn_text', None)
    context.user_data.pop('broadcast_btn_url', None)
    return ConversationHandler.END

async def handle_payment_decision(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    if update.effective_user.id not in CONFIG['admin_ids']:
        await query.edit_message_caption(caption="Unauthorized access.")
        return

    data = query.data
    action, order_id = data.rsplit('_', 1)
    status = 'completed' if action == 'approve_payment' else 'cancelled'

    payload = {
        'order_id': order_id,
        'status': status
    }
    
    try:
        async with bot_context.session.post(
            f"{CONFIG['wp_api_url']}/../update-payment-status",
            json=payload,
            headers={'X-Telegram-Bot-Api-Secret-Token': os.getenv("WEBHOOK_SECRET_TOKEN")},
            timeout=aiohttp.ClientTimeout(total=15)
        ) as response:
            if response.status == 200:
                result_text = "✅ Approved" if status == 'completed' else "❌ Rejected"
                new_caption = f"{query.message.caption}\n\n<b>Decision:</b> {result_text} by {update.effective_user.first_name}"
                await query.edit_message_caption(caption=new_caption, parse_mode='HTML')
            else:
                resp_text = await response.text()
                logger.error(f"Failed to update WP payment status: HTTP {response.status} - {resp_text}")
                await query.edit_message_caption(caption=f"{query.message.caption}\n\n<b>Error:</b> Failed to update WordPress status (HTTP {response.status}).", parse_mode='HTML')
    except Exception as e:
        logger.error(f"Error updating payment status: {e}", exc_info=True)
        await query.edit_message_caption(caption=f"{query.message.caption}\n\n<b>Error:</b> Exception occurred while updating status.", parse_mode='HTML')


async def challenge_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = f"{CONFIG['challenge_mini_app_url']}?startapp=vote"
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(
        "🗳️ Vote Now / ድምጽ ይስጡ", web_app=WebAppInfo(url=url)
    )]])
    await update.message.reply_text(
        "Super SGS Furniture Creative Challenge is live! Vote for your favourite creator 👇",
        reply_markup=kb
    )

async def main() -> None:
    logger.info("Script starting...")
    if not all(CONFIG.values()):
        logger.critical("Missing required environment variables! Please check your .env file or environment.")
        raise ValueError("Missing required environment variables.")

    unique_user_agent = 'BeleqetJobBot/1.0'

    # Initialize persistence
    persistence = PicklePersistence(filepath='bot_data.pickle')

    async with aiohttp.ClientSession(
    headers={
        'User-Agent': unique_user_agent,
        'X-Beleqet-API-Token': os.getenv("BELEQET_API_SECRET_TOKEN")
            }
        ) as session:

        bot_context.session = session
        bot_context.application = (
            Application.builder()
            .token(CONFIG['telegram_token'])
            .persistence(persistence)
            .build()
            )
        bot_context.rate_limiter = RateLimiter()
        bot_context.application.add_error_handler(error_handler)
        
        email_code_states = {
            EMAIL_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_email_code),
                CallbackQueryHandler(code_button, pattern='^code_(resend|send|change|later)$'),
            ],
            NEW_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_new_email),
                CallbackQueryHandler(code_button, pattern='^code_(change|later)$'),
            ],
        }

        language_change_handler = ConversationHandler(
            entry_points=[CommandHandler('language', change_language_command)],
            states={
                CHANGE_LANGUAGE: [CallbackQueryHandler(handle_language_update, pattern='^lang_')],
            },
            fallbacks=[CommandHandler('cancel', cancel)],
        )

        conv_handler = ConversationHandler(
            entry_points=[CommandHandler('start', start),
                          CallbackQueryHandler(restart_from_button, pattern='^restart_reg$')],
            states={
                LANGUAGE: [CallbackQueryHandler(handle_language_selection, pattern='^(en|am)$')],
                ROLE: [CallbackQueryHandler(handle_role_selection)],
                COMPANY_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_company_name)],
                CONTACT_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_contact_name)],
                NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_name),
                       CallbackQueryHandler(use_telegram_name, pattern='^use_tg_name$')],
                # A shared contact (job seekers) or a typed number (employers).
                PHONE: [MessageHandler(filters.CONTACT | (filters.TEXT & ~filters.COMMAND), get_phone)],
                GENDER: [CallbackQueryHandler(get_gender, pattern='^gender_(MALE|FEMALE)$')],
                COUNTRY: [CallbackQueryHandler(get_country, pattern='^country_')],
                COUNTRY_TYPED: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_typed_country)],
                CITY: [CallbackQueryHandler(get_city, pattern='^city_'),
                       MessageHandler(filters.TEXT & ~filters.COMMAND, get_city)],
                LINK_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_link_email),
                             CallbackQueryHandler(link_button, pattern='^link_cancel$')],
                LINK_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_link_code),
                            CallbackQueryHandler(link_button, pattern='^link_(resend|change|cancel)$')],
                EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_email)],
                TG_USERNAME: [
                            MessageHandler(filters.TEXT & ~filters.COMMAND, get_tg_username),
                            CallbackQueryHandler(get_tg_username, pattern='^skip_tg$')
                        ],
                PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_password)],
                TRADE_LICENSE: [MessageHandler((filters.Document.ALL | filters.PHOTO) & ~filters.COMMAND, get_trade_license)],
                JOB_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_job_title)],
                # An employer's registration ends by confirming the email.
                **email_code_states,
            },
            fallbacks=[CommandHandler('cancel', cancel)],
            name="registration_conversation",
            persistent=True,
            allow_reentry=True
        )

        # Confirming the email later, from Post Job: the same steps as at the end of registration.
        email_conv = ConversationHandler(
            entry_points=[CallbackQueryHandler(code_button, pattern='^code_(send|change)$')],
            states=email_code_states,
            fallbacks=[CommandHandler('cancel', cancel)],
            name="email_conversation",
            persistent=True,
            allow_reentry=True
        )

        broadcast_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📣 Broadcast Message$"), broadcast_start)],
        states={
            BROADCAST_MESSAGE: [MessageHandler(filters.ALL & ~filters.COMMAND, broadcast_get_message)],
            BROADCAST_BUTTON_TEXT: [
                CommandHandler("skip", broadcast_skip_button),
                MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_get_button_text)
            ],
            BROADCAST_BUTTON_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_get_button_url)],
            BROADCAST_CONFIRM: [CallbackQueryHandler(broadcast_action, pattern="^broadcast_")],
        },
        fallbacks=[CommandHandler("cancel", broadcast_cancel_cmd)],
    )
        
        bot_context.application.add_handler(broadcast_conv)
        bot_context.application.add_handler(language_change_handler)
        bot_context.application.add_handler(conv_handler)
        bot_context.application.add_handler(email_conv)
        bot_context.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_menu_selection))
        bot_context.application.add_handler(CallbackQueryHandler(handle_payment_decision, pattern='^(approve_payment_|reject_payment_)'))
        bot_context.application.add_handler(CommandHandler("challenge", challenge_command))

        # Room for 5 MB avatar uploads (aiohttp refuses bodies over 1 MB by default).
        app = web.Application(client_max_size=6 * 1024 * 1024)
        # --- NEW Health Check Route ---
        app.router.add_get('/', health_check)
        app.router.add_post('/webhook', webhook_handler)
        
        # --- SGS Challenge Routes ---
        challenge_db = await init_challenge_db()
        register_challenge_routes(app, challenge_db, bot_token=CONFIG['telegram_token'], wp_api_url=CONFIG['wp_api_url'], admin_ids=CONFIG['admin_ids'])
        
        async def challenge_index(request):
            return web.FileResponse(os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'app', 'index.html'))
            
        app.router.add_get('/challenge', challenge_index)
        app.router.add_get('/challenge/', challenge_index)
        app.router.add_static('/challenge/', path=os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'app'), name='challenge_static')
        
        runner = web.AppRunner(app)
        await runner.setup()
        port = int(os.environ.get('PORT', 8082))
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        logger.info("======================================================")
        logger.info(f">>> Webhook server started on http://0.0.0.0:{port} <<<")
        logger.info("======================================================")


        await bot_context.application.initialize()
        await bot_context.application.start()

        try:
            from telegram import MenuButtonWebApp
            await bot_context.application.bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Open App",
                    web_app=WebAppInfo(url=MINI_APP)
                )
            )
            logger.info(f">>> Telegram Chat Menu Button set to {MINI_APP} <<<")
        except Exception as e:
            logger.warning(f"Could not set chat menu button: {e}")

        await bot_context.application.updater.start_polling(allowed_updates=Update.ALL_TYPES)
        logger.info(">>> Telegram bot started polling <<<")

        try:
            await asyncio.Event().wait()
        finally:
            await bot_context.application.updater.stop()
            await bot_context.application.stop()
            await runner.cleanup()
            logger.info("Bot and webhook server stopped gracefully.")


if __name__ == "__main__":
    asyncio.run(main())