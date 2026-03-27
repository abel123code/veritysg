import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

/* ── Fallback data (used when DB is empty) ── */
const FALLBACK_PHASES = [
  {
    key: "viewing",
    label: "Viewing",
    items: [
      { q: "Artificial scarcity — \"Many people are viewing this unit\"", a: "Agents may imply heavy demand to pressure you into a quick decision. Ask for the actual number of offers received in writing." },
      { q: "Anchoring with a high initial price", a: "By starting high, any subsequent discount feels like a bargain even if the final price is above market value. Always compare with recent transacted prices for the same development." },
      { q: "Selective disclosure of unit flaws", a: "Agents may steer you away from problem areas (water stains, cracks). Do your own thorough walk-through and bring a checklist." },
      { q: "Time-pressure tactics — \"Offer expires today\"", a: "Genuine sellers rarely impose same-day deadlines. Take your time; a good deal tomorrow is better than a bad deal today." },
      { q: "Rapport building to lower your guard", a: "Friendly small-talk is professional, but be wary if the agent pivots from personal chat directly into closing pressure." },
      { q: "Highlighting renovation potential to justify price", a: "\"Just repaint and it's perfect\" can mask costly structural issues. Factor realistic renovation costs into your budget." },
    ],
  },
  {
    key: "negotiation",
    label: "Negotiation",
    items: [
      { q: "Good cop / bad cop with co-agent", a: "One agent plays tough while another seems sympathetic. Recognise the pattern and negotiate on facts, not feelings." },
      { q: "Phantom offers — \"Another buyer just offered more\"", a: "Ask for proof. In Singapore, agents can provide the Option to Purchase (OTP) number if a genuine competing offer exists." },
      { q: "Emotional framing — \"Think of your family here\"", a: "Decisions should be financial first. Reframe every emotional appeal back to price-per-sqft and comparable transactions." },
      { q: "Nibbling — adding small costs after agreement", a: "Watch for last-minute additions like admin fees or furnishing mark-ups that weren't in the original discussion." },
      { q: "Deadline pressure — \"Seller is going overseas\"", a: "Artificial urgency. Verify timelines independently and never rush legal commitments." },
    ],
  },
  {
    key: "receipt",
    label: "Receipt & Closing",
    items: [
      { q: "Rushing the Option to Purchase (OTP) signing", a: "You have the right to review the OTP with a lawyer. Never sign under time pressure — the exercise period exists for a reason." },
      { q: "Downplaying additional costs", a: "Stamp duties, legal fees, and renovation costs can add 5-10% on top. Insist on a full cost breakdown before committing." },
      { q: "Discouraging independent legal advice", a: "\"Our conveyancer will handle everything\" may not protect your interests. Always engage your own lawyer." },
      { q: "Post-agreement pressure to waive conditions", a: "Once you've committed emotionally, agents may push you to drop inspection clauses. Keep all protective conditions." },
    ],
  },
];

const FALLBACK_REGULATIONS = [
  { title: "Buyer's Stamp Duty (BSD)", content: "First $180,000 — 1%\nNext $180,000 — 2%\nNext $640,000 — 3%\nNext $500,000 — 4%\nNext $1,500,000 — 5%\nExceeding $3,000,000 — 6%" },
  { title: "Additional Buyer's Stamp Duty (ABSD)", content: "Singapore Citizens — 0% (1st), 20% (2nd), 30% (3rd+)\nPermanent Residents — 5% (1st), 30% (2nd+)\nForeigners — 60% (any)" },
  { title: "Loan Limits (LTV)", content: "The Loan-to-Value limit for a first housing loan is 75% (up to 55% for HDB loans). For a second outstanding loan, LTV drops to 45%. Total Debt Servicing Ratio (TDSR) must not exceed 55% of gross monthly income." },
  { title: "HDB vs Private Property", content: "HDB Flats:\n• 99-year leasehold, subsidised by government\n• Eligibility: citizenship, income ceiling, 5-year MOP\n• CPF housing grants available for eligible buyers\n\nPrivate Property:\n• Freehold or 99-year leasehold options\n• No income ceiling or citizenship requirements\n• Higher entry cost; no government grants" },
];

const FALLBACK_GLOSSARY: [string, string][] = [
  ["PSF", "Price per square foot"],
  ["MOP", "Minimum Occupation Period (5 yrs for HDB)"],
  ["OTP", "Option to Purchase"],
  ["TOP", "Temporary Occupation Permit"],
  ["CSC", "Certificate of Statutory Completion"],
  ["TDSR", "Total Debt Servicing Ratio (≤ 55%)"],
  ["LTV", "Loan-to-Value ratio"],
];

