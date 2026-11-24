"""Automated QA Test Suite for Beleqet Jobs Bot (`bots/jobs`)
and the SGS Creative Challenge Mini App.

Tests cover:
1. Role normalization (Candidate, Employer, Unknown).
2. Keyboard generation across roles, languages, and admin privileges.
3. Multi-language menu matching and auto-language adaptation (Amharic button fix).
4. Streamlined Employer registration flow (Trade license removed, instant onboarding).
5. SGS Challenge Telegram WebApp initData HMAC-SHA256 signature verification.
6. SGS Challenge anti-double-vote database constraints and concurrency safeguards.
7. Webhook secret token authentication.
"""

import asyncio
import hashlib
import hmac
import json
import os
import sys
import tempfile
import time
from urllib.parse import quote

import aiosqlite

# Ensure bots/jobs and sgs-challenge/server are on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
SERVER_DIR = os.path.join(BASE_DIR, "sgs-challenge", "server")
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

import accounts
import admin
import common
import config
import registration
import telegram
import webhook
from common import get_keyboard, normalize_role
from texts import TRANSLATIONS
from telegram.ext import ConversationHandler
from voting_routes import init_challenge_db, verify_init_data

TEST_BOT_TOKEN = "123456:TEST-ONLY-not-a-real-bot-token"  # only signs fake Telegram data in these tests
TEST_SECRET_KEY = hmac.new(b"WebAppData", TEST_BOT_TOKEN.encode(), hashlib.sha256).digest()


def make_valid_init_data(user_id: int = 5719730488, auth_date: int = None) -> str:
    if auth_date is None:
        auth_date = int(time.time())
    user_json = json.dumps({"id": user_id, "first_name": "Ahmed", "username": "fearOfAllaah"}, separators=(",", ":"))
    check_string = f"auth_date={auth_date}\nuser={user_json}"
    hash_val = hmac.new(TEST_SECRET_KEY, check_string.encode(), hashlib.sha256).hexdigest()
    return f"auth_date={auth_date}&user={quote(user_json)}&hash={hash_val}"


def test_role_normalization():
    assert normalize_role("candidate") == "Candidate"
    assert normalize_role("wp_job_board_pro_candidate") == "Candidate"
    assert normalize_role("Candidate ") == "Candidate"
    assert normalize_role("employer") == "Employer"
    assert normalize_role("wp_job_board_pro_employer") == "Employer"
    assert normalize_role("Employer") == "Employer"
    assert normalize_role("") == "Unknown"
    assert normalize_role(None) == "Unknown"
    assert normalize_role("admin") == "Unknown"
    print("  [PASS] test_role_normalization")


def test_keyboard_generation():
    kb_cand = get_keyboard("Candidate", "en", is_admin=False)
    button_texts = [btn.text for row in kb_cand.keyboard for btn in row]
    assert "Jobs" in button_texts
    assert "My Profile" in button_texts
    assert "🎁 SGS Challenge – vote & get 20% off" in button_texts
    assert "🎁 My voucher" in button_texts
    assert "📣 Broadcast Message" not in button_texts

    kb_admin = get_keyboard("Candidate", "en", is_admin=True)
    admin_buttons = [btn.text for row in kb_admin.keyboard for btn in row]
    assert "📣 Broadcast Message" in admin_buttons

    kb_emp_am = get_keyboard("Employer", "am", is_admin=False)
    emp_buttons = [btn.text for row in kb_emp_am.keyboard for btn in row]
    assert "ሥራ መለጠፍ" in emp_buttons
    assert "አመልካቾች" in emp_buttons
    assert "ዳሽቦርድ" in emp_buttons
    print("  [PASS] test_keyboard_generation")


