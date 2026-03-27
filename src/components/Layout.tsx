import { GooeyNavLink } from "@/components/GooeyNavLink";

const navItems = [
{ to: "/", label: "Fair Buys" },
{ to: "/fair-rents", label: "Fair Rents" },
{ to: "/guide", label: "Guide" },
{ to: "/interactive-guide", label: "Interactive Guide" }];


const Layout = ({ children }: {children: React.ReactNode;}) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        









        
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>);

};

export default Layout;