interface DBTactic { id: string; phase: string; question: string; answer: string; sort_order: number; }
interface DBRegulation { id: string; title: string; content: string; sort_order: number; }
interface DBGlossary { id: string; term: string; definition: string; sort_order: number; }

export default function Guide() {
  const [activePhase, setActivePhase] = useState(0);
  const [phases, setPhases] = useState(FALLBACK_PHASES);
  const [regulations, setRegulations] = useState(FALLBACK_REGULATIONS);
  const [glossaryItems, setGlossaryItems] = useState(FALLBACK_GLOSSARY);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-prompts", {
          body: { action: "get_guide_content" },
        });
        if (error || !data?.success) return;

        // Tactics
        const dbTactics: DBTactic[] = data.tactics || [];
        if (dbTactics.length > 0) {
          const phaseMap: Record<string, { q: string; a: string }[]> = {};
          for (const t of dbTactics) {
            if (!phaseMap[t.phase]) phaseMap[t.phase] = [];
            phaseMap[t.phase].push({ q: t.question, a: t.answer });
          }
          const phaseLabels: Record<string, string> = { viewing: "Viewing", negotiation: "Negotiation", receipt: "Receipt & Closing" };
          const built = ["viewing", "negotiation", "receipt"]
            .filter((k) => phaseMap[k]?.length)
            .map((k) => ({ key: k, label: phaseLabels[k] || k, items: phaseMap[k] }));
          if (built.length > 0) setPhases(built);
        }

        // Regulations
        const dbRegs: DBRegulation[] = data.regulations || [];
        if (dbRegs.length > 0) {
          setRegulations(dbRegs.map((r) => ({ title: r.title, content: r.content })));
        }

        // Glossary
        const dbGloss: DBGlossary[] = data.glossary || [];
        if (dbGloss.length > 0) {
          setGlossaryItems(dbGloss.map((g) => [g.term, g.definition] as [string, string]));
        }
      } catch {
        // Use fallback silently
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <header className="pt-24 pb-16 px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-5xl font-bold tracking-tight"
        >
          The Buyer's Guide
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-4 text-neutral-500 max-w-lg mx-auto text-sm md:text-base leading-relaxed"
        >
          Understand the psychology behind the deal — and the regulations that protect you.
        </motion.p>
      </header>

      <div className="max-w-2xl mx-auto px-6 pb-24">
        {/* ── Phase Tabs ── */}
        <nav className="flex items-center justify-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 p-1 mb-10">
          {phases.map((phase, i) => (
            <button
              key={phase.key}
              onClick={() => setActivePhase(i)}
              className={`relative rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-all ${
                activePhase === i
                  ? "bg-neutral-100 text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {phase.label}
            </button>
          ))}
        </nav>

        {/* ── Tactics Accordion ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phases[activePhase]?.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-xs uppercase tracking-widest text-neutral-600 mb-4">
              Psychological Tactics — {phases[activePhase]?.label}
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {phases[activePhase]?.items.map((item, i) => (
                <AccordionItem key={i} value={`t-${i}`} className="border-neutral-800">
                  <AccordionTrigger className="text-left text-sm text-neutral-300 hover:text-neutral-100 py-4 [&[data-state=open]>svg]:text-neutral-400">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-500 text-sm leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </AnimatePresence>

        {/* ── Divider ── */}
        <div className="my-16 h-px bg-neutral-800" />

        {/* ── Regulations ── */}
        <h2 className="text-xs uppercase tracking-widest text-neutral-600 mb-6">
          Regulations & Duties
        </h2>
        <Accordion type="multiple" className="w-full">
          {regulations.map((reg, i) => (
            <AccordionItem key={i} value={`r-${i}`} className="border-neutral-800">
              <AccordionTrigger className="text-left text-sm text-neutral-300 hover:text-neutral-100 py-4 [&[data-state=open]>svg]:text-neutral-400">
                {reg.title}
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <p className="text-sm text-neutral-400 whitespace-pre-line leading-relaxed">{reg.content}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* ── Divider ── */}
        <div className="my-16 h-px bg-neutral-800" />

        {/* ── Glossary ── */}
        <h2 className="text-xs uppercase tracking-widest text-neutral-600 mb-6">
          Glossary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {glossaryItems.map(([term, def]) => (
            <div key={term} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <dt className="text-sm font-semibold text-neutral-200 mb-1">{term}</dt>
              <dd className="text-xs text-neutral-500 leading-relaxed">{def}</dd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