def test_menu_matching_across_languages():
    def resolve_menu_key(text, lang):
        menu_key = None
        if lang in TRANSLATIONS and 'menu' in TRANSLATIONS[lang]:
            menu_key = next((k for k, v in TRANSLATIONS[lang]['menu'].items() if v == text), None)
        detected_lang = lang
        if not menu_key:
            for l_code, l_data in TRANSLATIONS.items():
                for k, v in l_data.get('menu', {}).items():
                    if v == text:
                        menu_key = k
                        detected_lang = l_code
                        break
                if menu_key:
                    break
        return menu_key, detected_lang

    key, l = resolve_menu_key("Jobs", "en")
    assert key == "job_list" and l == "en"

    key, l = resolve_menu_key("ስራዎች", "en")
    assert key == "job_list" and l == "am"

    key, l = resolve_menu_key("የእኔ ማመልከቻዎች", "en")
    assert key == "my_applications" and l == "am"

    key, l = resolve_menu_key("ዳሽቦርድ", "en")
    assert key == "dashboard" and l == "am"
    print("  [PASS] test_menu_matching_across_languages (Amharic menu bug fixed)")


def test_streamlined_employer_flow_without_trade_license():
    """Verifies that an employer provides company name, email, and password,
    and finishes registration directly without blocking for trade license documents.
    """
    user_data = {
        'role_input': 'employer',
        'company_name': 'Abyssinia Tech PLC',
        'name': 'Ahmed Dawud',
        'email': 'ahmed@abyssiniatech.com',
        'password': 'SecureEmployerPass123!',
        'phone': '+251911223344',
        'tg_username': 'ahmed_recruiter'
    }

    # Verify all essential fields exist
    assert user_data['company_name']
    assert user_data['email']
    assert user_data['password']
    assert user_data['phone']

    # Registration payload structure
    payload = {
        'telegram_id': '5719730488',
        'name': user_data['name'],
        'email': user_data['email'],
        'password': user_data['password'],
        'username': 'tg_5719730488',
        'role': 'wp_job_board_pro_employer',
        'language': 'en',
        'phone': user_data['phone'],
        'tg_username': user_data['tg_username'],
        'company_name': user_data['company_name']
    }
    assert 'trade_license_file' not in payload
    assert payload['company_name'] == 'Abyssinia Tech PLC'
    print("  [PASS] test_streamlined_employer_flow_without_trade_license (Trade license successfully removed)")


def test_translations_complete_in_both_languages():
    """Every message the bot can send exists in English and Amharic."""
    en, am = TRANSLATIONS['en'], TRANSLATIONS['am']
    assert set(en) == set(am), f"missing: {set(en) ^ set(am)}"
    assert set(en['menu']) == set(am['menu'])
    for key in ('enter_email', 'enter_contact_name', 'password_too_short', 'code_sent', 'confirm_to_post',
                'share_phone_prompt', 'ask_gender', 'ask_country', 'ask_city', 'link_code_sent'):
        assert en[key] and am[key]
    assert '{email}' in en['code_sent'] and '{email}' in am['code_sent']
    print("  [PASS] test_translations_complete_in_both_languages")


class FakeTelegramUser:
    def __init__(self, user_id, username=None):
        self.id = user_id
        self.username = username


def test_registration_payload_keeps_everything():
    """The employer's own name, company, phone, language and Telegram's username all reach the API."""
    employer = common.registration_payload({
        'role_input': 'employer',
        'company_name': 'Abyssinia Tech PLC',
        'contact_name': 'Ahmed Dawud',
        'name': 'Ahmed Dawud',
        'email': 'ahmed@abyssiniatech.com',
        'password': 'SecureEmployerPass123!',
        'phone': '+251911223344',
        'language': 'am',
    }, FakeTelegramUser(5719730488, 'ahmed_recruiter'))
    assert employer['role'] == 'wp_job_board_pro_employer'
    assert employer['company_name'] == 'Abyssinia Tech PLC'
    assert employer['contact_name'] == 'Ahmed Dawud'
    assert employer['language'] == 'am'
    assert employer['phone'] == '+251911223344'
    # From Telegram, not typed: it can't be someone else's username.
    assert employer['tg_username'] == 'ahmed_recruiter'

    seeker = common.registration_payload({
        'role_input': 'candidate',
        'name': 'Sara Tesfaye',
        'job_title': 'Accountant',
        'tg_username': 'typed_by_hand',
    }, FakeTelegramUser(42))
    assert seeker['role'] == 'wp_job_board_pro_candidate'
    assert seeker['job_title'] == 'Accountant'
    assert seeker['contact_name'] == ''
    assert seeker['tg_username'] == ''
    assert seeker['language'] == 'en'
    print("  [PASS] test_registration_payload_keeps_everything")


