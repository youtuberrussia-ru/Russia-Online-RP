# Game design baseline

## World and progression
- One shared launch server/world/economy/organizations/families/leaderboards.
- Architecture should allow more servers later without fragmenting account identity.
- Original city layout, districts, landmarks, interiors, writing and art.
- Android-first touch controls and performance for modest devices.

## Core systems
Player identity, character profile, friends, chat, phone, vehicles, ownership, garages, fuel, maintenance, jobs, businesses, properties, bank, trade, organizations, families, separate criminal factions, events, achievements and daily/weekly tasks.

## Official organizations
Exactly 11: МВД, ФСБ, Армия, МЧС, Минздрав, Прокуратура, Правительство, ГИБДД, СМИ, ФСИН and Центральный банк. Driving school is a service/system, not an organization; licences are issued by game systems after tests.

Each organization has a dedicated building, interview-based recruitment, leader/deputy roles, ranks, uniforms, vehicles, salary, storage, rules and employee history. Rank permissions and salaries must be balanced and editable by the owner.

## Economy
- No donations or paid advantages in the current design.
- Currency is earned through jobs, businesses, tasks, events and legitimate gameplay.
- Every balance change is a server-side ledger transaction with idempotency and audit.
- Cash wallet and bank account are separate balances; deposits, withdrawals and player transfers are atomic and recorded in the bank ledger.
- Player-to-player transfers use account nicknames, reject self-transfers and never accept client-supplied balances or fees.
- Login rewards cannot be reset by reinstalling or changing the device clock.
- Reward amounts remain configurable and require economy testing.

## Admin hierarchy
1. ГА — Главный администратор
2. ЗГА — Заместитель главного администратора
3. СТ АДМ — Старший администратор
4. АДМ — Администратор
5. СТ МОДЕР — Старший модератор
6. МОДЕР — Модератор
7. МЛ МОДЕР — Младший модератор

Organization rank and server admin rank are separate. GA/ZGA have broad operational access; only the owner controls admin appointment/removal and owner-level settings.

## Anti-cheat
Validate movement, teleport, flight/noclip, damage, ammo, inventory, money and vehicle state on the server. Never permanently ban from one suspicious client signal. Confirmed cheat bans use exact reason ЧИТЫ / НЕЗАКОННОЕ ПО, preserve corroborated evidence and support appeal/review.

## Not in launch scope
Real-money donations, pay-to-win boosts, copied competitor assets and unreviewed automatic permanent bans.