import os
import requests
import json

BOT_TOKEN = os.getenv('TELEGRAM_BOT_API_TOKEN', 'd5d2j1Tq3uGeJwulPESUzyTsTY5auc9LlQTSsljzSBYJIdzjoavflIwVFLS1ouVseYYOFZuHjFxXGqSu')
headers = {'x-beleqet-api-token': BOT_TOKEN, 'Content-Type': 'application/json'}

print("=== 1. TEST CANDIDATE REGISTRATION VIA BOT ===")
cand_data = {
    'telegram_id': 99990001,
    'first_name': 'BotCand',
    'last_name': 'Tester',
    'username': 'botcandtest',
    'email': 'botcand@example.com',
    'phone': '+251911000111',
    'role': 'candidate',
    'password': 'TestPassword123!',
    'job_title': 'Senior Python Developer'
}
res = requests.post('http://127.0.0.1:4000/api/v1/telegram/register', json=cand_data, headers=headers)
print('Candidate Registration Response Status:', res.status_code)
print('Candidate Registration Response Body:', res.text)

print("\n=== 2. TEST CANDIDATE WEB LOGIN WITH BOT-REGISTERED PASSWORD ===")
login_res = requests.post('http://127.0.0.1:4000/api/v1/auth/login', json={'email': 'botcand@example.com', 'password': 'TestPassword123!'})
print('Candidate Web Login Status:', login_res.status_code)
if login_res.status_code in (200, 201):
    print('SUCCESS: Web login succeeded! User received JWT token.')
else:
    print('Web login failed:', login_res.text)

print("\n=== 3. TEST EMPLOYER REGISTRATION VIA BOT (WITHOUT TRADE LICENSE) ===")
emp_data = {
    'telegram_id': 99990002,
    'first_name': 'EmpBoss',
    'last_name': 'Manager',
    'username': 'empbosstest',
    'email': 'empboss@example.com',
    'phone': '+251922000222',
    'role': 'employer',
    'password': 'BossPassword123!',
    'company_name': 'Acme Tech Solutions'
}
emp_res = requests.post('http://127.0.0.1:4000/api/v1/telegram/register', json=emp_data, headers=headers)
print('Employer Registration Response Status:', emp_res.status_code)
print('Employer Registration Response Body:', emp_res.text)

print("\n=== 4. TEST EMPLOYER WEB LOGIN WITH BOT-REGISTERED PASSWORD ===")
emp_login = requests.post('http://127.0.0.1:4000/api/v1/auth/login', json={'email': 'empboss@example.com', 'password': 'BossPassword123!'})
print('Employer Web Login Status:', emp_login.status_code)
if emp_login.status_code in (200, 201):
    print('SUCCESS: Employer Web login succeeded! User received JWT token.')
else:
    print('Employer web login failed:', emp_login.text)

print("\n=== 5. VERIFY DATABASE RECORDS (PASSWORD HASH & COMPANY PROFILE) ===")
import subprocess
sql = 'SELECT u.email, u.role, (u."passwordHash" IS NOT NULL) AS has_password, c.name AS company_name FROM users u LEFT JOIN companies c ON c."userId" = u.id WHERE u.email IN (\'botcand@example.com\', \'empboss@example.com\');'
cmd = ['sudo', '-n', 'docker', 'exec', 'beleqet2-postgres', 'psql', '-U', 'beleqet_user', '-d', 'beleqet_db', '-c', sql]
print(subprocess.check_output(cmd).decode())

print("\n=== 6. CLEANING UP TEST ACCOUNTS ===")
cleanup_sql = 'DELETE FROM companies WHERE "userId" IN (SELECT id FROM users WHERE email IN (\'botcand@example.com\', \'empboss@example.com\')); DELETE FROM users WHERE email IN (\'botcand@example.com\', \'empboss@example.com\');'
cmd_cleanup = ['sudo', '-n', 'docker', 'exec', 'beleqet2-postgres', 'psql', '-U', 'beleqet_user', '-d', 'beleqet_db', '-c', cleanup_sql]
print(subprocess.check_output(cmd_cleanup).decode())
print("Test accounts successfully cleaned up.")