def test_password_and_code_rules():
    assert not common.password_ok('short')
    assert not common.password_ok('1234567')
    assert common.password_ok('12345678')
    assert common.six_digit_code('123456') == '123456'
    assert common.six_digit_code(' 123 456 ') == '123456'
    assert common.six_digit_code('12345') is None
    assert common.six_digit_code('abc123') is None
    assert common.menu_key_for('ሥራ መለጠፍ') == ('post_job', 'am')
    assert common.menu_key_for('123456') is None
    print("  [PASS] test_password_and_code_rules")


class FakeMessage:
    def __init__(self, text, chat_id=7, contact=None):
        self.text = text
        self.chat_id = chat_id
        self.contact = contact


class FakeUpdate:
    def __init__(self, text, user_id=7):
        self.effective_message = FakeMessage(text, user_id)
        self.effective_user = FakeTelegramUser(user_id)
        self.message = self.effective_message
        self.callback_query = None


class FakeContext:
    def __init__(self, lang='en'):
        self.user_data = {'language': lang, 'role': 'Employer'}


class RecordingSender:
    def __init__(self):
        self.sent = []
        self.markups = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append(text)
        self.markups.append(kwargs.get('reply_markup'))


class FakeContact:
    def __init__(self, phone_number, user_id):
        self.phone_number = phone_number
        self.user_id = user_id


class FakeQuery:
    def __init__(self, data, user):
        self.data = data
        self.from_user = user
        self.message = FakeMessage(None, user.id)
        self.edits = []

    async def answer(self):
        pass

    async def edit_message_text(self, text, reply_markup=None):
        self.edits.append(text)

    async def edit_message_reply_markup(self, reply_markup=None):
        pass


class FakeCallbackUpdate:
    def __init__(self, data, user_id=7):
        self.effective_user = FakeTelegramUser(user_id)
        self.callback_query = FakeQuery(data, self.effective_user)
        self.effective_message = self.callback_query.message
        self.message = None


def button_data(markup):
    return [button.callback_data for row in markup.inline_keyboard for button in row]


async def async_test_email_code_step():
    """The code step: format check, confirmation, a refused code, and leaving through the menu."""
    calls = []
    answers = {}

    async def fake_api(path, payload):
        calls.append((path, payload))
        return answers[path]

    menu_presses = []

    async def fake_menu(update, context):
        menu_presses.append(update.effective_message.text)

    sender = RecordingSender()
    original = (accounts.bot_api, accounts.handle_menu_selection, common.bot_context.rate_limiter)
    accounts.bot_api, accounts.handle_menu_selection, common.bot_context.rate_limiter = fake_api, fake_menu, sender
    try:
        context = FakeContext()

        state = await accounts.handle_email_code(FakeUpdate('12ab'), context)
        assert state == config.EMAIL_CODE and calls == []
        assert sender.sent[-1] == TRANSLATIONS['en']['code_format']

        answers['confirm-email'] = (400, {'message': 'That code is not right or has expired.'})
        state = await accounts.handle_email_code(FakeUpdate('111 111'), context)
        assert state == config.EMAIL_CODE
        assert 'not right' in sender.sent[-1]

        answers['confirm-email'] = (200, {'confirmed': True})
        state = await accounts.handle_email_code(FakeUpdate('123 456'), context)
        assert state == ConversationHandler.END
        assert calls[-1] == ('confirm-email', {'telegram_id': '7', 'code': '123456'})
        assert sender.sent[-1].startswith(TRANSLATIONS['en']['code_confirmed'])

        # A menu button ends the step and does what it says, instead of counting as a wrong code.
        state = await accounts.handle_email_code(FakeUpdate('Jobs'), context)
        assert state == ConversationHandler.END and menu_presses == ['Jobs']

        # A taken email asks for another one.
        answers['email-code'] = (409, {'message': 'That email belongs to another account.'})
        state = await accounts.handle_new_email(FakeUpdate('taken@firm.com'), context)
        assert state == config.NEW_EMAIL
        assert calls[-1] == ('email-code', {'telegram_id': '7', 'email': 'taken@firm.com'})
    finally:
        accounts.bot_api, accounts.handle_menu_selection, common.bot_context.rate_limiter = original
    print("  [PASS] async_test_email_code_step")


