"""Starts the Beleqet Jobs bot: the handlers, the web server (webhook and SGS Challenge) and polling."""
import aiohttp
import asyncio
import os
import sys
from aiohttp import web
from telegram import Update, WebAppInfo
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ConversationHandler, MessageHandler, PicklePersistence, filters

sys.path.append(os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'server'))
from voting_routes import UPLOADS_DIR as CHALLENGE_UPLOADS_DIR, init_challenge_db, register_challenge_routes  # noqa: E402

from config import BROADCAST_BUTTON_TEXT, BROADCAST_BUTTON_URL, BROADCAST_CONFIRM, BROADCAST_MESSAGE, CHANGE_LANGUAGE, CITY, COMPANY_NAME, CONFIG, CONTACT_NAME, COUNTRY, COUNTRY_TYPED, EMAIL, EMAIL_CODE, GENDER, JOB_TITLE, LANGUAGE, LINK_CODE, LINK_EMAIL, NAME, NEW_EMAIL, PASSWORD, PHONE, ROLE, TG_USERNAME, TRADE_LICENSE, logger
from common import MINI_APP, RateLimiter, bot_context, cancel
import challenge
from registration import change_language_command, get_city, get_company_name, get_contact_name, get_country, get_email, get_gender, get_job_title, get_name, get_password, get_phone, get_tg_username, get_trade_license, get_typed_country, handle_language_selection, handle_language_update, handle_role_selection, restart_from_button, start, use_telegram_name
from accounts import code_button, get_link_code, get_link_email, handle_email_code, handle_new_email, link_button
from menu import handle_menu_selection
from webhook import error_handler, health_check, webhook_handler
from admin import broadcast_action, broadcast_cancel_cmd, broadcast_get_button_text, broadcast_get_button_url, broadcast_get_message, broadcast_skip_button, broadcast_start, handle_payment_decision

async def main() -> None:
    logger.info("Script starting...")
    if not all(CONFIG.values()):
        logger.critical("Missing required environment variables! Please check your .env file or environment.")
        raise ValueError("Missing required environment variables.")

    unique_user_agent = 'BeleqetJobBot/1.0'

    # Saved conversations, in data/ with everything else the bot writes (deploys never touch it).
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    os.makedirs(data_dir, exist_ok=True)
    persistence = PicklePersistence(filepath=os.path.join(data_dir, 'persistence.pickle'))

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
        bot_context.application.add_handler(CommandHandler("challenge", challenge.challenge_command))
        bot_context.application.add_handler(CommandHandler("voucher", challenge.voucher_command))
        bot_context.application.add_handler(MessageHandler(filters.Regex(f"^{challenge.REMIND_BUTTON}$"), challenge.remind_start))
        bot_context.application.add_handler(CallbackQueryHandler(challenge.remind_decision, pattern='^sgs_(remind|unpin|cancel)$'))

        # Room for 5 MB avatar uploads (aiohttp refuses bodies over 1 MB by default).
        app = web.Application(client_max_size=6 * 1024 * 1024)
        # --- NEW Health Check Route ---
        app.router.add_get('/', health_check)
        app.router.add_post('/webhook', webhook_handler)
        
        # --- SGS Challenge Routes ---
        challenge_db = await init_challenge_db()
        bot_context.challenge_db = challenge_db
        register_challenge_routes(app, challenge_db, bot_token=CONFIG['telegram_token'], wp_api_url=CONFIG['wp_api_url'],
                                  admin_ids=CONFIG['admin_ids'], on_vote=challenge.send_voucher_after_vote)
        
        async def challenge_index(request):
            return web.FileResponse(os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'app', 'index.html'))
            
        app.router.add_get('/challenge', challenge_index)
        app.router.add_get('/challenge/', challenge_index)
        # Creators' photos live in data/; registered first, so it wins over the app folder below.
        app.router.add_static('/challenge/uploads/', path=CHALLENGE_UPLOADS_DIR, name='challenge_uploads')
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

        await challenge.setup_profile(bot_context.application.bot)

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
