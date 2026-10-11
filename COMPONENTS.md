# Components Map

```mermaid
flowchart LR
  subgraph Sources["Live public data"]
    MFAPI["mfapi.in<br/>NAV history + search"]
    AMFI["AMFI NAVAll.txt<br/>categories → peers"]
    NEWS["NewsData.io<br/>(fallback: Google News RSS)"]
  end

  subgraph Vercel["Vercel (Next.js 14)"]
    UI["Dashboard page<br/>add/remove fund · returns table · trend chart · reports"]
    FUNDS["/api/funds<br/>validate code, pick benchmark + 10 peers, backfill 1y"]
    DAILY["/api/cron/daily<br/>00:00 IST · NAVs + news"]
    WEEKLY["/api/cron/weekly<br/>Sat 08:00 IST · snapshot + report"]
    RUN["/api/report/run<br/>'Generate report now'"]
  end

  subgraph Supabase["Supabase (Postgres)"]
    T1[(funds)]
    T2[(nav_history)]
    T3[(market_news)]
    T4[(weekly_snapshots)]
    T5[(reports)]
  end

  GEMINI["Gemini Flash<br/>JSON schema output"]
  RESEND["Resend<br/>HTML email"]
  USER(("Meera"))

  USER --> UI
  UI --> FUNDS
  UI --> RUN
  FUNDS --> MFAPI
  FUNDS --> AMFI
  FUNDS --> T1
  FUNDS --> T2
  DAILY --> MFAPI --> T2
  DAILY --> NEWS --> T3
  WEEKLY --> T2
  RUN --> WEEKLY
  WEEKLY --> T3
  WEEKLY --> T4
  WEEKLY --> GEMINI --> T5
  WEEKLY --> RESEND --> USER
```

| Component | Role |
|---|---|
| **mfapi.in** | Daily NAVs for each fund, its benchmark proxy and its category peers; scheme search for the add-fund form. |
| **AMFI NAVAll.txt** | Maps each fund's category to 10 Direct-Growth peers for the category average. |
| **Index proxies** | Index-fund NAVs standing in for the three tracked indices: Nifty 50, Nifty Midcap 150, Nifty Smallcap 100. Debt and overseas funds are compared with their similar-funds average only. |
| **NewsData.io** | Daily Indian market and macro headlines, stored so the weekly report sees 7 days of news. |
| **Supabase** | Stores funds, NAV history, news, weekly snapshots (for multi-week trends) and reports. |
| **Daily cron** | Refreshes NAVs and news every night. |
| **Weekly cron** | Computes WoW/MoM/YTD for each fund vs benchmark vs category, gets index moves, calls Gemini, saves the report, sends the email. |
| **Gemini Flash** | Writes a 3-sentence plain-language summary per fund plus one verdict: *No action needed / One fund worth watching / Consider reviewing your allocation*. |
| **Resend** | Delivers the Saturday-morning email. |
| **Dashboard** | Add or remove a fund by scheme code (or name search), latest returns, trend chart, past reports, manual run. |