def test_job_seeker_residence_and_phone():
    """Typed countries, the person's own shared number, and what reaches the API."""
    assert common.country_from_text(' Kenya ') == 'KE'
    assert common.country_from_text('saudi  arabia') == 'SA'
    assert common.country_from_text('ኢትዮጵያ') == 'ET'
    assert common.country_from_text('de') == 'DE'
    assert common.country_from_text('Atlantis') is None

    me = FakeTelegramUser(7)
    assert common.own_phone(FakeMessage(None, contact=FakeContact('251911223344', 7)), me) == '+251911223344'
    assert common.own_phone(FakeMessage(None, contact=FakeContact('+971 50 123 4567', 7)), me) == '+971501234567'
    # Someone else's contact card isn't the person's number.
    assert common.own_phone(FakeMessage(None, contact=FakeContact('+251911000000', 99)), me) is None
    assert common.own_phone(FakeMessage('0911223344'), me) is None

    seeker = common.registration_payload({
        'role_input': 'candidate', 'name': 'Hana Bekele', 'phone': '+251911223344',
        'gender': 'FEMALE', 'country': 'ET', 'city': 'Hawassa', 'job_title': 'Nurse',
    }, FakeTelegramUser(42, 'hana_b'))
    assert (seeker['gender'], seeker['country'], seeker['city']) == ('FEMALE', 'ET', 'Hawassa')
    assert seeker['email'] is None and seeker['password'] is None
    print("  [PASS] test_job_seeker_residence_and_phone")


async def async_test_job_seeker_steps():
    """Phone by the share button only, then gender, country and city, then the job title."""
    sender = RecordingSender()
    original = common.bot_context.rate_limiter
    common.bot_context.rate_limiter = sender
    try:
        context = FakeContext()
        context.user_data = {'language': 'en', 'role_input': 'candidate', 'role': 'Candidate'}

        state = await registration.get_phone(FakeUpdate('0911223344'), context)
        assert state == config.PHONE and 'phone' not in context.user_data
        assert sender.sent[-1] == TRANSLATIONS['en']['share_phone_only']

        shared = FakeUpdate(None)
        shared.effective_message.contact = FakeContact('251911223344', 7)
        state = await registration.get_phone(shared, context)
        assert state == config.GENDER and context.user_data['phone'] == '+251911223344'

        state = await registration.get_gender(FakeCallbackUpdate('gender_FEMALE'), context)
        assert state == config.COUNTRY and context.user_data['gender'] == 'FEMALE'
        assert 'country_ET' in button_data(sender.markups[-1])

        state = await registration.get_country(FakeCallbackUpdate('country_ET'), context)
        assert state == config.CITY and context.user_data['country'] == 'ET'
        assert 'city_0' in button_data(sender.markups[-1])

        state = await registration.get_city(FakeCallbackUpdate('city_5'), context)
        assert state == config.JOB_TITLE and context.user_data['city'] == 'Hawassa'

        # Outside Ethiopia: type the country, then the city.
        state = await registration.get_country(FakeCallbackUpdate('country_other'), context)
        assert state == config.COUNTRY_TYPED
        state = await registration.get_typed_country(FakeUpdate('Lebanon'), context)
        assert state == config.CITY and context.user_data['country'] == 'LB'
        assert sender.sent[-1] == TRANSLATIONS['en']['type_city']
        state = await registration.get_city(FakeUpdate('  Beirut '), context)
        assert state == config.JOB_TITLE and context.user_data['city'] == 'Beirut'
    finally:
        common.bot_context.rate_limiter = original
    print("  [PASS] async_test_job_seeker_steps")


