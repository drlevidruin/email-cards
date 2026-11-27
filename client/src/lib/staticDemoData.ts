import type {
  AgentRule,
  CommitmentItem,
  CustomView,
  DraftItem,
  EmailMessage,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  ScreenerSender,
} from './types';

export interface DemoDataset {
  accounts: GmailAccount[];
  threads: EmailThread[];
  messages: EmailMessage[];
  commitments: CommitmentItem[];
  screener: ScreenerSender[];
  tasks: ExtractedTask[];
  drafts: DraftItem[];
  rules: AgentRule[];
  customViews: CustomView[];
  snapshotLabel?: string;
  snapshotId?: string;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

/**
 * A time for a message the user sent: about `h` hours ago, but inside working hours (9 AM to 6 PM local),
 * after the message before it (`afterH` hours ago) and before the one after it (`beforeH`). Never Friday from 4 PM through Saturday.
 */
function workTime(h: number, afterH?: number, beforeH?: number): string {
  const now = Date.now();
  const MIN = 60 * 1000;
  const lo = now - (afterH ?? h + 24) * 60 * MIN + 10 * MIN;
  const hi = now - (beforeH ?? 0.25) * 60 * MIN - 10 * MIN;
  const nominal = now - h * 60 * MIN;
  for (let k = 0; k <= 120; k++) {
    for (const sign of k === 0 ? [1] : [1, -1]) {
      const t = nominal + sign * k * 10 * MIN;
      const hour = new Date(t).getHours();
      const wd = new Date(t).getDay();
      // Never on Shabbos: Friday from 4 PM through Saturday
      const rest = wd === 6 || (wd === 5 && hour >= 16);
      if (t >= lo && t <= hi && hour >= 9 && hour < 18 && !rest) return new Date(t).toISOString();
    }
  }
  return new Date(nominal).toISOString();
}

/** An exact local time in the sample's year, so a deadline label and its `deadlineAt` can never disagree. Month is 1 to 12. */
function onDay(month: number, day: number, hour: number, minute = 0): string {
  return new Date(2026, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function buildDemoDataset(): DemoDataset {
  const accounts: GmailAccount[] = [
    {
      id: 'acc_studio',
      email: 'alex@meridianstudio.co',
      displayName: 'Alex Chen',
      label: 'Studio',
      color: '#38bdf8',
      provider: 'demo',
      status: 'demo',
      lastSyncedAt: hoursAgo(0.1),
      unreadCount: 0,
      signature: 'Alex Chen\nPrincipal, Meridian Studio',
      isDemo: true,
    },
    {
      id: 'acc_personal',
      email: 'alex.chen.home@gmail.com',
      displayName: 'Alex Chen',
      label: 'Personal',
      color: '#34d399',
      provider: 'demo',
      status: 'demo',
      lastSyncedAt: hoursAgo(0.1),
      unreadCount: 0,
      signature: 'Best,\nAlex',
      isDemo: true,
    },
    {
      id: 'acc_ventures',
      email: 'alex@northstarventures.io',
      displayName: 'Alex Chen',
      label: 'Ventures',
      color: '#f59e0b',
      provider: 'demo',
      status: 'demo',
      lastSyncedAt: hoursAgo(0.1),
      unreadCount: 0,
      signature: 'Alex Chen\nAdvisor, Northstar Ventures',
      isDemo: true,
    },
  ];

  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const meta = (accId: string) => {
    const a = accMap.get(accId)!;
    return {
      accountId: a.id,
      accountColor: a.color,
      accountLabel: a.label,
      accountEmail: a.email,
    };
  };

  const messages: EmailMessage[] = [];
  // The user's own earlier mail, sent in working hours
  const wait01At = workTime(96);
  const wait02At = workTime(94);
  // Owen and Rachel write on Monday; the user answers each the same day
  const wait04In = hoursAgo(27);
  const wait04At = workTime(23, 27);
  const wait05In = hoursAgo(26);
  const wait05At = workTime(21, 26);
  const wait03At = workTime(120);
  const addMsg = (m: EmailMessage) => {
    messages.push(m);
    return m;
  };

  // =========================================================================
  // 1. SEVEN HIGH-STAKES DECISION THREADS
  // =========================================================================

  // DEC-00 (Personal): the one anyone understands, first in Needs you
  addMsg({
    id: 'msg_dec00_1',
    threadId: 'thr_dec_00',
    accountId: 'acc_personal',
    fromName: 'Maya Chen',
    fromEmail: 'maya.chen@fastmail.com',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: "Dad's 70th: dinner on Sunday?",
    snippet: "Surprise dinner at Lucia's on Sunday at 6 for Dad's 70th. Can you make it? I need a headcount by 6 tonight.",
    bodyText:
      "Hi Alex,\n\nDad turns 70 on Sunday, and I'm planning a surprise dinner at Lucia's at 6. Can you make it? I have to give them a headcount by 6 tonight.\n\nMaya",
    sentAt: hoursAgo(1),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // DEC-00b (Personal): an email that needs nothing but a look, so Done is the right move on the card that teaches Done
  addMsg({
    id: 'msg_dec00b_1',
    threadId: 'thr_dec_00b',
    accountId: 'acc_personal',
    fromName: 'Sam Ortiz',
    fromEmail: 'sam.ortiz@icloud.com',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Thanks for Sunday',
    snippet: 'Thank you for giving up your Sunday to help us move. Dinner is on us once the boxes are unpacked.',
    bodyText:
      'Alex,\n\nThank you for giving up your Sunday to help us move. We would still be staring at that couch on the stairs without you.\n\nDinner is on us once the boxes are unpacked. No need to reply, I just wanted to say thanks.\n\nSam',
    sentAt: hoursAgo(1.5),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // DEC-01 (Studio): Atelier Loft Keynote Venue Contract & Deposit
  addMsg({
    id: 'msg_dec01_1',
    threadId: 'thr_dec_01',
    accountId: 'acc_studio',
    fromName: 'Maya Lindholm',
    fromEmail: 'maya@atelierloft.co',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Atelier Loft Keynote Venue: Addendum B & AV Rider',
    snippet: 'Sharing the revised venue agreement for December 10 in San Francisco with the updated house lighting schedule.',
    bodyText:
      'Hi Alex,\n\nSharing the revised venue agreement for Meridian Studio\'s December 10 product keynote at Atelier Loft in San Francisco. We held the main gallery plus the rooftop mezzanine as discussed.\n\nTwo quick updates from our operations lead:\n1. Load-in can start at 7:00 AM instead of 8:30 AM at no extra charge.\n2. The house AV rig covers dual 4K laser projection, but custom directional stage wash lighting is billed under Addendum B.\n\nLet me know if you want us to keep the $4,200 AV cap in place.\n\nBest,\nMaya Lindholm\nEvents Director, Atelier Loft',
    sentAt: hoursAgo(28),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec01_1',
        filename: 'Atelier-Loft-Addendum-B.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 418200,
      },
    ],
  });
  addMsg({
    id: 'msg_dec01_2',
    threadId: 'thr_dec_01',
    accountId: 'acc_studio',
    fromName: 'Alex Chen',
    fromEmail: 'alex@meridianstudio.co',
    toEmails: ['maya@atelierloft.co'],
    subject: 'Re: Atelier Loft Keynote Venue: Addendum B & AV Rider',
    snippet: 'Thanks Maya! Early 7:00 AM load-in is huge for our fabrication crew. Checking the lighting cap with Lumina AV now.',
    bodyText:
      'Thanks Maya! The 7:00 AM load-in is huge for our stage crew.\n\nI am confirming the directional wash specs with Marcus at Lumina AV right now. Provided our external rig does not trigger a house union surcharge, we are aligned on the $4,200 cap.\n\nBest,\nAlex',
    sentAt: workTime(18, 28, 1.4),
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });
  addMsg({
    id: 'msg_dec01_3',
    threadId: 'thr_dec_01',
    accountId: 'acc_studio',
    fromName: 'Maya Lindholm',
    fromEmail: 'maya@atelierloft.co',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Re: Atelier Loft Keynote Venue: Addendum B & AV Rider',
    snippet: 'Confirmed no union surcharge for external lighting under 6 fixtures. Need your sign-off on Addendum B before 4:00 PM today.',
    bodyText:
      'Hi Alex,\n\nGood news: our house engineer confirmed zero union surcharge as long as Lumina AV stays under 6 fixtures and ties into the balcony breaker.\n\nOne time-sensitive item: another tech company placed a backup hold on December 10. Could you confirm the $4,200 AV lighting cap and reply with approval on Addendum B by 4:00 PM today so I can lock the main gallery and release the backup bidder?\n\nAlso happy to coordinate dinner drop-off access if your investor group is heading nearby afterward.\n\nWarmly,\nMaya',
    sentAt: hoursAgo(1.4),
    isUnread: true,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec01_2',
        filename: 'Atelier-Loft-Final-Execution-Copy.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 432900,
      },
    ],
  });

  // DEC-02 (Ventures): Kestrel AI Seed Bridge Pro-Rata Allocation
  addMsg({
    id: 'msg_dec02_1',
    threadId: 'thr_dec_02',
    accountId: 'acc_ventures',
    fromName: 'Priya Subramanian',
    fromEmail: 'priya@kestrelai.dev',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Kestrel AI Seed Bridge: Pro-Rata Allocation & Closing Packet',
    snippet: 'We are wrapping our $3.2M seed extension at a $24M post-money cap after hitting $1.4M ARR in October.',
    bodyText:
      'Alex,\n\nQuick update before the broader investor letter goes out: Kestrel AI crossed $1.4M ARR this month (up 3.4x since March), driven by three enterprise workflow rollouts.\n\nWe are closing an oversubscribed $3.2M seed extension on a $24M post-money SAFE led by our existing lead. Northstar Ventures has a $75,000 pro-rata allocation reserved.\n\nI attached the updated KPI deck and SAFE side letter. Would love to have you stay on the cap table as we prep our launch microsite with your studio team.\n\nBest,\nPriya',
    sentAt: hoursAgo(22),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec02_1',
        filename: 'Kestrel-AI-Q4-Extension-Deck.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2840000,
      },
      {
        id: 'att_dec02_2',
        filename: 'Kestrel-SAFE-ProRata-Northstar.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 315000,
      },
    ],
  });
  addMsg({
    id: 'msg_dec02_2',
    threadId: 'thr_dec_02',
    accountId: 'acc_ventures',
    fromName: 'Alex Chen',
    fromEmail: 'alex@northstarventures.io',
    toEmails: ['priya@kestrelai.dev'],
    subject: 'Re: Kestrel AI Seed Bridge: Pro-Rata Allocation & Closing Packet',
    snippet: 'Incredible momentum Priya. Reviewing cash reserve with Tessa this morning and confirming wire timing.',
    bodyText:
      'Incredible momentum Priya, huge congrats to the whole team on $1.4M ARR.\n\nI am checking Q4 reserve liquidity with Tessa this morning and reviewing the pro-rata side letter. Will confirm our exact allocation before end of day.\n\nBest,\nAlex',
    sentAt: workTime(9, 22, 0.8),
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });
  addMsg({
    id: 'msg_dec02_3',
    threadId: 'thr_dec_02',
    accountId: 'acc_ventures',
    fromName: 'Priya Subramanian',
    fromEmail: 'priya@kestrelai.dev',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Re: Kestrel AI Seed Bridge: Pro-Rata Allocation & Closing Packet',
    snippet: 'Cooley is finalizing the closing packet at 5:30 PM today. Please confirm full $75k or partial allocation.',
    bodyText:
      'Thanks Alex! Just a heads up that outside counsel is locking the signature packet at 5:30 PM today so wires can clear early next week.\n\nPlease reply with "Full $75k", a partial amount, or "Pass" before 5:30 PM today so we keep your slot intact.\n\nPriya',
    sentAt: hoursAgo(0.8),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // DEC-03 (Studio): Solis Health Final Typography Lock
  addMsg({
    id: 'msg_dec03_1',
    threadId: 'thr_dec_03',
    accountId: 'acc_studio',
    fromName: 'Jordan Okafor',
    fromEmail: 'jordan@solishealth.com',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Solis Health: Packaging Press Proof & Serif Lockup',
    snippet: 'Our executive team loved both typography directions. Leaning strongly toward Option B with the tighter wordmark.',
    bodyText:
      'Hi Alex,\n\nOur leadership team reviewed the two typography boards this morning and loved the restraint of both directions. Everyone is leaning strongly toward Option B (the editorial serif paired with the geometric mono dosage table).\n\nBefore we hand files to the packaging printer, can Meridian confirm that the commercial font license covers 5,000 retail cartons plus web display?\n\nThanks,\nJordan Okafor\nVP Brand, Solis Health',
    sentAt: hoursAgo(26),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec03_1',
        filename: 'Solis-OptionB-PressProof-v4.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 6120000,
      },
    ],
  });
  addMsg({
    id: 'msg_dec03_2',
    threadId: 'thr_dec_03',
    accountId: 'acc_studio',
    fromName: 'Alex Chen',
    fromEmail: 'alex@meridianstudio.co',
    toEmails: ['jordan@solishealth.com'],
    subject: 'Re: Solis Health: Packaging Press Proof & Serif Lockup',
    snippet: 'Confirmed: we just purchased the Monotype commercial license covering print packaging and 500k monthly web views.',
    bodyText:
      'Confirmed: we purchased the Monotype commercial license this morning (Order #MT-20918), which covers retail packaging up to 50,000 units and 500k monthly web pageviews.\n\nDoing one last kerning pass on the 6pt ingredient panel today.\n\nAlex',
    sentAt: workTime(12, 26, 2.2),
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });
  addMsg({
    id: 'msg_dec03_3',
    threadId: 'thr_dec_03',
    accountId: 'acc_studio',
    fromName: 'Jordan Okafor',
    fromEmail: 'jordan@solishealth.com',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Re: Solis Health: Packaging Press Proof & Serif Lockup',
    snippet: 'Printer needs final mechanical sign-off by tomorrow noon to hold our November press slot. Ready to greenlight Option B?',
    bodyText:
      'Awesome, thank you for sorting the font license so quickly.\n\nOur printer in Portland just told us they need final mechanical sign-off by noon tomorrow to keep our November press slot (otherwise we slip two weeks). Can you review the updated die-line PDF attached and reply to greenlight Option B?\n\nBest,\nJordan',
    sentAt: hoursAgo(2.2),
    isUnread: true,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec03_2',
        filename: 'Solis-Final-Dieline-Mechanical.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5490000,
      },
    ],
  });

  // DEC-04 (Personal): Home Remodel Structural Beam Sign-Off
  addMsg({
    id: 'msg_dec04_1',
    threadId: 'thr_dec_04',
    accountId: 'acc_personal',
    fromName: 'Elena Morales',
    fromEmail: 'elena@pacificarch.studio',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Kitchen Remodel Permit Addendum: Steel Lintel Revision',
    snippet: 'City plan check came back with one clean structural note requiring a wider steel lintel over the backyard slider.',
    bodyText:
      'Alex, good news overall: city plan check cleared zoning, electrical, and plumbing with zero corrections! The single remaining structural comment asks for an upgraded W10x22 steel lintel over the 12-foot kitchen slider.\n\nOur fabricator quoted a $2,850 delta (materials + crane lift), which keeps the exact flush ceiling line you wanted with no drop soffit.\n\nElena Morales, AIA\nPacific Architectural Studio',
    sentAt: hoursAgo(15),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec04_1',
        filename: 'Structural-Addendum-S2.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1920000,
      },
    ],
  });
  addMsg({
    id: 'msg_dec04_2',
    threadId: 'thr_dec_04',
    accountId: 'acc_personal',
    fromName: 'Elena Morales',
    fromEmail: 'elena@pacificarch.studio',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Re: Kitchen Remodel Permit Addendum: Steel Lintel Revision',
    snippet: 'Need your written "Approved" on the $2,850 steel lintel change order by tomorrow 3:00 PM to upload for Thursday review.',
    bodyText:
      'Alex,\n\nFollowing up quickly: if you approve the $2,850 steel lintel change order by tomorrow at 3:00 PM, I can stamp and upload Sheet S2 before the Thursday morning city intake cutoff and keep our January demo date intact.\n\nJust reply "Approved for W10x22 flush beam" and I will handle the rest.\n\nElena',
    sentAt: hoursAgo(3.1),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // DEC-05 (Studio): Kestrel AI Launch Microsite Prototype Decision
  addMsg({
    id: 'msg_dec05_1',
    threadId: 'thr_dec_05',
    accountId: 'acc_studio',
    fromName: 'Devon Takahashi',
    fromEmail: 'devon@meridianstudio.co',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Kestrel AI Microsite: WebGL Prism Hero vs CSS Shader Call',
    snippet: 'Both staging builds are live. WebGL looks unreal on M-series Macs, while CSS shader ships Friday with 99 Lighthouse score.',
    bodyText:
      'Hey Alex,\n\nPushed both staging links for Kestrel AI\'s launch microsite ahead of Priya\'s announcement next week:\n\n- Build A (WebGL refractive prism): Cinema-grade light dispersion, runs 60fps on Apple Silicon, needs 2 extra days for mobile Safari fallback.\n- Build B (Layered CSS + SVG mesh shader): 90% of the visual magic, 99 Lighthouse performance, zero mobile risk, ready to ship Friday.\n\nWhich build should we present at Thursday\'s 2:00 PM check-in with Priya?\n\nDevon',
    sentAt: hoursAgo(4.5),
    isUnread: true,
    isOutbound: false,
    attachments: [
      {
        id: 'att_dec05_1',
        filename: 'Kestrel-Hero-Benchmark-Notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 684000,
      },
    ],
  });

  // DEC-06 (Ventures): Advisor Intro to Samira Patel (Veridian Robotics)
  addMsg({
    id: 'msg_dec06_1',
    threadId: 'thr_dec_06',
    accountId: 'acc_ventures',
    fromName: 'Daniel Park',
    fromEmail: 'dpark@summitpartners.vc',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Intro: Samira Patel (Veridian Robotics) - Series A Advisory',
    snippet: 'Samira is building warehouse manipulation models with real hardware telemetry. She wants your eyes on their GTM narrative.',
    bodyText:
      'Alex,\n\nI want to connect you with Samira Patel, co-founder and CEO of Veridian Robotics. They have 18 autonomous picking cells running live in two Midwest logistics hubs and are gearing up for a $16M Series A in January.\n\nSamira specifically asked for an intro to someone who understands both deep-tech venture framing and high-craft product storytelling. She is sending over a brief preview note directly as well.\n\nCan you send two 30-minute slots next week so I can lock the intro?\n\nBest,\nDaniel Park',
    sentAt: hoursAgo(5.8),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // DEC-07 (Personal): Winter Ski Cabin in Stowe Headcount
  addMsg({
    id: 'msg_dec07_1',
    threadId: 'thr_dec_07',
    accountId: 'acc_personal',
    fromName: 'Hannah Kim',
    fromEmail: 'hannah.kim@fastmail.com',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Stowe Ski Cabin (Jan 15-18): Arrival Time & Lift Pass Group Code',
    snippet: 'Timberline Chalet confirmed our reservation! Need everyone\'s arrival night before Friday 6 PM for the 20% lift pass discount.',
    bodyText:
      'Hey Alex!\n\nTimberline Chalet confirmed our 4-bedroom house in Stowe (Receipt #STW-9914). Everyone is super excited.\n\nTwo quick logistics before Friday 6:00 PM:\n1. Are you driving up Thursday night or Friday morning?\n2. Do you want in on the 3-day group lift pass code (saves $92 per person)?\n\nReply when you have a sec and I will lock the spreadsheet!\n\nHannah',
    sentAt: hoursAgo(6.5),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // =========================================================================
  // 2. SIX WAITING / OPEN LOOP THREADS (LINKED TO COMMITMENT RADAR!)
  // =========================================================================

  // WAIT-01 (Studio): Lumina AV Stage Lighting Quote (waiting_on_them, 4 days)
  addMsg({
    id: 'msg_wait01_1',
    threadId: 'thr_wait_01',
    accountId: 'acc_studio',
    fromName: 'Alex Chen',
    fromEmail: 'alex@meridianstudio.co',
    toEmails: ['marcus@luminaav.io'],
    subject: 'Atelier Loft Dec 10 Keynote: Revised Modular Stage Lighting Quote',
    snippet: 'Hey Marcus, can you send the revised 6-fixture directional wash quote under our $4,200 cap so we can attach to Addendum B?',
    bodyText:
      'Hey Marcus,\n\nQuick one on the stage wash lighting for the Atelier Loft keynote on December 10.\n\nCould you send over the revised itemized quote under $4,200 so I can sign off with Maya?\n\nThanks,\nAlex',
    sentAt: wait01At,
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });

  // WAIT-02 (Ventures): Q4 Portfolio KPI Rollup (waiting_on_them, 3 days)
  addMsg({
    id: 'msg_wait02_1',
    threadId: 'thr_wait_02',
    accountId: 'acc_ventures',
    fromName: 'Alex Chen',
    fromEmail: 'alex@northstarventures.io',
    toEmails: ['tessa@northstarventures.io'],
    subject: 'Q4 Portfolio KPI Rollup & LP Annual Letter Draft Figures',
    snippet: 'Tessa, checking in on the finalized net IRR and Kestrel/Veridian reserve numbers before we lock the LP memo.',
    bodyText:
      'Hi Tessa,\n\nOnce Carta\'s Q4 cap table export lands, could you share the finalized net IRR table and remaining dry powder figure so I can finish the Q4 LP letter and confirm Kestrel AI\'s $75k bridge check?\n\nBest,\nAlex',
    sentAt: wait02At,
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });

  // WAIT-03 (Studio): Solis Health MSA Redline (waiting_on_them, 5 days)
  addMsg({
    id: 'msg_wait03_1',
    threadId: 'thr_wait_03',
    accountId: 'acc_studio',
    fromName: 'Alex Chen',
    fromEmail: 'alex@meridianstudio.co',
    toEmails: ['cbennett@meridianlegal.com'],
    subject: 'Solis Health Master Services Agreement: Section 9 Indemnity Redline',
    snippet: 'Claire, sent over Solis\'s counsel comments on mutual IP indemnity. Hoping to return a clean draft this week.',
    bodyText:
      'Hi Claire,\n\nForwarding Solis Health\'s redlines on Section 9 (mutual IP indemnity and liability cap equal to fees paid). Everything else in the SOW is aligned.\n\nLet me know once you have clean markup we can return to Jordan\'s team.\n\nThanks, Alex',
    sentAt: wait03At,
    isUnread: false,
    isOutbound: true,
    attachments: [
      {
        id: 'att_wait03_1',
        filename: 'Solis-MSA-Redline-v2.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 148000,
      },
    ],
  });

  // The message where the user made the WAIT-04 promise
  addMsg({
    id: 'msg_wait04_0',
    threadId: 'thr_wait_04',
    accountId: 'acc_studio',
    fromName: 'Alex Chen',
    fromEmail: 'alex@meridianstudio.co',
    toEmails: ['owen@meridianstudio.co'],
    subject: 'Senior Motion Designer Finalists: Candidate Scorecards & Reel Notes',
    snippet: 'I will send you my scorecard notes before Thursday morning.',
    bodyText: 'Hi Owen,\n\nHappy to. I will send you my scorecard notes on Lina and Theo before Thursday morning.\n\nAlex',
    sentAt: wait04At,
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });

  // WAIT-04 (Studio): Senior Motion Designer Scorecards (you_promised, 2 days)
  addMsg({
    id: 'msg_wait04_1',
    threadId: 'thr_wait_04',
    accountId: 'acc_studio',
    fromName: 'Owen Alvarez',
    fromEmail: 'owen@meridianstudio.co',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Senior Motion Designer Finalists: Candidate Scorecards & Reel Notes',
    snippet: 'Loved both final portfolios (Lina and Theo). You mentioned sharing your written rubric notes by Thursday morning.',
    bodyText:
      'Hey Alex,\n\nBoth finalists crushed the live Cinema4D + Rive walkthrough on Friday. Lina\'s kinetic typography fits our Solis and robotics hardware stories really well, while Theo has stronger interactive shader chops.\n\nWhenever you get a moment before Thursday morning, drop your scorecard notes in the doc so we can extend an offer before competing timelines close.\n\nThanks!\nOwen',
    sentAt: wait04In,
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  // The message where the user made the WAIT-05 promise
  addMsg({
    id: 'msg_wait05_0',
    threadId: 'thr_wait_05',
    accountId: 'acc_personal',
    fromName: 'Alex Chen',
    fromEmail: 'alex.chen.home@gmail.com',
    toEmails: ['rachel@harborcpa.com'],
    subject: 'Q4 Estimated Tax Safe Harbor & Advisory Expense Summary',
    snippet: 'I will upload the K-1 summary and the receipts to your portal by Friday.',
    bodyText: 'Hi Rachel,\n\nSounds good. I will upload the K-1 summary and the AWS and Anthropic statements to your portal by Friday.\n\nAlex',
    sentAt: wait05At,
    isUnread: false,
    isOutbound: true,
    attachments: [],
  });

  // WAIT-05 (Personal): CPA Tax Voucher & K-1 Upload (you_promised, 3 days)
  addMsg({
    id: 'msg_wait05_1',
    threadId: 'thr_wait_05',
    accountId: 'acc_personal',
    fromName: 'Rachel Goldstein, CPA',
    fromEmail: 'rachel@harborcpa.com',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Q4 Estimated Tax Safe Harbor & Advisory Expense Summary',
    snippet: 'Please upload your Q3 K-1 packet plus your Studio and Ventures software receipts (AWS, Anthropic) by Friday.',
    bodyText:
      'Hi Alex,\n\nTo finalize your Q4 safe-harbor estimated payment without overpaying, please upload two items to the secure portal by Friday:\n1. Northstar Ventures Q3 K-1 summary sheet\n2. Q4 cloud & AI infrastructure receipts (AWS and Anthropic statements)\n\nOnce uploaded I will turn around the voucher amounts within 24 hours.\n\nBest,\nRachel Goldstein, CPA\nHarbor Tax Advisory',
    sentAt: wait05In,
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  // WAIT-06 (Ventures): Founder Dinner Dec 10 After Keynote (cross-account link!)
  addMsg({
    id: 'msg_wait06_1',
    threadId: 'thr_wait_06',
    accountId: 'acc_ventures',
    fromName: 'Mateo Rivera',
    fromEmail: 'mateo@northstarventures.io',
    toEmails: ['alex@northstarventures.io'],
    subject: 'SF Founder Dinner (Dec 10, 7:30 PM) - Private Room Near Atelier Loft',
    snippet: 'Booked the private dining room at Bar Sprezzatura, 6 minutes from Atelier Loft. 14 founders confirmed including Priya.',
    bodyText:
      'Alex,\n\nLocked the private room at Bar Sprezzatura for Thursday, December 10 at 7:30 PM so you can walk straight over after the Atelier Loft keynote wraps.\n\n14 portfolio founders and co-investors are confirmed, including Priya (Kestrel AI) and Daniel Park. Since your Delta flight lands Wednesday afternoon, we can do a quick walk-through Thursday morning.\n\nMateo',
    sentAt: hoursAgo(16),
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  // REF-01 (Studio): Q1 Studio Offsite Venue Shortlist
  addMsg({
    id: 'msg_ref01_1',
    threadId: 'thr_ref_01',
    accountId: 'acc_studio',
    fromName: 'Devon Takahashi',
    fromEmail: 'devon@meridianstudio.co',
    toEmails: ['alex@meridianstudio.co', 'owen@meridianstudio.co'],
    subject: 'Q1 Studio Offsite: Hudson Valley vs Sea Ranch Shortlist',
    snippet: 'Two finalists for the February retreat: Troutbeck or Sea Ranch. Which one gets your vote?',
    bodyText:
      'Team,\n\nTwo finalists for the February retreat:\nTroutbeck: easy train, fireplace library.\nSea Ranch: unreal light, but a flight.\n\nWhich one gets your vote? No rush, we pick the winner over coffee next Monday.\n\nDevon',
    sentAt: hoursAgo(26),
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  // =========================================================================
  // 3. FOUR FIRST-TIME SENDERS IN THE SCREENER
  // =========================================================================

  // SCR-01 (Ventures): Warm intro from Samira Patel
  addMsg({
    id: 'msg_scr01_1',
    threadId: 'thr_scr_01',
    accountId: 'acc_ventures',
    fromName: 'Samira Patel',
    fromEmail: 'samira@veridianrobotics.ai',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Hello from Veridian Robotics (via Daniel Park)',
    snippet: 'Daniel suggested I share our 3-minute live warehouse manipulation demo before we open our Series A data room.',
    bodyText:
      'Hi Alex,\n\nDaniel Park spoke so highly of your design-led venture perspective and your work with technical founders. I am Samira, CEO of Veridian Robotics.\n\nWe just crossed 1.2M autonomous picks in live cold-chain warehouses without human tele-op fallback. I would love to share a 2-page technical overview and get 20 minutes of your candid feedback on our Series A narrative.\n\nWarm regards,\nSamira Patel\nCo-Founder & CEO, Veridian Robotics',
    sentAt: hoursAgo(5.2),
    isUnread: true,
    isOutbound: false,
    attachments: [
      {
        id: 'att_scr01_1',
        filename: 'Veridian-Robotics-SeriesA-Teaser.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1640000,
      },
    ],
  });

  // SCR-02 (Studio): Conference keynote invitation
  addMsg({
    id: 'msg_scr02_1',
    threadId: 'thr_scr_02',
    accountId: 'acc_studio',
    fromName: 'Nadia Brooks',
    fromEmail: 'nadia@ds-summit.org',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Keynote Speaker Invitation: Design Systems Summit 2027',
    snippet: 'We would be honored to host you on the main stage in San Francisco to speak on AI-native spatial interfaces.',
    bodyText:
      'Alex,\n\nI am curating the main stage program for Design Systems Summit 2027 (March 18-19, San Francisco, 900 attendees). Your studio\'s recent essays on quiet software and spatial triage sparked huge discussion among our committee.\n\nWe would love to invite you for a 25-minute keynote with full travel, hotel, and speaker honorarium covered. Would you be open to a quick 10-minute call next week?\n\nNadia Brooks\nProgram Chair, Design Systems Summit',
    sentAt: hoursAgo(11),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // SCR-03 (Personal): High-craft newsletter first issue
  addMsg({
    id: 'msg_scr03_1',
    threadId: 'thr_scr_03',
    accountId: 'acc_personal',
    fromName: 'Craft & Type Editorial',
    fromEmail: 'dispatch@craftandtype.press',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Craft & Type #114: Optical Sizing in Dark-Mode Editorial UI',
    snippet: 'Why high-contrast serif headlines paired with crisp monospace numerals define modern desktop software.',
    bodyText:
      'Welcome to Craft & Type #114.\n\nIn this issue, we dissect how optical sizing changes when light text sits on deep obsidian surfaces. Halation makes thin strokes bloom slightly, which is why modern studio interfaces reduce white luminance to #ECEFF4 and tighten letter-spacing on serif display titles.\n\nRead the full illustrated breakdown online or archive directly to your digest feed.\n\nUnsubscribe anytime.',
    sentAt: hoursAgo(14),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // SCR-04 (Studio): Cold sales outreach
  addMsg({
    id: 'msg_scr04_1',
    threadId: 'thr_scr_04',
    accountId: 'acc_studio',
    fromName: 'Kyle Henderson',
    fromEmail: 'kyle@hyperleadscale.biz',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Quick 15-min chat about 10x outbound pipeline for Meridian Studio?',
    snippet: 'Bumping this to the top of your inbox! Our AI SDR pods book 45 qualified agency demos per month on autopilot.',
    bodyText:
      'Hey Alex,\n\nNoticed Meridian Studio is growing fast! Most creative studios leave $500k+ on the table because they rely on referrals instead of automated multi-channel cold outreach.\n\nDo you have 15 minutes Thursday at 10 AM to see how HyperLeadScale books 45 meetings/month guaranteed?\n\nCheers,\nKyle Henderson\nAccount Executive, HyperLeadScale',
    sentAt: hoursAgo(7.5),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  // =========================================================================
  // 4. SIX EDITORIAL NEWSLETTERS / FEED THREADS (+ 1 EXTRA = 7 FEED)
  // =========================================================================

  addMsg({
    id: 'msg_feed01_1',
    threadId: 'thr_feed_01',
    accountId: 'acc_personal',
    fromName: 'Stratechery Dispatch',
    fromEmail: 'ben@stratechery-digest.example',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Spatial Software and the Post-Inbox Interface',
    snippet: 'For twenty years email clients copied a 1990s spreadsheet table. Multimodal LLMs finally let software match human cognition.',
    bodyText:
      'Spatial Software and the Post-Inbox Interface\n\nFor twenty years, every major email client inherited the exact same metaphor: a reverse-chronological database table where an urgent $75,000 investment decision sits one pixel above a 15% off coffee promo.\n\nTwo structural shifts break that lock-in today:\n1. Deterministic distillation: Models can reliably extract the buried ask, deadline, and open commitment from messy multi-party prose.\n2. Multiple lenses over one datastore: Triage wants decision cards; big-picture context wants a spatial constellation map; receipts want a financial ledger.\n\nThe winners in personal productivity will not be chat boxes bolted onto legacy tables, but calm, high-craft instruments where AI quietly prepares reversible drafts and gets out of the way.',
    sentAt: hoursAgo(6),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  addMsg({
    id: 'msg_feed02_1',
    threadId: 'thr_feed_02',
    accountId: 'acc_studio',
    fromName: 'Dense Discovery',
    fromEmail: 'kai@densediscovery.example',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Dense Discovery #318: Calm Technology & Precision Micro-Tools',
    snippet: 'This week: acoustic studio lighting, local-first SQLite apps on macOS, and three independent type foundries worth bookmarking.',
    bodyText:
      'Dense Discovery #318\n\nFeatured Essay: Why Local-First Apps Feel Magically Fast\nWhen your primary data lives in local SQLite on your Mac rather than behind six cloud microservices, UI interactions drop below 16ms. Everything feels physical and grounded.\n\nWorth Exploring:\n- Instrument Serif & Plus Jakarta Sans pairing for editorial dashboards\n- Tactile dark surfaces using subtle 1px top-edge luminance instead of heavy drop shadows\n- Architectural hardware inspiration from Dieter Rams and Teenage Engineering',
    sentAt: hoursAgo(19),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  addMsg({
    id: 'msg_feed03_1',
    threadId: 'thr_feed_03',
    accountId: 'acc_ventures',
    fromName: 'StrictlyVC Brief',
    fromEmail: 'briefing@strictlyvc.example',
    toEmails: ['alex@northstarventures.io'],
    subject: 'StrictlyVC Morning Brief: Applied AI Seed Extensions Accelerate',
    snippet: 'Inside Q4 deal flow: vertical AI startups passing $1M ARR are raising preempted bridge rounds in under 10 days.',
    bodyText:
      'StrictlyVC Morning Brief\n\nTop Story: Applied AI Seed Extensions\nFounders crossing $1M ARR with lean teams of under 12 engineers are skipping traditional multi-month Series A roadshows in favor of fast $2M-$4M insider extensions at $20M-$30M post-money caps.\n\nAlso Watching:\n- Autonomous warehouse robotics deployments up 64% YoY across Midwest cold-chain operators\n- Sovereign inference clusters driving fresh demand for custom compiler tooling\n- LP liquidity returning selectively via structured secondaries',
    sentAt: hoursAgo(8.5),
    isUnread: true,
    isOutbound: false,
    attachments: [],
  });

  addMsg({
    id: 'msg_feed04_1',
    threadId: 'thr_feed_04',
    accountId: 'acc_studio',
    fromName: 'Linear Method Notes',
    fromEmail: 'notes@linear-method.example',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Crafting Keyboard-First Flows Without Alienating Mouse Users',
    snippet: 'How command palettes, subtle keycap hints, and zero-latency optimistic updates elevate daily tools into instruments.',
    bodyText:
      'Linear Method Notes: Issue 42\n\nGreat keyboard navigation should never require memorizing an obscure manual. Pair every primary lens and action with a quiet monospace badge (1-4, Cmd+K, E to archive, H to snooze) so power habits form organically over a user\'s first week.\n\nMost importantly, every destructive or bulk action must be reversible in one click with an unmistakable undo toast.',
    sentAt: hoursAgo(32),
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  addMsg({
    id: 'msg_feed05_1',
    threadId: 'thr_feed_05',
    accountId: 'acc_personal',
    fromName: 'Architectural Review Dispatch',
    fromEmail: 'dispatch@archreview.example',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Adaptive Reuse: Daylight, Flush Steel Lintels & Warm Timber',
    snippet: 'A quiet residential renovation study showing how eliminating drop soffits doubles perceived ceiling height in narrow townhomes.',
    bodyText:
      'Architectural Review Weekend Dispatch\n\nCase Study: Flush Structural Steel in Residential Renovations\nBy recessing a wide-flange steel beam directly into the joist cavity above a full-width rear glass slider, architects preserve an unbroken plaster ceiling plane from kitchen island straight out to the garden terrace.\n\nThe modest structural steel premium pays dividends every hour in natural daylight and spatial calm.',
    sentAt: hoursAgo(44),
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  addMsg({
    id: 'msg_feed06_1',
    threadId: 'thr_feed_06',
    accountId: 'acc_ventures',
    fromName: 'Silicon Weekly',
    fromEmail: 'editor@siliconweekly.example',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Silicon Weekly: Latency Budgets for Real-Time Edge Robotics',
    snippet: 'Sub-25ms closed-loop vision-action inference is moving from lab demos onto commercial factory floors.',
    bodyText:
      'Silicon Weekly #89\n\nHighlights:\n- Quantized vision-language-action policies now run comfortably on dual-Orin industrial nodes under 22ms end-to-end latency.\n- Hardware startups pairing proprietary tactile sensor logs with foundation models are building durable data moats that generic software cannot copy.',
    sentAt: hoursAgo(52),
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  addMsg({
    id: 'msg_ref03_1',
    threadId: 'thr_ref_03',
    accountId: 'acc_personal',
    fromName: 'Apple Developer Digest',
    fromEmail: 'news@developer-updates.example',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'macOS Human Interface Notes: Vibrancy, Depth & Dark Surfaces',
    snippet: 'Updated guidance on translucent sidebars, crisp hairline strokes, and restrained accent colors on Retina displays.',
    bodyText:
      'Apple Developer Design Notes\n\nOn high-DPI macOS displays, reserve saturated color for meaningful identity markers (account badges, urgency signals, active selections) while letting canvas and surface hierarchy rely on subtle stepped luminance and hairline borders.',
    sentAt: hoursAgo(62),
    isUnread: false,
    isOutbound: false,
    attachments: [],
  });

  // =========================================================================
  // 5. NINE PAPER TRAIL / RECEIPTS, INVOICES & TRAVEL THREADS
  // =========================================================================

  addMsg({
    id: 'msg_rec01_1',
    threadId: 'thr_rec_01',
    accountId: 'acc_studio',
    fromName: 'Amazon Web Services',
    fromEmail: 'billing@aws-notifications.example',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'AWS Monthly Cloud Infrastructure Invoice #AWS-2026-1142 ($1,850.00)',
    snippet: 'Your November AWS statement for Meridian Studio production clusters is ready. Total charged: $1,850.00 USD.',
    bodyText:
      'Amazon Web Services Billing Statement\n\nInvoice Number: AWS-2026-1142\nBilling Period: Oct 1 - Oct 31, 2026\nAccount: Meridian Studio Production\nTotal Amount Charged: $1,850.00 USD\n\nBreakdown:\n- EC2 & EKS Staging/Preview Nodes: $1,120.00\n- CloudFront Asset CDN: $410.00\n- S3 + RDS Automated Backups: $320.00\n\nPDF invoice attached for bookkeeping and CPA records.',
    sentAt: hoursAgo(10),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec01_1',
        filename: 'AWS-Invoice-2026-1142.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 245000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec02_1',
    threadId: 'thr_rec_02',
    accountId: 'acc_personal',
    fromName: 'Delta Air Lines',
    fromEmail: 'confirmations@delta-air.example',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Flight Confirmation DL-8K49MP: JFK to SFO (Dec 9 - Dec 13)',
    snippet: 'Confirmed! Nonstop JFK -> SFO departing Dec 9 at 1:15 PM (Seat 4A). Total paid: $628.40 USD.',
    bodyText:
      'Delta Air Lines E-Ticket & Itinerary\n\nConfirmation Code: DL-8K49MP\nPassenger: Alex Chen\nTotal Charged: $628.40 USD\n\nOutbound: Wed Dec 9 | DL 402 | New York (JFK) 1:15 PM -> San Francisco (SFO) 4:48 PM | Seat 4A\nReturn: Sun Dec 13 | DL 419 | San Francisco (SFO) 11:30 AM -> New York (JFK) 8:10 PM | Seat 5C\n\nOnline check-in opens 24 hours before each flight in the Fly Delta app.',
    sentAt: hoursAgo(20),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec02_1',
        filename: 'Delta-Itinerary-DL8K49MP.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 312000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec03_1',
    threadId: 'thr_rec_03',
    accountId: 'acc_ventures',
    fromName: 'Anthropic Billing',
    fromEmail: 'billing@anthropic-receipts.example',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Anthropic API Receipt #ANT-904821 ($142.00)',
    snippet: 'Payment received for Northstar Ventures research & diligence workspace: $142.00 USD.',
    bodyText:
      'Anthropic PBC - Payment Receipt\n\nReceipt Number: ANT-904821\nWorkspace: Northstar Ventures Diligence\nTotal Paid: $142.00 USD\nModels Used: Claude Sonnet 4 & Claude Opus 4 API tokens\nPayment Method: Visa ending in 4821\n\nThank you for building with Claude.',
    sentAt: hoursAgo(27),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec03_1',
        filename: 'Anthropic-Receipt-ANT904821.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec04_1',
    threadId: 'thr_rec_04',
    accountId: 'acc_studio',
    fromName: 'Figma Billing',
    fromEmail: 'billing@figma-receipts.example',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Figma Organization Monthly Receipt #FG-77219 ($49.00)',
    snippet: 'Your monthly Figma Dev Mode & Design seat add-on receipt for $49.00 USD is attached.',
    bodyText:
      'Figma, Inc. Receipt\n\nInvoice Number: FG-77219\nPlan: Organization Add-on Seat\nAmount Paid: $49.00 USD\nStatus: Paid in full\n\nAttached PDF receipt for Meridian Studio accounting.',
    sentAt: hoursAgo(34),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec04_1',
        filename: 'Figma-Receipt-FG77219.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 94000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec05_1',
    threadId: 'thr_rec_05',
    accountId: 'acc_personal',
    fromName: 'Pacific Architectural Studio',
    fromEmail: 'billing@pacificarch.studio',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Invoice #PAS-408: Permit Submission Milestone ($3,400.00)',
    snippet: 'Thank you for your ACH payment for Milestone 2 architectural drawings and city plan check submission.',
    bodyText:
      'Pacific Architectural Studio\n\nInvoice Number: PAS-408\nProject: Residential Kitchen & Rear Terrace Remodel\nMilestone: Permit Set & Structural Coordination\nTotal Paid: $3,400.00 USD\nStatus: Paid via ACH\n\nNote: Structural steel lintel addendum (if approved) will be billed separately with fabricator.',
    sentAt: hoursAgo(56),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec05_1',
        filename: 'PacificArch-Invoice-PAS408.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 210000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec06_1',
    threadId: 'thr_rec_06',
    accountId: 'acc_personal',
    fromName: 'Timberline Chalet Stowe',
    fromEmail: 'reservations@timberlinestowe.example',
    toEmails: ['alex.chen.home@gmail.com'],
    subject: 'Reservation Receipt #STW-9914: Stowe Timberline Chalet ($1,240.00)',
    snippet: 'Deposit received for Jan 15-18 mountain chalet stay in Stowe, VT. Your share recorded: $1,240.00.',
    bodyText:
      'Timberline Chalet Stowe - Reservation Confirmation\n\nBooking Reference: STW-9914\nCheck-in: Fri Jan 15, 4:00 PM | Check-out: Mon Jan 18, 11:00 AM\nGroup Lead: Hannah Kim & Alex Chen\nDeposit Paid: $1,240.00 USD\n\nKeypad check-in code will be sent 48 hours prior to arrival.',
    sentAt: hoursAgo(64),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec06_1',
        filename: 'Stowe-Chalet-Receipt-STW9914.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 185000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec07_1',
    threadId: 'thr_rec_07',
    accountId: 'acc_studio',
    fromName: 'Linear Billing',
    fromEmail: 'receipts@linear-billing.example',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Linear Workspace Renewal Receipt #LIN-55102 ($288.00)',
    snippet: 'Your Meridian Studio Linear Plus workspace renewed cleanly for $288.00 USD.',
    bodyText:
      'Linear Orbit, Inc.\n\nReceipt Number: LIN-55102\nWorkspace: Meridian Studio (3 seats, annual)\nAmount Paid: $288.00 USD\nStatus: Paid\n\nPDF receipt attached.',
    sentAt: hoursAgo(78),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec07_1',
        filename: 'Linear-Receipt-LIN55102.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 86000,
      },
    ],
  });

  addMsg({
    id: 'msg_rec08_1',
    threadId: 'thr_rec_08',
    accountId: 'acc_studio',
    fromName: 'Monotype Foundry',
    fromEmail: 'orders@monotype-store.example',
    toEmails: ['alex@meridianstudio.co'],
    subject: 'Commercial Font License Confirmation #MT-20918 ($420.00)',
    snippet: 'Commercial print & web font license issued for Solis Health packaging (50k units + 500k monthly pageviews).',
    bodyText:
      'Monotype Foundry - Commercial License Certificate\n\nOrder Number: MT-20918\nLicensee: Meridian Studio (for Client: Solis Health)\nTypeface Family: Editorial Display Serif Pro (5 weights)\nTotal Paid: $420.00 USD\n\nLicense PDF and WOFF2/OTF archive certificate attached.',
    sentAt: hoursAgo(29),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_rec08_1',
        filename: 'Monotype-License-MT20918.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 342000,
      },
    ],
  });

  addMsg({
    id: 'msg_ref02_1',
    threadId: 'thr_ref_02',
    accountId: 'acc_ventures',
    fromName: 'Carta Fund Admin',
    fromEmail: 'notifications@carta-admin.example',
    toEmails: ['alex@northstarventures.io'],
    subject: 'Carta Q4 Cap Table Export & Admin Statement #CRT-88412 ($350.00)',
    snippet: 'Your Q4 fund administration export and updated portfolio ownership ledger are ready for LP reporting.',
    bodyText:
      'Carta Fund Administration\n\nStatement Number: CRT-88412\nEntity: Northstar Ventures Advisory SPV\nQuarterly Admin Fee: $350.00 USD (Paid)\n\nAttached: Q4 Portfolio Cap Table Export (includes Kestrel AI and active advisory equity positions).',
    sentAt: hoursAgo(42),
    isUnread: false,
    isOutbound: false,
    attachments: [
      {
        id: 'att_ref02_1',
        filename: 'Northstar-Q4-CapTable-Export.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512000,
      },
    ],
  });

  // =========================================================================
  // ASSEMBLE THREADS WITH RICH INTELLIGENCE & CROSS-ACCOUNT LINKS
  // =========================================================================

  const threads: EmailThread[] = [
    // --- 7 HIGH-STAKES DECISIONS ---
    {
      id: 'thr_dec_00',
      ...meta('acc_personal'),
      subject: "Dad's 70th: dinner on Sunday?",
      snippet: "Surprise dinner at Lucia's on Sunday at 6 for Dad's 70th. Can you make it? I need a headcount by 6 tonight.",
      participants: [
        { name: 'Maya Chen', email: 'maya.chen@fastmail.com' },
        { name: 'Alex Chen', email: 'alex.chen.home@gmail.com' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(1),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Family'],
      bucket: 'decision',
      urgencyScore: 91,
      distilledAsk: 'Tell Maya if you can make dinner Sunday',
      goalQuote: 'Can you make it? I have to give them a headcount by 6 tonight.',
      aiSummaryBullets: [
        "Dinner is Sunday at 6 at Lucia's for Dad's 70th.",
        'Maya needs a headcount by 6 tonight.',
      ],
      deadlineAt: onDay(11, 24, 18),
      deadlineLabel: 'Today 6:00 PM',
      quickActions: [
        {
          id: 'qa_dec00_1',
          label: "Yes, I'll be there",
          kind: 'reply',
          draftHint: "Tell Maya you will be at Lucia's on Sunday at 6",
          draftBody: "Hi Maya,\n\nCount me in for Sunday at 6. See you at Lucia's.\n\nAlex",
        },
        {
          id: 'qa_dec00_2',
          label: "Sorry, I can't make it",
          kind: 'reply',
          draftHint: "Tell Maya you can't make it on Sunday",
          draftBody: "Hi Maya,\n\nI can't make it on Sunday. Give Dad a hug from me, and I'll call him that morning.\n\nAlex",
        },
      ],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_00b',
      ...meta('acc_personal'),
      subject: 'Thanks for Sunday',
      snippet: 'Thank you for giving up your Sunday to help us move. Dinner is on us once the boxes are unpacked.',
      participants: [
        { name: 'Sam Ortiz', email: 'sam.ortiz@icloud.com' },
        { name: 'Alex Chen', email: 'alex.chen.home@gmail.com' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(1.5),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Friends'],
      bucket: 'decision',
      urgencyScore: 90,
      distilledAsk: 'Nothing to do. Sam says thanks for Sunday.',
      goalQuote: 'No need to reply, I just wanted to say thanks.',
      aiSummaryBullets: ['Sam thanks you for helping with the move on Sunday.', 'No reply is needed.'],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_01',
      ...meta('acc_studio'),
      subject: 'Atelier Loft Keynote Venue: Addendum B & AV Rider',
      snippet: 'Confirmed no union surcharge under 6 fixtures. Need your sign-off on Addendum B before 4:00 PM today to release backup hold.',
      participants: [
        { name: 'Maya Lindholm', email: 'maya@atelierloft.co' },
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
      ],
      messageCount: 3,
      lastMessageAt: hoursAgo(1.4),
      isUnread: true,
      isStarred: true,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Keynote', 'Contract', 'San Francisco'],
      bucket: 'decision',
      urgencyScore: 96,
      distilledAsk: 'Approve Addendum B and the $4,200 cap',
      goalQuote: 'Could you confirm the $4,200 AV lighting cap and reply with approval on Addendum B by 4:00 PM today',
      aiSummaryBullets: [
        'The venue holds a backup booking for Dec 10.',
        'Sign by 4 PM today or lose the date.',
      ],
      deadlineAt: onDay(11, 24, 16),
      deadlineLabel: 'Today 4:00 PM',
      quickActions: [
        {
          id: 'qa_dec01_1',
          label: 'Approve Addendum B',
          kind: 'approve',
          draftHint: 'Approve Addendum B with the $4,200 AV lighting cap',
          draftBody: 'Hi Maya,\n\nI approve Addendum B with the $4,200 AV lighting cap. Please lock the main gallery for Dec 10 and release the backup bidder.\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec01_2',
          label: 'Approve, add dinner access',
          kind: 'reply',
          draftHint: 'Approve Addendum B and take the dinner drop-off access Maya offered',
          draftBody: 'Hi Maya,\n\nI approve Addendum B with the $4,200 AV lighting cap. Yes please to the dinner drop-off access you mentioned. Please lock the main gallery for Dec 10.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_rec_02', 'thr_wait_06', 'thr_wait_01'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_02',
      ...meta('acc_ventures'),
      subject: 'Kestrel AI Seed Bridge: Pro-Rata Allocation & Closing Packet',
      snippet: 'Cooley is finalizing the closing packet at 5:30 PM today. Confirm full $75,000 pro-rata allocation on the $24M post-money SAFE.',
      participants: [
        { name: 'Priya Subramanian', email: 'priya@kestrelai.dev' },
        { name: 'Alex Chen', email: 'alex@northstarventures.io' },
      ],
      messageCount: 3,
      lastMessageAt: hoursAgo(0.8),
      isUnread: true,
      isStarred: true,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Investment', 'SAFE', 'Kestrel AI'],
      bucket: 'decision',
      urgencyScore: 93,
      distilledAsk: 'Choose full $75k, partial or pass',
      goalQuote: 'Please reply with "Full $75k", a partial amount, or "Pass" before 5:30 PM today',
      aiSummaryBullets: [
        'Kestrel AI is raising more than it planned.',
        'Say yes, partial, or pass by 5:30 PM.',
      ],
      deadlineAt: onDay(11, 24, 17, 30),
      deadlineLabel: 'Today 5:30 PM',
      quickActions: [
        {
          id: 'qa_dec02_1',
          label: 'Confirm full $75k',
          kind: 'approve',
          draftHint: 'Confirm Northstar Ventures is taking the full $75,000 pro-rata allocation',
          draftBody: 'Hi Priya,\n\nWe are taking the full $75,000 pro-rata allocation on the $24M post-money SAFE. Please keep our slot in the signature packet before the 5:30 PM lock.\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec02_2',
          label: 'Ask for more time',
          kind: 'reply',
          draftHint: 'Ask Priya if counsel can hold the slot while I confirm Q4 reserve liquidity with Tessa',
          draftBody: 'Hi Priya,\n\nI am still confirming Q4 reserve liquidity with Tessa. Can counsel hold our slot until [the time you need]? If that is not possible, tell me today.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_05', 'thr_wait_02', 'thr_wait_06'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_03',
      ...meta('acc_studio'),
      subject: 'Solis Health: Packaging Press Proof & Serif Lockup',
      snippet: 'Printer needs final mechanical sign-off by tomorrow noon to hold our November press slot. Ready to greenlight Option B?',
      participants: [
        { name: 'Jordan Okafor', email: 'jordan@solishealth.com' },
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
      ],
      messageCount: 3,
      lastMessageAt: hoursAgo(2.2),
      isUnread: true,
      isStarred: true,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Client', 'Solis Health', 'Print'],
      bucket: 'decision',
      urgencyScore: 89,
      distilledAsk: 'Approve Option B on the packaging proof',
      goalQuote: 'Can you review the updated die-line PDF attached and reply to greenlight Option B?',
      aiSummaryBullets: [
        'Leadership picked Option B.',
        'Miss noon tomorrow and printing slips two weeks.',
      ],
      deadlineAt: onDay(11, 25, 12),
      deadlineLabel: 'Tomorrow noon',
      quickActions: [
        {
          id: 'qa_dec03_1',
          label: 'Approve Option B',
          kind: 'approve',
          draftHint: 'Approve Option B and the updated die-line for the November press run',
          draftBody: 'Hi Jordan,\n\nI approve Option B and the updated die-line for the November press run. Please go ahead before tomorrow\'s noon cutoff.\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec03_2',
          label: 'Ask for a change',
          kind: 'reply',
          draftHint: 'Ask for a change to the die-line before approving',
          draftBody: 'Hi Jordan,\n\nBefore I approve Option B, I need one change to the die-line: [the change you need]. Can you send a corrected PDF before tomorrow\'s noon cutoff?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_rec_08', 'thr_wait_03'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_04',
      ...meta('acc_personal'),
      subject: 'Kitchen Remodel Permit Addendum: Steel Lintel Revision',
      snippet: 'Need your written "Approved" on the $2,850 steel lintel change order by tomorrow 3:00 PM to upload for Thursday review.',
      participants: [
        { name: 'Elena Morales', email: 'elena@pacificarch.studio' },
        { name: 'Alex Chen', email: 'alex.chen.home@gmail.com' },
      ],
      messageCount: 2,
      lastMessageAt: hoursAgo(3.1),
      isUnread: true,
      isStarred: true,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Home', 'Remodel', 'Contract'],
      bucket: 'decision',
      urgencyScore: 86,
      distilledAsk: 'Approve the $2,850 kitchen change order',
      goalQuote: 'if you approve the $2,850 steel lintel change order by tomorrow at 3:00 PM',
      aiSummaryBullets: [
        'The city cleared everything except one beam.',
        'The upgrade costs $2,850 more.',
      ],
      deadlineAt: onDay(11, 25, 15),
      deadlineLabel: 'Tomorrow 3:00 PM',
      quickActions: [
        {
          id: 'qa_dec04_1',
          label: 'Approve the $2,850 lintel',
          kind: 'approve',
          draftHint: 'Reply Approved for the W10x22 flush beam at $2,850',
          draftBody: 'Hi Elena,\n\nApproved for W10x22 flush beam. Please go ahead with the $2,850 steel lintel change order and upload Sheet S2 before Thursday morning\'s city intake cutoff.\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec04_2',
          label: 'Approve, ask lead time',
          kind: 'reply',
          draftHint: 'Approve the flush beam and ask whether steel lead time affects the January demo date',
          draftBody: 'Hi Elena,\n\nApproved for W10x22 flush beam at $2,850. Does steel fabrication lead time affect the January demo date?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_rec_05', 'thr_feed_05'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_05',
      ...meta('acc_studio'),
      subject: 'Kestrel AI Microsite: WebGL Prism Hero vs CSS Shader Call',
      snippet: 'Both staging builds are live. Decide between WebGL prism hero (+2 days mobile fallback) or CSS shader hero (ships Friday).',
      participants: [
        { name: 'Devon Takahashi', email: 'devon@meridianstudio.co' },
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(4.5),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Client', 'Kestrel AI', 'Engineering'],
      bucket: 'decision',
      urgencyScore: 73,
      distilledAsk: 'Pick which version to present Thursday',
      goalQuote: 'Which build should we present at Thursday\'s 2:00 PM check-in with Priya?',
      aiSummaryBullets: [
        'Build B ships Friday and works on every phone.',
        'Build A looks better but needs two more days.',
      ],
      deadlineAt: onDay(11, 26, 14),
      deadlineLabel: 'Thu 2:00 PM',
      quickActions: [
        {
          id: 'qa_dec05_1',
          label: 'Go with Build B',
          kind: 'approve',
          draftHint: 'Go with Build B, the CSS shader, to ship Friday',
          draftBody: 'Hi Devon,\n\nLet\'s go with Build B, the CSS shader. It ships Friday and has zero mobile risk.\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec05_2',
          label: 'Go with Build A',
          kind: 'reply',
          draftHint: 'Go with Build A, the WebGL prism',
          draftBody: 'Hi Devon,\n\nLet\'s go with Build A, the WebGL prism, at Thursday\'s 2:00 PM check-in with Priya. I know it needs 2 extra days for the mobile Safari fallback.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_02'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_06',
      ...meta('acc_ventures'),
      subject: 'Intro: Samira Patel (Veridian Robotics) - Series A Advisory',
      snippet: 'Daniel wants two 30-minute windows next week to introduce Samira Patel before she opens Veridian\'s $16M Series A data room.',
      participants: [
        { name: 'Daniel Park', email: 'dpark@summitpartners.vc' },
        { name: 'Alex Chen', email: 'alex@northstarventures.io' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(5.8),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Warm Intro', 'Robotics', 'Advisory'],
      bucket: 'decision',
      urgencyScore: 79,
      distilledAsk: 'Send Daniel two times to meet next week',
      goalQuote: 'Can you send two 30-minute slots next week so I can lock the intro?',
      aiSummaryBullets: [
        'Daniel wants to introduce you to Samira.',
        'She is raising a $16M round in January.',
      ],
      deadlineAt: onDay(11, 27, 11),
      deadlineLabel: 'Fri 11:00 AM',
      quickActions: [
        {
          id: 'qa_dec06_1',
          label: 'Offer two times',
          kind: 'schedule',
          draftHint: 'Offer Daniel two 30-minute slots next week for Samira',
          draftBody: 'Hi Daniel,\n\nHappy to meet Samira. I can do 30 minutes next week: [first time] or [second time].\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec06_2',
          label: 'Send times later',
          kind: 'reply',
          draftHint: 'Tell Daniel I will send two 30-minute slots for next week by a day I choose',
          draftBody: 'Hi Daniel,\n\nHappy to meet Samira. I will send you two 30-minute slots for next week by [day].\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_scr_01', 'thr_wait_04'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_dec_07',
      ...meta('acc_personal'),
      subject: 'Stowe Ski Cabin (Jan 15-18): Arrival Time & Lift Pass Group Code',
      snippet: 'Confirm Thursday night vs Friday morning arrival and whether you want the 3-day group lift pass discount before Friday 6 PM.',
      participants: [
        { name: 'Hannah Kim', email: 'hannah.kim@fastmail.com' },
        { name: 'Alex Chen', email: 'alex.chen.home@gmail.com' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(6.5),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Travel', 'Friends', 'Stowe'],
      bucket: 'decision',
      urgencyScore: 82,
      distilledAsk: 'Pick your arrival and lift pass',
      goalQuote: 'Are you driving up Thursday night or Friday morning?',
      aiSummaryBullets: [
        'The chalet is booked for Jan 15 to 18.',
        'Hannah needs answers by Friday evening.',
      ],
      deadlineAt: onDay(11, 27, 18),
      deadlineLabel: 'Fri 6:00 PM',
      quickActions: [
        {
          id: 'qa_dec07_1',
          label: 'Thursday night, with lift pass',
          kind: 'reply',
          draftHint: 'Confirm Thursday night arrival and the 3-day group lift pass',
          draftBody: 'Hi Hannah,\n\nI am driving up Thursday night, and I am in for the 3-day group lift pass.\n\nBest,\nAlex',
        },
        {
          id: 'qa_dec07_2',
          label: 'Arrive Friday morning',
          kind: 'reply',
          draftHint: 'Confirm Friday morning arrival and ask about the lift pass',
          draftBody: 'Hi Hannah,\n\nI am driving up Friday morning instead of Thursday night. For the 3-day group lift pass: [in or out].\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_rec_06'],
      senderTrust: 'approved',
    },

    // --- 7 WAITING / OPEN LOOP THREADS ---
    {
      id: 'thr_wait_01',
      ...meta('acc_studio'),
      subject: 'Atelier Loft Dec 10 Keynote: Revised Modular Stage Lighting Quote',
      snippet: 'Waiting on Marcus Reid (Lumina AV) for the itemized 6-fixture stage wash quote under $4,200.',
      participants: [
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
        { name: 'Marcus Reid', email: 'marcus@luminaav.io' },
      ],
      messageCount: 1,
      lastMessageAt: wait01At,
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Keynote', 'Vendor'],
      bucket: 'waiting',
      urgencyScore: 72,
      distilledAsk: 'Remind Marcus about the itemized quote',
      goalQuote: 'Could you send over the revised itemized quote under $4,200 so I can sign off with Maya?',
      aiSummaryBullets: [
        'You need it to finish the venue addendum.',
        'No reply in four days.',
      ],
      deadlineAt: null,
      deadlineLabel: 'Waiting 4 days',
      quickActions: [
        {
          id: 'qa_wait01_1',
          label: 'Remind Marcus about the quote',
          kind: 'nudge',
          draftHint: 'Nudge Marcus for the revised itemized quote under $4,200',
          draftBody: 'Hi Marcus,\n\nA quick follow-up on the revised itemized quote under $4,200. I need it to sign off with Maya. Could you send it over?\n\nBest,\nAlex',
        },
        {
          id: 'qa_wait01_2',
          label: 'Offer a call',
          kind: 'reply',
          draftHint: 'Ask Marcus for a short call about the lighting quote',
          draftBody: 'Hi Marcus,\n\nI have not seen the revised lighting quote yet. Do you have time for a short call on [day and time] to go through it?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_01', 'thr_rec_02'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_wait_02',
      ...meta('acc_ventures'),
      subject: 'Q4 Portfolio KPI Rollup & LP Annual Letter Draft Figures',
      snippet: 'Waiting on Tessa Holloway for finalized net IRR and reserve liquidity numbers ahead of the Kestrel AI bridge.',
      participants: [
        { name: 'Alex Chen', email: 'alex@northstarventures.io' },
        { name: 'Tessa Holloway', email: 'tessa@northstarventures.io' },
      ],
      messageCount: 1,
      lastMessageAt: wait02At,
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['LP Reporting', 'Finance'],
      bucket: 'waiting',
      urgencyScore: 68,
      distilledAsk: 'Remind Tessa about the net IRR table',
      goalQuote: 'could you share the finalized net IRR table and remaining dry powder figure',
      aiSummaryBullets: [
        'The data she needed has arrived.',
        'It decides today\'s $75,000 investment.',
      ],
      deadlineAt: null,
      deadlineLabel: 'Waiting 4 days',
      quickActions: [
        {
          id: 'qa_wait02_1',
          label: 'Remind Tessa',
          kind: 'nudge',
          draftHint: 'Nudge Tessa for the net IRR table and the dry powder figure',
          draftBody: 'Hi Tessa,\n\nA quick follow-up: could you send the finalized net IRR table and the remaining dry powder figure? I need them to finish the Q4 LP letter and confirm Kestrel AI\'s $75k bridge check.\n\nBest,\nAlex',
        },
        {
          id: 'qa_wait02_2',
          label: 'Ask for dry powder first',
          kind: 'reply',
          draftHint: 'Ask Tessa to send just the remaining dry powder figure first',
          draftBody: 'Hi Tessa,\n\nIf the full IRR table will take longer, could you send just the remaining dry powder figure first? I need it to confirm Kestrel AI\'s $75k bridge check.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_02', 'thr_ref_02'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_wait_03',
      ...meta('acc_studio'),
      subject: 'Solis Health Master Services Agreement: Section 9 Indemnity Redline',
      snippet: 'Waiting 5 days on Claire Bennett (Meridian Legal) to return clean Section 9 IP indemnity markup.',
      participants: [
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
        { name: 'Claire Bennett', email: 'cbennett@meridianlegal.com' },
      ],
      messageCount: 1,
      lastMessageAt: wait03At,
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Legal', 'Contract', 'Solis Health'],
      bucket: 'waiting',
      urgencyScore: 65,
      distilledAsk: 'Remind Claire about the clean markup',
      goalQuote: 'Let me know once you have clean markup we can return to Jordan\'s team.',
      aiSummaryBullets: [
        'All terms are already agreed.',
        'Printing starts this week.',
      ],
      deadlineAt: null,
      deadlineLabel: 'Waiting 5 days',
      quickActions: [
        {
          id: 'qa_wait03_1',
          label: 'Remind Claire',
          kind: 'nudge',
          draftHint: 'Nudge Claire for the clean markup of the Section 9 redline',
          draftBody: 'Hi Claire,\n\nChecking in on the clean markup for Solis Health\'s Section 9 redline. Could you send it when it is ready so I can return it to Jordan\'s team?\n\nBest,\nAlex',
        },
        {
          id: 'qa_wait03_2',
          label: 'Offer a quick call',
          kind: 'reply',
          draftHint: 'Offer Claire a short call to walk through Section 9',
          draftBody: 'Hi Claire,\n\nIf it would help, I can walk through the Section 9 redline with you on a short call. Everything else in the SOW is aligned.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_03'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_wait_04',
      ...meta('acc_studio'),
      subject: 'Senior Motion Designer Finalists: Candidate Scorecards & Reel Notes',
      snippet: 'You promised Owen Alvarez your written scorecard notes on Lina and Theo before Thursday morning.',
      participants: [
        { name: 'Owen Alvarez', email: 'owen@meridianstudio.co' },
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
      ],
      messageCount: 2,
      lastMessageAt: wait04At,
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Hiring', 'Team'],
      bucket: 'waiting',
      urgencyScore: 61,
      distilledAsk: 'Add your scorecard notes to the doc',
      goalQuote: 'drop your scorecard notes in the doc so we can extend an offer before competing timelines close.',
      aiSummaryBullets: [
        'Owen wants to make an offer this week.',
        'Lina is strong on type, Theo on shaders.',
      ],
      deadlineAt: onDay(11, 26, 9),
      deadlineLabel: 'Due Thursday morning',
      quickActions: [
        {
          id: 'qa_wait04_1',
          label: 'Send scorecard notes',
          kind: 'reply',
          draftHint: 'Send Owen the scorecard notes for Lina and Theo',
          draftBody: 'Hi Owen,\n\nHere are my scorecard notes. Lina: [your notes on Lina]. Theo: [your notes on Theo].\n\nBest,\nAlex',
        },
        {
          id: 'qa_wait04_2',
          label: 'Ask for more time',
          kind: 'reply',
          draftHint: 'Ask Owen for more time on the scorecard notes',
          draftBody: 'Hi Owen,\n\nI need a little more time on the scorecard notes. Can I add them to the doc by [day and time] instead of Thursday morning?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_06'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_wait_05',
      ...meta('acc_personal'),
      subject: 'Q4 Estimated Tax Safe Harbor & Advisory Expense Summary',
      snippet: 'You promised Rachel Goldstein CPA your Q3 K-1 packet and Q4 cloud/AI receipts (AWS, Anthropic) by Friday.',
      participants: [
        { name: 'Rachel Goldstein, CPA', email: 'rachel@harborcpa.com' },
        { name: 'Alex Chen', email: 'alex.chen.home@gmail.com' },
      ],
      messageCount: 2,
      lastMessageAt: wait05At,
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Taxes', 'Finance'],
      bucket: 'waiting',
      urgencyScore: 58,
      distilledAsk: 'Upload two items to the portal by Friday',
      goalQuote: 'please upload two items to the secure portal by Friday',
      aiSummaryBullets: [
        'Your receipts are already saved.',
        'Rachel returns vouchers within a day.',
      ],
      deadlineAt: onDay(11, 27, 17),
      deadlineLabel: 'Due Friday',
      quickActions: [
        {
          id: 'qa_wait05_1',
          label: 'Confirm the upload',
          kind: 'reply',
          draftHint: 'Tell Rachel the K-1 summary and the AWS and Anthropic statements will be uploaded by Friday',
          draftBody: 'Hi Rachel,\n\nI will upload the Northstar Ventures Q3 K-1 summary sheet and the AWS and Anthropic statements to the secure portal by Friday.\n\nBest,\nAlex',
        },
        {
          id: 'qa_wait05_2',
          label: 'Ask what to include',
          kind: 'reply',
          draftHint: 'Ask Rachel which AWS and Anthropic statements to include',
          draftBody: 'Hi Rachel,\n\nBefore I upload, can you confirm which AWS and Anthropic statements you need? I will send them as soon as I hear back.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_rec_01', 'thr_rec_03'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_wait_06',
      ...meta('acc_ventures'),
      subject: 'SF Founder Dinner (Dec 10, 7:30 PM) - Private Room Near Atelier Loft',
      snippet: 'Private room confirmed at Bar Sprezzatura, 6 min walk from Atelier Loft. 14 founders confirmed including Priya.',
      participants: [
        { name: 'Mateo Rivera', email: 'mateo@northstarventures.io' },
        { name: 'Alex Chen', email: 'alex@northstarventures.io' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(16),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['San Francisco', 'Keynote', 'Events'],
      bucket: 'waiting',
      urgencyScore: 75,
      distilledAsk: 'Confirm the Thursday walk-through',
      goalQuote: 'we can do a quick walk-through Thursday morning.',
      aiSummaryBullets: [
        'The dinner room is minutes from the keynote.',
        'Priya and Daniel are both coming.',
      ],
      deadlineAt: null,
      deadlineLabel: 'Dec 10',
      quickActions: [
        {
          id: 'qa_wait06_1',
          label: 'Confirm walk-through',
          kind: 'reply',
          draftHint: 'Thank Mateo and confirm the Thursday morning walk-through',
          draftBody: 'Hi Mateo,\n\nThank you for locking the private room at Bar Sprezzatura. I can do the Thursday morning walk-through at [time].\n\nBest,\nAlex',
        },
        {
          id: 'qa_wait06_2',
          label: 'Ask for seating and menu',
          kind: 'reply',
          draftHint: 'Ask Mateo for the seating plan and menu before the walk-through',
          draftBody: 'Hi Mateo,\n\nThanks for the update on the 14 founders and co-investors. Can you share the seating plan and menu before the Thursday morning walk-through?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_01', 'thr_rec_02', 'thr_dec_02'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_ref_01',
      ...meta('acc_studio'),
      subject: 'Q1 Studio Offsite: Hudson Valley vs Sea Ranch Shortlist',
      snippet: 'Devon narrowed the February retreat to Troutbeck (Hudson Valley) and Sea Ranch Lodge.',
      participants: [
        { name: 'Devon Takahashi', email: 'devon@meridianstudio.co' },
        { name: 'Alex Chen', email: 'alex@meridianstudio.co' },
      ],
      messageCount: 1,
      lastMessageAt: hoursAgo(26),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Team', 'Offsite'],
      bucket: 'waiting',
      urgencyScore: 77,
      distilledAsk: 'Pick Troutbeck or Sea Ranch',
      goalQuote: 'Which one gets your vote?',
      aiSummaryBullets: [
        'Troutbeck is easy to reach by train.',
        'Sea Ranch has the better light but means a flight.',
      ],
      deadlineAt: null,
      deadlineLabel: 'Monday',
      quickActions: [
        {
          id: 'qa_ref01_1',
          label: 'Vote for Sea Ranch',
          kind: 'reply',
          draftHint: 'Vote for Sea Ranch Lodge',
          draftBody: 'Hi Devon,\n\nMy vote is Sea Ranch Lodge, for the architectural light. Let\'s pick a winner over coffee next Monday.\n\nBest,\nAlex',
        },
        {
          id: 'qa_ref01_2',
          label: 'Vote for Troutbeck',
          kind: 'reply',
          draftHint: 'Vote for Troutbeck',
          draftBody: 'Hi Devon,\n\nMy vote is Troutbeck, for the easy train access. Let\'s pick a winner over coffee next Monday.\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'approved',
    },

    // --- 4 FIRST-TIME SENDERS IN SCREENER ---
    {
      id: 'thr_scr_01',
      ...meta('acc_ventures'),
      subject: 'Hello from Veridian Robotics (via Daniel Park)',
      snippet: 'Samira Patel sharing Veridian Robotics Series A teaser (1.2M live autonomous warehouse picks) per Daniel Park\'s intro.',
      participants: [{ name: 'Samira Patel', email: 'samira@veridianrobotics.ai' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(5.2),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Screener', 'Robotics'],
      bucket: 'screener',
      urgencyScore: 76,
      distilledAsk: 'Give Samira 20 minutes of feedback',
      goalQuote: 'I would love to share a 2-page technical overview and get 20 minutes of your candid feedback',
      aiSummaryBullets: [
        'Daniel Park sent her your way.',
        'Her warehouse robots are already working.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [
        {
          id: 'qa_scr01_1',
          label: 'Suggest a time',
          kind: 'approve',
          draftHint: 'Thank Samira and suggest a time to talk about her overview',
          draftBody: 'Hi Samira,\n\nThank you for reaching out. I would be glad to talk about your overview. Does [day and time] work for you?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_06'],
      senderTrust: 'screener',
    },
    {
      id: 'thr_scr_02',
      ...meta('acc_studio'),
      subject: 'Keynote Speaker Invitation: Design Systems Summit 2027',
      snippet: 'Program chair Nadia Brooks inviting you to deliver a 25-minute main-stage keynote in San Francisco (March 18-19).',
      participants: [{ name: 'Nadia Brooks', email: 'nadia@ds-summit.org' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(11),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Screener', 'Speaking'],
      bucket: 'screener',
      urgencyScore: 48,
      distilledAsk: 'Take a 10\u2011minute call next week',
      goalQuote: 'Would you be open to a quick 10-minute call next week?',
      aiSummaryBullets: [
        'A 900-person design conference in San Francisco.',
        'They want a 10 minute call next week.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [
        {
          id: 'qa_scr02_1',
          label: 'Accept intro call',
          kind: 'schedule',
          draftHint: 'Thank Nadia for the invitation and offer a time for the 10-minute call next week',
          draftBody: 'Hi Nadia,\n\nThank you for the invitation. I would be glad to have a quick call next week. Does [day and time] work for you?\n\nBest,\nAlex',
        },
      ],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'screener',
    },
    {
      id: 'thr_scr_03',
      ...meta('acc_personal'),
      subject: 'Craft & Type #114: Optical Sizing in Dark-Mode Editorial UI',
      snippet: 'Editorial typography newsletter exploring halation, obsidian dark palettes, and display serif pairings.',
      participants: [{ name: 'Craft & Type Editorial', email: 'dispatch@craftandtype.press' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(14),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Screener', 'Newsletter'],
      bucket: 'screener',
      urgencyScore: 22,
      distilledAsk: null,
      aiSummaryBullets: [
        'A design newsletter worth keeping.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_scr03_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'screener',
    },
    {
      id: 'thr_scr_04',
      ...meta('acc_studio'),
      subject: 'Quick 15-min chat about 10x outbound pipeline for Meridian Studio?',
      snippet: 'Unsolicited cold sales pitch offering automated AI SDR demo booking for creative agencies.',
      participants: [{ name: 'Kyle Henderson', email: 'kyle@hyperleadscale.biz' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(7.5),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Screener', 'Cold Outreach'],
      bucket: 'screener',
      urgencyScore: 10,
      distilledAsk: null,
      aiSummaryBullets: [
        'A cold sales email. Safe to block.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_scr04_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'screener',
    },

    // --- 7 EDITORIAL NEWSLETTERS / FEED THREADS ---
    {
      id: 'thr_feed_01',
      ...meta('acc_personal'),
      subject: 'Spatial Software and the Post-Inbox Interface',
      snippet: 'Why multimodal intelligence enables multiple purpose-built lenses over one calm local-first communication store.',
      participants: [{ name: 'Stratechery Dispatch', email: 'ben@stratechery-digest.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(6),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'Tech Strategy'],
      bucket: 'feed',
      urgencyScore: 28,
      distilledAsk: null,
      aiSummaryBullets: [
        'Email should separate decisions from noise.',
        'Good AI tools draft quietly in the background.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_feed01_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: ['thr_feed_04'],
      senderTrust: 'feed',
    },
    {
      id: 'thr_feed_02',
      ...meta('acc_studio'),
      subject: 'Dense Discovery #318: Calm Technology & Precision Micro-Tools',
      snippet: 'Local-first SQLite speed (<16ms UI), editorial serif pairings, and architectural dark surfaces.',
      participants: [{ name: 'Dense Discovery', email: 'kai@densediscovery.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(19),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'Design'],
      bucket: 'feed',
      urgencyScore: 26,
      distilledAsk: null,
      aiSummaryBullets: [
        'Picks on calm technology and fast apps.',
        'Plus new type and design finds.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_feed02_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'feed',
    },
    {
      id: 'thr_feed_03',
      ...meta('acc_ventures'),
      subject: 'StrictlyVC Morning Brief: Applied AI Seed Extensions Accelerate',
      snippet: 'Vertical AI teams past $1M ARR are raising $2M-$4M insider extensions in under 10 days; robotics deployments up 64%.',
      participants: [{ name: 'StrictlyVC Brief', email: 'briefing@strictlyvc.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(8.5),
      isUnread: true,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'Venture'],
      bucket: 'feed',
      urgencyScore: 25,
      distilledAsk: null,
      aiSummaryBullets: [
        'Early AI startups are raising extra seed rounds.',
        'Warehouse robot rollouts grew 64% this year.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_feed03_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_02', 'thr_scr_01'],
      senderTrust: 'feed',
    },
    {
      id: 'thr_feed_04',
      ...meta('acc_studio'),
      subject: 'Crafting Keyboard-First Flows Without Alienating Mouse Users',
      snippet: 'Pairing quiet keycap hints, command palettes, and instant reversible undo toasts for effortless speed.',
      participants: [{ name: 'Linear Method Notes', email: 'notes@linear-method.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(32),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'Product Craft'],
      bucket: 'feed',
      urgencyScore: 22,
      distilledAsk: null,
      aiSummaryBullets: [
        'Show keyboard shortcuts right where people work.',
        'Every bulk action needs a preview and undo.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_feed04_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: ['thr_feed_01'],
      senderTrust: 'feed',
    },
    {
      id: 'thr_feed_05',
      ...meta('acc_personal'),
      subject: 'Adaptive Reuse: Daylight, Flush Steel Lintels & Warm Timber',
      snippet: 'Case study on recessing wide-flange steel beams into ceiling joists to preserve unbroken daylight planes.',
      participants: [{ name: 'Architectural Review Dispatch', email: 'dispatch@archreview.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(44),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'Architecture'],
      bucket: 'feed',
      urgencyScore: 19,
      distilledAsk: null,
      aiSummaryBullets: [
        'Hidden steel beams make rooms feel taller.',
        'It backs up Elena\'s beam advice for your kitchen.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_feed05_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: ['thr_dec_04'],
      senderTrust: 'feed',
    },
    {
      id: 'thr_feed_06',
      ...meta('acc_ventures'),
      subject: 'Silicon Weekly: Latency Budgets for Real-Time Edge Robotics',
      snippet: 'Sub-25ms closed-loop vision-language-action inference reaches commercial warehouse deployments.',
      participants: [{ name: 'Silicon Weekly', email: 'editor@siliconweekly.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(52),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'Hardware'],
      bucket: 'feed',
      urgencyScore: 21,
      distilledAsk: null,
      aiSummaryBullets: [
        'Robot models now run fast on small chips.',
        'Touch data may be the next big advantage.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_feed06_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: ['thr_scr_01'],
      senderTrust: 'feed',
    },
    {
      id: 'thr_ref_03',
      ...meta('acc_personal'),
      subject: 'macOS Human Interface Notes: Vibrancy, Depth & Dark Surfaces',
      snippet: 'Design guidance on translucent sidebars, hairline borders, and restrained accent color usage.',
      participants: [{ name: 'Apple Developer Digest', email: 'news@developer-updates.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(62),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Editorial', 'macOS'],
      bucket: 'feed',
      urgencyScore: 18,
      distilledAsk: null,
      aiSummaryBullets: [
        'Use soft layers and thin lines for depth.',
        'Save bright colors for what matters.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_ref03_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: null,
      relatedThreadIds: [],
      senderTrust: 'feed',
    },

    // --- 9 PAPER TRAIL / RECEIPTS, INVOICES & TRAVEL ---
    {
      id: 'thr_rec_01',
      ...meta('acc_studio'),
      subject: 'AWS Monthly Cloud Infrastructure Invoice #AWS-2026-1142 ($1,850.00)',
      snippet: 'November AWS statement for Meridian Studio production clusters: $1,850.00 USD (PDF attached).',
      participants: [{ name: 'Amazon Web Services', email: 'billing@aws-notifications.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(10),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Receipt', 'Cloud', 'Tax Deductible'],
      bucket: 'paper_trail',
      urgencyScore: 36,
      distilledAsk: null,
      aiSummaryBullets: [
        'Paid $1,850 for this month\'s cloud hosting.',
        'Rachel needs it for your Q4 taxes.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_rec01_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Amazon Web Services',
        amount: 1850.0,
        currency: 'USD',
        category: 'SaaS & Cloud',
        invoiceNumber: 'AWS-2026-1142',
      },
      relatedThreadIds: ['thr_wait_05'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_02',
      ...meta('acc_personal'),
      subject: 'Flight Confirmation DL-8K49MP: JFK to SFO (Dec 9 - Dec 13)',
      snippet: 'Delta nonstop JFK -> SFO (Seat 4A) departing Wed Dec 9 at 1:15 PM. Total paid: $628.40 USD.',
      participants: [{ name: 'Delta Air Lines', email: 'confirmations@delta-air.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(20),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Travel', 'San Francisco', 'Receipt'],
      bucket: 'paper_trail',
      urgencyScore: 48,
      distilledAsk: 'Check in 24 hours before the flight',
      goalQuote: 'Online check-in opens 24 hours before each flight in the Fly Delta app.',
      aiSummaryBullets: [
        'Round trip JFK to SFO, Dec 9 to 13.',
        'It lines up with the keynote and dinner.',
      ],
      deadlineAt: onDay(12, 8, 13, 15),
      deadlineLabel: 'Dec 8 1:15 PM',
      quickActions: [{ id: 'qa_rec02_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Delta Air Lines',
        amount: 628.4,
        currency: 'USD',
        category: 'Travel',
        invoiceNumber: 'DL-8K49MP',
      },
      relatedThreadIds: ['thr_dec_01', 'thr_wait_06', 'thr_wait_01'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_03',
      ...meta('acc_ventures'),
      subject: 'Anthropic API Receipt #ANT-904821 ($142.00)',
      snippet: 'November Claude API diligence workspace payment receipt: $142.00 USD.',
      participants: [{ name: 'Anthropic Billing', email: 'billing@anthropic-receipts.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(27),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Receipt', 'AI', 'Tax Deductible'],
      bucket: 'paper_trail',
      urgencyScore: 34,
      distilledAsk: null,
      aiSummaryBullets: [
        'Paid $142 for November API usage.',
        'Send it to Rachel with the Q4 taxes.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_rec03_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Anthropic',
        amount: 142.0,
        currency: 'USD',
        category: 'SaaS & Cloud',
        invoiceNumber: 'ANT-904821',
      },
      relatedThreadIds: ['thr_wait_05'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_04',
      ...meta('acc_studio'),
      subject: 'Figma Organization Monthly Receipt #FG-77219 ($49.00)',
      snippet: 'Monthly Figma Organization seat receipt for Meridian Studio: $49.00 USD.',
      participants: [{ name: 'Figma Billing', email: 'billing@figma-receipts.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(34),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Receipt', 'SaaS'],
      bucket: 'paper_trail',
      urgencyScore: 30,
      distilledAsk: null,
      aiSummaryBullets: [
        'Paid $49 for one more seat.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_rec04_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Figma',
        amount: 49.0,
        currency: 'USD',
        category: 'SaaS & Cloud',
        invoiceNumber: 'FG-77219',
      },
      relatedThreadIds: [],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_05',
      ...meta('acc_personal'),
      subject: 'Invoice #PAS-408: Permit Submission Milestone ($3,400.00)',
      snippet: 'Pacific Architectural Studio Milestone 2 permit drawings invoice paid via ACH ($3,400.00).',
      participants: [{ name: 'Pacific Architectural Studio', email: 'billing@pacificarch.studio' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(56),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Invoice', 'Home Remodel'],
      bucket: 'paper_trail',
      urgencyScore: 38,
      distilledAsk: null,
      aiSummaryBullets: [
        'Paid $3,400 for the permit package.',
        'The $2,850 beam change is still open.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_rec05_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Pacific Architectural Studio',
        amount: 3400.0,
        currency: 'USD',
        category: 'Invoices',
        invoiceNumber: 'PAS-408',
      },
      relatedThreadIds: ['thr_dec_04'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_06',
      ...meta('acc_personal'),
      subject: 'Reservation Receipt #STW-9914: Stowe Timberline Chalet ($1,240.00)',
      snippet: 'Deposit receipt for Jan 15-18 Stowe mountain chalet reservation ($1,240.00 USD).',
      participants: [{ name: 'Timberline Chalet Stowe', email: 'reservations@timberlinestowe.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(64),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Travel', 'Receipt', 'Stowe'],
      bucket: 'paper_trail',
      urgencyScore: 35,
      distilledAsk: null,
      aiSummaryBullets: [
        'Paid the $1,240 deposit for Jan 15 to 18.',
        'The door code arrives two days before.',
      ],
      deadlineAt: null,
      deadlineLabel: 'Jan 15',
      quickActions: [{ id: 'qa_rec06_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Timberline Chalet Stowe',
        amount: 1240.0,
        currency: 'USD',
        category: 'Travel',
        invoiceNumber: 'STW-9914',
      },
      relatedThreadIds: ['thr_dec_07'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_07',
      ...meta('acc_studio'),
      subject: 'Linear Workspace Renewal Receipt #LIN-55102 ($288.00)',
      snippet: 'Meridian Studio annual Linear Plus renewal paid ($288.00 USD).',
      participants: [{ name: 'Linear Billing', email: 'receipts@linear-billing.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(78),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Receipt', 'SaaS'],
      bucket: 'paper_trail',
      urgencyScore: 29,
      distilledAsk: null,
      aiSummaryBullets: [
        'Renewed three Linear seats for $288.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_rec07_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Linear',
        amount: 288.0,
        currency: 'USD',
        category: 'SaaS & Cloud',
        invoiceNumber: 'LIN-55102',
      },
      relatedThreadIds: [],
      senderTrust: 'approved',
    },
    {
      id: 'thr_rec_08',
      ...meta('acc_studio'),
      subject: 'Commercial Font License Confirmation #MT-20918 ($420.00)',
      snippet: 'Monotype commercial print & web font license for Solis Health packaging ($420.00 USD).',
      participants: [{ name: 'Monotype Foundry', email: 'orders@monotype-store.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(29),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Receipt', 'Solis Health', 'Design'],
      bucket: 'paper_trail',
      urgencyScore: 31,
      distilledAsk: null,
      aiSummaryBullets: [
        'Font license covers 50,000 cartons and the website.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_rec08_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Monotype Foundry',
        amount: 420.0,
        currency: 'USD',
        category: 'Purchases',
        invoiceNumber: 'MT-20918',
      },
      relatedThreadIds: ['thr_dec_03'],
      senderTrust: 'approved',
    },
    {
      id: 'thr_ref_02',
      ...meta('acc_ventures'),
      subject: 'Carta Q4 Cap Table Export & Admin Statement #CRT-88412 ($350.00)',
      snippet: 'Q4 fund administration statement ($350.00) and updated Northstar Ventures cap table export attached.',
      participants: [{ name: 'Carta Fund Admin', email: 'notifications@carta-admin.example' }],
      messageCount: 1,
      lastMessageAt: hoursAgo(42),
      isUnread: false,
      isStarred: false,
      isArchived: false,
      isSnoozedUntil: null,
      labels: ['Invoice', 'LP Reporting'],
      bucket: 'paper_trail',
      urgencyScore: 33,
      distilledAsk: null,
      aiSummaryBullets: [
        'Paid the $350 quarterly fund admin fee.',
        'Tessa needs this for her Q4 numbers.',
      ],
      deadlineAt: null,
      deadlineLabel: null,
      quickActions: [{ id: 'qa_ref02_1', label: 'Archive', kind: 'archive' }],
      receiptInfo: {
        vendor: 'Carta',
        amount: 350.0,
        currency: 'USD',
        category: 'Invoices',
        invoiceNumber: 'CRT-88412',
      },
      relatedThreadIds: ['thr_wait_02'],
      senderTrust: 'approved',
    },
  ];

  // =========================================================================
  // 5 COMMITMENT RADAR ITEMS (2 you_promised + 3 waiting_on_them)
  // =========================================================================
  const commitments: CommitmentItem[] = [
    {
      id: 'com_01',
      threadId: 'thr_wait_04',
      accountId: 'acc_studio',
      accountColor: '#38bdf8',
      accountLabel: 'Studio',
      direction: 'you_promised',
      counterpartyName: 'Owen Alvarez',
      counterpartyEmail: 'owen@meridianstudio.co',
      summary: 'Send Owen the interview scorecards',
      promiseQuote: 'I will send you my scorecard notes on Lina and Theo before Thursday morning.',
      dueLabel: 'Due Thu AM',
      daysOpen: 1,
      status: 'open',
      suggestedNudgeDraft:
        'Hi Owen,\n\nA quick update on my scorecard notes for Lina and Theo: I will send them before Thursday morning.\n\nBest,\nAlex',
    },
    {
      id: 'com_02',
      threadId: 'thr_wait_05',
      accountId: 'acc_personal',
      accountColor: '#34d399',
      accountLabel: 'Personal',
      direction: 'you_promised',
      counterpartyName: 'Rachel Goldstein, CPA',
      counterpartyEmail: 'rachel@harborcpa.com',
      summary: 'Upload tax papers to Rachel\'s portal',
      promiseQuote: 'I will upload the K-1 summary and the AWS and Anthropic statements to your portal by Friday.',
      dueLabel: 'Due Friday',
      daysOpen: 1,
      status: 'open',
      suggestedNudgeDraft:
        'Hi Rachel,\n\nA quick update on the K-1 summary and the AWS and Anthropic statements: I will upload them to your portal by Friday.\n\nBest,\nAlex',
    },
    {
      id: 'com_03',
      threadId: 'thr_wait_01',
      accountId: 'acc_studio',
      accountColor: '#38bdf8',
      accountLabel: 'Studio',
      direction: 'waiting_on_them',
      counterpartyName: 'Marcus Reid',
      counterpartyEmail: 'marcus@luminaav.io',
      summary: 'The revised lighting quote',
      dueLabel: '4 days waiting',
      daysOpen: 4,
      status: 'open',
      suggestedNudgeDraft:
        'Hi Marcus,\n\nA quick follow-up on the revised itemized quote under $4,200. I need it to sign off with Maya. Could you send it over?\n\nBest,\nAlex',
    },
    {
      id: 'com_04',
      threadId: 'thr_wait_02',
      accountId: 'acc_ventures',
      accountColor: '#f59e0b',
      accountLabel: 'Ventures',
      direction: 'waiting_on_them',
      counterpartyName: 'Tessa Holloway',
      counterpartyEmail: 'tessa@northstarventures.io',
      summary: 'The Q4 numbers',
      dueLabel: '4 days waiting',
      daysOpen: 4,
      status: 'open',
      suggestedNudgeDraft:
        'Hi Tessa,\n\nA quick follow-up: could you send the finalized net IRR table and the remaining dry powder figure? I need them to finish the Q4 LP letter and confirm Kestrel AI\'s $75k bridge check.\n\nBest,\nAlex',
    },
    {
      id: 'com_05',
      threadId: 'thr_wait_03',
      accountId: 'acc_studio',
      accountColor: '#38bdf8',
      accountLabel: 'Studio',
      direction: 'waiting_on_them',
      counterpartyName: 'Claire Bennett',
      counterpartyEmail: 'cbennett@meridianlegal.com',
      summary: 'The clean contract redline',
      dueLabel: '5 days waiting',
      daysOpen: 5,
      status: 'open',
      suggestedNudgeDraft:
        'Hi Claire,\n\nChecking in on the clean markup for Solis Health\'s Section 9 redline. Could you send it when it is ready so I can return it to Jordan\'s team?\n\nBest,\nAlex',
    },
  ];

  // =========================================================================
  // 4 FIRST-TIME SENDERS IN SCREENER
  // =========================================================================
  const screener: ScreenerSender[] = [
    {
      email: 'samira@veridianrobotics.ai',
      name: 'Samira Patel',
      domain: 'veridianrobotics.ai',
      accountId: 'acc_ventures',
      accountColor: '#f59e0b',
      firstSeenAt: hoursAgo(5.2),
      sampleSubject: 'Hello from Veridian Robotics (via Daniel Park)',
      sampleSnippet: 'Warm intro via Daniel Park with Series A teaser covering 1.2M autonomous warehouse picks.',
      threadIds: ['thr_scr_01'],
      aiRecommendation: 'approve',
      aiReason: 'A warm introduction from Daniel Park.',
      status: 'pending',
    },
    {
      email: 'nadia@ds-summit.org',
      name: 'Nadia Brooks',
      domain: 'ds-summit.org',
      accountId: 'acc_studio',
      accountColor: '#38bdf8',
      firstSeenAt: hoursAgo(11),
      sampleSubject: 'Keynote Speaker Invitation: Design Systems Summit 2027',
      sampleSnippet: 'Main-stage 25-minute keynote invitation in San Francisco with full travel and honorarium.',
      threadIds: ['thr_scr_02'],
      aiRecommendation: 'approve',
      aiReason: 'A real speaking invitation from a design conference.',
      status: 'pending',
    },
    {
      email: 'dispatch@craftandtype.press',
      name: 'Craft & Type Editorial',
      domain: 'craftandtype.press',
      accountId: 'acc_personal',
      accountColor: '#34d399',
      firstSeenAt: hoursAgo(14),
      sampleSubject: 'Craft & Type #114: Optical Sizing in Dark-Mode Editorial UI',
      sampleSnippet: 'Illustrated typography essay on dark-mode halation and serif headline pairings.',
      threadIds: ['thr_scr_03'],
      aiRecommendation: 'feed',
      aiReason: 'A thoughtful design newsletter, best kept in Newsletters.',
      status: 'pending',
    },
    {
      email: 'kyle@hyperleadscale.biz',
      name: 'Kyle Henderson',
      domain: 'hyperleadscale.biz',
      accountId: 'acc_studio',
      accountColor: '#38bdf8',
      firstSeenAt: hoursAgo(7.5),
      sampleSubject: 'Quick 15-min chat about 10x outbound pipeline for Meridian Studio?',
      sampleSnippet: 'Automated cold outreach pitching outsourced AI SDR pods for agency demos.',
      threadIds: ['thr_scr_04'],
      aiRecommendation: 'mute',
      aiReason: 'A mass cold sales email from an unknown company.',
      status: 'pending',
    },
  ];

  // =========================================================================
  // 6 EXTRACTED TASKS LINKED TO THREADS
  // =========================================================================
  const tasks: ExtractedTask[] = [
    {
      id: 'tsk_01',
      threadId: 'thr_dec_01',
      accountId: 'acc_studio',
      title: 'Sign the venue addendum',
      dueLabel: 'Today 4:00 PM',
      completed: false,
      priority: 'high',
    },
    {
      id: 'tsk_02',
      threadId: 'thr_dec_02',
      accountId: 'acc_ventures',
      title: 'Confirm your $75,000 investment',
      dueLabel: 'Today 5:30 PM',
      completed: false,
      priority: 'high',
    },
    {
      id: 'tsk_03',
      threadId: 'thr_dec_03',
      accountId: 'acc_studio',
      title: 'Approve the packaging proof',
      dueLabel: 'Tomorrow noon',
      completed: false,
      priority: 'high',
    },
    {
      id: 'tsk_04',
      threadId: 'thr_dec_04',
      accountId: 'acc_personal',
      title: 'Approve the $2,850 beam change',
      dueLabel: 'Tomorrow 3:00 PM',
      completed: false,
      priority: 'medium',
    },
    {
      id: 'tsk_05',
      threadId: 'thr_wait_04',
      accountId: 'acc_studio',
      title: 'Send Owen the interview scorecards',
      dueLabel: 'Thu AM',
      completed: false,
      priority: 'medium',
    },
    {
      id: 'tsk_06',
      threadId: 'thr_wait_05',
      accountId: 'acc_personal',
      title: 'Upload tax papers to Rachel\'s portal',
      dueLabel: 'Friday',
      completed: false,
      priority: 'low',
    },
  ];

  // =========================================================================
  // STARTER APPROVAL DOCK DRAFTS (SAFE, NEVER AUTO-SENT)
  // =========================================================================
  const drafts: DraftItem[] = [
    {
      id: 'drf_01',
      threadId: 'thr_dec_03',
      accountId: 'acc_studio',
      toEmails: ['jordan@solishealth.com'],
      subject: 'Re: Solis Health: Packaging Press Proof & Serif Lockup',
      bodyText:
        'Hi Jordan,\n\nI approve Option B and the updated die-line for the November press run. Please go ahead before tomorrow\'s noon cutoff.\n\nBest,\nAlex',
      tone: 'direct',
      status: 'pending_approval',
      scheduledFor: null,
      createdBy: 'agent',
      createdAt: hoursAgo(0.6),
    },
    {
      id: 'drf_02',
      threadId: 'thr_dec_06',
      accountId: 'acc_ventures',
      toEmails: ['dpark@summitpartners.vc'],
      subject: 'Re: Intro: Samira Patel (Veridian Robotics) - Series A Advisory',
      bodyText:
        'Hi Daniel,\n\nHappy to meet Samira. I can do 30 minutes next week: [first time] or [second time].\n\nBest,\nAlex',
      tone: 'warm',
      status: 'pending_approval',
      scheduledFor: null,
      createdBy: 'agent',
      createdAt: hoursAgo(0.4),
    },
  ];

  // =========================================================================
  // 3 NATURAL-LANGUAGE AGENT RULES
  // =========================================================================
  const rules: AgentRule[] = [
    {
      id: 'rule_01',
      name: 'Quiet Editorial Digests',
      naturalLanguage:
        'Automatically route long-form newsletters, Substacks, and weekly design or VC digests into the Editorial Feed without interrupting the Decision Deck.',
      enabled: true,
      matchCount: 14,
      createdAt: hoursAgo(160),
    },
    {
      id: 'rule_02',
      name: 'Auto-Vault Receipts & Travel',
      naturalLanguage:
        'Extract vendor name, dollar total, and confirmation or invoice numbers from receipts, cloud bills, and flight bookings, then file directly into the Paper Trail Vault.',
      enabled: true,
      matchCount: 9,
      createdAt: hoursAgo(140),
    },
    {
      id: 'rule_03',
      name: 'Elevate Contracts & Deadlines',
      naturalLanguage:
        'Promote any message containing SAFE terms, pro-rata deadlines, legal redlines, or same-day sign-offs to the top of Pulse with an urgent heat-edge.',
      enabled: true,
      matchCount: 6,
      createdAt: hoursAgo(110),
    },
  ];

  // =========================================================================
  // 2 CUSTOM SMART VIEWS
  // =========================================================================
  const customViews: CustomView[] = [
    {
      id: 'view_01',
      name: 'Contracts & Capital',
      icon: 'landmark',
      queryDescription:
        'All threads involving contracts, SAFE allocations, legal redlines, or invoices over $500 across every Gmail account.',
      filterSpec: { keywords: ['contract', 'SAFE', 'invoice', 'addendum', 'pro-rata', 'retainer'] },
      threadIds: [
        'thr_dec_01',
        'thr_dec_02',
        'thr_dec_04',
        'thr_wait_03',
        'thr_rec_01',
        'thr_rec_05',
        'thr_rec_06',
      ],
      createdAt: hoursAgo(90),
    },
    {
      id: 'view_02',
      name: 'SF Keynote Trip (Dec 9-13)',
      icon: 'plane',
      queryDescription:
        'Merged cross-account view for the San Francisco keynote venue, AV quote, Delta flight, and founder dinner.',
      filterSpec: { keywords: ['Atelier Loft', 'SFO', 'Dec 10', 'Sprezzatura', 'Lumina AV'] },
      threadIds: ['thr_dec_01', 'thr_rec_02', 'thr_wait_06', 'thr_wait_01'],
      createdAt: hoursAgo(45),
    },
  ];

  // Compute accurate initial unread counts per account
  for (const acc of accounts) {
    acc.unreadCount = threads.filter(
      (t) => t.accountId === acc.id && t.isUnread && !t.isArchived,
    ).length;
  }

  return {
    accounts,
    threads,
    messages,
    commitments,
    screener,
    tasks,
    drafts,
    rules,
    customViews,
  };
}
