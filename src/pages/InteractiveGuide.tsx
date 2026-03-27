import { useState } from "react";
import Layout from "@/components/Layout";
import ColorChangeCard from "@/components/ui/color-change-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface GuideCard {
  heading: string;
  description: string;
  imgSrc: string;
  content: React.ReactNode;
}

const cards: GuideCard[] = [
  {
    heading: "Taxes",
    description: "Understand BSD, ABSD and other property taxes in Singapore.",
    imgSrc: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
    content: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p className="font-semibold">Buyer's Stamp Duty (BSD)</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>First $180,000 — 1%</li>
          <li>Next $180,000 — 2%</li>
          <li>Next $640,000 — 3%</li>
          <li>Next $500,000 — 4%</li>
          <li>Next $1,500,000 — 5%</li>
          <li>Above $3,000,000 — 6%</li>
        </ul>
        <p className="font-semibold pt-2">Additional Buyer's Stamp Duty (ABSD)</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Citizens — 0% (1st), 20% (2nd), 30% (3rd+)</li>
          <li>PRs — 5% (1st), 30% (2nd+)</li>
          <li>Foreigners — 60% (any)</li>
        </ul>
      </div>
    ),
  },
  {
    heading: "Agent Fees",
    description: "Commission rates for buying, selling and renting property.",
    imgSrc: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
    content: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p className="font-semibold">Buying</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Buyer's agent commission is typically 1% of the purchase price</li>
          <li>For new launches, developer usually pays the agent fee</li>
        </ul>
        <p className="font-semibold pt-2">Selling</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Seller's agent commission is typically 2% of the sale price</li>
          <li>Negotiable depending on property value and market conditions</li>
        </ul>
        <p className="font-semibold pt-2">Renting</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Tenant agent fee: half month's rent (1-year lease) or one month (2-year lease)</li>
          <li>Landlord agent fee: one month's rent (1-year) or two months (2-year)</li>
        </ul>
      </div>
    ),
  },
  {
    heading: "Deposits",
    description: "Security deposit norms and the diplomatic clause explained.",
    imgSrc: "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800&q=80",
    content: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p className="font-semibold">Standard Practice</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>1-year lease — one month's rent as deposit</li>
          <li>2-year lease — two months' rent as deposit</li>
        </ul>
        <p className="font-semibold pt-2">Refund</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Refundable at end of tenancy, subject to deductions for damages</li>
          <li>Landlord must return deposit within 7–14 days of key handover</li>
          <li>Normal wear and tear should not be deducted</li>
        </ul>
        <p className="font-semibold pt-2">Diplomatic Clause</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Allows early termination after 14 months (2-year lease) with 2 months' notice</li>
          <li>Full deposit returned if clause is exercised properly</li>
        </ul>
      </div>
    ),
  },
];

const InteractiveGuide = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <Layout>
      <h2 className="mb-2 text-3xl font-bold tracking-tight">Interactive Guide</h2>
      <p className="mb-8 text-muted-foreground">
        Hover over and click a card to explore key property topics in Singapore.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card, idx) => (
          <ColorChangeCard
            key={card.heading}
            heading={card.heading}
            description={card.description}
            imgSrc={card.imgSrc}
            onClick={() => setOpenIdx(idx)}
          />
        ))}
      </div>

      <Dialog open={openIdx !== null} onOpenChange={() => setOpenIdx(null)}>
        <DialogContent className="max-w-md">
          {openIdx !== null && (
            <>
              <DialogHeader>
                <DialogTitle>{cards[openIdx].heading}</DialogTitle>
                <DialogDescription>{cards[openIdx].description}</DialogDescription>
              </DialogHeader>
              <div className="mt-2">{cards[openIdx].content}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default InteractiveGuide;