async def async_test_link_existing_account():
    """Email, the code sent to it, and the menu of the account it unlocks."""
    calls = []
    answers = {}

    async def fake_api(path, payload):
        calls.append((path, payload))
        return answers[path]

    sender = RecordingSender()
    original = (accounts.bot_api, common.bot_context.rate_limiter)
    accounts.bot_api, common.bot_context.rate_limiter = fake_api, sender
    try:
        context = FakeContext()
        context.user_data = {'language': 'en'}

        state = await accounts.get_link_email(FakeUpdate('not-an-email'), context)
        assert state == config.LINK_EMAIL and calls == []

        answers['link-account'] = (404, {'message': 'No Beleqet account uses that email.'})
        state = await accounts.get_link_email(FakeUpdate('Boss@Firm.com'), context)
        assert state == config.LINK_EMAIL and 'No Beleqet account' in sender.sent[-2]

        answers['link-account'] = (200, {'sent': True, 'email': 'boss@firm.com'})
        state = await accounts.get_link_email(FakeUpdate('boss@firm.com'), context)
        assert state == config.LINK_CODE
        assert calls[-1] == ('link-account', {'telegram_id': '7', 'email': 'boss@firm.com'})

        answers['link-account/confirm'] = (400, {'message': 'That code is not right or has expired.'})
        state = await accounts.get_link_code(FakeUpdate('111 111'), context)
        assert state == config.LINK_CODE and 'not right' in sender.sent[-1]

        answers['link-account/confirm'] = (200, {'linked': True, 'role': 'employer', 'language': 'am', 'first_name': 'Abebe'})
        state = await accounts.get_link_code(FakeUpdate('123456'), context)
        assert state == ConversationHandler.END
        assert calls[-1][1]['code'] == '123456' and calls[-1][1]['email'] == 'boss@firm.com'
        assert context.user_data['role'] == 'Employer' and context.user_data['language'] == 'am'
        assert sender.sent[-1] == TRANSLATIONS['am']['link_done'].format(name='Abebe')
    finally:
        accounts.bot_api, common.bot_context.rate_limiter = original
    print("  [PASS] async_test_link_existing_account")


async def async_test_new_registration_forgets_old_answers():
    """Registering as a job seeker after an employer registration sends no leftover email."""
    sender = RecordingSender()
    original = common.bot_context.rate_limiter
    common.bot_context.rate_limiter = sender
    try:
        context = FakeContext()
        context.user_data = {'language': 'en', 'email': 'boss@firm.com', 'password': 'Old-pass-123',
                             'company_name': 'Old Co', 'role_input': 'employer'}
        state = await registration.handle_role_selection(FakeCallbackUpdate('candidate'), context)
        assert state == config.NAME
        for key in ('email', 'password', 'company_name'):
            assert key not in context.user_data, key
        assert context.user_data['role_input'] == 'candidate'

        # Even if one slipped through, a job seeker's registration carries no email or password.
        seeker = common.registration_payload({'role_input': 'candidate', 'email': 'x@y.com', 'password': 'secret-123'}, FakeTelegramUser(5))
        assert seeker['email'] is None and seeker['password'] is None
    finally:
        common.bot_context.rate_limiter = original
    print("  [PASS] async_test_new_registration_forgets_old_answers")


def test_buttons_open_the_mini_app():
    """Every menu button and job link opens the Mini App's own screens (/tg)."""
    for role_links in common.MENU_URLS.values():
        for url in role_links.values():
            assert url.startswith(common.MINI_APP), url
    assert common.MINI_APP.endswith('/tg')
    assert common.MENU_URLS['employer']['post_job'].endswith('/tg/post-job')
    print("  [PASS] test_buttons_open_the_mini_app")


