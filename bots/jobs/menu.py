"""The main menu's buttons."""
import aiohttp
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes

from config import CONFIG, logger
from texts import TRANSLATIONS
from common import MENU_URLS, bot_context, challenge_command, fetch_account, normalize_role

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
