import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SavedSearch } from "@/data/mockData";

const SavedSearchCard = ({ search }: { search: SavedSearch }) => {
  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="font-semibold">{search.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{search.subtitle}</p>
        </div>
        {search.newCount > 0 && (
          <Badge variant="secondary" className="ml-3 shrink-0">
            {search.newCount} new
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedSearchCard;