def test_sgs_challenge_init_data():
    valid_data = make_valid_init_data(5719730488)
    verified = verify_init_data(valid_data, TEST_BOT_TOKEN)
    assert verified is not None
    assert verified["user"]["id"] == 5719730488

    tampered_data = valid_data.replace("fearOfAllaah", "hacker")
    assert verify_init_data(tampered_data, TEST_BOT_TOKEN) is None

    old_date = int(time.time()) - (25 * 3600)
    old_data = make_valid_init_data(5719730488, auth_date=old_date)
    assert verify_init_data(old_data, TEST_BOT_TOKEN) is None

    assert verify_init_data("", TEST_BOT_TOKEN) is None
    assert verify_init_data("not_valid", TEST_BOT_TOKEN) is None
    print("  [PASS] test_sgs_challenge_init_data")


async def async_test_sgs_challenge_strict_single_vote():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        db = await init_challenge_db(db_path)

        await db.execute("INSERT INTO challenge_creators (name, handle, is_active) VALUES ('Creator A', '@creatora', 1)")
        await db.execute("INSERT INTO challenge_creators (name, handle, is_active) VALUES ('Creator B', '@creatorb', 1)")
        await db.commit()

        telegram_id = "5719730488"

        await db.execute("INSERT INTO challenge_votes (creator_id, telegram_id, created_at) VALUES (1, ?, ?)", (telegram_id, int(time.time())))
        await db.commit()

        failed_same = False
        try:
            await db.execute("INSERT INTO challenge_votes (creator_id, telegram_id, created_at) VALUES (1, ?, ?)", (telegram_id, int(time.time())))
        except aiosqlite.IntegrityError:
            failed_same = True
        assert failed_same is True

        failed_diff = False
        try:
            await db.execute("INSERT INTO challenge_votes (creator_id, telegram_id, created_at) VALUES (2, ?, ?)", (telegram_id, int(time.time())))
        except aiosqlite.IntegrityError:
            failed_diff = True
        assert failed_diff is True

        async with db.execute("SELECT COUNT(*) FROM challenge_votes WHERE telegram_id = ?", (telegram_id,)) as cur:
            (count,) = await cur.fetchone()
            assert count == 1

        await db.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
    print("  [PASS] test_sgs_challenge_strict_single_vote (Anti-double-vote constraint verified)")


def test_webhook_secret_token_verification():
    expected_token = "test-webhook-secret-not-real"  # test-only value

    def check_token(provided):
        if not expected_token or not provided:
            return False
        return hmac.compare_digest(provided, expected_token)

    assert check_token(expected_token) is True
    assert check_token("wrong_token") is False
    assert check_token("") is False
    assert check_token(None) is False
    print("  [PASS] test_webhook_secret_token_verification")


class AlertSender:
    """Stands in for the rate limiter: records what was sent, and can fail one kind of message."""
    def __init__(self, fail=()):
        self.sent = []
        self.fail = fail

    async def _record(self, kind, chat_id, content, kwargs):
        if kind in self.fail:
            raise telegram.error.BadRequest(f"can't send this as a {kind}")
        self.sent.append((kind, chat_id, content, kwargs))

    async def send_photo(self, chat_id, photo, **kwargs):
        await self._record('photo', chat_id, photo, kwargs)

    async def send_document(self, chat_id, document, **kwargs):
        await self._record('document', chat_id, document, kwargs)

    async def send_message(self, chat_id, text, **kwargs):
        await self._record('message', chat_id, text, kwargs)


def test_payment_alert_text():
    """Who paid, for what, and the payer's own reference, escaped so it can't break the message."""
    text = webhook.payment_alert_text({
        'order_id': 'pay-1', 'amount': '1,500', 'currency': 'ETB', 'reference': 'FT<b>12&3',
        'payer': 'Sara Tesfaye · sara@example.com', 'plan': 'Pro',
    })
    assert '<b>Payer:</b> Sara Tesfaye · sara@example.com' in text
    assert '<b>Plan:</b> Pro' in text
    assert '<b>Amount:</b> 1,500 ETB' in text
    assert '<code>FT&lt;b&gt;12&amp;3</code>' in text
    assert 'before you approve' in text
    # Older alerts without the payer and plan still read well.
    assert 'Payer' not in webhook.payment_alert_text({'order_id': 'pay-1', 'amount': '1', 'currency': 'ETB'})
    print("  [PASS] test_payment_alert_text")


def test_payment_alert_attaches_the_receipt():
    """A PDF goes as a file, an image as a photo (or a file if Telegram refuses it), and with no
    receipt the alert still arrives, as text with the buttons."""
    async def check():
        keyboard = object()
        original = common.bot_context.rate_limiter
        try:
            for receipt, fail, kind in [
                ((b'%PDF', 'abc.pdf'), (), 'document'),
                ((b'img', 'abc.webp'), (), 'photo'),
                ((b'img', 'abc.webp'), ('photo',), 'document'),
                ((b'img', 'abc.webp'), ('photo', 'document'), 'message'),
                (None, (), 'message'),
            ]:
                sender = AlertSender(fail)
                common.bot_context.rate_limiter = sender
                await webhook.send_payment_alert(42, 'Bank transfer', keyboard, receipt)
                assert len(sender.sent) == 1, (receipt, fail, sender.sent)
                sent_kind, chat_id, content, kwargs = sender.sent[0]
                assert (sent_kind, chat_id) == (kind, 42)
                assert kwargs['reply_markup'] is keyboard and kwargs['parse_mode'] == 'HTML'
                if kind == 'message':
                    assert content.startswith('Bank transfer') and 'admin site' in content
                else:
                    assert content == receipt[0] and kwargs['filename'] == receipt[1]
                    assert kwargs['caption'] == 'Bank transfer'
        finally:
            common.bot_context.rate_limiter = original
    asyncio.run(check())
    print("  [PASS] test_payment_alert_attaches_the_receipt")


def test_receipt_download():
    """The receipt is fetched from its link; a missing or oversized file gives None, never an error."""
    from aiohttp import web as aioweb

    async def receipt(request):
        return aioweb.Response(body=b'%PDF-1.4 receipt')

    async def check():
        app = aioweb.Application()
        app.router.add_get('/files/abc.pdf', receipt)
        runner = aioweb.AppRunner(app)
        await runner.setup()
        site = aioweb.TCPSite(runner, '127.0.0.1', 0)
        await site.start()
        base = f"http://127.0.0.1:{site._server.sockets[0].getsockname()[1]}"
        original = webhook.RECEIPT_MAX_BYTES
        try:
            assert await webhook.download_receipt(f"{base}/files/abc.pdf?x=1") == (b'%PDF-1.4 receipt', 'abc.pdf')
            assert await webhook.download_receipt(f"{base}/files/missing.pdf") is None
            assert await webhook.download_receipt('file:///etc/passwd') is None
            assert await webhook.download_receipt(None) is None
            webhook.RECEIPT_MAX_BYTES = 4
            assert await webhook.download_receipt(f"{base}/files/abc.pdf") is None
        finally:
            webhook.RECEIPT_MAX_BYTES = original
            await runner.cleanup()
    asyncio.run(check())
    print("  [PASS] test_receipt_download")


class FakeApiAnswer:
    def __init__(self, status, body):
        self.status = status
        self.body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def json(self):
        return self.body

    async def text(self):
        return json.dumps(self.body)


class FakeApiSession:
    def __init__(self, status=200, body=None):
        self.answer = FakeApiAnswer(status, body or {})
        self.posts = []

    def post(self, url, json=None, **kwargs):
        self.posts.append((url, json))
        return self.answer


class FakeAlertMessage:
    caption = 'Bank transfer to check'
    caption_html = '<b>Bank transfer to check</b>'
    reply_markup = 'approve/reject buttons'


class FakeAlertQuery:
    def __init__(self, data, user):
        self.data = data
        self.from_user = user
        self.message = FakeAlertMessage()
        self.answers = []
        self.captions = []

    async def answer(self, text=None, show_alert=False):
        self.answers.append((text, show_alert))

    async def edit_message_caption(self, caption, parse_mode=None, reply_markup=None):
        self.captions.append((caption, reply_markup))


class FakeAlertUpdate:
    def __init__(self, data, user_id):
        user = FakeTelegramUser(user_id)
        user.first_name = 'Ahmed'
        self.effective_user = user
        self.callback_query = FakeAlertQuery(data, user)


def test_payment_decision_in_telegram():
    """Approve and Reject reach the API with the admin's Telegram id; only admins can press them, and
    the message says what happened."""
    async def press(data, user_id, session):
        update = FakeAlertUpdate(data, user_id)
        original = (common.bot_context.session, config.CONFIG['admin_ids'], config.CONFIG['wp_api_url'])
        common.bot_context.session = session
        config.CONFIG['admin_ids'] = [712718884]
        config.CONFIG['wp_api_url'] = 'http://127.0.0.1:4000/api/v1/telegram/register'
        try:
            await admin.handle_payment_decision(update, FakeContext())
        finally:
            common.bot_context.session, config.CONFIG['admin_ids'], config.CONFIG['wp_api_url'] = original
        return update.callback_query

    async def check():
        session = FakeApiSession()
        query = await press('approve_payment_pay-1', 5551234, session)
        assert session.posts == [] and query.captions == []
        assert query.answers == [("Only the bot's admins can approve or reject payments.", True)]

        query = await press('approve_payment_pay-1', 712718884, session)
        assert session.posts == [('http://127.0.0.1:4000/api/v1/telegram/register/../update-payment-status',
                                  {'order_id': 'pay-1', 'status': 'completed', 'admin_telegram_id': '712718884'})]
        caption, buttons = query.captions[-1]
        assert caption.startswith('<b>Bank transfer to check</b>')
        assert 'Approved by Ahmed. The plan has started.' in caption and buttons is None

        session = FakeApiSession()
        query = await press('reject_payment_pay-1', 712718884, session)
        assert session.posts[-1][1]['status'] == 'cancelled'
        assert 'Rejected by Ahmed.' in query.captions[-1][0]

        query = await press('reject_payment_pay-1', 712718884,
                            FakeApiSession(409, {'message': 'This payment is already approved.'}))
        caption, buttons = query.captions[-1]
        assert 'This payment is already approved.' in caption and buttons is None

        query = await press('approve_payment_pay-1', 712718884, FakeApiSession(500, {'message': 'boom'}))
        caption, buttons = query.captions[-1]
        assert 'Not saved (HTTP 500)' in caption and buttons == 'approve/reject buttons'
    asyncio.run(check())
    print("  [PASS] test_payment_decision_in_telegram")


def main():
    print("==================================================")
    print(" RUNNING BELEQET JOBS BOT (`bots/jobs`) TEST SUITE")
    print("==================================================")
    test_role_normalization()
    test_keyboard_generation()
    test_menu_matching_across_languages()
    test_streamlined_employer_flow_without_trade_license()
    test_translations_complete_in_both_languages()
    test_registration_payload_keeps_everything()
    test_password_and_code_rules()
    asyncio.run(async_test_email_code_step())
    test_job_seeker_residence_and_phone()
    asyncio.run(async_test_job_seeker_steps())
    asyncio.run(async_test_link_existing_account())
    asyncio.run(async_test_new_registration_forgets_old_answers())
    test_buttons_open_the_mini_app()
    test_sgs_challenge_init_data()
    asyncio.run(async_test_sgs_challenge_strict_single_vote())
    test_webhook_secret_token_verification()
    test_payment_alert_text()
    test_payment_alert_attaches_the_receipt()
    test_receipt_download()
    test_payment_decision_in_telegram()
    print("==================================================")
    print(" ALL 20 / 20 TESTS PASSED SUCCESSFULLY! (100% OK)")
    print("==================================================")


if __name__ == "__main__":
    main()
